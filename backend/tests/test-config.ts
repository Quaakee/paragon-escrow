import { GlobalConfig } from '../src/constants.js'
import { PrivateKey } from '@bsv/sdk'

/**
 * Test Configuration
 *
 * This file contains the global configuration for testing the escrow system.
 * All tests use these consistent settings to ensure predictable behavior.
 */

// Generate test keys for deterministic testing
export const TEST_SEEKER_PRIVATE_KEY = PrivateKey.fromRandom()
export const TEST_FURNISHER_PRIVATE_KEY = PrivateKey.fromRandom()
export const TEST_PLATFORM_PRIVATE_KEY = PrivateKey.fromRandom()

// Derive public keys
export const TEST_SEEKER_PUBLIC_KEY = TEST_SEEKER_PRIVATE_KEY.toPublicKey().toString()
export const TEST_FURNISHER_PUBLIC_KEY = TEST_FURNISHER_PRIVATE_KEY.toPublicKey().toString()
export const TEST_PLATFORM_PUBLIC_KEY = TEST_PLATFORM_PRIVATE_KEY.toPublicKey().toString()

/**
 * Standard GlobalConfig for testing
 *
 * This represents a typical escrow configuration:
 * - Bid-based contract (not bounty)
 * - Seeker approves work
 * - Optional bonding (furnishers can post bond)
 * - Platform charges 2.5% fee (250 basis points)
 * - Time measured in seconds (easier for testing than blocks)
 */
export const TEST_GLOBAL_CONFIG: GlobalConfig = {
  // Financial settings
  minAllowableBid: 1000, // Minimum 1000 satoshis
  escrowServiceFeeBasisPoints: 250, // 2.5% platform fee

  // Authorization settings
  platformAuthorizationRequired: false, // Furnisher can start work without platform approval
  escrowMustBeFullyDecisive: true, // Platform must award all-or-nothing in disputes
  bountySolversNeedApproval: true, // Bids must be approved before work starts

  // Bonding settings
  furnisherBondingMode: 'optional', // Furnishers can optionally post bonds
  requiredBondAmount: 0, // No required bond (since optional)

  // Timing settings
  maxWorkStartDelay: 86400, // 24 hours (in seconds) to start work after bid acceptance
  maxWorkApprovalDelay: 172800, // 48 hours (in seconds) for seeker to approve work
  delayUnit: 'seconds', // Use seconds for easier testing

  // Approval and contract type
  approvalMode: 'seeker', // Seeker approves bids
  contractType: 'bid', // Bid-based (not bounty)

  // Dispute handling
  contractSurvivesAdverseFurnisherDisputeResolution: false, // Contract ends after adverse resolution

  // Bounty increase settings (not applicable for bid contracts, but required)
  bountyIncreaseAllowanceMode: 'forbidden',
  bountyIncreaseCutoffPoint: 'bid-acceptance',

  // Network settings
  platformKey: TEST_PLATFORM_PUBLIC_KEY,
  topic: 'test-escrow-topic',
  service: 'test-escrow-service',
  keyDerivationProtocol: [2, 'test escrow protocol'],
  networkPreset: 'testnet'
}

/**
 * Bounty-based GlobalConfig for testing bounty contracts
 */
export const TEST_BOUNTY_CONFIG: GlobalConfig = {
  ...TEST_GLOBAL_CONFIG,
  contractType: 'bounty',
  bountySolversNeedApproval: false, // Anyone can submit solutions
  bountyIncreaseAllowanceMode: 'by-seeker',
  bountyIncreaseCutoffPoint: 'submission-of-work',
  furnisherBondingMode: 'required',
  requiredBondAmount: 500 // Require 500 satoshi bond for bounty hunters
}

/**
 * Platform-approval GlobalConfig for testing platform-mediated contracts
 */
export const TEST_PLATFORM_APPROVAL_CONFIG: GlobalConfig = {
  ...TEST_GLOBAL_CONFIG,
  platformAuthorizationRequired: true, // Platform must approve work start
  approvalMode: 'platform', // Platform approves bids
  escrowServiceFeeBasisPoints: 500 // Higher 5% fee for platform-mediated contracts
}

/**
 * Test timeouts for async operations
 */
export const TEST_TIMEOUTS = {
  short: 5000, // 5 seconds
  medium: 15000, // 15 seconds
  long: 30000 // 30 seconds
}

/**
 * Test amounts in satoshis
 */
export const TEST_AMOUNTS = {
  minBid: 1000,
  standardBid: 5000,
  largeBid: 50000,
  standardBond: 1000,
  largeBond: 5000,
  smallPayment: 100,
  platformFee: 125 // 2.5% of 5000
}

/**
 * Test work descriptions
 */
export const TEST_WORK_DESCRIPTIONS = {
  simple: 'Build a simple todo app',
  complex: 'Implement a complete escrow system with smart contracts, overlay network integration, and comprehensive testing suite',
  short: 'Fix bug'
}

/**
 * Test completion descriptions
 */
export const TEST_COMPLETION_DESCRIPTIONS = {
  success: 'Work completed successfully. Deliverables attached.',
  partial: 'Partial completion due to scope changes.',
  late: 'Work completed but after deadline.'
}

/**
 * Helper function to create a work deadline relative to current time
 */
export function createWorkDeadline(hoursFromNow: number): number {
  return Math.floor(Date.now() / 1000) + (hoursFromNow * 3600)
}

/**
 * Helper function to wait for a specific time (for locktime testing)
 */
export async function waitForTime(seconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000))
}

/**
 * Helper to advance time (for testing time-dependent contract methods)
 */
export function advanceTime(seconds: number): number {
  return Math.floor(Date.now() / 1000) + seconds
}
