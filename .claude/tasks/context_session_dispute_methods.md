# Dispute Methods Implementation - Context Document

## Session Date
2025-10-01

## Task Summary
Implemented dispute initiation methods for both Seeker and Furnisher entities in the babbage-escrow backend.

## Files Modified

### 1. `/home/ishaan/Documents/babbage-escrow/backend/src/entities/Seeker.ts`
- **Method**: `disputeWork()` (lines 143-182)
- **Purpose**: Allows seeker to raise a dispute when work is not completed on time or when submitted work is unsatisfactory

### 2. `/home/ishaan/Documents/babbage-escrow/backend/src/entities/Furnisher.ts`
- **Method**: `raiseDispute()` (lines 107-150)
- **Purpose**: Allows furnisher to raise a dispute when seeker fails to approve completed work within the approval deadline

## Contract Method Analysis

### `seekerRaisesDisputeOnChain` (Escrow.ts lines 516-529)
**Parameters**:
- `seekerSig: Sig` - Seeker's signature

**Validations**:
- Status must be `STATUS_WORK_STARTED` or `STATUS_WORK_SUBMITTED`
- If status is `STATUS_WORK_STARTED`, locktime must exceed `workCompletionDeadline` (timeout expired)
- Enforces proper time units (blocks vs seconds)

**State Change**:
- Status → `STATUS_DISPUTED_BY_SEEKER`
- Same satoshis (no payout, just state transition)

### `furnisherRaisesDisputeOnChain` (Escrow.ts lines 538-546)
**Parameters**:
- `furnisherSig: Sig` - Furnisher's signature

**Validations**:
- Status must be `STATUS_WORK_SUBMITTED`
- Locktime must exceed `workCompletionTime + maxWorkApprovalDelay` (approval delay expired)
- Enforces proper time units
- Checks signature against `acceptedBid.furnisherKey`

**State Change**:
- Status → `STATUS_DISPUTED_BY_FURNISHER`
- Same satoshis (no payout, just state transition)

## Implementation Details

### Seeker.disputeWork()
```typescript
async disputeWork (record: EscrowTX, evidence?: number[])
```

**Implementation Flow**:
1. **State Validation**: Checks status is `work-started` or `work-submitted`
2. **Locktime Check**: Gets current locktime (blocks or seconds based on delayUnit)
3. **Deadline Validation**: If status is `work-started`, verifies `workCompletionDeadline` has expired
4. **Contract Call**: Calls `seekerRaisesDispute` with seeker signature
5. **Broadcasting**: Broadcasts transaction to overlay network via TopicBroadcaster
6. **TODO**: Platform notification with evidence (commented for future implementation)

**Key Features**:
- Proper error handling with descriptive messages
- Locktime validation before contract call
- Sequence number `0xfffffffe` to enable locktime checking
- Evidence parameter placeholder (not used on-chain but available for off-chain dispute resolution)

### Furnisher.raiseDispute()
```typescript
async raiseDispute (record: EscrowTX)
```

**Implementation Flow**:
1. **State Validation**: Checks status is `work-submitted`
2. **Ownership Check**: Verifies furnisher key matches the accepted bid furnisher
3. **Locktime Check**: Gets current locktime
4. **Approval Deadline**: Verifies `workCompletionTime + maxWorkApprovalDelay` has expired
5. **Contract Call**: Calls `furnisherRaisesDispute` with furnisher signature
6. **Broadcasting**: Broadcasts transaction to overlay network
7. **TODO**: Platform notification (commented for future implementation)

**Key Features**:
- Additional ownership validation (prevents raising disputes on others' work)
- Clear error messages with deadline information
- Proper deadline calculation and validation
- Sequence number `0xfffffffe` for locktime

## Common Patterns Used

Both implementations follow the established patterns in the codebase:

1. **callContractMethod()**: Used from `utils.ts` to handle contract method invocation
2. **signatory()**: Private method that creates BSV SDK-compatible signatures
3. **getCurrentLockTime()**: Handles both block-based and time-based delays
4. **broadcaster.broadcast()**: Uses TopicBroadcaster to update overlay network
5. **Error Handling**: Null checks and descriptive error messages
6. **Sequence Numbers**: `0xfffffffe` to enable nLockTime validation

## Evidence Parameter (Seeker Only)

The `evidence?: number[]` parameter in `Seeker.disputeWork()`:
- Currently accepted but not used on-chain
- Available for future off-chain dispute resolution
- Could be converted to ByteString if contract is updated to accept evidence
- Placeholder for platform dispute messaging system

## Known Limitations & Future Work

### TODO Items:
1. **Platform Notification System**: Both methods need integration with platform's dispute resolution service
2. **Evidence Storage**: Seeker evidence should be stored/transmitted to platform
3. **Dispute Records**: Local basket storage for dispute history
4. **Message Box**: Integration with dispute message box system

### Contract Considerations:
- Evidence is commented out in contract methods (`seekerDisputeEvidence` and `furnisherDisputeEvidence` fields)
- If contract is updated to accept evidence on-chain, `Seeker.disputeWork()` would need modification
- Current implementation assumes platform handles evidence off-chain

## Testing Recommendations

When testing these implementations:

1. **Seeker Dispute Tests**:
   - Test from `work-started` state with expired deadline
   - Test from `work-submitted` state (immediate dispute)
   - Test error handling for invalid states
   - Test locktime validation (should fail if deadline not expired)
   - Test both block-based and time-based delays

2. **Furnisher Dispute Tests**:
   - Test from `work-submitted` state with expired approval deadline
   - Test ownership validation (should fail for wrong furnisher)
   - Test error handling for invalid states
   - Test locktime validation (should fail if approval window still open)
   - Test both block-based and time-based delays

3. **Integration Tests**:
   - Test full workflow: seek → bid → accept → start → submit → dispute
   - Test dispute broadcasting to overlay network
   - Verify state transitions on-chain
   - Test with different globalConfig settings (delayUnit, maxWorkApprovalDelay, etc.)

## Related Files Reference

- **Contract**: `/home/ishaan/Documents/babbage-escrow/backend/src/contracts/Escrow.ts`
- **Utilities**: `/home/ishaan/Documents/babbage-escrow/backend/src/utils.ts`
- **Types**: `/home/ishaan/Documents/babbage-escrow/backend/src/constants.ts`
- **Artifacts**: `/home/ishaan/Documents/babbage-escrow/backend/artifacts/Escrow.json`

## BSV SDK Concepts Used

- **Transaction Broadcasting**: TopicBroadcaster for overlay network updates
- **Signature Creation**: WalletInterface.createSignature() with BRC-42 key derivation
- **SIGHASH Scopes**: ANYONECANPAY_SINGLE (from contract method signatures)
- **Locktime Handling**: Both block height and Unix timestamp support
- **Sequence Numbers**: RBF-compatible sequence numbers for locktime validation

## Post-Dispute Claim Methods (Added 2025-10-01)

### Seeker.reclaimAfterDispute()
```typescript
async reclaimAfterDispute (record: EscrowTX, reconstitute?: boolean): Promise<void>
```

**Implementation Flow**:
1. **State Validation**: Checks status is `disputed-by-seeker`, `disputed-by-furnisher`, or `resolved`
2. **Resolution Transaction Query**: Queries overlay to find the spending transaction (Platform.decideDispute result)
3. **Dispute Record Storage**: Creates OP_RETURN output in `escrow-disputes` basket with full dispute metadata
4. **Automatic Internalization**: P2PKH outputs from Platform.decideDispute() are automatically recognized by wallet
5. **Optional Reconstitution**: If `reconstitute=true`, calls `this.seek()` to create new contract with same parameters

**Key Features**:
- Queries overlay network for resolution transaction using `findSpendingTx` flag
- Stores comprehensive dispute record including original bounty, keys, descriptions
- Uses wallet baskets (`escrow-disputes`) for historical tracking with tags
- No explicit wallet internalization needed - P2PKH outputs auto-tracked
- Reconstitution uses original `workDescription`, `workCompletionDeadline`, and `satoshis`
- Graceful error handling if overlay query or basket storage fails

**Dispute Record Format**:
```typescript
{
  escrowTxid: string
  escrowOutputIndex: number
  seekerKey: string
  furnisherKey: string
  platformKey: string
  workDescription: string
  disputeStatus: 'disputed-by-seeker' | 'disputed-by-furnisher' | 'resolved'
  resolutionTxid?: string
  resolvedAt: string (ISO timestamp)
  originalBounty: number
}
```

### Furnisher.claimAfterDispute()
```typescript
async claimAfterDispute (record: EscrowTX): Promise<void>
```

**Implementation Flow**:
1. **Ownership Validation**: Verifies furnisher key matches `acceptedBid.furnisherKey`
2. **State Validation**: Checks status is `disputed-by-seeker`, `disputed-by-furnisher`, or `resolved`
3. **Resolution Transaction Query**: Queries overlay to find the spending transaction
4. **Dispute Record Storage**: Creates OP_RETURN output in `escrow-disputes` basket
5. **Automatic Internalization**: P2PKH outputs auto-tracked by wallet

**Key Features**:
- Additional ownership check prevents claiming other furnisher's payouts
- Stores both `workDescription` and `workCompletionDescription`
- Includes `bondAmount` in dispute record
- Uses same basket storage pattern as seeker
- Tags include 'furnisher' for filtering
- No reconstitution option (seeker-only feature)

**Dispute Record Format**:
```typescript
{
  escrowTxid: string
  escrowOutputIndex: number
  seekerKey: string
  furnisherKey: string
  platformKey: string
  workDescription: string
  workCompletionDescription: string
  disputeStatus: 'disputed-by-seeker' | 'disputed-by-furnisher' | 'resolved'
  resolutionTxid?: string
  resolvedAt: string (ISO timestamp)
  originalBounty: number
  bondAmount: number
}
```

## Wallet Integration Patterns

### Automatic P2PKH Output Recognition
Both claim methods rely on BSV SDK wallet's automatic tracking:
- Platform.decideDispute() creates P2PKH outputs locked to party keys
- Wallet automatically recognizes outputs locked to derived public keys
- No explicit `relinquishOutput()` or internalization call needed
- Outputs are immediately spendable after Platform broadcasts

### Basket Storage for History
Both methods use wallet baskets for dispute history:
- **Basket name**: `escrow-disputes`
- **Output type**: OP_RETURN with JSON metadata
- **Satoshis**: 1 (minimal storage cost)
- **Tags**: `['dispute', 'escrow', 'resolved']` (plus `'furnisher'` for Furnisher)
- **Purpose**: Long-term dispute resolution tracking

### Overlay Query Pattern
Resolution transaction discovery:
```typescript
const answer = await this.resolver.query({
  service: this.globalConfig.service,
  query: {
    txid: record.record.txid,
    outputIndex: record.record.outputIndex,
    findSpendingTx: true // Key flag to get spending transaction
  }
})
```

## Critical Bug Fix - 2025-10-01 (Post-Implementation)

### Issue: TypeScript Errors with `spentBy` Property

**Problem Discovered**:
- Lines 219-220 in Seeker.ts: `output.spentBy` property does not exist
- Lines 192-193 in Furnisher.ts: Same `output.spentBy` error
- TypeScript compiler error: "Property 'spentBy' does not exist on type"

**Root Cause Analysis**:

1. **LookupAnswer Type Structure** (from `@bsv/overlay`):
   ```typescript
   type LookupAnswer = {
     type: 'output-list';
     outputs: Array<{
       beef: number[];
       outputIndex: number;
     }>;
   } | {
     type: 'freeform';
     result: unknown;
   };
   ```
   - **NO `spentBy` field exists** in the output structure

2. **Overlay Behavior**:
   - When an output is spent, `EscrowLookupService.outputSpent()` is called
   - This calls `storage.deleteRecord(txid, outputIndex)`
   - **Spent UTXOs are DELETED from the overlay**, not marked as spent

3. **Why the Original Implementation Was Wrong**:
   - Code tried to query overlay for spent UTXO: `findSpendingTx: true`
   - This query parameter doesn't exist in the lookup service
   - Even if it did, the UTXO would be deleted from overlay when spent
   - The `output.spentBy` field never existed in BSV SDK overlay types

**The Correct Solution**:

BSV SDK wallets **automatically track all incoming P2PKH outputs**:
- When `Platform.decideDispute()` creates P2PKH outputs locked to party keys
- The wallet automatically recognizes outputs locked to derived public keys (BRC-42)
- Outputs are immediately spendable without explicit internalization
- No need to query overlay for resolution transaction

**Changes Made**:

1. **Removed Broken Overlay Query Code** (Seeker.ts lines 204-227):
   - Deleted attempt to query overlay with `findSpendingTx: true`
   - Deleted code accessing non-existent `output.spentBy` field
   - Removed `resolutionTx` variable and related logic

2. **Removed Broken Overlay Query Code** (Furnisher.ts lines 177-199):
   - Same deletions as Seeker.ts

3. **Added Explanatory Comments**:
   Both files now include clear explanation:
   ```typescript
   // Note: The Platform.decideDispute() method creates P2PKH outputs locked to
   // the seeker's and furnisher's public keys. The wallet automatically recognizes
   // and tracks these incoming P2PKH outputs, making them immediately spendable.
   // The overlay network deletes spent UTXOs, so we cannot query for the resolution
   // transaction. Instead, we trust that the wallet has received the payout.
   ```

4. **Updated Dispute Record Structure**:
   - Removed `resolutionTxid` field (no longer available)
   - Kept all other metadata for historical tracking

   **Seeker dispute record** (now):
   ```typescript
   {
     escrowTxid: string
     escrowOutputIndex: number
     seekerKey: string
     furnisherKey: string
     platformKey: string
     workDescription: string
     disputeStatus: string
     resolvedAt: string
     originalBounty: number
     // resolutionTxid removed
   }
   ```

   **Furnisher dispute record** (now):
   ```typescript
   {
     escrowTxid: string
     escrowOutputIndex: number
     seekerKey: string
     furnisherKey: string
     platformKey: string
     workDescription: string
     workCompletionDescription: string
     disputeStatus: string
     resolvedAt: string
     originalBounty: number
     bondAmount: number
     // resolutionTxid removed
   }
   ```

**Why This Fix Is Correct**:

1. **Aligns with BSV SDK Architecture**:
   - Wallets automatically track P2PKH outputs to derived keys
   - No explicit internalization needed for standard P2PKH payments
   - This is how BRC-42 key derivation + wallet integration works

2. **Respects Overlay Design**:
   - Overlay tracks **unspent** UTXOs only
   - Spent UTXOs are deleted, not archived
   - Querying for spent outputs will always return empty results

3. **Maintains Functionality**:
   - Payout outputs are still received and spendable
   - Dispute resolution is still tracked in wallet baskets
   - Historical records still contain all necessary metadata

4. **TypeScript Compliance**:
   - No more type errors
   - Code matches actual BSV SDK types
   - Type-safe implementation

**Verification**:
- Searched entire codebase: No remaining references to `spentBy` or `findSpendingTx`
- TypeScript errors resolved
- Implementation now follows BSV SDK best practices

## Dispute Listing Methods - 2025-10-01

All three `listDisputes()` methods have been fully implemented:

### 1. Seeker.listDisputes(active?: boolean)

**Location**: `/home/ishaan/Documents/babbage-escrow/backend/src/entities/Seeker.ts` (lines 184-260)

**Return Type**:
```typescript
Promise<{ active: EscrowTX[], historical: any[] }>
```

**Implementation Details**:

1. **Active Disputes (Overlay Query)**:
   - Queries overlay using `LookupResolver` with:
     - `service: this.globalConfig.service`
     - `query: { seekerKey: this.derivedPublicKey, find: 'all-disputed' }`
   - Uses existing `recordsFromAnswer()` helper to parse results
   - Returns array of `EscrowTX` objects
   - Graceful error handling with console warnings

2. **Historical Disputes (Basket Query)**:
   - Queries `escrow-disputes` basket with tags: `['dispute', 'escrow', 'resolved']`
   - Parses OP_RETURN format: `00 6a <length> <data>`
   - Extracts JSON from hex-encoded data
   - Filters records where `record.seekerKey === this.derivedPublicKey`
   - Returns array of parsed dispute records
   - Graceful error handling for parsing failures

3. **Parameter Logic**:
   - `active === true`: Only query overlay (active disputes)
   - `active === false`: Only query baskets (historical disputes)
   - `active === undefined`: Query both overlay and baskets

### 2. Furnisher.listDisputes(active?: boolean)

**Location**: `/home/ishaan/Documents/babbage-escrow/backend/src/entities/Furnisher.ts` (lines 152-228)

**Return Type**: Same as Seeker
```typescript
Promise<{ active: EscrowTX[], historical: any[] }>
```

**Implementation Details**:

1. **Active Disputes (Overlay Query)**:
   - Same pattern as Seeker but queries by `furnisherKey`:
     - `query: { furnisherKey: this.derivedPublicKey, find: 'all-disputed' }`
   - Uses `recordsFromAnswer()` helper
   - Returns disputed contracts where this furnisher is the accepted bidder

2. **Historical Disputes (Basket Query)**:
   - Same basket and parsing logic as Seeker
   - Filters records where `record.furnisherKey === this.derivedPublicKey`
   - Includes disputes where furnisher was involved

3. **Parameter Logic**: Identical to Seeker

### 3. Platform.listHistoricalDisputes()

**Location**: `/home/ishaan/Documents/babbage-escrow/backend/src/entities/Platform.ts` (lines 49-107)

**Return Type**:
```typescript
Promise<any[]>
```

**Implementation Details**:

1. **No Active Disputes Query**:
   - Platform already has `listActiveDisputes()` method (lines 37-47)
   - That method queries overlay for all disputes by platformKey
   - New method focuses only on historical disputes

2. **Historical Disputes (Basket Query)**:
   - Same basket and parsing logic as Seeker/Furnisher
   - Filters records where `record.platformKey === this.derivedPublicKey`
   - Returns disputes resolved by this platform

3. **Important Note**:
   - Currently reads dispute records created by Seeker/Furnisher claim methods
   - Platform.decideDispute() doesn't yet store its own records
   - Future enhancement: Platform should store detailed decision records
   - Suggested basket: `escrow-decisions` with decision rationale, amounts, notes

## Common Implementation Patterns

All three methods share the same core patterns:

### OP_RETURN Parsing Logic
```typescript
// Parse OP_RETURN: 00 6a <length> <data>
const opFalse = lockingScript.substring(0, 2)    // '00'
const opReturn = lockingScript.substring(2, 4)   // '6a'
const lengthByte = parseInt(lockingScript.substring(4, 6), 16)
const dataStartIndex = lengthByte < 76 ? 6 : 8  // Handle OP_PUSHDATA1
const dataHex = lockingScript.substring(dataStartIndex)
const jsonStr = Buffer.from(dataHex, 'hex').toString('utf8')
const record = JSON.parse(jsonStr)
```

### Overlay Query Pattern for Active Disputes
```typescript
const answer = await this.resolver.query({
  service: this.globalConfig.service,
  query: {
    seekerKey: this.derivedPublicKey,    // or furnisherKey
    find: 'all-disputed'
  }
})
const active = recordsFromAnswer(answer)
```

### Basket Query Pattern for Historical Disputes
```typescript
const outputs = await this.wallet.getOutputs({
  basket: 'escrow-disputes',
  tags: ['dispute', 'escrow', 'resolved'],
  includeEnvelope: true
})
```

### Error Handling Pattern
- Try-catch blocks around both overlay and basket queries
- Graceful fallback to empty arrays on failures
- Console warnings with error messages
- Per-record error handling with filtering (null values removed)

## Data Flow

1. **Dispute Raised** → Contract state changes to `disputed-by-seeker` or `disputed-by-furnisher`
2. **Active State** → UTXO exists on overlay, queryable via `find: 'all-disputed'`
3. **Platform Decides** → Creates P2PKH payout outputs, spends dispute UTXO
4. **UTXO Spent** → Overlay removes UTXO (deleted, not archived)
5. **Party Claims** → Calls reclaimAfterDispute/claimAfterDispute
6. **History Stored** → Party stores OP_RETURN record in `escrow-disputes` basket
7. **Historical State** → Queryable via wallet.getOutputs() from basket

## Testing Recommendations

### Seeker.listDisputes() Tests:
1. Test with active disputes on overlay (status: disputed-by-seeker, disputed-by-furnisher)
2. Test with historical disputes in basket (after resolution and claim)
3. Test with `active=true` (only overlay results)
4. Test with `active=false` (only basket results)
5. Test with `active=undefined` (both sources)
6. Test error handling when overlay is unreachable
7. Test error handling when basket has invalid data
8. Verify filtering (only returns disputes where seeker is this user)

### Furnisher.listDisputes() Tests:
1. Same as Seeker tests but from furnisher perspective
2. Verify filtering by furnisherKey in acceptedBid
3. Test with disputes where furnisher is not the accepted bidder (should not appear)

### Platform.listHistoricalDisputes() Tests:
1. Test with historical disputes after resolution
2. Test filtering by platformKey
3. Test with empty basket
4. Test error handling for invalid OP_RETURN data
5. Verify multiple dispute records are all returned
6. Test that only disputes for this platform are returned

### Integration Tests:
1. Full workflow: raise dispute → platform decides → party claims → list historical
2. Verify active dispute appears in listDisputes(true)
3. Verify after resolution, dispute moves from active to historical
4. Test multiple concurrent disputes
5. Test disputes across different parties
6. Verify OP_RETURN parsing handles various data sizes

## Known Limitations

1. **Platform Decision Records**:
   - Platform.decideDispute() doesn't store its own records yet
   - Platform.listHistoricalDisputes() relies on Seeker/Furnisher records
   - Future: Platform should store detailed decision records including:
     - Decision rationale
     - Evidence considered
     - Amount breakdown (amountForSeeker, amountForFurnisher, platformFee)
     - Timestamp of decision
     - Notes/comments

2. **OP_RETURN Parsing**:
   - Current implementation assumes data < 252 bytes (single length byte)
   - Handles OP_PUSHDATA1 but not OP_PUSHDATA2/OP_PUSHDATA4
   - JSON parsing failures are silently filtered out
   - No validation of dispute record schema

3. **Overlay Query Reliability**:
   - Depends on overlay network availability
   - No retry logic for failed queries
   - No caching of overlay results

4. **Basket Storage**:
   - All parties share same `escrow-disputes` basket
   - No pagination for large result sets
   - Requires includeEnvelope=true (more bandwidth)
   - Filtering happens client-side (could be more efficient)

## Future Enhancements

1. **Platform Decision Storage**:
   - Add basket storage to Platform.decideDispute()
   - Create `escrow-decisions` basket
   - Store complete decision records with all metadata

2. **Enhanced Filtering**:
   - Add date range filtering
   - Add status filtering (disputed-by-seeker vs disputed-by-furnisher)
   - Add amount filtering
   - Add pagination support

3. **Performance Optimizations**:
   - Implement caching for overlay queries
   - Use server-side filtering in lookup service
   - Lazy-load historical records
   - Optimize OP_RETURN parsing

4. **Error Recovery**:
   - Implement retry logic for overlay queries
   - Add exponential backoff
   - Cache last successful results
   - Implement offline mode

5. **Data Validation**:
   - Add schema validation for dispute records
   - Verify record integrity
   - Check for duplicate records
   - Validate signatures/timestamps

## Next Steps for Engineer Picking Up

1. **Testing**:
   - Write comprehensive unit tests for all three methods
   - Test edge cases (empty results, malformed data, network errors)
   - Integration tests with full dispute workflow

2. **Platform Decision Storage**:
   - Implement basket storage in Platform.decideDispute()
   - Design decision record schema
   - Add decision metadata (rationale, evidence)

3. **Performance Optimization**:
   - Profile basket query performance with large datasets
   - Consider pagination implementation
   - Optimize OP_RETURN parsing

4. **Documentation**:
   - Add JSDoc comments to all three methods
   - Document return value schemas
   - Add usage examples

5. **Error Handling Enhancement**:
   - Add retry logic for overlay queries
   - Implement proper logging
   - Add monitoring/metrics

6. **UI Integration**:
   - Display active vs historical disputes separately
   - Show dispute details from records
   - Implement dispute timeline view
   - Add filtering/sorting in UI

7. **Platform Notification System**:
   - Implement dispute notification to platform
   - Add evidence submission system
   - Create dispute message box

8. **Wallet Output Verification**:
   - Test P2PKH output recognition
   - Verify balance updates after resolution
   - Test with different wallet implementations
