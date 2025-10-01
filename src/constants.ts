import { BEEF, PubKeyHex, WalletNetwork, WalletProtocol } from "@bsv/sdk"
import { EscrowContract } from "mod.js"

export interface Bid {
    furnisherKey: string
    plans: string
    bidAmount: number
    bond: number
    timeOfBid: number
    timeRequired: number
}

export interface EscrowRecord {
  txid: string
  outputIndex: number
  minAllowableBid: number
  escrowServiceFeeBasisPoints: number
  platformAuthorizationRequired: boolean
  escrowMustBeFullyDecisive: boolean
  bountySolversNeedApproval: boolean
  furnisherBondingMode: 'forbidden' | 'optional' | 'required'
  requiredBondAmount: number
  maxWorkStartDelay: number
  maxWorkApprovalDelay: number
  delayUnit: 'blocks' | 'seconds'
  workCompletionDeadline: number
  approvalMode: 'seeker' | 'platform' | 'seeker-or-platform'
  contractType: 'bid' | 'bounty'
  contractSurvivesAdverseFurnisherDisputeResolution: boolean
  bountyIncreaseAllowanceMode: 'forbidden' | 'by-seeker' | 'by-platform' | 'by-seeker-or-platform' | 'by-anyone'
  bountyIncreaseCutoffPoint: 'bid-acceptance' | 'start-of-work' | 'submission-of-work' | 'acceptance-of-work'
  bids: Array<Bid>
  seekerKey: string
  platformKey: string
  acceptedBid: Bid
  bidAcceptedBy: 'platform' | 'seeker' | 'not-yet-accepted'
  workCompletionTime: number
  status: 'initial' | 'bid-accepted' | 'work-started' | 'work-submitted' | 'resolved' | 'disputed-by-seeker' | 'disputed-by-furnisher'
  workDescription: string
  workCompletionDescription: string
}

export interface EscrowTX {
  record: EscrowRecord,
  contract: EscrowContract,
  beef: BEEF,
  script: string,
  satoshis: number
}

export interface UTXOReference {
  txid: string
  outputIndex: number
}

/**
 * This is what all parties in the system need to agree about.
 * Potentially future versions will allow some deviations, but for now the assumption is:
 * 1. You have a frontend with these hard-coded.
 * 2. You are all using the same frontend.
 * 3. Any deviations from these rules are invalid.
 */
export interface GlobalConfig {
  minAllowableBid: number
  escrowServiceFeeBasisPoints: number
  platformAuthorizationRequired: boolean
  escrowMustBeFullyDecisive: boolean
  bountySolversNeedApproval: boolean
  furnisherBondingMode: 'forbidden' | 'optional' | 'required'
  requiredBondAmount: number
  maxWorkStartDelay: number
  maxWorkApprovalDelay: number
  delayUnit: 'blocks' | 'seconds'
  approvalMode: 'seeker' | 'platform' | 'seeker-or-platform'
  contractType: 'bid' | 'bounty'
  contractSurvivesAdverseFurnisherDisputeResolution: boolean
  bountyIncreaseAllowanceMode: 'forbidden' | 'by-seeker' | 'by-platform' | 'by-seeker-or-platform' | 'by-anyone'
  bountyIncreaseCutoffPoint: 'bid-acceptance' | 'start-of-work' | 'submission-of-work' | 'acceptance-of-work'
  platformKey: PubKeyHex
  topic: string
  service: string
  keyDerivationProtocol: WalletProtocol
  networkPreset: 'mainnet' | 'testnet' | 'local'
}
