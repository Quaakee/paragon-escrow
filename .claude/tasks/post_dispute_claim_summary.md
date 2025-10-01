# Post-Dispute Claim Methods Implementation Summary

## Date
2025-10-01

## Overview
Implemented post-dispute claim methods for both Seeker and Furnisher entities to handle dispute resolution payouts from Platform.decideDispute().

## Files Modified

### 1. `/home/ishaan/Documents/babbage-escrow/backend/src/entities/Seeker.ts`
**Method**: `reclaimAfterDispute(record: EscrowTX, reconstitute?: boolean): Promise<void>` (lines 192-283)

### 2. `/home/ishaan/Documents/babbage-escrow/backend/src/entities/Furnisher.ts`
**Method**: `claimAfterDispute(record: EscrowTX): Promise<void>` (lines 160-244)

### 3. `/home/ishaan/Documents/babbage-escrow/backend/.claude/tasks/context_session_dispute_methods.md`
Updated with full documentation of new implementations

## Implementation Details

### Core Functionality

Both methods implement a four-step process:

1. **Validation**
   - Verify contract is in disputed or resolved state
   - Furnisher additionally validates ownership

2. **Resolution Transaction Discovery**
   - Query overlay network to find spending transaction
   - Uses `findSpendingTx: true` flag in LookupResolver query
   - Gracefully handles cases where resolution TX not found

3. **Dispute History Recording**
   - Creates OP_RETURN output in `escrow-disputes` wallet basket
   - Stores comprehensive metadata as JSON
   - Uses tags for filtering: `['dispute', 'escrow', 'resolved']`

4. **Automatic Payout Handling**
   - P2PKH outputs from Platform.decideDispute() auto-tracked by wallet
   - No explicit internalization needed
   - Funds immediately spendable after Platform broadcasts

### Key Differences Between Seeker and Furnisher

| Feature | Seeker | Furnisher |
|---------|--------|-----------|
| Ownership Check | ✗ | ✓ (verifies furnisher key) |
| Work Completion Description | ✗ | ✓ |
| Bond Amount in Record | ✗ | ✓ |
| Reconstitution Option | ✓ | ✗ |
| Additional Tag | - | 'furnisher' |

### Seeker-Specific: Reconstitution

When `reconstitute=true`:
- Calls `this.seek()` with original parameters
- Uses same `workDescription`
- Uses same `workCompletionDeadline`
- Uses same `satoshis` (bounty amount)
- Throws error if reconstitution fails

## Technical Approach

### Why No Explicit Internalization?

The implementation relies on BSV SDK wallet's automatic P2PKH output tracking:

```typescript
// Platform.decideDispute() creates P2PKH outputs like this:
outputs.push({
  satoshis: amountForSeeker,
  lockingScript: new P2PKH().lock(record.seekerKey).toHex(),
  outputDescription: 'Seeker dispute payout'
})
```

The wallet automatically:
1. Recognizes outputs locked to derived public keys
2. Tracks them as spendable UTXOs
3. Makes them available for future transactions

### Overlay Network Query Pattern

```typescript
const answer = await this.resolver.query({
  service: this.globalConfig.service,
  query: {
    txid: record.record.txid,
    outputIndex: record.record.outputIndex,
    findSpendingTx: true // Gets the transaction that spent this UTXO
  }
})
```

This retrieves the Platform.decideDispute() transaction that spent the escrow contract UTXO.

### Basket Storage Pattern

```typescript
await this.wallet.createAction({
  description: `Dispute resolution record: ${workDescription.substring(0, 50)}`,
  outputs: [{
    satoshis: 1,
    lockingScript: 'OP_FALSE OP_RETURN ' + Buffer.from(JSON.stringify(disputeRecord)).toString('hex'),
    outputDescription: 'Dispute resolution record',
    basket: 'escrow-disputes',
    tags: ['dispute', 'escrow', 'resolved']
  }]
})
```

This creates a permanent, queryable record of the dispute resolution.

## Error Handling

### Graceful Degradation
- Overlay query failures logged but don't block execution
- Basket storage failures logged but don't block execution
- Only critical errors (state validation, ownership) throw exceptions

### Error Messages
- Clear, descriptive error messages for all failure cases
- Includes current state in error messages for debugging
- Reconstitution errors wrapped with context

## Testing Recommendations

### Unit Tests Needed

1. **Seeker.reclaimAfterDispute()**
   - Test with disputed-by-seeker state
   - Test with disputed-by-furnisher state
   - Test with resolved state
   - Test with invalid state (should throw)
   - Test reconstitute=true path
   - Test reconstitute=false path
   - Test overlay query failure handling
   - Test basket storage failure handling

2. **Furnisher.claimAfterDispute()**
   - Test with correct furnisher key
   - Test with wrong furnisher key (should throw)
   - Test with disputed-by-seeker state
   - Test with disputed-by-furnisher state
   - Test with resolved state
   - Test with invalid state (should throw)
   - Test overlay query failure handling
   - Test basket storage failure handling

### Integration Tests Needed

1. **Full Dispute Flow**
   ```
   seek → bid → accept → start → submit → dispute → Platform.decideDispute() → claim
   ```

2. **Reconstitution Flow**
   ```
   seek → dispute → Platform.decideDispute() → reclaimAfterDispute(true) → verify new contract
   ```

3. **Basket Query**
   - Create disputes
   - Claim payouts
   - Query escrow-disputes basket
   - Verify all records present

## Usage Examples

### Seeker Claims and Reconstitutes
```typescript
const seeker = new Seeker(globalConfig, wallet)

// Get disputed contract
const myDisputes = await seeker.listDisputes(true)
const dispute = myDisputes[0]

// Claim payout and create new contract with same terms
await seeker.reclaimAfterDispute(dispute, true)

// Or just claim without reconstituting
await seeker.reclaimAfterDispute(dispute, false)
```

### Furnisher Claims Payout
```typescript
const furnisher = new Furnisher(globalConfig, wallet)

// Get disputed contracts where we're the furnisher
const myDisputes = await furnisher.listDisputes(true)
const dispute = myDisputes[0]

// Claim payout
await furnisher.claimAfterDispute(dispute)
```

### Query Dispute History
```typescript
// Query basket for all dispute resolutions (to be implemented in listDisputes)
const disputes = await wallet.listOutputs({
  basket: 'escrow-disputes',
  tags: ['dispute', 'escrow', 'resolved']
})

// Parse OP_RETURN data
disputes.forEach(output => {
  const script = output.lockingScript
  // Parse OP_RETURN to extract JSON dispute record
  const record = parseDisputeRecord(script)
  console.log(record)
})
```

## Dependencies

### Existing Dependencies (No New Imports)
- `@bsv/sdk`: Transaction, WalletInterface, LookupResolver
- All required imports already present in both files

### External Dependencies
- Wallet must support baskets (BRC-46)
- Overlay service must support `findSpendingTx` query flag
- Platform must have called decideDispute() first

## Future Enhancements

### Immediate Next Steps
1. Implement `listDisputes()` method to query basket storage
2. Add comprehensive unit tests
3. Test end-to-end dispute resolution flow

### Potential Features
1. **Evidence Retrieval**: Query platform for dispute evidence
2. **Message Box Integration**: Retrieve platform's dispute resolution notes
3. **Notification System**: Alert parties when dispute resolved
4. **Analytics**: Track dispute resolution statistics
5. **Partial Reconstitution**: Allow seeker to reconstitute with modified terms

## BSV SDK Patterns Used

### BRC Standards Compliance
- **BRC-46**: Wallet baskets for data organization
- **BRC-42**: Key derivation for identity
- **BRC-77**: Signature creation patterns
- **BRC-8**: Transaction envelopes (BEEF format)

### SDK Features
- `LookupResolver.query()` for overlay network queries
- `WalletInterface.createAction()` for basket storage
- `Transaction.fromBEEF()` for transaction parsing
- Automatic P2PKH output tracking

## Notes for Next Engineer

### Key Assumptions
1. Platform.decideDispute() has already been called
2. Resolution transaction is broadcast to overlay network
3. Wallet supports basket storage
4. Overlay service implements `findSpendingTx` query parameter

### Important Context
- The P2PKH outputs are **already in the wallet** after Platform broadcasts
- These methods are mainly for **recording history** and **optional reconstitution**
- No complex wallet interactions needed - BSV SDK handles P2PKH tracking automatically

### Code Quality
- Follows existing codebase patterns (callContractMethod, signatory, etc.)
- Proper async/await error handling
- TypeScript type safety maintained
- Comments explain BSV SDK wallet behavior

### Testing Status
- ⚠️ **No tests written yet** - this is the top priority
- Need both unit and integration tests
- Consider testing with mock wallet and overlay service

## Related Documentation
- Full context in: `/home/ishaan/Documents/babbage-escrow/backend/.claude/tasks/context_session_dispute_methods.md`
- Platform implementation: `/home/ishaan/Documents/babbage-escrow/backend/src/entities/Platform.ts` (lines 54-127)
