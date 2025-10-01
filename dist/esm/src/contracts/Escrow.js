var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { assert, hash256, method, prop, SmartContract, SigHash, Utils, hash160, toByteString, fill } from 'scrypt-ts';
export class EscrowContract extends SmartContract {
    // Contract types
    static TYPE_BOUNTY = 1n;
    static TYPE_BID = 2n;
    // Contract states
    static STATUS_INITIAL = 11n;
    static STATUS_BID_ACCEPTED = 12n;
    static STATUS_WORK_STARTED = 13n;
    static STATUS_WORK_SUBMITTED = 14n;
    static STATUS_RESOLVED = 15n;
    static STATUS_DISPUTED_BY_SEEKER = 16n;
    static STATUS_DISPUTED_BY_FURNISHER = 17n;
    // Furnisher bonding modes
    static FURNISHER_BONDING_MODE_FORBIDDEN = 31n;
    static FURNISHER_BONDING_MODE_OPTIONAL = 32n;
    static FURNISHER_BONDING_MODE_REQUIRED = 33n;
    // Furnisher selection and approval modes
    static FURNISHER_APPROVAL_MODE_SEEKER = 41n;
    static FURNISHER_APPROVAL_MODE_SEEKER_OR_PLATFORM = 42n;
    static FURNISHER_APPROVAL_MODE_PLATFORM = 43n;
    // Delay units
    static DELAY_UNIT_BLOCKS = 51n;
    static DELAY_UNIT_SECONDS = 52n;
    // Bounty increase allowance modes
    static BOUNTY_INCREASE_FORBIDDEN = 61n;
    static BOUNTY_INCREASE_ALLOWED_BY_SEEKER = 62n;
    static BOUNTY_INCREASE_ALLOWED_BY_PLATFORM = 63n;
    static BOUNTY_INCREASE_ALLOWED_BY_SEEKER_OR_PLATFORM = 64n;
    static BOUNTY_INCREASE_ALLOWED_BY_ANYONE = 65n;
    // Bounty increase cutoff points
    static INCREASE_CUTOFF_BID_ACCEPTANCE = 71n;
    static INCREASE_CUTOFF_START_OF_WORK = 72n;
    static INCREASE_CUTOFF_SUBMISSION_OF_WORK = 73n;
    static INCREASE_CUTOFF_ACCEPTANCE_OF_WORK = 74n;
    // Bid acceptance attribution
    static BID_NOT_YET_ACCEPTED = 81n;
    static BID_ACCEPTED_BY_SEEKER = 82n;
    static BID_ACCEPTED_BY_PLATFORM = 83n;
    minAllowableBid;
    escrowServiceFeeBasisPoints;
    platformAuthorizationRequired;
    escrowMustBeFullyDecisive;
    bountySolversNeedApproval;
    furnisherBondingMode;
    requiredBondAmount;
    maxWorkStartDelay;
    maxWorkApprovalDelay;
    delayUnit;
    workCompletionDeadline;
    approvalMode;
    contractType;
    contractSurvivesAdverseFurnisherDisputeResolution;
    bountyIncreaseAllowanceMode;
    bountyIncreaseCutoffPoint;
    bids;
    seekerKey;
    platformKey;
    acceptedBid;
    bidAcceptedBy;
    workCompletionTime;
    status;
    workDescription;
    workCompletionDescription;
    constructor(seekerKey, platformKey, escrowServiceFeeBasisPoints, platformAuthorizationRequired, workDescription, workCompletionDeadline, minAllowableBid = 0n, bountySolversNeedApproval = 1n, escrowMustBeFullyDecisive = 1n, furnisherBondingMode = EscrowContract.FURNISHER_BONDING_MODE_OPTIONAL, requiredBondAmount = 0n, maxWorkStartDelay = 144n, maxWorkApprovalDelay = 144n, delayUnit = EscrowContract.DELAY_UNIT_BLOCKS, approvalMode = EscrowContract.FURNISHER_APPROVAL_MODE_SEEKER, bountyIncreaseAllowanceMode = EscrowContract.BOUNTY_INCREASE_FORBIDDEN, bountyIncreaseCutoffPoint = EscrowContract.INCREASE_CUTOFF_BID_ACCEPTANCE, contractType = EscrowContract.TYPE_BID, contractSurvivesAdverseFurnisherDisputeResolution = 0n, bids = fill({
        furnisherKey: seekerKey,
        bidAmount: 0n,
        timeOfBid: 0n,
        bond: 0n,
        timeRequired: 0n,
        plans: toByteString('')
    }, 4)) {
        super(...arguments);
        // Required values in all contracts
        this.seekerKey = seekerKey; // Who are you?
        this.platformKey = platformKey; // What platform are you using?
        this.escrowServiceFeeBasisPoints = escrowServiceFeeBasisPoints; // What do they charge? (in basis points)
        this.platformAuthorizationRequired = platformAuthorizationRequired; // Must the platform authorize start-of-work?
        this.workDescription = workDescription; // What do you want done?
        this.workCompletionDeadline = workCompletionDeadline; // When do you need it by?
        // Optional values
        // Contract configuration
        this.minAllowableBid = minAllowableBid; // What's the minimum bid?
        this.bountySolversNeedApproval = bountySolversNeedApproval; // Can someone start work without talking to anyone, and the first one done gets the money?
        this.escrowMustBeFullyDecisive = escrowMustBeFullyDecisive; // if people mess up, is escrow forced to make an all-or-nothing award?
        this.furnisherBondingMode = furnisherBondingMode; // Can bidders offer up collateral for in case they mess up? Is this required?
        this.requiredBondAmount = requiredBondAmount; // How much collateral does a bidder need to offer up if this is required? Or if it's a race.
        this.maxWorkStartDelay = maxWorkStartDelay; // How long after you accept a bid before the worker needs to post up bond and get started, or else get replaced?
        this.maxWorkApprovalDelay = maxWorkApprovalDelay; // After they finish, how long do you have to look at the work before they can file a dispute?
        this.delayUnit = delayUnit; // Are times measured in seconds or blocks for this contract?
        this.approvalMode = approvalMode; // Who can approve a worker to start work? You, the platform, or either/or?
        this.contractType = contractType; // Are you putting up a fixed bounty for this work or accepting bids at different prices to get it done?
        this.contractSurvivesAdverseFurnisherDisputeResolution = contractSurvivesAdverseFurnisherDisputeResolution; // If platform finds workers fail, does the contract survive?
        this.bountyIncreaseAllowanceMode = bountyIncreaseAllowanceMode; // If this is a bounty contract, who may increase the bounty?
        this.bountyIncreaseCutoffPoint = bountyIncreaseCutoffPoint; // When is the latest point where someone may make the bounty higher?
        // State starts at initial, with no bids
        this.status = EscrowContract.STATUS_INITIAL;
        this.bids = bids;
        // Non-initial values are null
        this.bidAcceptedBy = EscrowContract.BID_NOT_YET_ACCEPTED;
        this.acceptedBid = {
            furnisherKey: seekerKey,
            bidAmount: 0n,
            timeOfBid: 0n,
            bond: 0n,
            timeRequired: 0n,
            plans: toByteString('')
        };
        this.workCompletionTime = 0n;
        this.workCompletionDescription = toByteString('');
    }
    seekerCancelsBeforeAcceptOnChain(seekerSig) {
        assert(this.status === EscrowContract.STATUS_INITIAL, 'Contract must be in the initial state for a seeker to cancel');
        assert(this.checkSig(seekerSig, this.seekerKey), 'Seeker must sign contract cancellation');
    }
    increaseBountyOnChain(mode, amount, sig) {
        assert(amount > 0n);
        assert(this.contractType === EscrowContract.TYPE_BOUNTY);
        assert(this.bountyIncreaseAllowanceMode !== EscrowContract.BOUNTY_INCREASE_FORBIDDEN);
        if (this.bountyIncreaseAllowanceMode === EscrowContract.BOUNTY_INCREASE_ALLOWED_BY_SEEKER_OR_PLATFORM) {
            assert(mode === EscrowContract.BOUNTY_INCREASE_ALLOWED_BY_PLATFORM ||
                mode === EscrowContract.BOUNTY_INCREASE_ALLOWED_BY_SEEKER);
        }
        else {
            assert(mode === this.bountyIncreaseAllowanceMode);
        }
        // Enforce cutoff time
        if (this.bountyIncreaseCutoffPoint === EscrowContract.INCREASE_CUTOFF_BID_ACCEPTANCE) {
            assert(this.status === EscrowContract.STATUS_INITIAL);
        }
        else if (this.bountyIncreaseCutoffPoint === EscrowContract.INCREASE_CUTOFF_START_OF_WORK) {
            assert(this.status === EscrowContract.STATUS_INITIAL ||
                this.status === EscrowContract.STATUS_BID_ACCEPTED);
        }
        else if (this.bountyIncreaseCutoffPoint === EscrowContract.INCREASE_CUTOFF_SUBMISSION_OF_WORK) {
            assert(this.status === EscrowContract.STATUS_INITIAL ||
                this.status === EscrowContract.STATUS_BID_ACCEPTED ||
                this.status === EscrowContract.STATUS_WORK_STARTED);
        }
        else if (this.bountyIncreaseCutoffPoint === EscrowContract.INCREASE_CUTOFF_ACCEPTANCE_OF_WORK) {
            assert(this.status === EscrowContract.STATUS_INITIAL ||
                this.status === EscrowContract.STATUS_BID_ACCEPTED ||
                this.status === EscrowContract.STATUS_WORK_STARTED ||
                this.status === EscrowContract.STATUS_WORK_SUBMITTED);
        }
        if (mode === EscrowContract.BOUNTY_INCREASE_ALLOWED_BY_SEEKER) {
            assert(this.checkSig(sig, this.seekerKey), 'Seeker must sign to increase bounty');
        }
        else if (mode === EscrowContract.BOUNTY_INCREASE_ALLOWED_BY_PLATFORM) {
            assert(this.checkSig(sig, this.platformKey), 'Platform must sign to increase bounty');
        }
        assert(this.ctx.hashOutputs === hash256(this.buildStateOutput(this.ctx.utxo.value + amount)));
    }
    seekerExtendsWorkDeadlineOnChain(seekerSig, extension) {
        assert(extension > 0n);
        if (this.delayUnit === EscrowContract.DELAY_UNIT_BLOCKS) {
            assert(this.workCompletionDeadline + extension < 500000000n);
        }
        else {
            assert(this.workCompletionDeadline + extension > 500000000n);
        }
        assert(this.status === EscrowContract.STATUS_INITIAL ||
            this.status === EscrowContract.STATUS_BID_ACCEPTED ||
            this.status === EscrowContract.STATUS_WORK_STARTED);
        this.workCompletionDeadline += extension;
        assert(this.checkSig(seekerSig, this.seekerKey), 'Seeker must sign to extend deadline');
        assert(this.ctx.hashOutputs === hash256(this.buildStateOutput(this.ctx.utxo.value)));
    }
    seekerExtendsWorkDeadline(seekerSig, extension) {
        this.workCompletionDeadline += extension;
    }
    furnisherPlacesBidOnChain(furnisherSig, bid, index) {
        assert(this.status === EscrowContract.STATUS_INITIAL);
        assert(this.bountySolversNeedApproval === 1n);
        assert(this.checkSig(furnisherSig, bid.furnisherKey));
        if (this.contractType === EscrowContract.TYPE_BOUNTY) {
            assert(bid.bidAmount === this.ctx.utxo.value);
        }
        else {
            assert(bid.bidAmount >= this.minAllowableBid);
        }
        if (this.furnisherBondingMode === EscrowContract.FURNISHER_BONDING_MODE_FORBIDDEN) {
            assert(bid.bond === 0n);
        }
        else if (this.furnisherBondingMode === EscrowContract.FURNISHER_BONDING_MODE_OPTIONAL) {
            assert(bid.bond >= 0n); // Bonds cannot be below zero, this would allow a worker to withdraw part of the payment when work starts.
        }
        else {
            assert(bid.bond === this.requiredBondAmount);
            assert(bid.bond >= 0n);
        }
        if (this.contractType === EscrowContract.TYPE_BID) {
            assert(this.ctx.utxo.value === 1n);
        }
        assert(bid.timeRequired > 0n);
        assert(bid.timeOfBid > 0n);
        if (this.delayUnit === EscrowContract.DELAY_UNIT_BLOCKS) {
            assert(bid.timeRequired < 500000000n);
            assert(bid.timeOfBid < 500000000n);
        }
        else {
            assert(bid.timeRequired > 500000000n);
            assert(bid.timeOfBid > 500000000n);
        }
        this.enforceProperTimeUnits();
        assert(this.ctx.locktime >= bid.timeOfBid);
        assert(this.bids[Number(index)].furnisherKey === this.seekerKey); // Must use an open slot
        this.bids[Number(index)] = bid;
        assert(this.ctx.hashOutputs === hash256(this.buildStateOutput(this.ctx.utxo.value)));
    }
    furnisherPlacesBid(furnisherSig, bid, index) {
        this.bids[Number(index)] = bid;
    }
    acceptBidOnChain(mode, sig, index) {
        const bid = this.bids[Number(index)];
        assert(this.status === EscrowContract.STATUS_INITIAL);
        assert(this.bountySolversNeedApproval === 1n);
        if (this.approvalMode === EscrowContract.FURNISHER_APPROVAL_MODE_SEEKER_OR_PLATFORM) {
            assert(mode === EscrowContract.FURNISHER_APPROVAL_MODE_SEEKER ||
                mode === EscrowContract.FURNISHER_APPROVAL_MODE_PLATFORM);
        }
        else {
            assert(mode === this.approvalMode);
        }
        if (mode === EscrowContract.FURNISHER_APPROVAL_MODE_SEEKER) {
            assert(this.checkSig(sig, this.seekerKey));
            this.bidAcceptedBy = EscrowContract.BID_ACCEPTED_BY_SEEKER;
        }
        else {
            assert(this.checkSig(sig, this.platformKey));
            this.bidAcceptedBy = EscrowContract.BID_ACCEPTED_BY_PLATFORM;
        }
        assert(this.ctx.sequence === 0xfffffffen);
        assert(this.ctx.locktime < this.workCompletionDeadline - bid.timeRequired);
        this.status = EscrowContract.STATUS_BID_ACCEPTED;
        this.acceptedBid = bid;
        if (this.contractType === EscrowContract.TYPE_BID) {
            assert(this.ctx.hashOutputs === hash256(this.buildStateOutput(bid.bidAmount)));
        }
        else {
            assert(this.ctx.hashOutputs === hash256(this.buildStateOutput(this.ctx.utxo.value)));
        }
    }
    acceptBid(mode, sig, index) {
        const bid = this.bids[Number(index)];
        if (mode === EscrowContract.FURNISHER_APPROVAL_MODE_SEEKER) {
            this.bidAcceptedBy = EscrowContract.BID_ACCEPTED_BY_SEEKER;
        }
        else {
            this.bidAcceptedBy = EscrowContract.BID_ACCEPTED_BY_PLATFORM;
        }
        this.status = EscrowContract.STATUS_BID_ACCEPTED;
        this.acceptedBid = bid;
    }
    withdrawBidAcceptanceOnChain(sig, index) {
        assert(this.status === EscrowContract.STATUS_BID_ACCEPTED);
        if (this.bidAcceptedBy === EscrowContract.BID_ACCEPTED_BY_SEEKER) {
            assert(this.checkSig(sig, this.seekerKey));
        }
        else {
            assert(this.checkSig(sig, this.platformKey));
        }
        if (this.delayUnit === EscrowContract.DELAY_UNIT_BLOCKS) {
            assert((this.acceptedBid).timeOfBid + this.maxWorkStartDelay < 500000000n);
        }
        else {
            assert((this.acceptedBid).timeOfBid + this.maxWorkStartDelay > 500000000n);
        }
        this.enforceProperTimeUnits();
        assert(this.ctx.locktime > (this.acceptedBid).timeOfBid + this.maxWorkStartDelay);
        assert(this.bids[Number(index)] === this.acceptedBid);
        this.status = EscrowContract.STATUS_INITIAL;
        this.acceptedBid = {
            furnisherKey: this.seekerKey,
            bidAmount: 0n,
            timeOfBid: 0n,
            bond: 0n,
            timeRequired: 0n,
            plans: toByteString('')
        };
        this.bids[Number(index)] = {
            furnisherKey: this.seekerKey,
            bidAmount: 0n,
            timeOfBid: 0n,
            bond: 0n,
            timeRequired: 0n,
            plans: toByteString('')
        };
        this.bidAcceptedBy = EscrowContract.BID_NOT_YET_ACCEPTED;
        if (this.contractType === EscrowContract.TYPE_BID) {
            assert(this.ctx.hashOutputs === hash256(this.buildStateOutput(1n))); // Force bid amount to be withdrawn
        }
        else {
            assert(this.ctx.hashOutputs === hash256(this.buildStateOutput(this.ctx.utxo.value)));
        }
    }
    withdrawBidAcceptance(sig, index) {
        this.status = EscrowContract.STATUS_INITIAL;
        this.acceptedBid = {
            furnisherKey: this.seekerKey,
            bidAmount: 0n,
            timeOfBid: 0n,
            bond: 0n,
            timeRequired: 0n,
            plans: toByteString('')
        };
        this.bids[Number(index)] = {
            furnisherKey: this.seekerKey,
            bidAmount: 0n,
            timeOfBid: 0n,
            bond: 0n,
            timeRequired: 0n,
            plans: toByteString('')
        };
        this.bidAcceptedBy = EscrowContract.BID_NOT_YET_ACCEPTED;
    }
    rejectBidOnChain(mode, sig, index) {
        assert(this.status === EscrowContract.STATUS_INITIAL);
        if (this.approvalMode === EscrowContract.FURNISHER_APPROVAL_MODE_SEEKER_OR_PLATFORM) {
            assert(mode === EscrowContract.FURNISHER_APPROVAL_MODE_SEEKER ||
                mode === EscrowContract.FURNISHER_APPROVAL_MODE_PLATFORM);
        }
        else {
            assert(mode === this.approvalMode);
        }
        if (mode === EscrowContract.FURNISHER_APPROVAL_MODE_SEEKER) {
            assert(this.checkSig(sig, this.seekerKey));
        }
        else {
            assert(this.checkSig(sig, this.platformKey));
        }
        this.bids[Number(index)] = {
            furnisherKey: this.seekerKey,
            bidAmount: 0n,
            timeOfBid: 0n,
            bond: 0n,
            timeRequired: 0n,
            plans: toByteString('')
        };
        assert(this.ctx.hashOutputs === hash256(this.buildStateOutput(this.ctx.utxo.value)));
    }
    rejectBid(mode, sig, index) {
        this.bids[Number(index)] = {
            furnisherKey: this.seekerKey,
            bidAmount: 0n,
            timeOfBid: 0n,
            bond: 0n,
            timeRequired: 0n,
            plans: toByteString('')
        };
    }
    furnisherStartsWorkOnChain(furnisherSig) {
        assert(this.status === EscrowContract.STATUS_BID_ACCEPTED);
        assert(this.platformAuthorizationRequired === 0n);
        assert(this.bountySolversNeedApproval === 1n);
        assert(this.checkSig(furnisherSig, (this.acceptedBid).furnisherKey));
        this.status = EscrowContract.STATUS_WORK_STARTED;
        assert(this.ctx.hashOutputs === hash256(this.buildStateOutput(this.ctx.utxo.value + (this.acceptedBid).bond)));
    }
    furnisherStartsWork(furnisherSig) {
        this.status = EscrowContract.STATUS_WORK_STARTED;
    }
    furnisherStartsWorkWithPlatformAuthorizationOnChain(furnisherSig, platformSig) {
        assert(this.status === EscrowContract.STATUS_BID_ACCEPTED);
        assert(this.platformAuthorizationRequired === 1n);
        assert(this.bountySolversNeedApproval === 1n);
        assert(this.checkSig(furnisherSig, (this.acceptedBid).furnisherKey));
        assert(this.checkSig(platformSig, this.platformKey));
        this.status = EscrowContract.STATUS_WORK_STARTED;
        assert(this.ctx.hashOutputs === hash256(this.buildStateOutput(this.ctx.utxo.value + (this.acceptedBid).bond)));
    }
    furnisherStartsWorkWithPlatformAuthorization(furnisherSig, platformSig) {
        this.status = EscrowContract.STATUS_WORK_STARTED;
    }
    seekerRaisesDisputeOnChain(seekerSig) {
        assert(this.checkSig(seekerSig, this.seekerKey));
        assert(this.status === EscrowContract.STATUS_WORK_STARTED ||
            this.status === EscrowContract.STATUS_WORK_SUBMITTED);
        if (this.status === EscrowContract.STATUS_WORK_STARTED) {
            this.enforceProperTimeUnits();
            assert(this.ctx.locktime > this.workCompletionDeadline);
        }
        this.status = EscrowContract.STATUS_DISPUTED_BY_SEEKER;
        // this.seekerDisputeEvidence = seekerDisputeEvidence
        assert(this.ctx.hashOutputs === hash256(this.buildStateOutput(this.ctx.utxo.value)));
    }
    seekerRaisesDispute(seekerSig) {
        this.status = EscrowContract.STATUS_DISPUTED_BY_SEEKER;
        // this.seekerDisputeEvidence = seekerDisputeEvidence
    }
    furnisherRaisesDisputeOnChain(furnisherSig) {
        assert(this.checkSig(furnisherSig, (this.acceptedBid).furnisherKey));
        assert(this.status === EscrowContract.STATUS_WORK_SUBMITTED);
        this.enforceProperTimeUnits();
        assert(this.ctx.locktime > (this.workCompletionTime) + this.maxWorkApprovalDelay);
        this.status = EscrowContract.STATUS_DISPUTED_BY_FURNISHER;
        // this.furnisherDisputeEvidence = furnisherDisputeEvidence
        assert(this.ctx.hashOutputs === hash256(this.buildStateOutput(this.ctx.utxo.value)));
    }
    furnisherRaisesDispute(furnisherSig) {
        this.status = EscrowContract.STATUS_DISPUTED_BY_FURNISHER;
        // this.furnisherDisputeEvidence = furnisherDisputeEvidence
    }
    // TODO: Consider adding on-chain adversarial evidence collection states from each party prior to dispute decision by platform.
    furnisherSubmitsWorkOnChain(furnisherSig, workCompletionDescription, adHocBid) {
        this.enforceProperTimeUnits();
        this.workCompletionTime = this.ctx.locktime;
        this.workCompletionDescription = workCompletionDescription;
        if (this.contractType === EscrowContract.TYPE_BOUNTY && this.bountySolversNeedApproval === 0n) {
            assert(this.status === EscrowContract.STATUS_INITIAL);
            this.status = EscrowContract.STATUS_WORK_SUBMITTED;
            assert(this.checkSig(furnisherSig, adHocBid.furnisherKey));
            assert(adHocBid.bidAmount === this.ctx.utxo.value); // Bounty does not include their bond, which they will get back if their solution is legitimate
            assert(adHocBid.timeOfBid === this.ctx.locktime);
            assert(adHocBid.bond === this.requiredBondAmount);
            assert(adHocBid.timeRequired === 0n);
            this.acceptedBid = adHocBid;
            assert(this.ctx.hashOutputs === hash256(this.buildStateOutput(this.ctx.utxo.value + this.requiredBondAmount)));
        }
        else {
            assert(this.status === EscrowContract.STATUS_WORK_STARTED);
            this.status = EscrowContract.STATUS_WORK_SUBMITTED;
            assert(this.checkSig(furnisherSig, (this.acceptedBid).furnisherKey));
            assert(this.ctx.locktime > (this.acceptedBid).timeOfBid);
            assert(this.ctx.hashOutputs === hash256(this.buildStateOutput(this.ctx.utxo.value)));
        }
    }
    furnisherSubmitsWork(furnisherSig, workCompletionDescription, adHocBid) {
        this.workCompletionTime = this.ctx.locktime;
        this.workCompletionDescription = workCompletionDescription;
        if (this.contractType === EscrowContract.TYPE_BOUNTY && this.bountySolversNeedApproval === 0n) {
            this.status = EscrowContract.STATUS_WORK_SUBMITTED;
            this.acceptedBid = adHocBid;
        }
        else {
            this.status = EscrowContract.STATUS_WORK_SUBMITTED;
        }
    }
    seekerApprovesWorkOnChain(seekerSig) {
        assert(this.status === EscrowContract.STATUS_WORK_SUBMITTED);
        assert(this.checkSig(seekerSig, this.seekerKey));
        this.status = EscrowContract.STATUS_RESOLVED;
        assert(this.ctx.hashOutputs === hash256(this.buildStateOutput(this.ctx.utxo.value)));
    }
    seekerApprovesWork(seekerSig) {
        this.status = EscrowContract.STATUS_RESOLVED;
    }
    furnisherClaimsPaymentOnChain(furnisherSig) {
        assert(this.status === EscrowContract.STATUS_RESOLVED);
        assert(this.checkSig(furnisherSig, (this.acceptedBid).furnisherKey));
        // At this point, there was no dispute and the furnisher is free to drain the contract.
        // They may do whatever they want with the funds, it is no longer enforced here.
    }
    resolveDisputeOnChain(platformResolves, amountForSeeker, amountForFurnisher, otherOutputs, platformSig, seekerSig, furnisherSig) {
        assert(this.status === EscrowContract.STATUS_DISPUTED_BY_FURNISHER ||
            this.status === EscrowContract.STATUS_DISPUTED_BY_SEEKER);
        assert(amountForSeeker >= 0n);
        assert(amountForFurnisher >= 0n);
        if (platformResolves === 1n) {
            assert(this.checkSig(platformSig, this.platformKey));
            if (this.escrowMustBeFullyDecisive === 1n) {
                assert(amountForSeeker === 0n || amountForFurnisher === 0n);
            }
            // validate total of amounts less fee
            assert(amountForSeeker + amountForFurnisher >= this.ctx.utxo.value - (this.ctx.utxo.value * this.escrowServiceFeeBasisPoints) / 10000n);
        }
        else {
            assert(this.checkSig(seekerSig, this.seekerKey));
            assert(this.checkSig(furnisherSig, this.acceptedBid.furnisherKey));
            // validate total of amounts
            assert(amountForSeeker + amountForFurnisher >= this.ctx.utxo.value);
        }
        if (amountForSeeker > 0n && amountForFurnisher === 0n) {
            if (this.contractSurvivesAdverseFurnisherDisputeResolution === 1n) {
                assert(this.ctx.hashOutputs === hash256(this.buildStateOutput(amountForSeeker) +
                    otherOutputs));
            }
            else {
                assert(this.ctx.hashOutputs === hash256(Utils.buildPublicKeyHashOutput(hash160(this.seekerKey), amountForSeeker) +
                    otherOutputs));
            }
        }
        else if (amountForSeeker === 0n && amountForFurnisher > 0n) {
            assert(this.ctx.hashOutputs === hash256(Utils.buildPublicKeyHashOutput(hash160((this.acceptedBid).furnisherKey), amountForFurnisher) +
                otherOutputs));
        }
        else {
            assert(this.ctx.hashOutputs === hash256(Utils.buildPublicKeyHashOutput(hash160(this.seekerKey), amountForSeeker) +
                Utils.buildPublicKeyHashOutput(hash160((this.acceptedBid).furnisherKey), amountForFurnisher) +
                otherOutputs));
        }
    }
    enforceProperTimeUnits() {
        assert(this.ctx.sequence === 0xfffffffen);
        if (this.delayUnit === EscrowContract.DELAY_UNIT_BLOCKS) {
            assert(this.ctx.locktime < 500000000n);
        }
        else {
            assert(this.ctx.locktime > 500000000n);
        }
    }
}
__decorate([
    prop(true)
], EscrowContract.prototype, "minAllowableBid", void 0);
__decorate([
    prop(true)
], EscrowContract.prototype, "escrowServiceFeeBasisPoints", void 0);
__decorate([
    prop(true)
], EscrowContract.prototype, "platformAuthorizationRequired", void 0);
__decorate([
    prop(true)
], EscrowContract.prototype, "escrowMustBeFullyDecisive", void 0);
__decorate([
    prop(true)
], EscrowContract.prototype, "bountySolversNeedApproval", void 0);
__decorate([
    prop(true)
], EscrowContract.prototype, "furnisherBondingMode", void 0);
__decorate([
    prop(true)
], EscrowContract.prototype, "requiredBondAmount", void 0);
__decorate([
    prop(true)
], EscrowContract.prototype, "maxWorkStartDelay", void 0);
__decorate([
    prop(true)
], EscrowContract.prototype, "maxWorkApprovalDelay", void 0);
__decorate([
    prop(true)
], EscrowContract.prototype, "delayUnit", void 0);
__decorate([
    prop(true)
], EscrowContract.prototype, "workCompletionDeadline", void 0);
__decorate([
    prop(true)
], EscrowContract.prototype, "approvalMode", void 0);
__decorate([
    prop(true)
], EscrowContract.prototype, "contractType", void 0);
__decorate([
    prop(true)
], EscrowContract.prototype, "contractSurvivesAdverseFurnisherDisputeResolution", void 0);
__decorate([
    prop(true)
], EscrowContract.prototype, "bountyIncreaseAllowanceMode", void 0);
__decorate([
    prop(true)
], EscrowContract.prototype, "bountyIncreaseCutoffPoint", void 0);
__decorate([
    prop(true)
], EscrowContract.prototype, "bids", void 0);
__decorate([
    prop(true)
], EscrowContract.prototype, "seekerKey", void 0);
__decorate([
    prop(true)
], EscrowContract.prototype, "platformKey", void 0);
__decorate([
    prop(true)
], EscrowContract.prototype, "acceptedBid", void 0);
__decorate([
    prop(true)
], EscrowContract.prototype, "bidAcceptedBy", void 0);
__decorate([
    prop(true)
], EscrowContract.prototype, "workCompletionTime", void 0);
__decorate([
    prop(true)
], EscrowContract.prototype, "status", void 0);
__decorate([
    prop(true)
], EscrowContract.prototype, "workDescription", void 0);
__decorate([
    prop(true)
], EscrowContract.prototype, "workCompletionDescription", void 0);
__decorate([
    method()
], EscrowContract.prototype, "seekerCancelsBeforeAcceptOnChain", null);
__decorate([
    method(SigHash.ANYONECANPAY_SINGLE)
], EscrowContract.prototype, "increaseBountyOnChain", null);
__decorate([
    method(SigHash.ANYONECANPAY_SINGLE)
], EscrowContract.prototype, "seekerExtendsWorkDeadlineOnChain", null);
__decorate([
    method()
], EscrowContract.prototype, "seekerExtendsWorkDeadline", null);
__decorate([
    method(SigHash.ANYONECANPAY_SINGLE)
], EscrowContract.prototype, "furnisherPlacesBidOnChain", null);
__decorate([
    method()
], EscrowContract.prototype, "furnisherPlacesBid", null);
__decorate([
    method(SigHash.ANYONECANPAY_SINGLE)
], EscrowContract.prototype, "acceptBidOnChain", null);
__decorate([
    method()
], EscrowContract.prototype, "acceptBid", null);
__decorate([
    method(SigHash.ANYONECANPAY_SINGLE)
], EscrowContract.prototype, "withdrawBidAcceptanceOnChain", null);
__decorate([
    method()
], EscrowContract.prototype, "withdrawBidAcceptance", null);
__decorate([
    method(SigHash.ANYONECANPAY_SINGLE)
], EscrowContract.prototype, "rejectBidOnChain", null);
__decorate([
    method()
], EscrowContract.prototype, "rejectBid", null);
__decorate([
    method(SigHash.ANYONECANPAY_SINGLE)
], EscrowContract.prototype, "furnisherStartsWorkOnChain", null);
__decorate([
    method()
], EscrowContract.prototype, "furnisherStartsWork", null);
__decorate([
    method(SigHash.ANYONECANPAY_SINGLE)
], EscrowContract.prototype, "furnisherStartsWorkWithPlatformAuthorizationOnChain", null);
__decorate([
    method()
], EscrowContract.prototype, "furnisherStartsWorkWithPlatformAuthorization", null);
__decorate([
    method(SigHash.ANYONECANPAY_SINGLE)
], EscrowContract.prototype, "seekerRaisesDisputeOnChain", null);
__decorate([
    method()
], EscrowContract.prototype, "seekerRaisesDispute", null);
__decorate([
    method(SigHash.ANYONECANPAY_SINGLE)
], EscrowContract.prototype, "furnisherRaisesDisputeOnChain", null);
__decorate([
    method()
], EscrowContract.prototype, "furnisherRaisesDispute", null);
__decorate([
    method(SigHash.ANYONECANPAY_SINGLE)
], EscrowContract.prototype, "furnisherSubmitsWorkOnChain", null);
__decorate([
    method()
], EscrowContract.prototype, "furnisherSubmitsWork", null);
__decorate([
    method(SigHash.ANYONECANPAY_SINGLE)
], EscrowContract.prototype, "seekerApprovesWorkOnChain", null);
__decorate([
    method()
], EscrowContract.prototype, "seekerApprovesWork", null);
__decorate([
    method()
], EscrowContract.prototype, "furnisherClaimsPaymentOnChain", null);
__decorate([
    method(SigHash.ANYONECANPAY_ALL)
], EscrowContract.prototype, "resolveDisputeOnChain", null);
__decorate([
    method()
], EscrowContract.prototype, "enforceProperTimeUnits", null);
//# sourceMappingURL=Escrow.js.map