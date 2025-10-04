/**
 * Unit Tests
 *
 * Tests for individual utility functions and components
 */

import { recordFromContract, contractFromGlobalConfigAndParams } from '../src/utils.js'
import { EscrowContract } from '../src/contracts/Escrow.js'
import {
  TEST_GLOBAL_CONFIG,
  TEST_SEEKER_PRIVATE_KEY,
  TEST_WORK_DESCRIPTIONS,
  TEST_AMOUNTS,
  createWorkDeadline,
  advanceTime
} from './test-config.js'
import {
  generateWorkDescription,
  generateBidAmount,
  generateBondAmount,
  generateTimeEstimate,
  assertDefined,
  assertNotEmpty,
  MockWallet,
  MockBroadcaster,
  MockLookupResolver
} from './test-utils.js'
import escrowArtifact from '../artifacts/Escrow.json'

// Load artifact before running tests
beforeAll(() => {
  EscrowContract.loadArtifact(escrowArtifact)
})

describe('Utility Functions', () => {
  describe('contractFromGlobalConfigAndParams', () => {
    it('should create contract with correct initial state', () => {
      const seekerKey = TEST_SEEKER_PRIVATE_KEY.toPublicKey().toString()
      const workDescription = TEST_WORK_DESCRIPTIONS.simple
      const deadline = createWorkDeadline(168)

      const contract = contractFromGlobalConfigAndParams(
        TEST_GLOBAL_CONFIG,
        seekerKey,
        workDescription,
        deadline
      )

      expect(contract).toBeDefined()
      expect(contract.seekerKey.toString()).toBe(seekerKey)
      expect(contract.platformKey.toString()).toBe(TEST_GLOBAL_CONFIG.platformKey)
      // workDescription is stored as hex ByteString
      expect(Buffer.from(contract.workDescription.toString(), 'hex').toString('utf8')).toBe(workDescription)
      expect(contract.workCompletionDeadline).toBe(BigInt(deadline))
      expect(contract.status).toBe(EscrowContract.STATUS_INITIAL)
      expect(contract.bidAcceptedBy).toBe(EscrowContract.BID_NOT_YET_ACCEPTED)
      expect(contract.bids.length).toBe(4) // Fixed array of 4 bids
    })

    it('should apply all global config settings correctly', () => {
      const contract = contractFromGlobalConfigAndParams(
        TEST_GLOBAL_CONFIG,
        TEST_SEEKER_PRIVATE_KEY.toPublicKey().toString(),
        TEST_WORK_DESCRIPTIONS.simple,
        createWorkDeadline(168)
      )

      expect(Number(contract.minAllowableBid)).toBe(TEST_GLOBAL_CONFIG.minAllowableBid)
      expect(Number(contract.escrowServiceFeeBasisPoints)).toBe(TEST_GLOBAL_CONFIG.escrowServiceFeeBasisPoints)
      expect(Number(contract.maxWorkStartDelay)).toBe(TEST_GLOBAL_CONFIG.maxWorkStartDelay)
      expect(Number(contract.maxWorkApprovalDelay)).toBe(TEST_GLOBAL_CONFIG.maxWorkApprovalDelay)

      // Verify contract type
      if (TEST_GLOBAL_CONFIG.contractType === 'bid') {
        expect(contract.contractType).toBe(EscrowContract.TYPE_BID)
      } else {
        expect(contract.contractType).toBe(EscrowContract.TYPE_BOUNTY)
      }

      // Verify bonding mode
      if (TEST_GLOBAL_CONFIG.furnisherBondingMode === 'optional') {
        expect(contract.furnisherBondingMode).toBe(EscrowContract.FURNISHER_BONDING_MODE_OPTIONAL)
      }

      console.log('✓ All global config settings applied correctly')
    })

    it('should handle different contract types', () => {
      const seekerKey = TEST_SEEKER_PRIVATE_KEY.toPublicKey().toString()

      // Create bid contract
      const bidContract = contractFromGlobalConfigAndParams(
        TEST_GLOBAL_CONFIG,
        seekerKey,
        TEST_WORK_DESCRIPTIONS.simple,
        createWorkDeadline(168)
      )

      expect(bidContract.contractType).toBe(EscrowContract.TYPE_BID)

      // Create bounty config
      const bountyConfig = {
        ...TEST_GLOBAL_CONFIG,
        contractType: 'bounty' as const
      }

      const bountyContract = contractFromGlobalConfigAndParams(
        bountyConfig,
        seekerKey,
        TEST_WORK_DESCRIPTIONS.simple,
        createWorkDeadline(168)
      )

      expect(bountyContract.contractType).toBe(EscrowContract.TYPE_BOUNTY)

      console.log('✓ Both contract types (BID and BOUNTY) working')
    })
  })

  describe('recordFromContract', () => {
    it('should convert contract to record format', () => {
      const contract = contractFromGlobalConfigAndParams(
        TEST_GLOBAL_CONFIG,
        TEST_SEEKER_PRIVATE_KEY.toPublicKey().toString(),
        TEST_WORK_DESCRIPTIONS.simple,
        createWorkDeadline(168)
      )

      const record = recordFromContract('test-txid', 0, contract)

      expect(record.txid).toBe('test-txid')
      expect(record.outputIndex).toBe(0)
      expect(record.status).toBe('initial')
      expect(record.contractType).toBe('bid')
      expect(record.seekerKey).toBe(TEST_SEEKER_PRIVATE_KEY.toPublicKey().toString())
      // workDescription is stored as hex in the record
      expect(Buffer.from(record.workDescription, 'hex').toString('utf8')).toBe(TEST_WORK_DESCRIPTIONS.simple)
      expect(Array.isArray(record.bids)).toBe(true)
    })

    it('should correctly map all status values', () => {
      const statuses = [
        { contract: EscrowContract.STATUS_INITIAL, expected: 'initial' },
        { contract: EscrowContract.STATUS_BID_ACCEPTED, expected: 'bid-accepted' },
        { contract: EscrowContract.STATUS_WORK_STARTED, expected: 'work-started' },
        { contract: EscrowContract.STATUS_WORK_SUBMITTED, expected: 'work-submitted' },
        { contract: EscrowContract.STATUS_RESOLVED, expected: 'resolved' },
        { contract: EscrowContract.STATUS_DISPUTED_BY_SEEKER, expected: 'disputed-by-seeker' },
        { contract: EscrowContract.STATUS_DISPUTED_BY_FURNISHER, expected: 'disputed-by-furnisher' }
      ]

      statuses.forEach(({ contract: status, expected }) => {
        const mockContract = contractFromGlobalConfigAndParams(
          TEST_GLOBAL_CONFIG,
          TEST_SEEKER_PRIVATE_KEY.toPublicKey().toString(),
          TEST_WORK_DESCRIPTIONS.simple,
          createWorkDeadline(168)
        )
        mockContract.status = status

        const record = recordFromContract('txid', 0, mockContract)
        expect(record.status).toBe(expected)
      })

      console.log('✓ All status mappings correct')
    })

    it('should correctly map bonding modes', () => {
      const modes = [
        { contract: EscrowContract.FURNISHER_BONDING_MODE_FORBIDDEN, expected: 'forbidden' },
        { contract: EscrowContract.FURNISHER_BONDING_MODE_OPTIONAL, expected: 'optional' },
        { contract: EscrowContract.FURNISHER_BONDING_MODE_REQUIRED, expected: 'required' }
      ]

      modes.forEach(({ contract: mode, expected }) => {
        const mockContract = contractFromGlobalConfigAndParams(
          TEST_GLOBAL_CONFIG,
          TEST_SEEKER_PRIVATE_KEY.toPublicKey().toString(),
          TEST_WORK_DESCRIPTIONS.simple,
          createWorkDeadline(168)
        )
        mockContract.furnisherBondingMode = mode

        const record = recordFromContract('txid', 0, mockContract)
        expect(record.furnisherBondingMode).toBe(expected)
      })

      console.log('✓ All bonding mode mappings correct')
    })
  })
})

describe('Test Configuration', () => {
  describe('createWorkDeadline', () => {
    it('should create deadline in the future', () => {
      const hoursFromNow = 24
      const deadline = createWorkDeadline(hoursFromNow)
      const now = Math.floor(Date.now() / 1000)

      expect(deadline).toBeGreaterThan(now)
      expect(deadline).toBeLessThanOrEqual(now + (hoursFromNow * 3600) + 10) // Allow 10s tolerance

      console.log(`✓ Deadline created: ${hoursFromNow} hours from now (${deadline})`)
    })

    it('should create different deadlines for different hours', () => {
      const deadline1 = createWorkDeadline(1)
      const deadline2 = createWorkDeadline(24)
      const deadline3 = createWorkDeadline(168)

      expect(deadline2).toBeGreaterThan(deadline1)
      expect(deadline3).toBeGreaterThan(deadline2)

      console.log('✓ Multiple deadlines created correctly')
    })
  })

  describe('advanceTime', () => {
    it('should advance time by specified seconds', () => {
      const now = Math.floor(Date.now() / 1000)
      const advanced = advanceTime(3600)

      expect(advanced).toBeGreaterThan(now)
      expect(advanced).toBeLessThanOrEqual(now + 3600 + 1)

      console.log(`✓ Time advanced by 3600 seconds`)
    })
  })

  describe('test amounts', () => {
    it('should have valid test amounts', () => {
      expect(TEST_AMOUNTS.minBid).toBeGreaterThan(0)
      expect(TEST_AMOUNTS.standardBid).toBeGreaterThanOrEqual(TEST_AMOUNTS.minBid)
      expect(TEST_AMOUNTS.largeBid).toBeGreaterThan(TEST_AMOUNTS.standardBid)
      expect(TEST_AMOUNTS.standardBond).toBeGreaterThan(0)

      console.log('✓ All test amounts valid')
    })
  })
})

describe('Test Utilities', () => {
  describe('MockWallet', () => {
    it('should create wallet with private key', () => {
      const wallet = new MockWallet(TEST_SEEKER_PRIVATE_KEY)

      expect(wallet).toBeDefined()
      expect(wallet.getPrivateKey()).toBe(TEST_SEEKER_PRIVATE_KEY)
      expect(wallet.getPublicKeySync().toString()).toBe(TEST_SEEKER_PRIVATE_KEY.toPublicKey().toString())

      console.log('✓ MockWallet created successfully')
    })

    it('should handle height management', async () => {
      const wallet = new MockWallet(TEST_SEEKER_PRIVATE_KEY)

      const initialHeight = await wallet.getHeight({})
      expect(initialHeight.height).toBeGreaterThan(0)

      wallet.setHeight(900000)
      const newHeight = await wallet.getHeight({})
      expect(newHeight.height).toBe(900000)

      wallet.advanceHeight(144)
      const advancedHeight = await wallet.getHeight({})
      expect(advancedHeight.height).toBe(900144)

      console.log('✓ Height management working')
    })

    it('should manage outputs correctly', async () => {
      const wallet = new MockWallet(TEST_SEEKER_PRIVATE_KEY)

      wallet.addOutput({ id: 1, basket: 'test' })
      wallet.addOutput({ id: 2, basket: 'test' })
      wallet.addOutput({ id: 3, basket: 'other' })

      const allOutputs = await wallet.listOutputs()
      expect(allOutputs.totalOutputs).toBe(3)

      const testBasket = await wallet.listOutputs({ basket: 'test' })
      expect(testBasket.totalOutputs).toBe(2)

      wallet.clearOutputs()
      const afterClear = await wallet.listOutputs()
      expect(afterClear.totalOutputs).toBe(0)

      console.log('✓ Output management working')
    })

    it('should derive public keys', async () => {
      const wallet = new MockWallet(TEST_SEEKER_PRIVATE_KEY)

      const result = await wallet.getPublicKey({
        counterparty: 'self',
        protocolID: [2, 'test-protocol'],
        keyID: '1'
      })

      expect(result.publicKey).toBeDefined()
      expect(typeof result.publicKey).toBe('string')
      expect(result.publicKey.length).toBeGreaterThan(0)

      console.log(`✓ Public key derived: ${result.publicKey.substring(0, 20)}...`)
    })

    it('should create signatures', async () => {
      const wallet = new MockWallet(TEST_SEEKER_PRIVATE_KEY)
      const dataToSign = Array.from(Buffer.from('test data'))

      const result = await wallet.createSignature({
        protocolID: [2, 'test'],
        keyID: '1',
        counterparty: 'self',
        data: dataToSign
      })

      expect(result.signature).toBeDefined()
      expect(Array.isArray(result.signature) || typeof result.signature === 'string').toBe(true)

      console.log('✓ Signature created successfully')
    })
  })

  describe('MockBroadcaster', () => {
    it('should track broadcasted transactions', async () => {
      const broadcaster = new MockBroadcaster()
      const { Transaction } = await import('@bsv/sdk')

      const tx1 = new Transaction()
      const tx2 = new Transaction()

      await broadcaster.broadcast(tx1)
      await broadcaster.broadcast(tx2)

      expect(broadcaster.broadcastedTransactions.length).toBe(2)
      expect(broadcaster.getLastTransaction()).toBe(tx2)

      broadcaster.clear()
      expect(broadcaster.broadcastedTransactions.length).toBe(0)

      console.log('✓ MockBroadcaster working correctly')
    })
  })

  describe('MockLookupResolver', () => {
    it('should store and retrieve records', async () => {
      const resolver = new MockLookupResolver()

      resolver.storeRecord({ key: 'value' }, { data: 'test1' })
      resolver.storeRecord({ key: 'value' }, { data: 'test2' })
      resolver.storeRecord({ other: 'query' }, { data: 'test3' })

      const result1 = await resolver.query({
        service: 'test',
        query: { key: 'value' }
      })

      expect(result1.type).toBe('output-list')
      expect(result1.outputs.length).toBe(2)

      const result2 = await resolver.query({
        service: 'test',
        query: { other: 'query' }
      })

      expect(result2.outputs.length).toBe(1)

      resolver.clear()
      const afterClear = await resolver.query({
        service: 'test',
        query: { key: 'value' }
      })
      expect(afterClear.outputs.length).toBe(0)

      console.log('✓ MockLookupResolver working correctly')
    })
  })

  describe('Test Data Generators', () => {
    it('should generate random work descriptions', () => {
      const desc1 = generateWorkDescription()
      const desc2 = generateWorkDescription()

      expect(desc1).toBeDefined()
      expect(typeof desc1).toBe('string')
      expect(desc1.length).toBeGreaterThan(0)

      console.log(`✓ Generated: "${desc1}"`)
    })

    it('should generate bid amounts within bounds', () => {
      const bid1 = generateBidAmount(1000, 5000)
      const bid2 = generateBidAmount(1000, 5000)

      expect(bid1).toBeGreaterThanOrEqual(1000)
      expect(bid1).toBeLessThanOrEqual(5000)
      expect(bid2).toBeGreaterThanOrEqual(1000)
      expect(bid2).toBeLessThanOrEqual(5000)

      console.log(`✓ Generated bids: ${bid1}, ${bid2}`)
    })

    it('should generate bond amounts as percentage of bid', () => {
      const bidAmount = 10000
      const bond = generateBondAmount(bidAmount)

      expect(bond).toBeGreaterThan(0)
      expect(bond).toBeLessThan(bidAmount)
      expect(bond / bidAmount).toBeGreaterThanOrEqual(0.1)
      expect(bond / bidAmount).toBeLessThanOrEqual(0.2)

      console.log(`✓ Generated bond: ${bond} (${((bond / bidAmount) * 100).toFixed(1)}% of bid)`)
    })

    it('should generate time estimates', () => {
      const time = generateTimeEstimate(24, 168)

      expect(time).toBeGreaterThanOrEqual(24 * 3600)
      expect(time).toBeLessThanOrEqual(168 * 3600)

      const hours = time / 3600
      console.log(`✓ Generated time estimate: ${hours} hours`)
    })
  })

  describe('Assertion Helpers', () => {
    it('assertDefined should pass for defined values', () => {
      expect(() => assertDefined('value')).not.toThrow()
      expect(() => assertDefined(0)).not.toThrow()
      expect(() => assertDefined(false)).not.toThrow()
    })

    it('assertDefined should throw for undefined/null', () => {
      expect(() => assertDefined(undefined)).toThrow()
      expect(() => assertDefined(null)).toThrow()
    })

    it('assertNotEmpty should work correctly', () => {
      expect(() => assertNotEmpty([1, 2, 3])).not.toThrow()
      expect(() => assertNotEmpty([])).toThrow()
    })

    console.log('✓ All assertion helpers working')
  })
})

describe('Contract Constants', () => {
  it('should have all required status constants', () => {
    const statuses = [
      'STATUS_INITIAL',
      'STATUS_BID_ACCEPTED',
      'STATUS_WORK_STARTED',
      'STATUS_WORK_SUBMITTED',
      'STATUS_RESOLVED',
      'STATUS_DISPUTED_BY_SEEKER',
      'STATUS_DISPUTED_BY_FURNISHER'
    ]

    statuses.forEach(status => {
      expect(EscrowContract[status as keyof typeof EscrowContract]).toBeDefined()
    })

    console.log('✓ All status constants defined')
  })

  it('should have all required type constants', () => {
    expect(EscrowContract.TYPE_BOUNTY).toBe(1n)
    expect(EscrowContract.TYPE_BID).toBe(2n)

    console.log('✓ Type constants correct')
  })

  it('should have all bonding mode constants', () => {
    const modes = [
      'FURNISHER_BONDING_MODE_FORBIDDEN',
      'FURNISHER_BONDING_MODE_OPTIONAL',
      'FURNISHER_BONDING_MODE_REQUIRED'
    ]

    modes.forEach(mode => {
      expect(EscrowContract[mode as keyof typeof EscrowContract]).toBeDefined()
    })

    console.log('✓ All bonding mode constants defined')
  })

  it('should have all approval mode constants', () => {
    const modes = [
      'FURNISHER_APPROVAL_MODE_SEEKER',
      'FURNISHER_APPROVAL_MODE_PLATFORM',
      'FURNISHER_APPROVAL_MODE_SEEKER_OR_PLATFORM'
    ]

    modes.forEach(mode => {
      expect(EscrowContract[mode as keyof typeof EscrowContract]).toBeDefined()
    })

    console.log('✓ All approval mode constants defined')
  })
})
