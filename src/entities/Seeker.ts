import { WalletInterface, WalletClient, TopicBroadcaster, LookupResolver, Transaction, TransactionSignature, Signature, Utils, Broadcaster, Script } from '@bsv/sdk'
import { PushDrop } from '@bsv/sdk/script'
import type { EscrowTX, GlobalConfig } from '../constants.js'
import { callContractMethod, contractFromGlobalConfigAndParams, recordsFromAnswer } from '../utils.js'
import { bsv, PubKey, Sig, toByteString } from 'scrypt-ts'
import { EscrowContract } from '../contracts/Escrow.js'
import escrowArtifact from '../../artifacts/Escrow.json' with { type: 'json' }
EscrowContract.loadArtifact(escrowArtifact)

export default class Seeker {
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

  async seek (
    workDescription: string,
    workCompletionDeadline: number,
    bounty: number = 1,
    contractType: 'bid' | 'bounty' = 'bounty'
  ): Promise<void> {
    await this.populateDerivedPublicKey()
    // Override global config with the specified contract type
    const configWithContractType = {
      ...this.globalConfig,
      contractType
    }
    const escrow = contractFromGlobalConfigAndParams(
      configWithContractType,
      this.derivedPublicKey!,
      workDescription,
      workCompletionDeadline
    )
    const { tx } = await this.wallet.createAction({
      description: workDescription,
      outputs: [{
        outputDescription: 'Work completion contract',
        satoshis: contractType === 'bounty' ? bounty : 1,
        lockingScript: escrow.lockingScript.toHex()
      }]
    })
    if (!tx) throw new Error('Transaction data missing from sign action result')
    await this.broadcaster.broadcast(Transaction.fromAtomicBEEF(tx))
  }

  async getMyOpenContracts (): Promise<EscrowTX[]> {
    await this.populateDerivedPublicKey()
    const answer = await this.resolver.query({
      service: this.globalConfig.service,
      query: {
        globalConfig: this.globalConfig,
        seekerKey: this.derivedPublicKey,
        find: 'all-open'
      }
    })
    return recordsFromAnswer(answer)
  }

  async cancelBeforeAccept (escrow: EscrowTX): Promise<void> {
    const { tx } = await callContractMethod(
      this.wallet,
      escrow,
      'seekerCancelsBeforeAccept',
      [this.signatory()]
    )
    if (!tx) throw new Error('Transaction data missing from sign action result')
    await this.broadcaster.broadcast(Transaction.fromAtomicBEEF(tx))
  }

  async increaseBounty (escrow: EscrowTX, increaseBy: number) {
    const { tx } = await callContractMethod(
      this.wallet,
      escrow,
      'increaseBounty',
      [EscrowContract.BOUNTY_INCREASE_ALLOWED_BY_SEEKER, BigInt(increaseBy), this.signatory()],
      escrow.satoshis + increaseBy
    )
    if (!tx) throw new Error('Transaction data missing from sign action result')
    await this.broadcaster.broadcast(Transaction.fromAtomicBEEF(tx))
  }

  async acceptBid (escrow: EscrowTX, bidIndex: number) {
    const { tx } = await callContractMethod(
      this.wallet,
      escrow,
      'acceptBid',
      [EscrowContract.BID_ACCEPTED_BY_SEEKER, this.signatory(), BigInt(bidIndex)],
      escrow.contract.contractType === EscrowContract.TYPE_BID
        ? Number(escrow.contract.bids[bidIndex].bidAmount)
        : escrow.satoshis
    )
    if (!tx) throw new Error('Transaction data missing from sign action result')
    await this.broadcaster.broadcast(Transaction.fromAtomicBEEF(tx))
  }

  async cancelBidApprovalAfterDelay (escrow: EscrowTX) {
    const lockTime = await this.getCurrentLockTime()
    const { tx } = await callContractMethod(
      this.wallet,
      escrow,
      'withdrawBidAcceptance',
      [
        this.signatory(),
        escrow.contract.bids.findIndex(x => (
          x.furnisherKey === escrow.contract.acceptedBid.furnisherKey && x.plans === escrow.contract.acceptedBid.plans
        ))
      ],
      escrow.contract.contractType === EscrowContract.TYPE_BID ? 1 : escrow.satoshis,
      [],
      0xffffffe,
      lockTime
    )
    if (!tx) throw new Error('Transaction data missing from sign action result')
    await this.broadcaster.broadcast(Transaction.fromAtomicBEEF(tx))
  }

  async approveCompletedWork (escrow: EscrowTX) {
    const { tx } = await callContractMethod(
      this.wallet,
      escrow,
      'seekerApprovesWork',
      [this.signatory()],
      escrow.satoshis
    )
    if (!tx) throw new Error('Transaction data missing from sign action result')
    await this.broadcaster.broadcast(Transaction.fromAtomicBEEF(tx))
  }

  async disputeWork (record: EscrowTX, evidence?: number[]) {
    // State must be work-started (timeout expired) or work-submitted
    // Verify state is valid for raising dispute
    if (record.record.status !== 'work-started' && record.record.status !== 'work-submitted') {
      throw new Error(`Cannot raise dispute in current state: ${record.record.status}`)
    }

    // Get current locktime for validation
    const lockTime = await this.getCurrentLockTime()

    // If work-started, verify deadline has expired
    if (record.record.status === 'work-started') {
      if (lockTime <= record.record.workCompletionDeadline) {
        throw new Error('Work completion deadline has not yet expired')
      }
    }

    // Call contract method to raise dispute
    const { tx } = await callContractMethod(
      this.wallet,
      record,
      'seekerRaisesDispute',
      [this.signatory()],
      record.satoshis, // Same satoshis (no payout yet, just state change)
      [],
      0xfffffffe, // Enable locktime
      lockTime
    )

    if (!tx) throw new Error('Transaction data missing from sign action result')

    // Broadcast to overlay network
    await this.broadcaster.broadcast(Transaction.fromAtomicBEEF(tx))

    // TODO: Compose and send dispute message to platform containing TXID and optional evidence
    // This would typically involve:
    // - Creating a dispute record with evidence if provided
    // - Sending to platform's dispute resolution service
    // - Storing dispute details locally for tracking
  }

  async listDisputes (active?: boolean): Promise<{ active: EscrowTX[], historical: any[] }> {
    await this.populateDerivedPublicKey()

    const result: { active: EscrowTX[], historical: any[] } = {
      active: [],
      historical: []
    }

    // Query active disputes from overlay network (if requested)
    if (active === true || active === undefined) {
      try {
        const answer = await this.resolver.query({
          service: this.globalConfig.service,
          query: {
            seekerKey: this.derivedPublicKey,
            find: 'all-disputed'
          }
        })
        result.active = recordsFromAnswer(answer)
      } catch (error) {
        console.warn('Failed to query active disputes from overlay:', error instanceof Error ? error.message : String(error))
        result.active = []
      }
    }

    // Query historical disputes from wallet baskets (if requested)
    if (active === false || active === undefined) {
      try {
        const listResult = await this.wallet.listOutputs({
          basket: 'escrow-disputes',
          tags: ['dispute', 'escrow', 'resolved'],
          include: 'locking scripts'
        })
        const outputs = listResult.outputs

        // Parse dispute records from basket outputs (supports both PushDrop and legacy OP_RETURN)
        result.historical = outputs.map((output: any) => {
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
              if (record.seekerKey === this.derivedPublicKey) {
                return record
              }
              return null
            }
          } catch (error) {
            console.warn('Failed to parse dispute record:', error instanceof Error ? error.message : String(error))
            return null
          }
        }).filter((record: any) => record !== null)
      } catch (error) {
        console.warn('Failed to query historical disputes from basket:', error instanceof Error ? error.message : String(error))
        result.historical = []
      }
    }

    return result
  }

  async reclaimAfterDispute (record: EscrowTX, reconstitute?: boolean): Promise<void> {
    await this.populateDerivedPublicKey()

    // Verify record is in a disputed state or resolved after dispute
    if (
      record.record.status !== 'disputed-by-seeker' &&
      record.record.status !== 'disputed-by-furnisher' &&
      record.record.status !== 'resolved'
    ) {
      throw new Error(`Cannot reclaim - contract not in disputed/resolved state: ${record.record.status}`)
    }

    // Note: The Platform.decideDispute() method creates P2PKH outputs locked to
    // the seeker's and furnisher's public keys. The wallet automatically recognizes
    // and tracks these incoming P2PKH outputs, making them immediately spendable.
    // The overlay network deletes spent UTXOs, so we cannot query for the resolution
    // transaction. Instead, we trust that the wallet has received the payout.

    // Record dispute resolution in basket for history tracking
    const disputeRecord = {
      escrowTxid: record.record.txid,
      escrowOutputIndex: record.record.outputIndex,
      seekerKey: record.record.seekerKey,
      furnisherKey: record.record.acceptedBid.furnisherKey,
      platformKey: record.record.platformKey,
      workDescription: record.record.workDescription,
      disputeStatus: record.record.status,
      resolvedAt: new Date().toISOString(),
      originalBounty: record.satoshis
    }

    try {
      // Store dispute record in wallet basket using PushDrop
      const pushDrop = new PushDrop(this.wallet)
      const dataBytes = Array.from(Buffer.from(JSON.stringify(disputeRecord)))
      const lockingScript = await pushDrop.lock(
        [dataBytes],                      // Data payload
        [2, 'escrow-disputes'],           // Protocol ID
        record.record.txid,               // Key ID (unique per escrow)
        'self',                           // Counterparty
        false,                            // forSelf (locked to counterparty, not self)
        false                             // includeSignature (no signature in locking script)
      )

      await this.wallet.createAction({
        description: `Dispute resolution record: ${record.record.workDescription.substring(0, 50)}`,
        outputs: [{
          satoshis: 1,
          lockingScript: lockingScript.toHex(),
          outputDescription: 'Dispute resolution record',
          basket: 'escrow-disputes',
          tags: ['dispute', 'escrow', 'resolved', 'pushdrop']
        }]
      })
    } catch (error) {
      console.warn('Failed to store dispute record in basket:', error)
    }

    // The P2PKH payout outputs created by Platform.decideDispute() are already
    // in the wallet and automatically spendable. The wallet recognizes them
    // because they're locked to our derived public key.

    // Wallet automatically tracks incoming P2PKH outputs, so no explicit
    // internalization needed - the funds are already available for spending

    console.log('Dispute resolution recorded. Payout outputs are available in wallet.')

    // If reconstitute flag is set, create a new contract with similar parameters
    if (reconstitute) {
      try {
        await this.seek(
          record.record.workDescription,
          record.record.workCompletionDeadline,
          record.satoshis // Use original bounty amount
        )
        console.log('Contract reconstituted with original parameters')
      } catch (error) {
        throw new Error(`Failed to reconstitute contract: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  private async populateDerivedPublicKey () {
    if (typeof this.derivedPublicKey !== 'string') {
      const { publicKey } = await this.wallet.getPublicKey({
        counterparty: 'self',
        protocolID: this.globalConfig.keyDerivationProtocol,
        keyID: '1'
      })
      this.derivedPublicKey = publicKey
    }
  }

  private signatory () {
    return async (preimageHash: number[], scope: number): Promise<Sig> => {
      const { signature } = await this.wallet.createSignature({
        protocolID: this.globalConfig.keyDerivationProtocol,
        keyID: '1',
        counterparty: 'self',
        data: preimageHash
      })
      const rawSignature = Signature.fromDER(signature)
      const txSig = new TransactionSignature(rawSignature.r, rawSignature.s, scope)
      return Sig(toByteString(Utils.toHex(txSig.toChecksigFormat())))
    }
  }

  async getCurrentLockTime (): Promise<number> {
    if (this.globalConfig.delayUnit === 'blocks') {
      const { height } = await this.wallet.getHeight({})
      return height
    } else {
      return Math.floor(Date.now() / 1000)
    }
  }
}
