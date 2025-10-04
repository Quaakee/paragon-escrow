# Escrow Integration Test Plan

Comprehensive test coverage for Seeker/Furnisher interactions in the escrow system.

## Test Status Legend
- ✅ **Complete** - Test implemented and passing
- 🔨 **In Progress** - Test being developed
- ⏳ **Planned** - Test designed but not implemented
- ❌ **Blocked** - Test blocked by dependencies

---

## Phase 1: Bidding & Selection

### ✅ SimpleBidFlow.test.ts
**Status:** Complete
**Purpose:** Basic TYPE_BID contract workflow
**Flow:**
1. Seeker creates TYPE_BID contract (1 satoshi)
2. Furnisher discovers contract via listAvailableWork()
3. Furnisher places bid
4. Seeker views bid via getMyOpenContracts()

**Validates:**
- Contract creation and broadcasting
- Overlay network propagation
- Bid placement with proper timestamps
- Contract value stays at 1 satoshi for TYPE_BID
- Hex encoding for string fields (workDescription, plans)

---

### ✅ BountyBidFlow.test.ts
**Status:** Complete
**Purpose:** Basic TYPE_BOUNTY contract workflow
**Flow:**
1. Seeker creates TYPE_BOUNTY contract (10,000 sats locked)
2. Furnisher discovers bounty
3. Furnisher places bid with required bond
4. Seeker views bid

**Validates:**
- Bounty amount stays locked (doesn't drop to 1 sat)
- Required bond enforcement
- bidAmount must equal bounty value for TYPE_BOUNTY
- bountySolversNeedApproval = true for bidding flow

---

### ⏳ MultipleBids.test.ts
**Status:** Planned
**Purpose:** Test multiple furnishers competing on same contract
**Flow:**
1. Seeker creates contract
2. Furnisher 1 places bid (5000 sats, 7 days, 500 bond)
3. Furnisher 2 places bid (6000 sats, 5 days, 300 bond)
4. Furnisher 3 places bid (4500 sats, 10 days, 600 bond)
5. Seeker views all 3 bids

**Validates:**
- Multiple bids stored in separate slots
- Each bid maintains independent details
- Filtering by bidAmount > 0 to find real bids
- UTXO reference updates between bids
- All 4 bid slots can be filled

**Key Learning:** Since tests use same wallet for seeker/furnisher, same public key appears in all bids. Filter by bidAmount, not furnisherKey.

---

### ⏳ BidRejection.test.ts
**Status:** Planned
**Purpose:** Test validation rules for invalid bids
**Scenarios:**

**Test 1: Bid Amount Too Low**
- Create TYPE_BID contract with minAllowableBid: 1000
- Attempt bid with 500 sats
- Expect: Contract assertion failure

**Test 2: Missing Required Bond**
- Create TYPE_BOUNTY contract with requiredBondAmount: 500
- Attempt bid with 0 bond
- Expect: Contract assertion failure

**Test 3: Invalid Timestamp (Too Small)**
- Attempt bid with timeRequired: 50000 (< 500000000)
- For delayUnit: 'seconds', timestamps must be Unix time
- Expect: Contract assertion failure at enforceProperTimeUnits()

**Test 4: All Slots Full**
- Create contract
- Place 4 bids to fill all slots
- Attempt 5th bid
- Expect: "No empty slot available" error

**Test 5: TYPE_BOUNTY Bid Amount Mismatch**
- Create bounty with 10000 sats
- Attempt bid with 8000 sats
- Expect: Assertion failure (bidAmount must equal bounty)

---

## Phase 2: Bid Acceptance (Critical Missing Piece)

### ⏳ AcceptBid.test.ts
**Status:** Planned - **PRIORITY 1**
**Purpose:** Seeker accepts a furnisher's bid
**Flow:**
1. Seeker creates TYPE_BID contract
2. Furnisher places bid
3. Wait for propagation
4. **Seeker calls acceptBid(contract, bidIndex)** ← NEW
5. Verify contract updates

**Validates:**
- Status changes from 'initial' to 'bid-accepted'
- acceptedBid is populated with chosen bid details
- bidAcceptedBy is set (seeker/platform)
- Contract UTXO is updated
- Overlay network propagates acceptance

**Required Functionality:**
```typescript
// In Seeker entity
async acceptBid(escrow: EscrowTX, bidIndex: number): Promise<void>
```

---

### ⏳ AcceptBountyBid.test.ts
**Status:** Planned - **PRIORITY 1**
**Purpose:** Accept bid on TYPE_BOUNTY contract
**Flow:**
1. Seeker creates TYPE_BOUNTY (10000 sats locked)
2. Furnisher places bid (bidAmount = 10000, bond = 500)
3. Seeker accepts bid
4. Verify bounty stays locked

**Validates:**
- Same as AcceptBid but for TYPE_BOUNTY
- Bounty amount doesn't change during acceptance
- Required bond is acknowledged

---

## Phase 3: Work Execution (Critical Missing Piece)

### ⏳ StartWork.test.ts
**Status:** Planned - **PRIORITY 1**
**Purpose:** Furnisher begins work after bid acceptance
**Flow:**
1. Create contract → Bid → Accept (reuse prior setup)
2. **Furnisher calls startWork(contract)** ← NEW
3. Verify status and timing

**Validates:**
- Status changes from 'bid-accepted' to 'work-started'
- workStartTime is recorded
- Must be called within maxWorkStartDelay
- Only accepted furnisher can start work
- Overlay propagates status change

**Required Functionality:**
```typescript
// In Furnisher entity
async startWork(escrow: EscrowTX): Promise<void>
```

---

### ⏳ SubmitWork.test.ts
**Status:** Planned - **PRIORITY 1**
**Purpose:** Furnisher submits completed work
**Flow:**
1. Create → Bid → Accept → Start Work (reuse setup)
2. **Furnisher calls submitWork(contract, completionDescription)** ← NEW
3. Verify submission recorded

**Validates:**
- Status changes from 'work-started' to 'work-submitted'
- workCompletionDescription is stored (hex-encoded)
- workCompletionTime is recorded
- Must be before workCompletionDeadline
- Only accepted furnisher can submit

**Required Functionality:**
```typescript
// In Furnisher entity
async submitWork(
  escrow: EscrowTX,
  completionDescription: string
): Promise<void>
```

---

## Phase 4: Completion & Payment (Critical Missing Piece)

### ⏳ ApproveWork.test.ts
**Status:** Planned - **PRIORITY 1**
**Purpose:** Seeker approves work and triggers payment
**Flow:**
1. Create → Bid → Accept → Start → Submit (reuse setup)
2. **Seeker calls approveWork(contract)** ← NEW
3. Verify payment distribution

**Validates:**
- Status changes from 'work-submitted' to 'resolved'
- Furnisher receives payment (bidAmount)
- Bond is returned to furnisher
- Platform fee is deducted (if applicable)
- Contract is marked complete
- Cannot be called twice

**Required Functionality:**
```typescript
// In Seeker entity
async approveWork(escrow: EscrowTX): Promise<void>
```

**Payment Distribution:**
```
Total UTXO Value: bountyAmount (or bidAmount for TYPE_BID)
├─ Platform Fee: (value * escrowServiceFeeBasisPoints) / 10000
├─ Furnisher Payment: bidAmount - platformFee
└─ Bond Return: bond amount back to furnisher
```

---

### ⏳ RejectWork.test.ts
**Status:** Planned
**Purpose:** Seeker rejects submitted work
**Flow:**
1. Create → Bid → Accept → Start → Submit
2. **Seeker calls rejectWork(contract)** ← NEW
3. Handle dispute/rework scenarios

**Validates:**
- Work can be rejected before approval
- Status transitions appropriately
- Dispute handling mechanisms
- Bond implications

**Note:** Requires understanding of dispute resolution flow in contract.

---

## Phase 5: Cancellations

### ⏳ CancelBeforeAccept.test.ts
**Status:** Planned
**Purpose:** Seeker cancels contract before accepting any bid
**Flow:**
1. Seeker creates contract
2. Furnishers place 2 bids
3. **Seeker calls cancelBeforeAccept(contract)** ← NEW
4. Verify refunds

**Validates:**
- Status must be 'initial'
- All bonds returned to furnishers
- Bounty returned to seeker (for TYPE_BOUNTY)
- Contract marked as cancelled
- Cannot cancel after accepting bid

**Required Functionality:**
```typescript
// In Seeker entity
async cancelBeforeAccept(escrow: EscrowTX): Promise<void>
```

---

### ⏳ CancelAfterDeadline.test.ts
**Status:** Planned
**Purpose:** Handle expired deadlines
**Scenarios:**

**Test 1: Work Start Deadline Expired**
- Bid accepted but furnisher doesn't start within maxWorkStartDelay
- Seeker can cancel and get refund

**Test 2: Work Completion Deadline Expired**
- Work started but not completed by workCompletionDeadline
- Seeker can reclaim bounty, furnisher forfeits bond

**Validates:**
- Deadline enforcement
- Automatic failure conditions
- Bond forfeiture rules

---

## Phase 6: Edge Cases & Error Handling

### ⏳ UtxoSpentError.test.ts
**Status:** Planned
**Purpose:** Handle stale contract references (UTXO already spent)
**Flow:**
1. Create contract
2. Furnisher places bid (spends UTXO, creates new one)
3. Attempt to place another bid using OLD contract reference
4. Verify proper error: "UTXO appears to have been spent"

**Validates:**
- Graceful error handling for spent UTXOs
- Error messages are clear
- Frontend can detect and refresh contract state

**Key Learning:** Always fetch fresh contract reference after any state change.

---

### ⏳ BondHandling.test.ts
**Status:** Planned
**Purpose:** Test bond mechanics across scenarios
**Scenarios:**

**Test 1: Optional Bond (TYPE_BID)**
- furnisherBondingMode: 'optional'
- Bid with 0 bond → Success
- Bid with 500 bond → Success

**Test 2: Required Bond (TYPE_BOUNTY)**
- furnisherBondingMode: 'required', requiredBondAmount: 500
- Bid with 0 bond → Failure
- Bid with 500 bond → Success
- Bid with 1000 bond → Success (over minimum)

**Test 3: Bond Return on Approval**
- Complete work successfully
- Verify bond returned with payment

**Test 4: Bond Forfeiture**
- Fail to complete work by deadline
- Verify bond is forfeited (goes to seeker or platform)

---

## Recommended Implementation Order

### **Priority 1: Critical Happy Path** (Start Here)
Complete the end-to-end successful workflow:

1. ✅ SimpleBidFlow.test.ts (Done)
2. ✅ BountyBidFlow.test.ts (Done)
3. ⏳ **AcceptBid.test.ts** ← Start here next
4. ⏳ **StartWork.test.ts**
5. ⏳ **SubmitWork.test.ts**
6. ⏳ **ApproveWork.test.ts**

**Result:** Full end-to-end flow: Create → Bid → Accept → Start → Submit → Approve → Paid ✅

---

### **Priority 2: Essential Variations**
Test common scenarios and validations:

7. ⏳ MultipleBids.test.ts
8. ⏳ CancelBeforeAccept.test.ts
9. ⏳ BidRejection.test.ts

---

### **Priority 3: Edge Cases**
Handle errors and unusual scenarios:

10. ⏳ RejectWork.test.ts
11. ⏳ UtxoSpentError.test.ts
12. ⏳ BondHandling.test.ts
13. ⏳ CancelAfterDeadline.test.ts

---

## Implementation Notes

### Test File Structure
All tests should follow this pattern:
```typescript
import { initializeTestContext, generateUniqueWorkDescription, waitForPropagation } from './test-utils.js'

describe('Test Name', () => {
  let context: TestContext
  let seeker: Seeker
  let furnisher: Furnisher

  jest.setTimeout(300000) // 5 minutes

  beforeAll(async () => {
    context = await initializeTestContext()
  }, 30000)

  beforeEach(() => {
    if (!context.isMetaNetAvailable || !context.isLARSAvailable) return
    seeker = new Seeker(CONFIG, context.wallet, context.broadcaster, context.resolver)
    furnisher = new Furnisher(CONFIG, context.wallet, context.broadcaster, context.resolver)
  })

  test('test description', async () => {
    if (!context.isMetaNetAvailable || !context.isLARSAvailable) return

    // Test implementation
  })
})
```

### Key Patterns to Apply

**1. Unique Work Descriptions**
```typescript
const workDescription = generateUniqueWorkDescription('Build a widget')
```

**2. Hex Encoding for String Matching**
```typescript
const workDescriptionHex = Buffer.from(workDescription, 'utf8').toString('hex')
const contract = contracts.find(c => c.record.workDescription === workDescriptionHex)
```

**3. Unix Timestamps**
```typescript
const timeRequired = Math.floor(Date.now() / 1000) + (7 * 24 * 3600)
```

**4. Overlay Network Propagation**
```typescript
await waitForPropagation(2) // Wait 2 seconds after state changes
```

**5. Real Bids Filtering**
```typescript
const realBids = contract.record.bids.filter(b => b.bidAmount > 0)
```

**6. Sequence and Locktime**
```typescript
// In callContractMethod calls
sequenceNumber: 0xfffffffe,
lockTime: Math.floor(Date.now() / 1000)
```

---

## Testing Prerequisites

### Required Services
1. ✅ MetaNet Desktop - Wallet for signing transactions
2. ✅ LARS - Local ARC Relay Service for overlay network
3. ✅ MongoDB - For overlay service storage
4. ✅ Overlay Services - Topic Manager + Lookup Service running

### Configuration
- Network: `local` (for testing)
- Timeouts: 5 minutes per test (wallet approval)
- Propagation delays: 2 seconds after state changes

---

## Current Coverage Status

### Implemented: 2/13 tests (15%)
- ✅ SimpleBidFlow.test.ts
- ✅ BountyBidFlow.test.ts

### Next 4 Tests = Complete Happy Path (Priority 1)
- ⏳ AcceptBid.test.ts
- ⏳ StartWork.test.ts
- ⏳ SubmitWork.test.ts
- ⏳ ApproveWork.test.ts

**Once Priority 1 is complete:** 6/13 tests (46%) + full end-to-end coverage ✅

---

## Success Criteria

A comprehensive test suite should:

✅ Cover all contract states: initial → bid-accepted → work-started → work-submitted → resolved
✅ Test both TYPE_BID and TYPE_BOUNTY workflows
✅ Validate all payment distributions
✅ Handle error cases gracefully
✅ Verify overlay network propagation
✅ Test bond mechanics thoroughly
✅ Cover cancellation scenarios
✅ Validate deadline enforcement

**Goal:** Full confidence in Seeker ↔ Furnisher interactions before production deployment.
