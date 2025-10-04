import { WalletInterface, WalletClient, TopicBroadcaster, LookupResolver, Broadcaster, Signature, TransactionSignature, Utils, Transaction, Script } from '@bsv/sdk'
import { PushDrop } from '@bsv/sdk/script'
import type { EscrowTX, GlobalConfig } from '../constants.js'
import { recordsFromAnswer, callContractMethod } from '../utils.js'
import { PubKey, Sig, toByteString } from 'scrypt-ts'
import { Bid } from '../contracts/Escrow.js'

export default class Furnisher {
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

  async listAvailableWork () {
    await this.populateDerivedPublicKey()
    const answer = await this.resolver.query({
      service: this.globalConfig.service,
      query: {
        globalConfig: this.globalConfig,

        find: 'all-open'
      }
    })
    return recordsFromAnswer(answer)
    // Potentially filter by work type in the future
  }

  async placeBid (escrow: EscrowTX, amount: number, plans: string, timeRequired: number, bond: number) {
    await this.populateDerivedPublicKey()

    console.log('🎯 [Furnisher.placeBid] Starting bid placement:', {
      contractTxid: escrow.record.txid,
      contractOutputIndex: escrow.record.outputIndex,
      utxoRef: `${escrow.record.txid}:${escrow.record.outputIndex}`,
      contractType: escrow.record.contractType,
      contractStatus: escrow.record.status,
      currentSatoshis: escrow.satoshis,
      currentBidsCount: escrow.record.bids.filter(b => b.furnisherKey !== escrow.record.seekerKey).length,
      bidAmount: amount,
      bond,
      timeRequired,
      plans: plans.substring(0, 50) + '...'
    })

    // Find an empty bid slot (empty slots have seekerKey as furnisherKey)
    const emptySlotIndex = escrow.record.bids.findIndex(x => x.furnisherKey === escrow.record.seekerKey)
    if (emptySlotIndex === -1) {
      throw new Error('No empty bid slots available (maximum 4 bids per contract)')
    }

    console.log('📋 [Furnisher.placeBid] Found empty slot:', emptySlotIndex)

    const currentLockTime = await this.getCurrentLockTime()
    const bid: Bid = {
      furnisherKey: PubKey(this.derivedPublicKey!),
      plans: toByteString(plans, true),
      bidAmount: BigInt(amount),
      bond: BigInt(bond),
      timeRequired: BigInt(timeRequired),
      timeOfBid: BigInt(currentLockTime)
    }

    console.log('📝 [Furnisher.placeBid] Constructed bid object:', {
      furnisherKey: this.derivedPublicKey,
      bidAmount: Number(bid.bidAmount),
      bond: Number(bid.bond),
      timeRequired: Number(bid.timeRequired),
      timeOfBid: Number(bid.timeOfBid),
      currentLockTime,
      plansLength: plans.length
    })

    // For TYPE_BID contracts, the contract value stays at 1 satoshi during bidding
    // For TYPE_BOUNTY contracts, the contract holds the bounty amount
    const nextOutputAmount = escrow.record.contractType === 'bid' ? 1 : escrow.satoshis

    console.log('💰 [Furnisher.placeBid] Calculated nextOutputAmount:', {
      contractType: escrow.record.contractType,
      currentSatoshis: escrow.satoshis,
      nextOutputAmount,
      calculation: escrow.record.contractType === 'bid'
        ? '1 satoshi (TYPE_BID during bidding)'
        : `${escrow.satoshis} satoshis (TYPE_BOUNTY)`
    })

    console.log('🔧 [Furnisher.placeBid] Calling callContractMethod...')
    const { tx } = await callContractMethod(
      this.wallet,
      escrow,
      'furnisherPlacesBid',
      [this.signatory(), bid, emptySlotIndex],
      nextOutputAmount,
      undefined, // otherOutputs
      0xfffffffe, // sequenceNumber for BIP68/BIP112 timelock
      Math.floor(Date.now() / 1000) // lockTime: current timestamp
    )
    if (!tx) throw new Error('Transaction data missing from sign action result')

    console.log('✅ [Furnisher.placeBid] Transaction created successfully, broadcasting...')
    await this.broadcaster.broadcast(Transaction.fromAtomicBEEF(tx))
    console.log('🎉 [Furnisher.placeBid] Bid placed and broadcasted successfully!')
  }

  async startWork (escrow: EscrowTX) {
    await this.populateDerivedPublicKey()
    const { tx } = await callContractMethod(
      this.wallet,
      escrow,
      'furnisherStartsWork',
      [this.signatory()],
      escrow.satoshis + Number(escrow.contract.acceptedBid.bond)
    )
    if (!tx) throw new Error('Transaction data missing from sign action result')
    await this.broadcaster.broadcast(Transaction.fromAtomicBEEF(tx))
  }

  async completeWork (escrow: EscrowTX, workCompletionDescriptor: string) {
    await this.populateDerivedPublicKey()
    const { tx } = await callContractMethod(
      this.wallet,
      escrow,
      'furnisherSubmitsWork',
      [this.signatory(), toByteString(workCompletionDescriptor)],
      escrow.satoshis
    )
    if (!tx) throw new Error('Transaction data missing from sign action result')
    await this.broadcaster.broadcast(Transaction.fromAtomicBEEF(tx))
  }

  async claimBounty (escrow: EscrowTX) {
    await this.populateDerivedPublicKey()
    const { tx } = await callContractMethod(
      this.wallet,
      escrow,
      'furnisherClaimsPayment',
      [this.signatory()]
    )
    if (!tx) throw new Error('Transaction data missing from sign action result')
    await this.broadcaster.broadcast(Transaction.fromAtomicBEEF(tx))
  }

  async raiseDispute (record: EscrowTX) {
    // Verify state is work-submitted
    if (record.record.status !== 'work-submitted') {
      throw new Error(`Cannot raise dispute in current state: ${record.record.status}`)
    }

    // Ensure this is our work (furnisher key matches)
    await this.populateDerivedPublicKey()
    if (record.contract.acceptedBid.furnisherKey.toString() !== this.derivedPublicKey) {
      throw new Error('Cannot raise dispute on work submitted by another furnisher')
    }

    // Get current locktime for validation
    const lockTime = await this.getCurrentLockTime()

    // Verify seeker approval deadline has elapsed
    const approvalDeadline = record.record.workCompletionTime + record.record.maxWorkApprovalDelay
    if (lockTime <= approvalDeadline) {
      throw new Error(`Seeker approval deadline has not yet expired. Deadline: ${approvalDeadline}, Current time: ${lockTime}`)
    }

    // Call contract method to raise dispute
    const { tx } = await callContractMethod(
      this.wallet,
      record,
      'furnisherRaisesDispute',
      [this.signatory()],
      record.satoshis, // Same satoshis (no payout yet, just state change)
      [],
      0xfffffffe, // Enable locktime
      lockTime
    )

    if (!tx) throw new Error('Transaction data missing from sign action result')

    // Broadcast to overlay network to update UTXO
    await this.broadcaster.broadcast(Transaction.fromAtomicBEEF(tx))

    // TODO: Notify platform about dispute for resolution
    // This would typically involve:
    // - Creating a dispute record
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
            furnisherKey: this.derivedPublicKey,
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
              if (record.furnisherKey === this.derivedPublicKey) {
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

  async claimAfterDispute (record: EscrowTX): Promise<void> {
    await this.populateDerivedPublicKey()

    // Verify this is our work
    if (record.contract.acceptedBid.furnisherKey.toString() !== this.derivedPublicKey) {
      throw new Error('Cannot claim dispute payout - not the furnisher for this contract')
    }

    // Verify record is in a disputed state or resolved after dispute
    if (
      record.record.status !== 'disputed-by-seeker' &&
      record.record.status !== 'disputed-by-furnisher' &&
      record.record.status !== 'resolved'
    ) {
      throw new Error(`Cannot claim - contract not in disputed/resolved state: ${record.record.status}`)
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
      workCompletionDescription: record.record.workCompletionDescription,
      disputeStatus: record.record.status,
      resolvedAt: new Date().toISOString(),
      originalBounty: record.satoshis,
      bondAmount: record.record.acceptedBid.bond
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
          tags: ['dispute', 'escrow', 'resolved', 'furnisher', 'pushdrop']
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
