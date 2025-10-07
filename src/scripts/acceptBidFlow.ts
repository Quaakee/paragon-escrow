/**
 * Accept Bid Flow Script
 *
 * This script validates the following bid acceptance workflow:
 * 1. Seeker creates a contract using seeker.seek()
 * 2. Furnisher places a bid using furnisher.placeBid()
 * 3. Seeker accepts the bid using seeker.acceptBid()
 *
 * All parameters reflect baseline rules from the Escrow.ts smart contract:
 * - Contract type: BID (TYPE_BID = 2n)
 * - Initial status: STATUS_INITIAL (11n)
 * - Approval mode: FURNISHER_APPROVAL_MODE_SEEKER (41n)
 * - Bonding mode: FURNISHER_BONDING_MODE_OPTIONAL (32n)
 * - Delay unit: DELAY_UNIT_SECONDS (52n)
 *
 * The script uses TopicBroadcaster for publishing to the overlay network
 * and LookupResolver for querying contracts from the overlay.
 *
 * Prerequisites:
 * 1. MetaNet Desktop must be running with wallet authenticated
 * 2. LARS overlay network must be running
 * 3. Wallet must have sufficient funds for transactions
 */

import { WalletClient, TopicBroadcaster, LookupResolver } from '@bsv/sdk'
import { WalletHealthChecker } from '../utils/wallet-health.js'
import Seeker from '../entities/Seeker.js'
import Furnisher from '../entities/Furnisher.js'
import { EscrowContract } from '../contracts/Escrow.js'
import type { GlobalConfig, EscrowTX } from '../constants.js'

// Test amounts in satoshis
const TEST_AMOUNTS = {
  minBid: 1000,
  standardBid: 5000,
  largeBid: 50000,
  standardBond: 1000,
  largeBond: 5000,
  smallPayment: 100,
  platformFee: 125 // 2.5% of 5000
}

// Test configuration for bid acceptance flow
const TEST_GLOBAL_CONFIG: GlobalConfig = {
  // Financial settings
  minAllowableBid: 1000,
  escrowServiceFeeBasisPoints: 250,

  // Authorization settings
  platformAuthorizationRequired: false,
  escrowMustBeFullyDecisive: true,
  bountySolversNeedApproval: true, // Bids must be approved

  // Bonding settings
  furnisherBondingMode: 'optional',
  requiredBondAmount: 0,

  // Timing settings
  maxWorkStartDelay: 86400,
  maxWorkApprovalDelay: 172800,
  delayUnit: 'seconds',

  // Approval and contract type
  approvalMode: 'seeker',
  contractType: 'bid', // BID contracts

  // Dispute handling
  contractSurvivesAdverseFurnisherDisputeResolution: false,

  // Bounty increase settings
  bountyIncreaseAllowanceMode: 'forbidden',
  bountyIncreaseCutoffPoint: 'bid-acceptance',

  // Network settings
  platformKey: '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
  topic: 'tm_escrow',
  service: 'ls_escrow',
  keyDerivationProtocol: [2, 'escrow v1 bid test'],
  networkPreset: 'local'
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
}

function assertEquals(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: ${message}\n  Expected: ${expected}\n  Actual: ${actual}`)
  }
}

async function runAcceptBidFlow() {
  console.log('\n=== Accept Bid Flow Script ===\n')

  // Initialize wallet connection to MetaNet Desktop
  const seekerWallet = new WalletClient('auto', 'localhost')
  const furnisherWallet = new WalletClient('auto', 'localhost')
  const healthChecker = new WalletHealthChecker(seekerWallet)

  // Check if MetaNet Desktop is available
  console.log('Checking MetaNet Desktop connection...')
  const health = await healthChecker.checkConnection()
  const isMetaNetAvailable = health.available && health.authenticated

  if (!isMetaNetAvailable) {
    console.log('\n⚠️  MetaNet Desktop not running - cannot proceed\n')
    console.log('To run this script:')
    console.log('1. Clone: git clone https://github.com/bsv-blockchain/metanet-desktop.git')
    console.log('2. Setup: cd metanet-desktop && npm install')
    console.log('3. Start: npm run tauri dev')
    console.log('4. Complete wallet setup and authentication')
    console.log('5. Ensure LARS is running')
    console.log('6. Re-run script\n')

    if (health.error) {
      console.log('Error details:')
      console.log(health.error)
      console.log('')
    }
    process.exit(1)
  }

  console.log('✅ MetaNet Desktop connected and authenticated\n')

  // Initialize overlay network components
  let broadcaster: TopicBroadcaster
  let resolver: LookupResolver

  try {
    // TopicBroadcaster for publishing transactions to LARS
    broadcaster = new TopicBroadcaster([TEST_GLOBAL_CONFIG.topic], {
      networkPreset: TEST_GLOBAL_CONFIG.networkPreset
    })

    // LookupResolver for querying LARS overlay services
    resolver = new LookupResolver({
      networkPreset: TEST_GLOBAL_CONFIG.networkPreset
    })

    console.log('✅ Overlay network components initialized\n')
  } catch (error) {
    console.log('\n⚠️  LARS overlay network might not be available')
    console.log('Error:', error instanceof Error ? error.message : String(error))
    console.log('\nTo setup LARS:')
    console.log('1. Clone: https://github.com/bitcoin-sv/arc')
    console.log('2. Follow local setup instructions')
    console.log('3. Ensure LARS is running on default ports\n')
    process.exit(1)
  }

  // Verify network configuration
  try {
    const { network } = await seekerWallet.getNetwork({})
    console.log(`📡 Wallet network: ${network}`)
    console.log(`📡 Test configuration: ${TEST_GLOBAL_CONFIG.networkPreset}`)
    console.log(`📡 Topic: ${TEST_GLOBAL_CONFIG.topic}`)
    console.log(`📡 Service: ${TEST_GLOBAL_CONFIG.service}\n`)
  } catch (error) {
    console.warn('Could not verify network:', error)
  }

  // Initialize Seeker and Furnisher entities
  const seeker = new Seeker(TEST_GLOBAL_CONFIG, seekerWallet, broadcaster, resolver)
  const furnisher = new Furnisher(TEST_GLOBAL_CONFIG, furnisherWallet, broadcaster, resolver)

  let contractRecord: EscrowTX
  let bidIndex: number = 0

  // Step 1: Seeker creates contract using seeker.seek()
  console.log('\n📝 Step 1: Seeker creates contract using seeker.seek()')

  const workDescription = 'Build a simple todo app with React and TypeScript'
  const workCompletionDeadline = Math.floor(Date.now() / 1000) + (7 * 86400) // 7 days from now
  const initialSatoshis = 1 // BID contracts start at 1 satoshi

  console.log(`   Description: ${workDescription}`)
  console.log(`   Deadline: ${new Date(workCompletionDeadline * 1000).toISOString()}`)
  console.log(`   Initial Satoshis: ${initialSatoshis}`)

  await seeker.seek(
    workDescription,
    workCompletionDeadline,
    initialSatoshis,
    'bid' // Explicitly specify BID type
  )

  console.log('✅ Contract created and broadcast to overlay\n')

  debugger
  // Query to get the created contract
  console.log('Querying for created contract...')
  const seekerContracts: EscrowTX[] = await seeker.getMyOpenContracts()
  console.log(`Found ${seekerContracts.length} contract(s)`)

  assert(seekerContracts.length > 0, 'Expected at least one contract')

  contractRecord = seekerContracts[seekerContracts.length - 1]

  // Verify baseline parameters from Escrow.ts
  console.log('\nVerifying baseline parameters...')
  assertEquals(contractRecord.contract.contractType, EscrowContract.TYPE_BID, 'Contract type should be BID')
  assertEquals(contractRecord.contract.status, EscrowContract.STATUS_INITIAL, 'Status should be INITIAL')
  assertEquals(contractRecord.satoshis, 1, 'BID contracts start at 1 satoshi')
  assertEquals(contractRecord.contract.approvalMode, EscrowContract.FURNISHER_APPROVAL_MODE_SEEKER, 'Approval mode should be SEEKER')
  assertEquals(contractRecord.contract.furnisherBondingMode, EscrowContract.FURNISHER_BONDING_MODE_OPTIONAL, 'Bonding mode should be OPTIONAL')
  assertEquals(contractRecord.contract.delayUnit, EscrowContract.DELAY_UNIT_SECONDS, 'Delay unit should be SECONDS')
  assertEquals(contractRecord.contract.bountySolversNeedApproval, 1n, 'Bounty solvers need approval should be true')
  assertEquals(contractRecord.contract.bidAcceptedBy, EscrowContract.BID_NOT_YET_ACCEPTED, 'Bid should not be accepted yet')

  console.log(`✅ Contract TXID: ${contractRecord.record.txid}`)
  console.log(`  - Type: BID (${EscrowContract.TYPE_BID})`)
  console.log(`  - Status: INITIAL (${EscrowContract.STATUS_INITIAL})`)
  console.log(`  - Satoshis: ${contractRecord.satoshis}`)
  console.log(`  - Min Allowable Bid: ${contractRecord.contract.minAllowableBid}`)

  // Step 2: Furnisher places bid using furnisher.placeBid()
  console.log('\n📝 Step 2: Furnisher places bid using furnisher.placeBid()')

  const bidAmount = TEST_AMOUNTS.standardBid // 5000 sats (>= minAllowableBid of 1000)
  const bond = TEST_AMOUNTS.standardBond // 1000 sats (optional bond, >= 0n)
  const timeRequiredDuration = 86400 * 3 // 3 days in seconds
  const timeRequired = Math.floor(Date.now() / 1000) + timeRequiredDuration // Unix timestamp for completion
  const bidPlans = 'I will build a clean, modern todo app with React and TypeScript. Includes: component structure, state management, local storage, and responsive design.'

  console.log(`   Bid Amount: ${bidAmount} sats`)
  console.log(`   Bond: ${bond} sats`)
  console.log(`   Time Required: ${new Date(timeRequired * 1000).toISOString()} (${timeRequiredDuration / 86400} days from now)`)
  console.log(`   Plans: "${bidPlans.substring(0, 50)}..."`)

  console.log('\nPlacing bid...')
  await furnisher.placeBid(
    contractRecord,
    bidAmount,
    bidPlans,
    timeRequired,
    bond
  )

  console.log('✅ Bid placed and broadcast to overlay\n')

  // Query to get the updated contract with bid
  console.log('Querying for updated contract with bid...')
  const updatedContracts: EscrowTX[] = await seeker.getMyOpenContracts()
  console.log(`Found ${updatedContracts.length} contract(s)`)

  const updatedContract = updatedContracts.find(c => c.record.txid === contractRecord.record.txid)

  if (!updatedContract) {
    // Contract TXID changed due to update, get the latest one
    console.log('Contract TXID changed, using latest contract')
    contractRecord = updatedContracts[updatedContracts.length - 1]
  } else {
    contractRecord = updatedContract
  }

  // Verify status is still INITIAL
  assertEquals(contractRecord.contract.status, EscrowContract.STATUS_INITIAL, 'Status should still be INITIAL')
  assertEquals(contractRecord.satoshis, 1, 'Satoshis should still be 1 before acceptance')

  // Find the furnisher's bid
  const furnisherPubKey = await furnisherWallet.getPublicKey({
    counterparty: 'self',
    protocolID: TEST_GLOBAL_CONFIG.keyDerivationProtocol,
    keyID: '1'
  })

  // Find the furnisher's bid by checking for valid bid data
  console.log('\nSearching for furnisher bid...')
  console.log('Current bids:', contractRecord.contract.bids.map((b: any, i: number) => ({
    index: i,
    bidAmount: b.bidAmount.toString(),
    timeOfBid: b.timeOfBid.toString(),
    furnisherKey: b.furnisherKey.toString().substring(0, 20) + '...'
  })))

  bidIndex = contractRecord.contract.bids.findIndex(
    (bid: any) =>
      bid.bidAmount > 0n &&
      bid.timeOfBid > 0n &&
      bid.furnisherKey.toString() === furnisherPubKey.publicKey
  )

  assert(bidIndex >= 0, 'Expected to find furnisher bid')
  assert(bidIndex < 4, 'Bid index should be less than 4')

  const placedBid = contractRecord.contract.bids[bidIndex]

  // Verify bid parameters
  console.log(`\nVerifying bid parameters at index ${bidIndex}...`)
  assertEquals(placedBid.bidAmount, BigInt(bidAmount), 'Bid amount should match')
  assertEquals(placedBid.bond, BigInt(bond), 'Bond should match')
  assertEquals(placedBid.timeRequired, BigInt(timeRequired), 'Time required should match')
  assert(Number(placedBid.timeOfBid) > 0, 'Time of bid should be greater than 0')

  // Verify bid meets constraints
  assert(placedBid.bidAmount >= contractRecord.contract.minAllowableBid, 'Bid amount should be >= min allowable bid')
  assert(placedBid.bond >= 0n, 'Bond should be >= 0')

  console.log(`✅ Bid placed at index ${bidIndex}`)
  console.log(`  - Bid Amount: ${bidAmount} sats`)
  console.log(`  - Bond: ${bond} sats`)
  console.log(`  - Time Required: ${timeRequired} (${timeRequiredDuration / 86400} days)`)

  // Step 3: Seeker accepts bid using seeker.acceptBid()
  console.log('\n📝 Step 3: Seeker accepts bid using seeker.acceptBid()')

  const bid = contractRecord.contract.bids[bidIndex]
  const expectedSatoshis = Number(bid.bidAmount)

  console.log(`   Accepting bid with amount: ${expectedSatoshis} sats`)

  await seeker.acceptBid(contractRecord, bidIndex)

  console.log('✅ Bid accepted and broadcast to overlay\n')

  debugger
  // Query to get the final contract state
  console.log('Querying for final contract state...')
  const finalContracts: EscrowTX[] = await seeker.getMyOpenContracts()
  const finalContract = finalContracts.find(c =>
    c.record.txid === contractRecord.record.txid ||
    c.contract.acceptedBid.furnisherKey.toString() === bid.furnisherKey.toString()
  )

  assert(finalContract !== undefined, 'Expected to find final contract')
  contractRecord = finalContract!

  // Verify status changed to BID_ACCEPTED
  console.log('\nVerifying final state...')
  assertEquals(contractRecord.contract.status, EscrowContract.STATUS_BID_ACCEPTED, 'Status should be BID_ACCEPTED')

  // Verify bidAcceptedBy is BID_ACCEPTED_BY_SEEKER
  assertEquals(contractRecord.contract.bidAcceptedBy, EscrowContract.BID_ACCEPTED_BY_SEEKER, 'Bid should be accepted by seeker')

  // Verify acceptedBid is set correctly
  assertEquals(contractRecord.contract.acceptedBid.furnisherKey.toString(), bid.furnisherKey.toString(), 'Accepted bid furnisher key should match')
  assertEquals(contractRecord.contract.acceptedBid.bidAmount, bid.bidAmount, 'Accepted bid amount should match')
  assertEquals(contractRecord.contract.acceptedBid.bond, bid.bond, 'Accepted bid bond should match')
  assertEquals(contractRecord.contract.acceptedBid.timeRequired, bid.timeRequired, 'Accepted bid time required should match')

  // Verify satoshis changed to bid amount
  assertEquals(contractRecord.satoshis, expectedSatoshis, 'Contract satoshis should be updated to bid amount')

  console.log(`✅ Bid accepted successfully`)
  console.log(`  - Status: BID_ACCEPTED (${EscrowContract.STATUS_BID_ACCEPTED})`)
  console.log(`  - Bid Accepted By: SEEKER (${EscrowContract.BID_ACCEPTED_BY_SEEKER})`)
  console.log(`  - Accepted Bid Amount: ${contractRecord.contract.acceptedBid.bidAmount}`)
  console.log(`  - Contract Satoshis: ${contractRecord.satoshis} (updated to bid amount)`)
  console.log(`  - Final TXID: ${contractRecord.record.txid}\n`)

  console.log('\n=== ✅ Accept Bid Flow Completed Successfully ===\n')
}

// Run the script
runAcceptBidFlow()
  .then(() => {
    console.log('Script finished successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed with error:')
    console.error(error)
    process.exit(1)
  })
