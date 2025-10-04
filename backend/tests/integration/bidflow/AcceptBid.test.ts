/**
 * Accept Bid Integration Test
 *
 * Tests the bid acceptance workflow for TYPE_BID contracts:
 * 1. Seeker creates a TYPE_BID work contract (1 satoshi)
 * 2. Furnisher places a bid on the contract
 * 3. Seeker accepts the furnisher's bid
 * 4. Verify contract state transitions correctly
 *
 * This test validates the critical state transition from 'initial' to 'bid-accepted'
 * and ensures the contract UTXO is updated properly with the chosen bid amount.
 *
 * Prerequisites:
 * - MetaNet Desktop running and authenticated
 * - LARS (Local ARC Relay Service) running
 * - Overlay services (Topic Manager + Lookup Service) running
 *
 * Run: npm test -- tests/integration/bidflow/AcceptBid.test.ts
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

describe('Accept Bid Flow', () => {
  let context: TestContext
  let seeker: Seeker
  let furnisher: Furnisher

  jest.setTimeout(300000) // 5 minutes for wallet approvals

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

  test('complete flow: create contract, place bid, accept bid, verify state transition', async () => {
    if (!context.isMetaNetAvailable || !context.isLARSAvailable) {
      return
    }

    console.log('\n🚀 Starting accept bid flow test...\n')

    // ============================================================================
    // STEP 1: Seeker creates a TYPE_BID work contract
    // ============================================================================
    console.log('📝 STEP 1: Seeker creating TYPE_BID work contract...')
    const workDescription = generateUniqueWorkDescription('Implement authentication system')
    const workDeadline = Math.floor(Date.now() / 1000) + (30 * 24 * 3600) // 30 days from now
    const contractValue = 1 // TYPE_BID contracts start at 1 satoshi

    await seeker.seek(workDescription, workDeadline, contractValue)
    console.log('✅ Work contract created successfully')
    console.log(`   Description: ${workDescription}`)
    console.log(`   Value: ${contractValue} satoshi (TYPE_BID)\n`)

    await waitForPropagation(2)

    // ============================================================================
    // STEP 2: Furnisher discovers and places bid
    // ============================================================================
    console.log('💰 STEP 2: Furnisher discovering contract and placing bid...')
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
    console.log(`   Status: ${targetContract!.record.status}\n`)

    // Place bid
    const bidAmount = 10000 // 10,000 satoshis
    const bidPlans = 'I will implement authentication with JWT tokens, refresh tokens, and role-based access control. Will include comprehensive tests and documentation.'
    const timeRequired = Math.floor(Date.now() / 1000) + (14 * 24 * 3600) // Unix timestamp: completion in 14 days
    const bond = 1000 // 1,000 satoshi bond

    console.log('⏳ Please approve the bid transaction in MetaNet Desktop...')
    await furnisher.placeBid(targetContract!, bidAmount, bidPlans, timeRequired, bond)
    console.log('✅ Bid placed successfully')
    console.log(`   Bid Amount: ${bidAmount} satoshis`)
    console.log(`   Completion Time: ${new Date(timeRequired * 1000).toISOString()}`)
    console.log(`   Bond: ${bond} satoshis\n`)

    await waitForPropagation(2)

    // ============================================================================
    // STEP 3: Seeker accepts the bid
    // ============================================================================
    console.log('👍 STEP 3: Seeker accepting the bid...')

    // Get fresh contract with bid included
    const seekerContracts = await seeker.getMyOpenContracts()
    const contractWithBid = seekerContracts.find((w: EscrowTX) => w.record.workDescription === workDescriptionHex)
    expect(contractWithBid).toBeDefined()

    // Verify contract still at 1 satoshi (TYPE_BID during bidding)
    expect(contractWithBid!.satoshis).toBe(1)

    // Find the bid that was placed
    const realBids = contractWithBid!.record.bids.filter((b: any) => b.bidAmount > 0)
    expect(realBids.length).toBeGreaterThanOrEqual(1)

    const bidPlansHex = Buffer.from(bidPlans, 'utf8').toString('hex')
    const ourBid = realBids.find((b: any) => b.plans === bidPlansHex)
    expect(ourBid).toBeDefined()

    // Find the index of our bid in the bids array
    const bidIndex = contractWithBid!.record.bids.findIndex((b: any) => b.plans === bidPlansHex)
    expect(bidIndex).toBeGreaterThanOrEqual(0)
    expect(bidIndex).toBeLessThan(4) // Contract supports 4 bids (indices 0-3)

    console.log(`✅ Found bid at index ${bidIndex}`)
    console.log(`   Bid Amount: ${ourBid!.bidAmount} satoshis`)
    console.log(`   Plans: ${Buffer.from(ourBid!.plans, 'hex').toString('utf8').substring(0, 60)}...`)

    // Accept the bid
    console.log('\n⏳ Please approve the bid acceptance transaction in MetaNet Desktop...')
    await seeker.acceptBid(contractWithBid!, bidIndex)
    console.log('✅ Bid accepted successfully\n')

    await waitForPropagation(2)

    // ============================================================================
    // STEP 4: Verify contract state after bid acceptance
    // ============================================================================
    console.log('🔍 STEP 4: Verifying contract state after bid acceptance...')

    // Get fresh contract after acceptance
    const updatedContracts = await seeker.getMyOpenContracts()
    const acceptedContract = updatedContracts.find((w: EscrowTX) => w.record.workDescription === workDescriptionHex)
    expect(acceptedContract).toBeDefined()

    // CRITICAL VERIFICATIONS:

    // 1. Status changed from 'initial' to 'bid-accepted'
    expect(acceptedContract!.record.status).toBe('bid-accepted')
    console.log('✅ Status changed to: bid-accepted')

    // 2. For TYPE_BID: Contract value should now equal the bid amount
    expect(acceptedContract!.satoshis).toBe(bidAmount)
    console.log(`✅ Contract value updated to: ${acceptedContract!.satoshis} satoshis (matches bid amount)`)

    // 3. acceptedBid is populated with the chosen bid
    expect(acceptedContract!.record.acceptedBid).toBeDefined()
    expect(acceptedContract!.record.acceptedBid.bidAmount).toBe(bidAmount)
    expect(acceptedContract!.record.acceptedBid.plans).toBe(bidPlansHex)
    expect(acceptedContract!.record.acceptedBid.bond).toBe(bond)
    expect(acceptedContract!.record.acceptedBid.timeRequired).toBe(timeRequired)
    console.log('✅ acceptedBid populated correctly:')
    console.log(`   Bid Amount: ${acceptedContract!.record.acceptedBid.bidAmount}`)
    console.log(`   Bond: ${acceptedContract!.record.acceptedBid.bond}`)

    // 4. bidAcceptedBy should be 'seeker' (based on TEST_GLOBAL_CONFIG_BID approvalMode)
    expect(acceptedContract!.record.bidAcceptedBy).toBe('seeker')
    console.log(`✅ bidAcceptedBy: ${acceptedContract!.record.bidAcceptedBy}`)

    // 5. Contract UTXO changed (new TXID indicates new transaction)
    expect(acceptedContract!.record.txid).not.toBe(contractWithBid!.record.txid)
    console.log(`✅ Contract UTXO updated:`)
    console.log(`   Old TXID: ${contractWithBid!.record.txid}`)
    console.log(`   New TXID: ${acceptedContract!.record.txid}\n`)

    console.log('🎉 SUCCESS: Bid acceptance workflow completed and verified!\n')
    console.log('Summary:')
    console.log('  - Contract created at 1 satoshi (TYPE_BID)')
    console.log('  - Furnisher placed bid')
    console.log('  - Seeker accepted bid')
    console.log('  - Status: initial → bid-accepted')
    console.log(`  - Value: 1 → ${bidAmount} satoshis`)
    console.log('  - Ready for furnisher to start work\n')
  }, 300000)
})
