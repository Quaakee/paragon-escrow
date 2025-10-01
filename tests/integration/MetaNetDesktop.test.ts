/**
 * MetaNet Desktop Integration Tests
 *
 * These tests verify that the escrow system works correctly with MetaNet Desktop.
 * They are conditional and will skip if MetaNet Desktop is not running.
 *
 * Prerequisites:
 * 1. Clone and setup MetaNet Desktop:
 *    git clone https://github.com/bsv-blockchain/metanet-desktop.git
 *    cd metanet-desktop && npm install
 *
 * 2. Start MetaNet Desktop:
 *    npm run tauri dev
 *
 * 3. Complete wallet setup (testnet recommended):
 *    - Choose network: testnet
 *    - Complete authentication
 *    - Unlock wallet
 *
 * 4. Run these tests:
 *    npm test -- tests/integration/MetaNetDesktop.test.ts
 */

import { WalletClient } from '@bsv/sdk'
import { WalletHealthChecker } from '../../src/utils/wallet-health.js'
import Seeker from '../../src/entities/Seeker.js'
import Furnisher from '../../src/entities/Furnisher.js'
import Platform from '../../src/entities/Platform.js'
import type { GlobalConfig } from '../../src/constants.js'

// Test configuration for testnet
const TEST_GLOBAL_CONFIG: GlobalConfig = {
  // Financial settings
  minAllowableBid: 1000,
  escrowServiceFeeBasisPoints: 250,

  // Authorization settings
  platformAuthorizationRequired: false,
  escrowMustBeFullyDecisive: true,
  bountySolversNeedApproval: false,

  // Bonding settings
  furnisherBondingMode: 'optional',
  requiredBondAmount: 0,

  // Timing settings
  maxWorkStartDelay: 86400,
  maxWorkApprovalDelay: 86400,
  delayUnit: 'seconds',

  // Approval and contract type
  approvalMode: 'seeker',
  contractType: 'bounty',

  // Dispute handling
  contractSurvivesAdverseFurnisherDisputeResolution: false,

  // Bounty increase settings
  bountyIncreaseAllowanceMode: 'by-seeker',
  bountyIncreaseCutoffPoint: 'bid-acceptance',

  // Network settings
  platformKey: '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798', // Dummy platform key for testing
  topic: 'tm_escrow_test',
  service: 'ls_escrow_test',
  keyDerivationProtocol: [2, 'escrow-v1-test'],
  networkPreset: 'testnet'
}

describe('MetaNet Desktop Integration', () => {
  let wallet: WalletClient
  let healthChecker: WalletHealthChecker
  let isMetaNetAvailable: boolean

  beforeAll(async () => {
    wallet = new WalletClient('auto', 'localhost')
    healthChecker = new WalletHealthChecker(wallet)

    // Check if MetaNet Desktop is available
    const health = await healthChecker.checkConnection()
    isMetaNetAvailable = health.available && health.authenticated

    if (!isMetaNetAvailable) {
      console.log('\n⚠️  MetaNet Desktop not running - skipping integration tests\n')
      console.log('To run these tests:')
      console.log('1. Clone: git clone https://github.com/bsv-blockchain/metanet-desktop.git')
      console.log('2. Setup: cd metanet-desktop && npm install')
      console.log('3. Start: npm run tauri dev')
      console.log('4. Complete wallet setup (testnet recommended)')
      console.log('5. Re-run tests\n')

      if (health.error) {
        console.log('Error details:')
        console.log(health.error)
        console.log('')
      }
    } else {
      console.log('\n✅ MetaNet Desktop connected and authenticated\n')

      // Verify we're on testnet
      try {
        const { network } = await wallet.getNetwork({})
        if (network !== 'testnet') {
          console.warn('⚠️  Wallet is on mainnet! These tests should run on testnet.')
          console.warn('   Please switch to testnet in MetaNet Desktop.\n')
        }
      } catch (error) {
        console.warn('Could not verify network:', error)
      }
    }
  }, 30000) // Longer timeout for wallet connection

  describe('Wallet Health Checks', () => {
    it('should check wallet connection', async () => {
      if (!isMetaNetAvailable) {
        return // Skip test
      }

      const health = await healthChecker.checkConnection()
      expect(health.available).toBe(true)
      expect(health.authenticated).toBe(true)
      expect(health.error).toBeUndefined()
    })

    it('should get user-friendly status message', async () => {
      if (!isMetaNetAvailable) {
        return // Skip test
      }

      const status = await healthChecker.getStatusMessage()
      expect(status).toContain('✅')
      expect(status).toContain('connected')
      expect(status).toContain('authenticated')
    })

    it('should ensure wallet availability without throwing', async () => {
      if (!isMetaNetAvailable) {
        return // Skip test
      }

      await expect(
        healthChecker.ensureAvailable()
      ).resolves.not.toThrow()
    })
  })

  describe('BRC-100 Basic Operations', () => {
    it('should get wallet version', async () => {
      if (!isMetaNetAvailable) {
        return // Skip test
      }

      const result = await wallet.getVersion({})
      expect(result.version).toBeDefined()
      expect(typeof result.version).toBe('string')
    })

    it('should get network type', async () => {
      if (!isMetaNetAvailable) {
        return // Skip test
      }

      const result = await wallet.getNetwork({})
      expect(result.network).toBeDefined()
      expect(['main', 'test']).toContain(result.network)
    })

    it('should get blockchain height', async () => {
      if (!isMetaNetAvailable) {
        return // Skip test
      }

      const result = await wallet.getHeight({})
      expect(result.height).toBeDefined()
      expect(typeof result.height).toBe('number')
      expect(result.height).toBeGreaterThan(0)
    })

    it('should check authentication status', async () => {
      if (!isMetaNetAvailable) {
        return // Skip test
      }

      const result = await wallet.isAuthenticated({})
      expect(result.authenticated).toBe(true)
    })
  })

  describe('BRC-42 Key Derivation', () => {
    it('should derive public key with protocol ID', async () => {
      if (!isMetaNetAvailable) {
        return // Skip test
      }

      const result = await wallet.getPublicKey({
        counterparty: 'self',
        protocolID: TEST_GLOBAL_CONFIG.keyDerivationProtocol,
        keyID: '1'
      })

      expect(result.publicKey).toBeDefined()
      expect(result.publicKey).toMatch(/^[0-9a-f]{66}$/i) // 33 bytes hex (compressed)
    })

    it('should derive different keys for different protocols', async () => {
      if (!isMetaNetAvailable) {
        return // Skip test
      }

      const key1 = await wallet.getPublicKey({
        counterparty: 'self',
        protocolID: [2, 'protocol-1'],
        keyID: '1'
      })

      const key2 = await wallet.getPublicKey({
        counterparty: 'self',
        protocolID: [2, 'protocol-2'],
        keyID: '1'
      })

      expect(key1.publicKey).not.toBe(key2.publicKey)
    })

    it('should derive different keys for different key IDs', async () => {
      if (!isMetaNetAvailable) {
        return // Skip test
      }

      const key1 = await wallet.getPublicKey({
        counterparty: 'self',
        protocolID: TEST_GLOBAL_CONFIG.keyDerivationProtocol,
        keyID: '1'
      })

      const key2 = await wallet.getPublicKey({
        counterparty: 'self',
        protocolID: TEST_GLOBAL_CONFIG.keyDerivationProtocol,
        keyID: '2'
      })

      expect(key1.publicKey).not.toBe(key2.publicKey)
    })
  })

  describe('Signature Creation', () => {
    it('should create signature for data', async () => {
      if (!isMetaNetAvailable) {
        return // Skip test
      }

      const testData = Array.from(Buffer.from('test data for signing'))

      const result = await wallet.createSignature({
        protocolID: TEST_GLOBAL_CONFIG.keyDerivationProtocol,
        keyID: '1',
        counterparty: 'self',
        data: testData
      })

      expect(result.signature).toBeDefined()
      expect(result.signature).toMatch(/^[0-9a-f]+$/i) // Hex string
    })
  })

  describe('Entity Classes', () => {
    let seeker: Seeker
    let furnisher: Furnisher
    let platform: Platform

    beforeEach(() => {
      if (!isMetaNetAvailable) {
        return // Skip setup
      }

      seeker = new Seeker(TEST_GLOBAL_CONFIG, wallet)
      furnisher = new Furnisher(TEST_GLOBAL_CONFIG, wallet)
      platform = new Platform(TEST_GLOBAL_CONFIG, wallet)
    })

    it('should create Seeker instance with MetaNet wallet', () => {
      if (!isMetaNetAvailable) {
        return // Skip test
      }

      expect(seeker).toBeDefined()
      expect(seeker).toBeInstanceOf(Seeker)
    })

    it('should create Furnisher instance with MetaNet wallet', () => {
      if (!isMetaNetAvailable) {
        return // Skip test
      }

      expect(furnisher).toBeDefined()
      expect(furnisher).toBeInstanceOf(Furnisher)
    })

    it('should create Platform instance with MetaNet wallet', () => {
      if (!isMetaNetAvailable) {
        return // Skip test
      }

      expect(platform).toBeDefined()
      expect(platform).toBeInstanceOf(Platform)
    })

    // Note: Full workflow tests require:
    // - Overlay service running (MongoDB)
    // - Topic manager configured
    // - Multiple wallet instances (seeker, furnisher, platform)
    // These are better suited for end-to-end tests in a staging environment
  })

  describe('Error Handling', () => {
    it('should handle wallet unavailability gracefully', async () => {
      // This test always runs to verify error handling works
      const disconnectedWallet = new WalletClient('auto', 'http://127.0.0.1:9999') // Wrong port
      const checker = new WalletHealthChecker(disconnectedWallet)

      const health = await checker.checkConnection()

      expect(health.available).toBe(false)
      expect(health.error).toBeDefined()
      expect(health.error).toContain('not running')
    })

    it('should provide helpful error messages', async () => {
      const disconnectedWallet = new WalletClient('auto', 'http://127.0.0.1:9999')
      const checker = new WalletHealthChecker(disconnectedWallet)

      const health = await checker.checkConnection()

      // Error message should include helpful troubleshooting steps
      expect(health.error).toContain('127.0.0.1:3321')
      expect(health.error).toContain('npm run tauri dev')
    })
  })

  describe('Output Management', () => {
    it('should list wallet outputs', async () => {
      if (!isMetaNetAvailable) {
        return // Skip test
      }

      const result = await wallet.listOutputs({
        basket: 'default',
        limit: 10
      })

      expect(result.outputs).toBeDefined()
      expect(Array.isArray(result.outputs)).toBe(true)
    })

    it('should list outputs with custom basket', async () => {
      if (!isMetaNetAvailable) {
        return // Skip test
      }

      // Try to list outputs from escrow-disputes basket
      // This might be empty if no disputes have been recorded yet
      const result = await wallet.listOutputs({
        basket: 'escrow-disputes',
        tags: ['dispute', 'escrow'],
        limit: 10
      })

      expect(result.outputs).toBeDefined()
      expect(Array.isArray(result.outputs)).toBe(true)
    })
  })
})

/**
 * Manual Testing Instructions
 *
 * For comprehensive testing with MetaNet Desktop:
 *
 * 1. Setup Test Environment:
 *    - Use testnet for safety
 *    - Ensure you have testnet coins (use faucet)
 *
 * 2. Test Seeker Workflow:
 *    const seeker = new Seeker(TEST_GLOBAL_CONFIG, wallet)
 *    await seeker.seek('Test work', Date.now() + 86400, 1000)
 *    const contracts = await seeker.getMyOpenContracts()
 *
 * 3. Test Furnisher Workflow:
 *    const furnisher = new Furnisher(TEST_GLOBAL_CONFIG, wallet)
 *    const available = await furnisher.listAvailableWork()
 *    await furnisher.placeBid(contracts[0], 500, 'My plans', 3600, 100)
 *
 * 4. Monitor Wallet:
 *    - Check transactions in MetaNet Desktop
 *    - Verify outputs are tracked correctly
 *    - Test dispute resolution flows
 *
 * 5. Test Error Recovery:
 *    - Stop MetaNet Desktop during operation
 *    - Verify error messages are helpful
 *    - Restart and verify recovery
 */
