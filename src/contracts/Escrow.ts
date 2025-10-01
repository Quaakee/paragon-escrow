import {
  assert,
  ByteString,
  hash256,
  method,
  prop,
  SmartContract,
  SigHash,
  PubKey,
  Sig,
  Utils,
  hash160,
  toByteString,
  FixedArray,
  fill
} from 'scrypt-ts'

export interface Bid {
  furnisherKey: PubKey
  plans: ByteString
  bidAmount: bigint
  bond: bigint
  timeOfBid: bigint
  timeRequired: bigint
}

export class EscrowContract extends SmartContract {
  // Contract types
  static readonly TYPE_BOUNTY: bigint = 1n
  static readonly TYPE_BID: bigint = 2n

  // Contract states
  static readonly STATUS_INITIAL: bigint = 11n
  static readonly STATUS_BID_ACCEPTED: bigint = 12n
  static readonly STATUS_WORK_STARTED: bigint = 13n
  static readonly STATUS_WORK_SUBMITTED: bigint = 14n
  static readonly STATUS_RESOLVED: bigint = 15n
  static readonly STATUS_DISPUTED_BY_SEEKER: bigint = 16n
  static readonly STATUS_DISPUTED_BY_FURNISHER: bigint = 17n

  // Furnisher bonding modes
  static readonly FURNISHER_BONDING_MODE_FORBIDDEN: bigint = 31n
  static readonly FURNISHER_BONDING_MODE_OPTIONAL: bigint = 32n
  static readonly FURNISHER_BONDING_MODE_REQUIRED: bigint = 33n

  // Furnisher selection and approval modes
  static readonly FURNISHER_APPROVAL_MODE_SEEKER: bigint = 41n
  static readonly FURNISHER_APPROVAL_MODE_SEEKER_OR_PLATFORM: bigint = 42n
  static readonly FURNISHER_APPROVAL_MODE_PLATFORM: bigint = 43n

  // Delay units
  static readonly DELAY_UNIT_BLOCKS: bigint = 51n
  static readonly DELAY_UNIT_SECONDS: bigint = 52n

  // Bounty increase allowance modes
  static readonly BOUNTY_INCREASE_FORBIDDEN: bigint = 61n
  static readonly BOUNTY_INCREASE_ALLOWED_BY_SEEKER: bigint = 62n
  static readonly BOUNTY_INCREASE_ALLOWED_BY_PLATFORM: bigint = 63n
  static readonly BOUNTY_INCREASE_ALLOWED_BY_SEEKER_OR_PLATFORM: bigint = 64n
  static readonly BOUNTY_INCREASE_ALLOWED_BY_ANYONE: bigint = 65n

  // Bounty increase cutoff points
  static readonly INCREASE_CUTOFF_BID_ACCEPTANCE: bigint = 71n
  static readonly INCREASE_CUTOFF_START_OF_WORK: bigint = 72n
  static readonly INCREASE_CUTOFF_SUBMISSION_OF_WORK: bigint = 73n
  static readonly INCREASE_CUTOFF_ACCEPTANCE_OF_WORK: bigint = 74n

  // Bid acceptance attribution
  static readonly BID_NOT_YET_ACCEPTED: bigint = 81n
  static readonly BID_ACCEPTED_BY_SEEKER: bigint = 82n
  static readonly BID_ACCEPTED_BY_PLATFORM: bigint = 83n

  @prop(true)
    minAllowableBid: bigint

  @prop(true)
    escrowServiceFeeBasisPoints: bigint

  @prop(true)
    platformAuthorizationRequired: bigint

  @prop(true)
    escrowMustBeFullyDecisive: bigint

  @prop(true)
    bountySolversNeedApproval: bigint

  @prop(true)
    furnisherBondingMode: bigint

  @prop(true)
    requiredBondAmount: bigint

  @prop(true)
    maxWorkStartDelay: bigint

  @prop(true)
    maxWorkApprovalDelay: bigint

  @prop(true)
    delayUnit: bigint

  @prop(true)
    workCompletionDeadline: bigint

  @prop(true)
    approvalMode: bigint

  @prop(true)
    contractType: bigint

  @prop(true)
    contractSurvivesAdverseFurnisherDisputeResolution: bigint

  @prop(true)
    bountyIncreaseAllowanceMode: bigint

  @prop(true)
    bountyIncreaseCutoffPoint: bigint

  @prop(true)
    bids: FixedArray<Bid, 4>

  @prop(true)
    seekerKey: PubKey

  @prop(true)
    platformKey: PubKey

  @prop(true)
    acceptedBid: Bid

  @prop(true)
    bidAcceptedBy: bigint

  @prop(true)
    workCompletionTime: bigint

  @prop(true)
    status: bigint

  @prop(true)
    workDescription: ByteString

  @prop(true)
    workCompletionDescription: ByteString

  constructor (
    seekerKey: PubKey,
    platformKey: PubKey,
    escrowServiceFeeBasisPoints: bigint,
    platformAuthorizationRequired: bigint,
    workDescription: ByteString,
    workCompletionDeadline: bigint,
    minAllowableBid: bigint = 0n,
    bountySolversNeedApproval: bigint = 1n,
    escrowMustBeFullyDecisive: bigint = 1n,
    furnisherBondingMode: bigint = EscrowContract.FURNISHER_BONDING_MODE_OPTIONAL,
    requiredBondAmount: bigint = 0n,
    maxWorkStartDelay: bigint = 144n,
    maxWorkApprovalDelay: bigint = 144n,
    delayUnit: bigint = EscrowContract.DELAY_UNIT_BLOCKS,
    approvalMode: bigint = EscrowContract.FURNISHER_APPROVAL_MODE_SEEKER,
    bountyIncreaseAllowanceMode: bigint = EscrowContract.BOUNTY_INCREASE_FORBIDDEN,
    bountyIncreaseCutoffPoint: bigint = EscrowContract.INCREASE_CUTOFF_BID_ACCEPTANCE,
    contractType: bigint = EscrowContract.TYPE_BID,
    contractSurvivesAdverseFurnisherDisputeResolution: bigint = 0n,
    bids: FixedArray<Bid, 4> = fill(
      {
        furnisherKey: seekerKey,
        bidAmount: 0n,
        timeOfBid: 0n,
        bond: 0n,
        timeRequired: 0n,
        plans: toByteString('')
      },
      4
    )
  ) {
    super(...arguments)

    // Required values in all contracts
    this.seekerKey = seekerKey // Who are you?
    this.platformKey = platformKey // What platform are you using?
    this.escrowServiceFeeBasisPoints = escrowServiceFeeBasisPoints // What do they charge? (in basis points)
    this.platformAuthorizationRequired = platformAuthorizationRequired // Must the platform authorize start-of-work?
    this.workDescription = workDescription // What do you want done?
    this.workCompletionDeadline = workCompletionDeadline // When do you need it by?

    // Optional values
    // Contract configuration
    this.minAllowableBid = minAllowableBid // What's the minimum bid?
    this.bountySolversNeedApproval = bountySolversNeedApproval // Can someone start work without talking to anyone, and the first one done gets the money?
    this.escrowMustBeFullyDecisive = escrowMustBeFullyDecisive // if people mess up, is escrow forced to make an all-or-nothing award?
    this.furnisherBondingMode = furnisherBondingMode // Can bidders offer up collateral for in case they mess up? Is this required?
    this.requiredBondAmount = requiredBondAmount // How much collateral does a bidder need to offer up if this is required? Or if it's a race.
    this.maxWorkStartDelay = maxWorkStartDelay // How long after you accept a bid before the worker needs to post up bond and get started, or else get replaced?
    this.maxWorkApprovalDelay = maxWorkApprovalDelay // After they finish, how long do you have to look at the work before they can file a dispute?
    this.delayUnit = delayUnit // Are times measured in seconds or blocks for this contract?
    this.approvalMode = approvalMode // Who can approve a worker to start work? You, the platform, or either/or?
    this.contractType = contractType // Are you putting up a fixed bounty for this work or accepting bids at different prices to get it done?
    this.contractSurvivesAdverseFurnisherDisputeResolution = contractSurvivesAdverseFurnisherDisputeResolution // If platform finds workers fail, does the contract survive?
    this.bountyIncreaseAllowanceMode = bountyIncreaseAllowanceMode // If this is a bounty contract, who may increase the bounty?
    this.bountyIncreaseCutoffPoint = bountyIncreaseCutoffPoint // When is the latest point where someone may make the bounty higher?

    // State starts at initial, with no bids
    this.status = EscrowContract.STATUS_INITIAL
    this.bids = bids

    // Non-initial values are null
    this.bidAcceptedBy = EscrowContract.BID_NOT_YET_ACCEPTED
    this.acceptedBid = { // Initially empty / placeholder
      furnisherKey: seekerKey,
      bidAmount: 0n,
      timeOfBid: 0n,
      bond: 0n,
      timeRequired: 0n,
      plans: toByteString('')
    }
    this.workCompletionTime = 0n
    this.workCompletionDescription = toByteString('')
  }

  @method()
  public seekerCancelsBeforeAcceptOnChain (seekerSig: Sig) {
    assert(this.status === EscrowContract.STATUS_INITIAL, 'Contract must be in the initial state for a seeker to cancel')
    assert(this.checkSig(seekerSig, this.seekerKey), 'Seeker must sign contract cancellation')
  }

  @method(SigHash.ANYONECANPAY_SINGLE)
  public increaseBountyOnChain (mode: bigint, amount: bigint, sig: Sig) {
    assert(amount > 0n)
    assert(this.contractType === EscrowContract.TYPE_BOUNTY)
    assert(this.bountyIncreaseAllowanceMode !== EscrowContract.BOUNTY_INCREASE_FORBIDDEN)
    if (this.bountyIncreaseAllowanceMode === EscrowContract.BOUNTY_INCREASE_ALLOWED_BY_SEEKER_OR_PLATFORM) {
      assert(
        mode === EscrowContract.BOUNTY_INCREASE_ALLOWED_BY_PLATFORM ||
                mode === EscrowContract.BOUNTY_INCREASE_ALLOWED_BY_SEEKER
      )
    } else {
      assert(mode === this.bountyIncreaseAllowanceMode)
    }

    // Enforce cutoff time
    if (this.bountyIncreaseCutoffPoint === EscrowContract.INCREASE_CUTOFF_BID_ACCEPTANCE) {
      assert(this.status === EscrowContract.STATUS_INITIAL)
    } else if (this.bountyIncreaseCutoffPoint === EscrowContract.INCREASE_CUTOFF_START_OF_WORK) {
      assert(
        this.status === EscrowContract.STATUS_INITIAL ||
                this.status === EscrowContract.STATUS_BID_ACCEPTED
      )
    } else if (this.bountyIncreaseCutoffPoint === EscrowContract.INCREASE_CUTOFF_SUBMISSION_OF_WORK) {
      assert(
        this.status === EscrowContract.STATUS_INITIAL ||
                this.status === EscrowContract.STATUS_BID_ACCEPTED ||
                this.status === EscrowContract.STATUS_WORK_STARTED
      )
    } else if (this.bountyIncreaseCutoffPoint === EscrowContract.INCREASE_CUTOFF_ACCEPTANCE_OF_WORK) {
      assert(
        this.status === EscrowContract.STATUS_INITIAL ||
                this.status === EscrowContract.STATUS_BID_ACCEPTED ||
                this.status === EscrowContract.STATUS_WORK_STARTED ||
                this.status === EscrowContract.STATUS_WORK_SUBMITTED
      )
    }
    if (mode === EscrowContract.BOUNTY_INCREASE_ALLOWED_BY_SEEKER) {
      assert(this.checkSig(sig, this.seekerKey), 'Seeker must sign to increase bounty')
    } else if (mode === EscrowContract.BOUNTY_INCREASE_ALLOWED_BY_PLATFORM) {
      assert(this.checkSig(sig, this.platformKey), 'Platform must sign to increase bounty')
    }
    assert(this.ctx.hashOutputs === hash256(this.buildStateOutput(this.ctx.utxo.value + amount)))
  }

  @method(SigHash.ANYONECANPAY_SINGLE)
  public seekerExtendsWorkDeadlineOnChain (seekerSig: Sig, extension: bigint) {
    assert(extension > 0n)
    if (this.delayUnit === EscrowContract.DELAY_UNIT_BLOCKS) {
      assert(this.workCompletionDeadline + extension < 500000000n)
    } else {
      assert(this.workCompletionDeadline + extension > 500000000n)
    }
    assert(
      this.status === EscrowContract.STATUS_INITIAL ||
            this.status === EscrowContract.STATUS_BID_ACCEPTED ||
            this.status === EscrowContract.STATUS_WORK_STARTED
    )
    this.workCompletionDeadline += extension
    assert(this.checkSig(seekerSig, this.seekerKey), 'Seeker must sign to extend deadline')
    assert(this.ctx.hashOutputs === hash256(this.buildStateOutput(this.ctx.utxo.value)))
  }

  @method()
  seekerExtendsWorkDeadline (seekerSig: Sig, extension: bigint): void {
    this.workCompletionDeadline += extension
  }

  @method(SigHash.ANYONECANPAY_SINGLE)
  public furnisherPlacesBidOnChain (furnisherSig: Sig, bid: Bid, index: bigint) {
    assert(this.status === EscrowContract.STATUS_INITIAL)
    assert(this.bountySolversNeedApproval === 1n)
    assert(this.checkSig(furnisherSig, bid.furnisherKey))
    if (this.contractType === EscrowContract.TYPE_BOUNTY) {
      assert(bid.bidAmount === this.ctx.utxo.value)
    } else {
      assert(bid.bidAmount >= this.minAllowableBid)
    }
    if (this.furnisherBondingMode === EscrowContract.FURNISHER_BONDING_MODE_FORBIDDEN) {
      assert(bid.bond === 0n)
    } else if (this.furnisherBondingMode === EscrowContract.FURNISHER_BONDING_MODE_OPTIONAL) {
      assert(bid.bond >= 0n) // Bonds cannot be below zero, this would allow a worker to withdraw part of the payment when work starts.
    } else {
      assert(bid.bond === this.requiredBondAmount)
      assert(bid.bond >= 0n)
    }
    if (this.contractType === EscrowContract.TYPE_BID) {
      assert(this.ctx.utxo.value === 1n)
    }
    assert(bid.timeRequired > 0n)
    assert(bid.timeOfBid > 0n)
    if (this.delayUnit === EscrowContract.DELAY_UNIT_BLOCKS) {
      assert(bid.timeRequired < 500000000n)
      assert(bid.timeOfBid < 500000000n)
    } else {
      assert(bid.timeRequired > 500000000n)
      assert(bid.timeOfBid > 500000000n)
    }
    this.enforceProperTimeUnits()
    assert(this.ctx.locktime >= bid.timeOfBid)
    assert(this.bids[Number(index)].furnisherKey === this.seekerKey) // Must use an open slot
    this.bids[Number(index)] = bid
    assert(this.ctx.hashOutputs === hash256(this.buildStateOutput(this.ctx.utxo.value)))
  }

  @method()
  furnisherPlacesBid (furnisherSig: Sig, bid: Bid, index: bigint): void {
    this.bids[Number(index)] = bid
  }

  @method(SigHash.ANYONECANPAY_SINGLE)
  public acceptBidOnChain (mode: bigint, sig: Sig, index: bigint) {
    const bid = this.bids[Number(index)]
    assert(this.status === EscrowContract.STATUS_INITIAL)
    assert(this.bountySolversNeedApproval === 1n)
    if (this.approvalMode === EscrowContract.FURNISHER_APPROVAL_MODE_SEEKER_OR_PLATFORM) {
      assert(
        mode === EscrowContract.FURNISHER_APPROVAL_MODE_SEEKER ||
                mode === EscrowContract.FURNISHER_APPROVAL_MODE_PLATFORM
      )
    } else {
      assert(mode === this.approvalMode)
    }
    if (mode === EscrowContract.FURNISHER_APPROVAL_MODE_SEEKER) {
      assert(this.checkSig(sig, this.seekerKey))
      this.bidAcceptedBy = EscrowContract.BID_ACCEPTED_BY_SEEKER
    } else {
      assert(this.checkSig(sig, this.platformKey))
      this.bidAcceptedBy = EscrowContract.BID_ACCEPTED_BY_PLATFORM
    }
    assert(this.ctx.sequence === 0xfffffffen)
    assert(this.ctx.locktime < this.workCompletionDeadline - bid.timeRequired)
    this.status = EscrowContract.STATUS_BID_ACCEPTED
    this.acceptedBid = bid
    if (this.contractType === EscrowContract.TYPE_BID) {
      assert(this.ctx.hashOutputs === hash256(this.buildStateOutput(bid.bidAmount)))
    } else {
      assert(this.ctx.hashOutputs === hash256(this.buildStateOutput(this.ctx.utxo.value)))
    }
  }

  @method()
  acceptBid (mode: bigint, sig: Sig, index: bigint): void {
    const bid = this.bids[Number(index)]
    if (mode === EscrowContract.FURNISHER_APPROVAL_MODE_SEEKER) {
      this.bidAcceptedBy = EscrowContract.BID_ACCEPTED_BY_SEEKER
    } else {
      this.bidAcceptedBy = EscrowContract.BID_ACCEPTED_BY_PLATFORM
    }
    this.status = EscrowContract.STATUS_BID_ACCEPTED
    this.acceptedBid = bid
  }

  @method(SigHash.ANYONECANPAY_SINGLE)
  public withdrawBidAcceptanceOnChain (sig: Sig, index: bigint) {
    assert(this.status === EscrowContract.STATUS_BID_ACCEPTED)
    if (this.bidAcceptedBy === EscrowContract.BID_ACCEPTED_BY_SEEKER) {
      assert(this.checkSig(sig, this.seekerKey))
    } else {
      assert(this.checkSig(sig, this.platformKey))
    }
    if (this.delayUnit === EscrowContract.DELAY_UNIT_BLOCKS) {
      assert((this.acceptedBid).timeOfBid + this.maxWorkStartDelay < 500000000n)
    } else {
      assert((this.acceptedBid).timeOfBid + this.maxWorkStartDelay > 500000000n)
    }
    this.enforceProperTimeUnits()
    assert(this.ctx.locktime > (this.acceptedBid).timeOfBid + this.maxWorkStartDelay)
    assert(this.bids[Number(index)] === this.acceptedBid)
    this.status = EscrowContract.STATUS_INITIAL
    this.acceptedBid = { // Initially empty / placeholder
      furnisherKey: this.seekerKey,
      bidAmount: 0n,
      timeOfBid: 0n,
      bond: 0n,
      timeRequired: 0n,
      plans: toByteString('')
    }
    this.bids[Number(index)] = { // Free up the slot
      furnisherKey: this.seekerKey,
      bidAmount: 0n,
      timeOfBid: 0n,
      bond: 0n,
      timeRequired: 0n,
      plans: toByteString('')
    }
    this.bidAcceptedBy = EscrowContract.BID_NOT_YET_ACCEPTED
    if (this.contractType === EscrowContract.TYPE_BID) {
      assert(this.ctx.hashOutputs === hash256(this.buildStateOutput(1n))) // Force bid amount to be withdrawn
    } else {
      assert(this.ctx.hashOutputs === hash256(this.buildStateOutput(this.ctx.utxo.value)))
    }
  }

  @method()
  withdrawBidAcceptance (sig: Sig, index: bigint): void {
    this.status = EscrowContract.STATUS_INITIAL
    this.acceptedBid = { // Initially empty / placeholder
      furnisherKey: this.seekerKey,
      bidAmount: 0n,
      timeOfBid: 0n,
      bond: 0n,
      timeRequired: 0n,
      plans: toByteString('')
    }
    this.bids[Number(index)] = { // Free up the slot
      furnisherKey: this.seekerKey,
      bidAmount: 0n,
      timeOfBid: 0n,
      bond: 0n,
      timeRequired: 0n,
      plans: toByteString('')
    }
    this.bidAcceptedBy = EscrowContract.BID_NOT_YET_ACCEPTED
  }

  @method(SigHash.ANYONECANPAY_SINGLE)
  public rejectBidOnChain (mode: bigint, sig: Sig, index: bigint) {
    assert(this.status === EscrowContract.STATUS_INITIAL)
    if (this.approvalMode === EscrowContract.FURNISHER_APPROVAL_MODE_SEEKER_OR_PLATFORM) {
      assert(
        mode === EscrowContract.FURNISHER_APPROVAL_MODE_SEEKER ||
                mode === EscrowContract.FURNISHER_APPROVAL_MODE_PLATFORM
      )
    } else {
      assert(mode === this.approvalMode)
    }
    if (mode === EscrowContract.FURNISHER_APPROVAL_MODE_SEEKER) {
      assert(this.checkSig(sig, this.seekerKey))
    } else {
      assert(this.checkSig(sig, this.platformKey))
    }
    this.bids[Number(index)] = { // Free up the slot
      furnisherKey: this.seekerKey,
      bidAmount: 0n,
      timeOfBid: 0n,
      bond: 0n,
      timeRequired: 0n,
      plans: toByteString('')
    }
    assert(this.ctx.hashOutputs === hash256(this.buildStateOutput(this.ctx.utxo.value)))
  }

  @method()
  rejectBid (mode: bigint, sig: Sig, index: bigint): void {
    this.bids[Number(index)] = { // Free up the slot
      furnisherKey: this.seekerKey,
      bidAmount: 0n,
      timeOfBid: 0n,
      bond: 0n,
      timeRequired: 0n,
      plans: toByteString('')
    }
  }

  @method(SigHash.ANYONECANPAY_SINGLE)
  public furnisherStartsWorkOnChain (furnisherSig: Sig) {
    assert(this.status === EscrowContract.STATUS_BID_ACCEPTED)
    assert(this.platformAuthorizationRequired === 0n)
    assert(this.bountySolversNeedApproval === 1n)
    assert(this.checkSig(furnisherSig, (this.acceptedBid).furnisherKey))
    this.status = EscrowContract.STATUS_WORK_STARTED
    assert(this.ctx.hashOutputs === hash256(this.buildStateOutput(this.ctx.utxo.value + (this.acceptedBid).bond)))
  }

  @method()
  furnisherStartsWork (furnisherSig: Sig): void {
    this.status = EscrowContract.STATUS_WORK_STARTED
  }

  @method(SigHash.ANYONECANPAY_SINGLE)
  public furnisherStartsWorkWithPlatformAuthorizationOnChain (furnisherSig: Sig, platformSig: Sig) {
    assert(this.status === EscrowContract.STATUS_BID_ACCEPTED)
    assert(this.platformAuthorizationRequired === 1n)
    assert(this.bountySolversNeedApproval === 1n)
    assert(this.checkSig(furnisherSig, (this.acceptedBid).furnisherKey))
    assert(this.checkSig(platformSig, this.platformKey))
    this.status = EscrowContract.STATUS_WORK_STARTED
    assert(this.ctx.hashOutputs === hash256(this.buildStateOutput(this.ctx.utxo.value + (this.acceptedBid).bond)))
  }

  @method()
  furnisherStartsWorkWithPlatformAuthorization (furnisherSig: Sig, platformSig: Sig): void {
    this.status = EscrowContract.STATUS_WORK_STARTED
  }

  @method(SigHash.ANYONECANPAY_SINGLE)
  public seekerRaisesDisputeOnChain (seekerSig: Sig) {
    assert(this.checkSig(seekerSig, this.seekerKey))
    assert(
      this.status === EscrowContract.STATUS_WORK_STARTED ||
            this.status === EscrowContract.STATUS_WORK_SUBMITTED
    )
    if (this.status === EscrowContract.STATUS_WORK_STARTED) {
      this.enforceProperTimeUnits()
      assert(this.ctx.locktime > this.workCompletionDeadline)
    }
    this.status = EscrowContract.STATUS_DISPUTED_BY_SEEKER
    // this.seekerDisputeEvidence = seekerDisputeEvidence
    assert(this.ctx.hashOutputs === hash256(this.buildStateOutput(this.ctx.utxo.value)))
  }

  @method()
  seekerRaisesDispute (seekerSig: Sig): void {
    this.status = EscrowContract.STATUS_DISPUTED_BY_SEEKER
    // this.seekerDisputeEvidence = seekerDisputeEvidence
  }

  @method(SigHash.ANYONECANPAY_SINGLE)
  public furnisherRaisesDisputeOnChain (furnisherSig: Sig) {
    assert(this.checkSig(furnisherSig, (this.acceptedBid).furnisherKey))
    assert(this.status === EscrowContract.STATUS_WORK_SUBMITTED)
    this.enforceProperTimeUnits()
    assert(this.ctx.locktime > (this.workCompletionTime) + this.maxWorkApprovalDelay)
    this.status = EscrowContract.STATUS_DISPUTED_BY_FURNISHER
    // this.furnisherDisputeEvidence = furnisherDisputeEvidence
    assert(this.ctx.hashOutputs === hash256(this.buildStateOutput(this.ctx.utxo.value)))
  }

  @method()
  furnisherRaisesDispute (furnisherSig: Sig): void {
    this.status = EscrowContract.STATUS_DISPUTED_BY_FURNISHER
    // this.furnisherDisputeEvidence = furnisherDisputeEvidence
  }

  // TODO: Consider adding on-chain adversarial evidence collection states from each party prior to dispute decision by platform.

  @method(SigHash.ANYONECANPAY_SINGLE)
  public furnisherSubmitsWorkOnChain (furnisherSig: Sig, workCompletionDescription: ByteString, adHocBid: Bid) {
    this.enforceProperTimeUnits()
    this.workCompletionTime = this.ctx.locktime
    this.workCompletionDescription = workCompletionDescription
    if (this.contractType === EscrowContract.TYPE_BOUNTY && this.bountySolversNeedApproval === 0n) {
      assert(this.status === EscrowContract.STATUS_INITIAL)
      this.status = EscrowContract.STATUS_WORK_SUBMITTED
      assert(this.checkSig(furnisherSig, adHocBid.furnisherKey))
      assert(adHocBid.bidAmount === this.ctx.utxo.value) // Bounty does not include their bond, which they will get back if their solution is legitimate
      assert(adHocBid.timeOfBid === this.ctx.locktime)
      assert(adHocBid.bond === this.requiredBondAmount)
      assert(adHocBid.timeRequired === 0n)
      this.acceptedBid = adHocBid
      assert(this.ctx.hashOutputs === hash256(this.buildStateOutput(this.ctx.utxo.value + this.requiredBondAmount)))
    } else {
      assert(this.status === EscrowContract.STATUS_WORK_STARTED)
      this.status = EscrowContract.STATUS_WORK_SUBMITTED
      assert(this.checkSig(furnisherSig, (this.acceptedBid).furnisherKey))
      assert(this.ctx.locktime > (this.acceptedBid).timeOfBid)
      assert(this.ctx.hashOutputs === hash256(this.buildStateOutput(this.ctx.utxo.value)))
    }
  }

  @method()
  furnisherSubmitsWork (furnisherSig: Sig, workCompletionDescription: ByteString, adHocBid: Bid): void {
    this.workCompletionTime = this.ctx.locktime
    this.workCompletionDescription = workCompletionDescription
    if (this.contractType === EscrowContract.TYPE_BOUNTY && this.bountySolversNeedApproval === 0n) {
      this.status = EscrowContract.STATUS_WORK_SUBMITTED
      this.acceptedBid = adHocBid
    } else {
      this.status = EscrowContract.STATUS_WORK_SUBMITTED
    }
  }

  @method(SigHash.ANYONECANPAY_SINGLE)
  public seekerApprovesWorkOnChain (seekerSig: Sig) {
    assert(this.status === EscrowContract.STATUS_WORK_SUBMITTED)
    assert(this.checkSig(seekerSig, this.seekerKey))
    this.status = EscrowContract.STATUS_RESOLVED
    assert(this.ctx.hashOutputs === hash256(this.buildStateOutput(this.ctx.utxo.value)))
  }

  @method()
  seekerApprovesWork (seekerSig: Sig): void {
    this.status = EscrowContract.STATUS_RESOLVED
  }

  @method()
  public furnisherClaimsPaymentOnChain (furnisherSig: Sig) {
    assert(this.status === EscrowContract.STATUS_RESOLVED)
    assert(this.checkSig(furnisherSig, (this.acceptedBid).furnisherKey))
    // At this point, there was no dispute and the furnisher is free to drain the contract.
    // They may do whatever they want with the funds, it is no longer enforced here.
  }

  @method(SigHash.ANYONECANPAY_ALL)
  public resolveDisputeOnChain (platformResolves: bigint, amountForSeeker: bigint, amountForFurnisher: bigint, otherOutputs: ByteString, platformSig: Sig, seekerSig: Sig, furnisherSig: Sig) {
    assert(
      this.status === EscrowContract.STATUS_DISPUTED_BY_FURNISHER ||
            this.status === EscrowContract.STATUS_DISPUTED_BY_SEEKER
    )
    assert(amountForSeeker >= 0n)
    assert(amountForFurnisher >= 0n)
    if (platformResolves === 1n) {
      assert(this.checkSig(platformSig, this.platformKey))
      if (this.escrowMustBeFullyDecisive === 1n) {
        assert(amountForSeeker === 0n || amountForFurnisher === 0n)
      }
      // validate total of amounts less fee
      assert(amountForSeeker + amountForFurnisher >= this.ctx.utxo.value - (this.ctx.utxo.value * this.escrowServiceFeeBasisPoints) / 10000n)
    } else {
      assert(this.checkSig(seekerSig, this.seekerKey))
      assert(this.checkSig(furnisherSig, this.acceptedBid.furnisherKey))
      // validate total of amounts
      assert(amountForSeeker + amountForFurnisher >= this.ctx.utxo.value)
    }
    if (amountForSeeker > 0n && amountForFurnisher === 0n) {
      if (this.contractSurvivesAdverseFurnisherDisputeResolution === 1n) {
        assert(this.ctx.hashOutputs === hash256(
          this.buildStateOutput(amountForSeeker) +
                    otherOutputs
        ))
      } else {
        assert(this.ctx.hashOutputs === hash256(
          Utils.buildPublicKeyHashOutput(hash160(this.seekerKey), amountForSeeker) +
                    otherOutputs
        ))
      }
    } else if (amountForSeeker === 0n && amountForFurnisher > 0n) {
      assert(this.ctx.hashOutputs === hash256(
        Utils.buildPublicKeyHashOutput(hash160((this.acceptedBid).furnisherKey), amountForFurnisher) +
                otherOutputs
      ))
    } else {
      assert(this.ctx.hashOutputs === hash256(
        Utils.buildPublicKeyHashOutput(hash160(this.seekerKey), amountForSeeker) +
                Utils.buildPublicKeyHashOutput(hash160((this.acceptedBid).furnisherKey), amountForFurnisher) +
                otherOutputs
      ))
    }
  }

  @method()
  private enforceProperTimeUnits (): void {
    assert(this.ctx.sequence === 0xfffffffen)
    if (this.delayUnit === EscrowContract.DELAY_UNIT_BLOCKS) {
      assert(this.ctx.locktime < 500000000n)
    } else {
      assert(this.ctx.locktime > 500000000n)
    }
  }
}
