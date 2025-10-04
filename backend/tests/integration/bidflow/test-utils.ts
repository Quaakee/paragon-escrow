/**
 * Shared test utilities for bidflow integration tests
 */

import { WalletClient, TopicBroadcaster, LookupResolver } from '@bsv/sdk'
import { WalletHealthChecker } from '../../../src/utils/wallet-health.js'
import type { GlobalConfig } from '../../../src/constants.js'

// Test configuration for TYPE_BID contracts
export const TEST_GLOBAL_CONFIG_BID: GlobalConfig = {
  // Financial settings
  minAllowableBid: 1000,
  escrowServiceFeeBasisPoints: 250,

  // Authorization settings
  platformAuthorizationRequired: false,
  escrowMustBeFullyDecisive: true,
  bountySolversNeedApproval: true,

  // Bonding settings
  furnisherBondingMode: 'optional',
  requiredBondAmount: 0,

  // Timing settings
  maxWorkStartDelay: 86400,
  maxWorkApprovalDelay: 86400,
  delayUnit: 'seconds',

  // Approval and contract type
  approvalMode: 'seeker',
  contractType: 'bid',

  // Dispute handling
  contractSurvivesAdverseFurnisherDisputeResolution: false,

  // Bounty increase settings
  bountyIncreaseAllowanceMode: 'forbidden',
  bountyIncreaseCutoffPoint: 'bid-acceptance',

  // Network settings - CONFIGURED FOR LOCAL LARS
  platformKey: '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
  topic: 'tm_escrow',
  service: 'ls_escrow',
  keyDerivationProtocol: [2, 'escrow v1 lars test'],
  networkPreset: 'local'
}

// Test configuration for TYPE_BOUNTY contracts with approval required
export const TEST_GLOBAL_CONFIG_BOUNTY: GlobalConfig = {
  ...TEST_GLOBAL_CONFIG_BID,
  contractType: 'bounty',
  bountySolversNeedApproval: true, // Changed to true for traditional bidding flow
  furnisherBondingMode: 'required',
  requiredBondAmount: 500
}

// Test configuration for TYPE_BOUNTY contracts with race-to-solve (no approval)
export const TEST_GLOBAL_CONFIG_BOUNTY_RACE: GlobalConfig = {
  ...TEST_GLOBAL_CONFIG_BID,
  contractType: 'bounty',
  bountySolversNeedApproval: false, // Race mode - furnishers submit work directly
  furnisherBondingMode: 'required',
  requiredBondAmount: 500
}

export interface TestContext {
  wallet: WalletClient
  healthChecker: WalletHealthChecker
  isMetaNetAvailable: boolean
  isLARSAvailable: boolean
  broadcaster: TopicBroadcaster
  resolver: LookupResolver
}

/**
 * Initialize test context (wallet, broadcaster, resolver)
 */
export async function initializeTestContext(): Promise<TestContext> {
  const wallet = new WalletClient('auto', 'localhost')
  const healthChecker = new WalletHealthChecker(wallet)

  const health = await healthChecker.checkConnection()
  const isMetaNetAvailable = health.available && health.authenticated

  if (!isMetaNetAvailable) {
    console.log('\n⚠️  MetaNet Desktop not running - skipping tests\n')
    console.log('To run these tests:')
    console.log('1. Clone: git clone https://github.com/bsv-blockchain/metanet-desktop.git')
    console.log('2. Setup: cd metanet-desktop && npm install')
    console.log('3. Start: npm run tauri dev')
    console.log('4. Complete wallet setup (local/testnet recommended)')
    console.log('5. Setup LARS (see LARSIntegration.test.ts header)')
    console.log('6. Re-run tests\n')

    if (health.error) {
      console.log('Error details:', health.error, '\n')
    }

    return {
      wallet,
      healthChecker,
      isMetaNetAvailable: false,
      isLARSAvailable: false,
      broadcaster: null as any,
      resolver: null as any
    }
  }

  console.log('\n✅ MetaNet Desktop connected and authenticated\n')

  let broadcaster: TopicBroadcaster
  let resolver: LookupResolver
  let isLARSAvailable = false

  try {
    broadcaster = new TopicBroadcaster(['tm_escrow'], {
      networkPreset: TEST_GLOBAL_CONFIG_BID.networkPreset
    })

    resolver = new LookupResolver({
      networkPreset: TEST_GLOBAL_CONFIG_BID.networkPreset
    })

    isLARSAvailable = true
    console.log('✅ Overlay network components initialized\n')
  } catch (error) {
    console.log('\n⚠️  LARS overlay network might not be available')
    console.log('Error:', error instanceof Error ? error.message : String(error))
    broadcaster = null as any
    resolver = null as any
  }

  try {
    const { network } = await wallet.getNetwork({})
    console.log(`📡 Wallet network: ${network}`)
    console.log(`📡 Test configuration: ${TEST_GLOBAL_CONFIG_BID.networkPreset}\n`)
  } catch (error) {
    console.warn('Could not verify network:', error)
  }

  return {
    wallet,
    healthChecker,
    isMetaNetAvailable,
    isLARSAvailable,
    broadcaster,
    resolver
  }
}

/**
 * Generate unique work description for testing
 */
export function generateUniqueWorkDescription(description: string): string {
  return `E2E Test ${Date.now()} - ${description}`
}

/**
 * Wait for overlay network propagation
 */
export async function waitForPropagation(seconds: number = 2): Promise<void> {
  console.log(`⏳ Waiting for overlay network propagation (${seconds} seconds)...`)
  await new Promise(resolve => setTimeout(resolve, seconds * 1000))
}
