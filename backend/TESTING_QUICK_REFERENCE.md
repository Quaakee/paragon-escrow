# Testing Quick Reference

Quick reference for running tests. For detailed guide, see [TESTING_SETUP.md](./TESTING_SETUP.md).

## Installation & Setup

```bash
# Install dependencies
npm install

# Build project (required before testing)
npm run build
```

## Run Tests

```bash
# Run all tests
npm test

# Watch mode (auto-rerun on changes)
npm run test:watch

# Coverage report
npm run test:coverage
```

## Run Specific Tests

```bash
# Single test file
npm test -- tests/happy-path.test.ts

# Test pattern (all files matching "dispute")
npm test -- --testPathPattern=dispute

# Specific test case
npm test -- --testNamePattern="should complete full escrow"

# Verbose output
npm test -- --verbose
```

## Test Files

| File | Description | Duration |
|------|-------------|----------|
| `happy-path.test.ts` | Full successful workflow | ~5-10s |
| `dispute-resolution.test.ts` | Dispute scenarios | ~5-10s |
| `integration.test.ts` | Component integration | ~10-15s |
| `unit.test.ts` | Utility function tests | ~2-5s |

## Test Scenarios

### Happy Path
✅ Seeker creates contract
✅ Furnisher places bid
✅ Seeker accepts bid
✅ Furnisher starts work
✅ Furnisher submits work
✅ Seeker approves work
✅ Furnisher claims payment

### Dispute Resolution
⚠️ Seeker disputes (missed deadline)
⚠️ Furnisher disputes (unapproved work)
⚖️ Platform decides dispute
💰 Parties claim payouts

### Integration
🔗 Entity interactions
📦 PushDrop storage
🌐 Overlay network
🗄️ Basket storage

## Common Issues

### "Cannot find module"
```bash
npm install && npm run build
```

### "Test timeout"
Increase timeout in test file:
```typescript
it('test', async () => {
  // ...
}, 60000) // 60 seconds
```

### "Coverage not found"
```bash
rm -rf coverage/
npm run test:coverage
```

## Quick Commands

```bash
# Full test cycle
npm run build && npm test

# Test + Coverage
npm run build && npm run test:coverage

# Debug specific test
npm test -- --runInBand tests/happy-path.test.ts

# Continuous development
npm run test:watch
```

## Test Structure

```
tests/
├── test-config.ts     # Configuration
├── test-utils.ts      # Mocks & helpers
├── happy-path.test.ts # Success scenarios
├── dispute-resolution.test.ts # Dispute scenarios
├── integration.test.ts # Integration tests
└── unit.test.ts       # Unit tests
```

## Expected Output

```
PASS tests/unit.test.ts
PASS tests/happy-path.test.ts
PASS tests/dispute-resolution.test.ts
PASS tests/integration.test.ts

Test Suites: 4 passed, 4 total
Tests:       XX passed, XX total
Time:        ~30-45s
```

## Resources

- **Full Guide**: [TESTING_SETUP.md](./TESTING_SETUP.md)
- **BSV SDK**: https://docs.bsvblockchain.org/
- **Jest Docs**: https://jestjs.io/
- **sCrypt Docs**: https://docs.scrypt.io/

---

**Need Help?** See [TESTING_SETUP.md](./TESTING_SETUP.md) for detailed troubleshooting and advanced testing.
