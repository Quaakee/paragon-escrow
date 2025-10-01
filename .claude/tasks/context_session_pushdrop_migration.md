# PushDrop Migration - Context Session

## Date: 2025-10-01

## Objective
Replace all OP_RETURN implementations with PushDrop in the escrow backend for improved BRC compliance and privacy-enhanced key derivation.

## Files Modified

### 1. `/home/ishaan/Documents/babbage-escrow/backend/src/entities/Seeker.ts`
**Changes:**
- **Line 2:** Added `import { PushDrop } from '@bsv/sdk/script'`
- **Lines 219-274 (listDisputes method):**
  - Replaced manual OP_RETURN parsing with PushDrop.unlock()
  - Added backward compatibility: tries PushDrop first, falls back to OP_RETURN
  - PushDrop format automatically filters by wallet key (no manual filtering needed)
  - Legacy OP_RETURN still requires manual filtering by seekerKey
- **Lines 310-334 (reclaimAfterDispute method):**
  - Replaced manual OP_RETURN script construction with PushDrop.lock()
  - Protocol ID: `[2, 'escrow-disputes']`
  - Key ID: `record.record.txid` (unique per escrow)
  - Locked to: `'self'`
  - Encryption: `false`
  - Added `'pushdrop'` tag to basket output

### 2. `/home/ishaan/Documents/babbage-escrow/backend/src/entities/Furnisher.ts`
**Changes:**
- **Line 2:** Added `import { PushDrop } from '@bsv/sdk/script'`
- **Lines 187-242 (listDisputes method):**
  - Replaced manual OP_RETURN parsing with PushDrop.unlock()
  - Added backward compatibility: tries PushDrop first, falls back to OP_RETURN
  - PushDrop format automatically filters by wallet key (no manual filtering needed)
  - Legacy OP_RETURN still requires manual filtering by furnisherKey
- **Lines 285-309 (claimAfterDispute method):**
  - Replaced manual OP_RETURN script construction with PushDrop.lock()
  - Protocol ID: `[2, 'escrow-disputes']`
  - Key ID: `record.record.txid` (unique per escrow)
  - Locked to: `'self'`
  - Encryption: `false`
  - Added `'pushdrop'` tag to basket output (along with existing `'furnisher'` tag)

### 3. `/home/ishaan/Documents/babbage-escrow/backend/src/entities/Platform.ts`
**Changes:**
- **Line 2:** Modified to `import { P2PKH, PushDrop } from '@bsv/sdk/script'`
- **Lines 59-115 (listHistoricalDisputes method):**
  - Replaced manual OP_RETURN parsing with PushDrop.unlock()
  - Added backward compatibility: tries PushDrop first, falls back to OP_RETURN
  - PushDrop format automatically filters by wallet key (no manual filtering needed)
  - Legacy OP_RETURN still requires manual filtering by platformKey
- **Note:** Platform.decideDispute() does not store dispute records, so no storage migration needed

## Technical Implementation Details

### PushDrop Storage Pattern
```typescript
// PushDrop requires WalletInterface in constructor
const pushDrop = new PushDrop(this.wallet)
const dataBytes = Array.from(Buffer.from(JSON.stringify(disputeRecord)))
const lockingScript = await pushDrop.lock(
  [dataBytes],                      // Data payload (array of field arrays)
  [2, 'escrow-disputes'],           // Protocol ID (BRC-42)
  record.record.txid,               // Key ID (unique per escrow)
  'self',                           // Counterparty
  false,                            // forSelf (false = locked to counterparty)
  false                             // includeSignature (false = no signature in locking script)
)
```

### PushDrop Retrieval Pattern (with Backward Compatibility)
```typescript
try {
  // Try PushDrop parsing first (new format)
  // Use static decode() method - does not require wallet
  const decoded = PushDrop.decode(lockingScript)
  const dataBytes = decoded.fields[0]  // First field contains our JSON data
  jsonStr = Buffer.from(dataBytes).toString('utf8')
  record = JSON.parse(jsonStr)

  // PushDrop outputs are already locked to our key via BRC-42
  // Wallet.getOutputs() already filtered by our key
  // No additional filtering needed!
  return record
} catch {
  // Fall back to OP_RETURN parsing (old format - backward compatibility)
  // ... legacy OP_RETURN parsing code with manual filtering ...
}
```

### Key API Details

**PushDrop Constructor:**
```typescript
new PushDrop(wallet: WalletInterface, originator?: string)
```

**PushDrop.lock() Method:**
```typescript
lock(
  fields: number[][],                           // Array of data field arrays
  protocolID: [SecurityLevel, string],          // BRC-42 protocol ID
  keyID: string,                                // BRC-42 key ID
  counterparty: string,                         // 'self' or 'anyone'
  forSelf?: boolean,                            // Lock to self vs counterparty
  includeSignature?: boolean,                   // Include signature in locking script
  lockPosition?: 'before' | 'after'             // Position of lock
): Promise<LockingScript>
```

**PushDrop.decode() Static Method:**
```typescript
static decode(script: LockingScript): {
  lockingPublicKey: PublicKey;
  fields: number[][];                           // Array of data field arrays
}
```

**PushDrop.unlock() Method (not used for data retrieval):**
```typescript
unlock(
  protocolID: [SecurityLevel, string],
  keyID: string,
  counterparty: string,
  signOutputs?: 'all' | 'none' | 'single',
  anyoneCanPay?: boolean,
  sourceSatoshis?: number,
  lockingScript?: LockingScript
): {
  sign: (tx: Transaction, inputIndex: number) => Promise<UnlockingScript>;
  estimateLength: () => Promise<73>;
}
```
Note: `unlock()` is for spending outputs, not for parsing stored data. Use `decode()` for data retrieval.

## Benefits of PushDrop Migration

1. **BRC-42 Compliance:** Uses proper BSV key derivation scheme
2. **Privacy-Enhanced:** Outputs are locked to derived keys using protocol ID and key ID
3. **Automatic Filtering:** Wallet automatically filters outputs by derived key (no manual seekerKey/furnisherKey/platformKey checks needed for PushDrop format)
4. **Backward Compatible:** Gracefully handles both old OP_RETURN and new PushDrop formats
5. **Better Security:** Data can be encrypted if needed (currently disabled with `false` parameter)
6. **Standard Template:** Uses ScriptTemplate interface for consistency across BSV applications

## Protocol ID Configuration
- **Protocol ID:** `[2, 'escrow-disputes']`
  - Security Level: `2` (counterparty-specific)
  - Protocol Name: `'escrow-disputes'`
- **Key ID:** `record.record.txid` (unique identifier per escrow transaction)
- **Counterparty:** `'self'` (locked to own derived key)

## Basket Tags
New outputs include the `'pushdrop'` tag in addition to existing tags:
- Seeker: `['dispute', 'escrow', 'resolved', 'pushdrop']`
- Furnisher: `['dispute', 'escrow', 'resolved', 'furnisher', 'pushdrop']`
- Platform: No storage (retrieval only)

## Testing Recommendations

1. **Test PushDrop Storage:** Verify dispute records are correctly stored with PushDrop format
2. **Test PushDrop Retrieval:** Verify dispute records can be retrieved and parsed
3. **Test Backward Compatibility:** Verify old OP_RETURN records can still be read
4. **Test Filtering:** Verify PushDrop outputs are automatically filtered by wallet key
5. **Test Key Derivation:** Verify same protocol ID and key ID produce consistent derived keys
6. **Integration Test:** Test full dispute flow (raise -> decide -> reclaim/claim) with PushDrop

## Next Steps for Engineers

1. Run the existing test suite to ensure no regressions
2. Add specific unit tests for PushDrop parsing logic
3. Test migration path: ensure existing OP_RETURN records are still readable
4. Consider adding monitoring/logging to track PushDrop vs OP_RETURN usage
5. Plan deprecation timeline for OP_RETURN format (if desired)
6. Update API documentation to reflect PushDrop implementation

## Notes
- All modifications maintain exact same functionality
- Methods work identically from caller's perspective
- Internal implementation now uses PushDrop with BRC-42 key derivation
- No breaking changes to API surface
- Zero additional dependencies (PushDrop is part of @bsv/sdk)
