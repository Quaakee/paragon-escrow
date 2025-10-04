/**
 * Simple Bid Flow Integration Test
 *
 * Tests the basic end-to-end flow:
 * 1. Seeker creates a TYPE_BID work contract
 * 2. Furnisher discovers the contract
 * 3. Furnisher places a bid
 * 4. Seeker views the bid
 *
 * Prerequisites:
 * - MetaNet Desktop running and authenticated
 * - LARS (Local ARC Relay Service) running
 * - Overlay services (Topic Manager + Lookup Service) running
 *
 * Run: npm test -- tests/integration/bidflow/SimpleBidFlow.test.ts
 */

import Seeker from '../../../src/entities/Seeker.js'
import Furnisher from '../../../src/entities/Furnisher.js'
import type { EscrowTX } from '../../../src/constants.js'
import {
  initializeTestContext,
  generateUniqueWorkDescription,
  waitForPropagation,
  TEST_GLOBAL_CONFIG_BID,
  type TestContext
} from './test-utils.js'

describe('Simple Bid Flow', () => {
  let context: TestContext
  let seeker: Seeker
  let furnisher: Furnisher

  jest.setTimeout(300000) // 5 minutes for wallet approval

  beforeAll(async () => {
    context = await initializeTestContext()
  }, 30000)

  beforeEach(() => {
    if (!context.isMetaNetAvailable || !context.isLARSAvailable) {
      return
    }

    seeker = new Seeker(TEST_GLOBAL_CONFIG_BID, context.wallet, context.broadcaster, context.resolver)
    furnisher = new Furnisher(TEST_GLOBAL_CONFIG_BID, context.wallet, context.broadcaster, context.resolver)
  })

  test('complete flow: seeker creates contract, furnisher finds and bids, seeker views bid', async () => {
    if (!context.isMetaNetAvailable || !context.isLARSAvailable) {
      return
    }

    console.log('\n🚀 Starting simple bid flow test...\n')

    // STEP 1: Seeker creates a work contract
    console.log('📝 STEP 1: Seeker creating work contract...')
    const workDescription = generateUniqueWorkDescription('Build a test widget')
    const workDeadline = Math.floor(Date.now() / 1000) + 86400 // 1 day from now
    const contractValue = 1 // TYPE_BID contracts start at 1 satoshi

    await seeker.seek(workDescription, workDeadline, contractValue)
    console.log('✅ Work contract created successfully')
    console.log(`   Description: ${workDescription}`)
    console.log(`   Value: ${contractValue} satoshi`)
    console.log(`   Type: TYPE_BID\n`)

    await waitForPropagation(2)

    // STEP 2: Furnisher lists available work and finds the contract
    console.log('📋 STEP 2: Furnisher listing available work...')
    const availableWork = await furnisher.listAvailableWork()
    console.log(`✅ Found ${availableWork.length} available contracts`)

    const workDescriptionHex = Buffer.from(workDescription, 'utf8').toString('hex')
    const targetContract = availableWork.find(w => w.record.workDescription === workDescriptionHex)
    expect(targetContract).toBeDefined()
    expect(targetContract!.record.status).toBe('initial')
    expect(targetContract!.record.contractType).toBe('bid')
    expect(targetContract!.satoshis).toBe(1)

    console.log('✅ Found our contract:')
    console.log(`   TXID: ${targetContract!.record.txid}`)
    console.log(`   Status: ${targetContract!.record.status}`)
    console.log(`   Contract Type: ${targetContract!.record.contractType}\n`)

    // STEP 3: Furnisher places a bid on the contract
    console.log('💰 STEP 3: Furnisher placing bid...')
    const bidAmount = 5000
    const bidPlans = 'I will build this widget using React and TypeScript with comprehensive tests'
    const timeRequired = Math.floor(Date.now() / 1000) + (7 * 24 * 3600) // Unix timestamp: completion in 7 days
    const bond = 500

    console.log('⏳ Please approve the bid transaction in MetaNet Desktop...')
    await furnisher.placeBid(targetContract!, bidAmount, bidPlans, timeRequired, bond)
    console.log('✅ Bid placed successfully')
    console.log(`   Bid Amount: ${bidAmount} satoshis`)
    console.log(`   Completion Time: ${new Date(timeRequired * 1000).toISOString()}`)
    console.log(`   Bond: ${bond} satoshis\n`)

    await waitForPropagation(2)

    // STEP 4: Seeker views the bid on their contract
    console.log('👀 STEP 4: Seeker viewing bids on their contract...')
    const seekerContracts = await seeker.getMyOpenContracts()
    console.log(`Found ${seekerContracts.length} contracts for seeker`)
    const updatedContract = seekerContracts.find((w: EscrowTX) => w.record.workDescription === workDescriptionHex)
    expect(updatedContract).toBeDefined()

    // CRITICAL: Verify contract value stayed at 1 satoshi for TYPE_BID
    expect(updatedContract!.satoshis).toBe(1)
    console.log('✅ Contract value correctly stayed at 1 satoshi (TYPE_BID behavior)')

    // Verify the bid was added
    // Note: Empty slots have bidAmount=0, real bids have bidAmount>0
    const realBids = updatedContract!.record.bids.filter((b: any) => b.bidAmount > 0)
    expect(realBids.length).toBeGreaterThanOrEqual(1)

    // Match bid by hex-encoded plans
    const bidPlansHex = Buffer.from(bidPlans, 'utf8').toString('hex')
    const ourBid = realBids.find((b: any) => b.plans === bidPlansHex)
    expect(ourBid).toBeDefined()
    expect(ourBid!.bidAmount).toBe(bidAmount)
    expect(ourBid!.bond).toBe(bond)
    expect(ourBid!.timeRequired).toBe(timeRequired)

    console.log('✅ Seeker can see the bid:')
    console.log(`   Total Bids: ${realBids.length}`)
    console.log(`   Bid Amount: ${ourBid!.bidAmount} satoshis`)
    console.log(`   Bid Plans: ${Buffer.from(ourBid!.plans, 'hex').toString('utf8').substring(0, 50)}...`)
    console.log(`   Time Required: ${new Date(ourBid!.timeRequired * 1000).toISOString()}`)
    console.log(`   Bond: ${ourBid!.bond} satoshis\n`)

    console.log('🎉 SUCCESS: Complete end-to-end bidding flow verified!\n')
  }, 300000)
})
