/**
 * Bounty Bid Flow Integration Test
 *
 * Tests the TYPE_BOUNTY contract workflow:
 * 1. Seeker creates a TYPE_BOUNTY contract with full bounty amount locked
 * 2. Furnisher discovers the bounty contract
 * 3. Furnisher places a bid (with required bond)
 * 4. Seeker views the bid
 * 5. Verify bounty amount stays locked (doesn't change to 1 satoshi)
 *
 * Key differences from TYPE_BID:
 * - Contract value starts at bounty amount (e.g., 10,000 sats), not 1 satoshi
 * - Bounty stays locked throughout bidding phase
 * - Required bond for furnisher (furnisherBondingMode: 'required')
 *
 * Prerequisites:
 * - MetaNet Desktop running and authenticated
 * - LARS (Local ARC Relay Service) running
 * - Overlay services (Topic Manager + Lookup Service) running
 *
 * Run: npm test -- tests/integration/bidflow/BountyBidFlow.test.ts
 */

import Seeker from '../../../src/entities/Seeker.js'
import Furnisher from '../../../src/entities/Furnisher.js'
import type { EscrowTX } from '../../../src/constants.js'
import {
  initializeTestContext,
  generateUniqueWorkDescription,
  waitForPropagation,
  TEST_GLOBAL_CONFIG_BOUNTY,
  type TestContext
} from './test-utils.js'

describe('Bounty Bid Flow', () => {
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

    seeker = new Seeker(TEST_GLOBAL_CONFIG_BOUNTY, context.wallet, context.broadcaster, context.resolver)
    furnisher = new Furnisher(TEST_GLOBAL_CONFIG_BOUNTY, context.wallet, context.broadcaster, context.resolver)
  })

  test('complete flow: seeker creates bounty, furnisher bids with bond, seeker views bid', async () => {
    if (!context.isMetaNetAvailable || !context.isLARSAvailable) {
      return
    }

    console.log('\n🚀 Starting bounty bid flow test...\n')

    // STEP 1: Seeker creates a TYPE_BOUNTY contract with full bounty locked
    console.log('📝 STEP 1: Seeker creating TYPE_BOUNTY contract...')
    const workDescription = generateUniqueWorkDescription('Find and fix security vulnerability')
    const workDeadline = Math.floor(Date.now() / 1000) + (7 * 24 * 3600) // 7 days from now
    const bountyAmount = 10000 // Full bounty amount locked upfront

    await seeker.seek(workDescription, workDeadline, bountyAmount)
    console.log('✅ Bounty contract created successfully')
    console.log(`   Description: ${workDescription}`)
    console.log(`   Bounty Amount: ${bountyAmount} satoshis (LOCKED)`)
    console.log(`   Type: TYPE_BOUNTY`)
    console.log(`   Deadline: ${new Date(workDeadline * 1000).toISOString()}\n`)

    await waitForPropagation(2)

    // STEP 2: Furnisher lists available bounties and finds the contract
    console.log('📋 STEP 2: Furnisher listing available bounties...')
    const availableBounties = await furnisher.listAvailableWork()
    console.log(`✅ Found ${availableBounties.length} available contracts`)

    const workDescriptionHex = Buffer.from(workDescription, 'utf8').toString('hex')
    const targetBounty = availableBounties.find(w => w.record.workDescription === workDescriptionHex)
    expect(targetBounty).toBeDefined()
    expect(targetBounty!.record.status).toBe('initial')
    expect(targetBounty!.record.contractType).toBe('bounty')

    // CRITICAL: Bounty contracts keep the bounty amount, not 1 satoshi
    expect(targetBounty!.satoshis).toBe(bountyAmount)

    console.log('✅ Found our bounty contract:')
    console.log(`   TXID: ${targetBounty!.record.txid}`)
    console.log(`   Status: ${targetBounty!.record.status}`)
    console.log(`   Contract Type: ${targetBounty!.record.contractType}`)
    console.log(`   Locked Bounty: ${targetBounty!.satoshis} satoshis\n`)

    // STEP 3: Furnisher places a bid with REQUIRED bond
    console.log('💰 STEP 3: Furnisher placing bid (with required bond)...')
    // CRITICAL: For TYPE_BOUNTY, bidAmount MUST equal the bounty value
    const bidAmount = bountyAmount // Must match the locked bounty (10000 sats)
    const bidPlans = 'I will audit the codebase, identify the vulnerability, and provide a comprehensive fix with security tests'
    const timeRequired = Math.floor(Date.now() / 1000) + (5 * 24 * 3600) // Unix timestamp: completion in 5 days
    const bond = 500 // Required bond for TYPE_BOUNTY contracts (from TEST_GLOBAL_CONFIG_BOUNTY)

    console.log(`   Bid Amount: ${bidAmount} satoshis (must equal bounty for TYPE_BOUNTY)`)
    console.log(`   Required Bond: ${bond} satoshis`)
    console.log(`   Time to Complete: 5 days`)
    console.log('⏳ Please approve the bid transaction in MetaNet Desktop...')

    await furnisher.placeBid(targetBounty!, bidAmount, bidPlans, timeRequired, bond)
    console.log('✅ Bid placed successfully with required bond\n')

    await waitForPropagation(2)

    // STEP 4: Seeker views the bid on their bounty contract
    console.log('👀 STEP 4: Seeker viewing bids on bounty contract...')
    const seekerContracts = await seeker.getMyOpenContracts()
    console.log(`Found ${seekerContracts.length} contracts for seeker`)
    const updatedBounty = seekerContracts.find((w: EscrowTX) => w.record.workDescription === workDescriptionHex)
    expect(updatedBounty).toBeDefined()

    // CRITICAL: Verify bounty amount stayed locked (didn't drop to 1 satoshi)
    expect(updatedBounty!.satoshis).toBe(bountyAmount)
    console.log(`✅ Bounty amount correctly stayed at ${bountyAmount} satoshis (TYPE_BOUNTY behavior)`)

    // Verify the bid was added
    // Note: Empty slots have bidAmount=0, real bids have bidAmount>0
    const realBids = updatedBounty!.record.bids.filter((b: any) => b.bidAmount > 0)
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
    console.log(`   Bond Posted: ${ourBid!.bond} satoshis (required)`)
    console.log(`   Bid Plans: ${Buffer.from(ourBid!.plans, 'hex').toString('utf8').substring(0, 60)}...`)
    console.log(`   Completion Time: ${new Date(ourBid!.timeRequired * 1000).toISOString()}`)
    console.log(`   Locked Bounty: ${updatedBounty!.satoshis} satoshis\n`)

    console.log('🎉 SUCCESS: Complete TYPE_BOUNTY bidding flow verified!')
    console.log('   ✓ Bounty stayed locked at original amount')
    console.log('   ✓ Required bond was enforced')
    console.log('   ✓ Bid recorded correctly\n')
  }, 300000)
})
