import { WalletInterface, WalletClient, TopicBroadcaster, LookupResolver, Transaction, TransactionSignature, Signature, Utils, Broadcaster, Script } from '@bsv/sdk'
import { P2PKH, PushDrop } from '@bsv/sdk/script'
import type { EscrowRecord, EscrowTX, GlobalConfig } from '../constants.js'
import { callContractMethod, recordsFromAnswer } from '../utils.js'
import { PubKey, Sig, toByteString } from 'scrypt-ts'
import { EscrowContract } from '../contracts/Escrow.js'
import escrowArtifact from '../../artifacts/Escrow.json' with { type: 'json' }
EscrowContract.loadArtifact(escrowArtifact)

export default class Platform {
  private derivedPublicKey: string | null = null
  private readonly broadcaster: Broadcaster
  private readonly resolver: LookupResolver

  constructor (
    private readonly globalConfig: GlobalConfig,
    private readonly wallet: WalletInterface = new WalletClient('auto', 'localhost'),
    broadcaster: TopicBroadcaster | 'DEFAULT' = 'DEFAULT',
    resolver: LookupResolver | 'DEFAULT' = 'DEFAULT'
  ) {
    if (broadcaster === 'DEFAULT') {
      this.broadcaster = new TopicBroadcaster([globalConfig.topic], {
        networkPreset: globalConfig.networkPreset
      })
    } else {
      this.broadcaster = broadcaster
    }
    if (resolver === 'DEFAULT') {
      this.resolver = new LookupResolver({
        networkPreset: globalConfig.networkPreset
      })
    } else {
      this.resolver = resolver
    }
  }

  async listActiveDisputes (): Promise<EscrowTX[]> {
    await this.populateDerivedPublicKey()
    const answer = await this.resolver.query({
      service: this.globalConfig.service,
      query: {
        platformKey: this.derivedPublicKey,
        find: 'all-disputed'
      }
    })
    return recordsFromAnswer(answer)
  }

  async listHistoricalDisputes (): Promise<any[]> {
    await this.populateDerivedPublicKey()

    try {
      const listResult = await this.wallet.listOutputs({
        basket: 'escrow-disputes',
        tags: ['dispute', 'escrow', 'resolved'],
        include: 'locking scripts'
      })
      const outputs = listResult.outputs

      // Parse dispute records from basket outputs (supports both PushDrop and legacy OP_RETURN)
      const historicalDisputes = outputs.map((output: any) => {
        try {
          const lockingScriptHex = output.lockingScript!
          const lockingScript = Script.fromHex(lockingScriptHex)

          let jsonStr: string
          let record: any

          // Try PushDrop parsing first (new format)
          try {
            const decoded = PushDrop.decode(lockingScript)
            const dataBytes = decoded.fields[0]
            jsonStr = Buffer.from(dataBytes).toString('utf8')
            record = JSON.parse(jsonStr)

            // PushDrop outputs are already locked to our key via BRC-42
            // Wallet.listOutputs() already filtered by our key
            // No additional filtering needed!
            return record
          } catch {
            // Fall back to OP_RETURN parsing (old format - backward compatibility)
            const opFalse = lockingScriptHex.substring(0, 2)
            const opReturn = lockingScriptHex.substring(2, 4)

            if (opFalse !== '00' || opReturn !== '6a') {
              return null
            }

            // Skip the length byte(s) and extract data
            // For data < 76 bytes, it's a single byte length
            const lengthByte = parseInt(lockingScriptHex.substring(4, 6), 16)
            const dataStartIndex = lengthByte < 76 ? 6 : 8 // Simple length vs OP_PUSHDATA1
            const dataHex = lockingScriptHex.substring(dataStartIndex)

            jsonStr = Buffer.from(dataHex, 'hex').toString('utf8')
            record = JSON.parse(jsonStr)

            // For OP_RETURN, we need manual filtering
            if (record.platformKey === this.derivedPublicKey) {
              return record
            }
            return null
          }
        } catch (error) {
          console.warn('Failed to parse dispute record:', error instanceof Error ? error.message : String(error))
          return null
        }
      }).filter((record: any) => record !== null)

      return historicalDisputes
    } catch (error) {
      console.warn('Failed to query historical disputes from basket:', error instanceof Error ? error.message : String(error))
      return []
    }

    // NOTE: This method currently reads dispute records created by Seeker and Furnisher
    // when they call reclaimAfterDispute() and claimAfterDispute().
    // Platform.decideDispute() does not yet store its own dispute decision records.
    // Future enhancement: Platform.decideDispute() should also store detailed decision
    // records (including amountForSeeker, amountForFurnisher, notes, decision rationale)
    // in a separate basket (e.g., 'escrow-decisions') for platform-side tracking.
  }

  async decideDispute (
    record: EscrowRecord,
    amountForSeeker: number,
    amountForFurnisher: number,
    notes: number[]
  ): Promise<void> {
    await this.populateDerivedPublicKey()

    // Verify platform key matches
    if (record.platformKey !== this.derivedPublicKey) {
      throw new Error('Platform key mismatch - not authorized to decide this dispute')
    }

    // Verify state is disputed
    if (record.status !== 'disputed-by-seeker' && record.status !== 'disputed-by-furnisher') {
      throw new Error('Contract is not in disputed state')
    }

    // Get the full escrow transaction
    const escrowTX = await this.getEscrowTX(record)

    // Calculate platform fee
    const platformFee = Math.floor(
      escrowTX.satoshis * record.escrowServiceFeeBasisPoints / 10000
    )

    // Build outputs: seeker payout, furnisher payout, platform fee
    const outputs = []

    if (amountForSeeker > 0) {
      outputs.push({
        satoshis: amountForSeeker,
        lockingScript: new P2PKH().lock(record.seekerKey).toHex(),
        outputDescription: 'Seeker dispute payout'
      })
    }

    if (amountForFurnisher > 0) {
      outputs.push({
        satoshis: amountForFurnisher,
        lockingScript: new P2PKH().lock(record.acceptedBid.furnisherKey).toHex(),
        outputDescription: 'Furnisher dispute payout'
      })
    }

    outputs.push({
      satoshis: platformFee,
      lockingScript: new P2PKH().lock(this.derivedPublicKey).toHex(),
      outputDescription: 'Platform fee'
    })

    // Build otherOutputs ByteString (all outputs after the first two)
    const otherOutputsHex = outputs.slice(2).map(o => o.lockingScript).join('')

    // Call contract method
    const { tx } = await callContractMethod(
      this.wallet,
      escrowTX,
      'resolveDispute',
      [
        1n, // platformResolves = true
        BigInt(amountForSeeker),
        BigInt(amountForFurnisher),
        toByteString(otherOutputsHex), // otherOutputs
        this.signatory(), // platformSig
        'WONTSIGN', // seekerSig (not needed)
        'WONTSIGN' // furnisherSig (not needed)
      ],
      undefined, // No next state output (contract destroyed)
      outputs
    )

    if (!tx) throw new Error('Transaction data missing from sign action result')
    await this.broadcaster.broadcast(Transaction.fromAtomicBEEF(tx))
  }

  private signatory () {
    return async (preimageHash: number[], scope: number): Promise<Sig> => {
      const { signature } = await this.wallet.createSignature({
        protocolID: [2, this.globalConfig.keyDerivationProtocol[1]],
        keyID: '1',
        counterparty: 'self',
        data: preimageHash
      })
      const rawSignature = Signature.fromDER(signature)
      const txSig = new TransactionSignature(rawSignature.r, rawSignature.s, scope)
      return Sig(toByteString(Utils.toHex(txSig.toChecksigFormat())))
    }
  }

  private async getEscrowTX (record: EscrowRecord): Promise<EscrowTX> {
    const answer = await this.resolver.query({
      service: this.globalConfig.service,
      query: {
        txid: record.txid,
        outputIndex: record.outputIndex
      }
    })
    const results = recordsFromAnswer(answer)
    if (results.length === 0) {
      throw new Error('Escrow not found on overlay')
    }
    return results[0]
  }

  private async populateDerivedPublicKey () {
    if (typeof this.derivedPublicKey !== 'string') {
      const { publicKey } = await this.wallet.getPublicKey({
        counterparty: 'self',
        protocolID: [2, this.globalConfig.keyDerivationProtocol[1]],
        keyID: '1'
      })
      this.derivedPublicKey = publicKey
    }
  }
}
