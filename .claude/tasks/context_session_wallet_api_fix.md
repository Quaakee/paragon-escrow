# Wallet API Fix - Context Session

## Date: 2025-10-01

## Objective
Fix incorrect wallet API calls in the escrow backend. The code was calling `wallet.getOutputs()` which doesn't exist in the BSV SDK WalletInterface. The correct method is `wallet.listOutputs()`.

## Problem Analysis

### Incorrect API Usage
```typescript
// INCORRECT (does not exist in WalletInterface)
const outputs = await this.wallet.getOutputs({
  basket: 'escrow-disputes',
  tags: ['dispute', 'escrow', 'resolved'],
  includeEnvelope: true  // This parameter doesn't exist either
})
```

### Correct BSV SDK WalletInterface API

**Method Name:** `listOutputs()`

**Interface Definition:**
```typescript
interface ListOutputsArgs {
  basket: BasketStringUnder300Bytes
  tags?: OutputTagStringUnder300Bytes[]
  tagQueryMode?: 'all' | 'any'
  include?: 'locking scripts' | 'entire transactions'
  includeCustomInstructions?: BooleanDefaultFalse
  includeTags?: BooleanDefaultFalse
  includeLabels?: BooleanDefaultFalse
  limit?: PositiveIntegerDefault10Max10000
  offset?: PositiveIntegerOrZero
  seekPermission?: BooleanDefaultTrue
}

interface ListOutputsResult {
  totalOutputs: PositiveIntegerOrZero
  BEEF?: BEEF  // Present when include: 'entire transactions'
  outputs: WalletOutput[]
}

interface WalletOutput {
  satoshis: SatoshiValue
  lockingScript?: HexString  // Present when include: 'locking scripts'
  spendable: boolean
  customInstructions?: string
  tags?: OutputTagStringUnder300Bytes[]
  outpoint: OutpointString  // Format: "txid.outputIndex"
  labels?: LabelStringUnder300Bytes[]
}
```

### Key Differences

1. **Method Name:** `getOutputs()` → `listOutputs()`
2. **Parameter Name:** `includeEnvelope` → `include: 'entire transactions'`
3. **Return Structure:**
   - Returns `{ totalOutputs, BEEF?, outputs }` instead of just array
   - BEEF data is at top level (aggregated), not per-output
   - Outputs have `outpoint` field instead of separate `txid` and `outputIndex`

### Implementation Strategy

Since the code needs individual transaction data per output (to parse locking scripts), we have two options:

**Option A: Use `include: 'entire transactions'`**
- Gets aggregated BEEF at top level
- Would need to parse BEEF and extract individual transactions
- More complex implementation

**Option B: Use `include: 'locking scripts'`** (CHOSEN)
- Gets locking script directly with each output
- Simpler implementation
- No need for BEEF parsing
- Sufficient for data extraction (PushDrop.decode() or OP_RETURN parsing)

## Files Modified

### 1. `/home/ishaan/Documents/babbage-escrow/backend/src/entities/Seeker.ts`

**Location:** Lines 213-217 (listDisputes method)

**Change:**
```typescript
// BEFORE
const outputs = await this.wallet.getOutputs({
  basket: 'escrow-disputes',
  tags: ['dispute', 'escrow', 'resolved'],
  includeEnvelope: true
})

// AFTER
const result = await this.wallet.listOutputs({
  basket: 'escrow-disputes',
  tags: ['dispute', 'escrow', 'resolved'],
  include: 'locking scripts'
})
const outputs = result.outputs
```

**Subsequent Changes:**
- Line 222: Changed `Transaction.fromBEEF(output.BEEF!)` to direct locking script access
- Line 223: `const lockingScript = output.lockingScript!` (locking script is now directly available)
- Removed lines 223-224: No longer need to extract from transaction

### 2. `/home/ishaan/Documents/babbage-escrow/backend/src/entities/Furnisher.ts`

**Location:** Lines 181-185 (listDisputes method)

**Change:**
```typescript
// BEFORE
const outputs = await this.wallet.getOutputs({
  basket: 'escrow-disputes',
  tags: ['dispute', 'escrow', 'resolved'],
  includeEnvelope: true
})

// AFTER
const result = await this.wallet.listOutputs({
  basket: 'escrow-disputes',
  tags: ['dispute', 'escrow', 'resolved'],
  include: 'locking scripts'
})
const outputs = result.outputs
```

**Subsequent Changes:**
- Line 190: Changed `Transaction.fromBEEF(output.envelope!)` to direct locking script access
- Line 191: `const lockingScript = output.lockingScript!` (locking script is now directly available)
- Removed lines 191-192: No longer need to extract from transaction

### 3. `/home/ishaan/Documents/babbage-escrow/backend/src/entities/Platform.ts`

**Location:** Lines 53-57 (listHistoricalDisputes method)

**Change:**
```typescript
// BEFORE
const outputs = await this.wallet.getOutputs({
  basket: 'escrow-disputes',
  tags: ['dispute', 'escrow', 'resolved'],
  includeEnvelope: true
})

// AFTER
const result = await this.wallet.listOutputs({
  basket: 'escrow-disputes',
  tags: ['dispute', 'escrow', 'resolved'],
  include: 'locking scripts'
})
const outputs = result.outputs
```

**Subsequent Changes:**
- Line 62: Changed `Transaction.fromBEEF(output.envelope!)` to direct locking script access
- Line 63: `const lockingScript = output.lockingScript!` (locking script is now directly available)
- Removed lines 63-64: No longer need to extract from transaction

## Technical Details

### Why `include: 'locking scripts'` Works

1. **PushDrop.decode()** only needs the locking script:
   ```typescript
   const decoded = PushDrop.decode(lockingScript)
   const dataBytes = decoded.fields[0]
   ```

2. **OP_RETURN parsing** only needs the locking script hex:
   ```typescript
   const lockingScriptHex = lockingScript.toHex()
   // Parse OP_FALSE OP_RETURN data...
   ```

3. **No transaction context needed** - we're only reading embedded data, not validating transactions

### Locking Script Format

When `include: 'locking scripts'` is specified:
- Each `WalletOutput` has `lockingScript?: HexString` populated
- The locking script is already a hex string
- Can be used directly or converted to `Script` object if needed
- For our use case, we can pass it directly to `PushDrop.decode()` or parse hex for OP_RETURN

### Error Handling

The code already has proper error handling:
```typescript
try {
  const result = await this.wallet.listOutputs({...})
  const outputs = result.outputs
  // ... parsing ...
} catch (error) {
  console.warn('Failed to query historical disputes from basket:', error instanceof Error ? error.message : String(error))
  result.historical = []  // or return []
}
```

## Benefits of This Fix

1. **Correct API Usage:** Uses actual BSV SDK WalletInterface methods
2. **Simpler Implementation:** Direct locking script access is cleaner than BEEF parsing
3. **Better Performance:** No need to parse entire transactions when only locking script is needed
4. **Type Safety:** Proper TypeScript types from SDK
5. **Future Proof:** Uses stable, documented API

## Testing Recommendations

1. **Test listOutputs() Call:** Verify wallet returns expected outputs
2. **Test Locking Script Access:** Verify `output.lockingScript` is populated
3. **Test PushDrop Parsing:** Verify PushDrop.decode() works with locking script
4. **Test OP_RETURN Parsing:** Verify legacy OP_RETURN parsing still works
5. **Test Empty Basket:** Verify graceful handling when no outputs exist
6. **Integration Test:** Test full dispute flow (raise -> list -> parse)

## API Documentation Reference

**BSV SDK Version:** 1.5.1

**WalletInterface Location:**
`@bsv/sdk/src/wallet/Wallet.interfaces.ts`

**Method:** `listOutputs(args: ListOutputsArgs, originator?: string): Promise<ListOutputsResult>`

**Documentation:**
```typescript
/**
 * Lists the spendable outputs kept within a specific basket, optionally tagged with specific labels.
 *
 * @param {ListOutputsArgs} args - Arguments detailing the query for listing spendable outputs.
 * @param {OriginatorDomainNameStringUnder250Bytes} [originator] - Fully-qualified domain name (FQDN) of the application that originated the request.
 * @returns {Promise<ListOutputsResult>} The promise returns an output listing or an error object.
 */
```

## Next Steps for Engineers

1. Run existing test suite to ensure no regressions
2. Test dispute listing functionality (Seeker, Furnisher, Platform)
3. Verify both PushDrop and OP_RETURN formats are parsed correctly
4. Monitor for any runtime errors related to locking script access
5. Consider adding unit tests that mock `listOutputs()` responses
6. Update any documentation that references the old `getOutputs()` API

## Notes

- All three files have identical API usage patterns
- The fix is consistent across all files
- Functionality remains exactly the same from user perspective
- No breaking changes to external API
- Zero additional dependencies
- The locking script is sufficient for all data extraction needs
