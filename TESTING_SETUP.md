# Testing Setup Guide

Complete guide for setting up and running tests for the Babbage Escrow System.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Running Tests](#running-tests)
5. [Test Structure](#test-structure)
6. [Troubleshooting](#troubleshooting)
7. [Advanced Testing](#advanced-testing)

---

## Prerequisites

### Required Software

- **Node.js**: Version 18.x or higher
- **npm**: Version 8.x or higher
- **TypeScript**: Version 5.2.2 (included in devDependencies)

Verify your installation:

```bash
node --version    # Should show v18.x or higher
npm --version     # Should show 8.x or higher
```

### BSV SDK Knowledge (Optional but Helpful)

Familiarity with:
- BSV blockchain concepts (transactions, UTXOs, scripts)
- BRC standards (BRC-42 key derivation, BRC-77/78 messaging)
- sCrypt smart contracts
- Overlay network architecture

---

## Installation

### 1. Clone Repository

```bash
cd /path/to/babbage-escrow/backend
```

### 2. Install Dependencies

```bash
npm install
```

This will install:
- `@bsv/sdk` - BSV TypeScript SDK
- `@bsv/overlay` - Overlay network tools
- `scrypt-ts` - sCrypt smart contract framework
- `jest` - Testing framework
- `ts-jest` - TypeScript support for Jest

Expected output:
```
added XXX packages, and audited YYY packages in Zs
```

### 3. Verify Installation

```bash
npm list --depth=0
```

You should see:
```
@babbage/escrow@0.1.0
├── @bsv/overlay@0.2.1
├── @bsv/sdk@1.4.0
├── @types/jest@29.5.12
├── jest@29.7.0
├── scrypt-ts@1.4.3
├── ts-jest@29.1.1
└── typescript@5.2.2
```

---

## Configuration

### 1. Build the Project

Tests require the project to be built first:

```bash
npm run build
```

Expected output:
```
tsc -b
```

This compiles TypeScript to JavaScript in the `dist/` directory.

### 2. Test Configuration Files

The test suite includes pre-configured files:

**`tests/test-config.ts`**
- GlobalConfig settings for test scenarios
- Test keys (automatically generated)
- Test amounts and descriptions
- Helper functions

**`tests/test-utils.ts`**
- MockWallet implementation
- MockBroadcaster for transaction tracking
- MockLookupResolver for overlay queries
- Test data generators
- Assertion helpers

### 3. Environment Variables (Optional)

For integration tests with real networks:

```bash
# Create .env file in backend directory
touch .env

# Add configuration
echo "BSV_NETWORK=testnet" >> .env
echo "WALLET_URL=https://your-wallet-url.com" >> .env
```

**Note**: Current tests use mocks and don't require real network access.

---

## Running Tests

### Basic Commands

#### Run All Tests

```bash
npm test
```

This runs:
1. `npm run build` - Compile TypeScript
2. `jest` - Execute all test files

Expected output:
```
PASS tests/unit.test.ts
PASS tests/happy-path.test.ts
PASS tests/dispute-resolution.test.ts
PASS tests/integration.test.ts

Test Suites: 4 passed, 4 total
Tests:       XX passed, XX total
Snapshots:   0 total
Time:        X.XXs
```

#### Watch Mode (Development)

```bash
npm run test:watch
```

Tests re-run automatically when files change. Useful during development.

#### Coverage Report

```bash
npm run test:coverage
```

Generates coverage report showing which code is tested:

```
File                       | % Stmts | % Branch | % Funcs | % Lines
---------------------------|---------|----------|---------|--------
All files                  |   XX.XX |    XX.XX |   XX.XX |   XX.XX
 src/entities/Seeker.ts    |   XX.XX |    XX.XX |   XX.XX |   XX.XX
 src/entities/Furnisher.ts |   XX.XX |    XX.XX |   XX.XX |   XX.XX
 src/entities/Platform.ts  |   XX.XX |    XX.XX |   XX.XX |   XX.XX
```

### Running Specific Tests

#### Single Test File

```bash
npm test -- tests/happy-path.test.ts
```

#### Test Pattern

```bash
npm test -- --testPathPattern=dispute
```

Runs all tests with "dispute" in filename.

#### Specific Test Case

```bash
npm test -- --testNamePattern="should complete full escrow workflow"
```

#### Verbose Output

```bash
npm test -- --verbose
```

Shows detailed test execution information.

---

## Test Structure

### Test Files Overview

```
tests/
├── test-config.ts              # Test configuration and constants
├── test-utils.ts               # Mock implementations and helpers
├── happy-path.test.ts          # Full successful workflow
├── dispute-resolution.test.ts  # Dispute scenarios
├── integration.test.ts         # Component integration tests
└── unit.test.ts                # Unit tests for utilities
```

### Test Scenarios

#### 1. Happy Path Test (`happy-path.test.ts`)

Tests the complete successful workflow:

1. Seeker creates work contract
2. Furnisher places bid
3. Seeker accepts bid
4. Furnisher starts work (posts bond)
5. Furnisher submits completed work
6. Seeker approves work
7. Furnisher claims payment

**Run this test:**
```bash
npm test -- tests/happy-path.test.ts
```

#### 2. Dispute Resolution Test (`dispute-resolution.test.ts`)

Tests dispute scenarios:

1. **Seeker-initiated dispute** (missed deadline)
   - Work deadline expires
   - Seeker raises dispute
   - Platform decides in favor of seeker
   - Seeker claims refund

2. **Furnisher-initiated dispute** (unapproved work)
   - Work submitted but not approved
   - Approval deadline expires
   - Furnisher raises dispute
   - Platform decides in favor of furnisher
   - Furnisher claims payment

**Run this test:**
```bash
npm test -- tests/dispute-resolution.test.ts
```

#### 3. Integration Test (`integration.test.ts`)

Tests system components:

- Entity interactions (Seeker, Furnisher, Platform)
- PushDrop storage for dispute records
- Overlay network queries (mocked)
- Basket storage and retrieval
- Contract state transitions
- BRC-42 key derivation

**Run this test:**
```bash
npm test -- tests/integration.test.ts
```

#### 4. Unit Test (`unit.test.ts`)

Tests individual functions:

- `contractFromGlobalConfigAndParams()`
- `recordFromContract()`
- Test utility functions
- Mock implementations
- Configuration helpers

**Run this test:**
```bash
npm test -- tests/unit.test.ts
```

---

## Troubleshooting

### Common Errors

#### Error: "Cannot find module 'XXX'"

**Problem**: Dependencies not installed or build not run

**Solution**:
```bash
npm install
npm run build
npm test
```

#### Error: "Test suite failed to run"

**Problem**: TypeScript compilation errors

**Solution**:
```bash
# Check for TypeScript errors
npm run build

# If errors exist, fix them first
# Then run tests
npm test
```

#### Error: "Timeout of 5000ms exceeded"

**Problem**: Test operation taking too long

**Solution**: Increase timeout in test file:
```typescript
it('test name', async () => {
  // test code
}, 30000) // 30 second timeout
```

#### Warning: "Coverage data not found"

**Problem**: Coverage directory not created

**Solution**:
```bash
# Clean and rebuild
rm -rf coverage/
npm run test:coverage
```

### Build Issues

#### TypeScript Version Mismatch

```bash
# Use project's TypeScript version
npm run build

# Don't use global TypeScript
```

#### Module Resolution Errors

Ensure `tsconfig.json` has correct settings:
```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true
  }
}
```

### Test Execution Issues

#### Tests Pass Locally but Fail in CI

Check:
1. Node.js version matches (18.x)
2. All dependencies installed
3. Build step runs before tests
4. Correct environment variables

#### Mock Wallet Issues

If mock wallet behaves unexpectedly:
```typescript
// Reset wallet state between tests
beforeEach(() => {
  wallet.clearOutputs()
  wallet.setHeight(800000)
})
```

---

## Advanced Testing

### Testing with Real BSV Network

**⚠️ WARNING**: Use testnet only for real network tests!

#### 1. Setup Testnet Wallet

```typescript
import { WalletClient } from '@bsv/sdk'

const realWallet = new WalletClient('auto', 'localhost')
```

#### 2. Fund Testnet Wallet

Get testnet coins from:
- BSV Testnet Faucet: https://faucet.bitcoincloud.net/

#### 3. Configure for Testnet

```typescript
const TESTNET_CONFIG: GlobalConfig = {
  ...TEST_GLOBAL_CONFIG,
  networkPreset: 'testnet'
}
```

#### 4. Run Integration Tests

```bash
# Set environment
export BSV_NETWORK=testnet

# Run tests
npm test -- tests/integration.test.ts
```

### Performance Testing

#### Benchmark Test Execution

```bash
# Run with timing
time npm test

# Result:
# real    0m12.345s
# user    0m10.123s
# sys     0m1.234s
```

#### Test Large Datasets

Modify integration tests:
```typescript
it('should handle 1000 contracts', async () => {
  const contracts = Array(1000).fill(null).map((_, i) => ({
    id: i,
    status: 'initial'
  }))

  // Test operations on large dataset
}, 60000) // 60s timeout for large tests
```

### Custom Test Scenarios

#### Create Custom GlobalConfig

```typescript
const CUSTOM_CONFIG: GlobalConfig = {
  ...TEST_GLOBAL_CONFIG,
  contractType: 'bounty',
  bountySolversNeedApproval: false,
  escrowServiceFeeBasisPoints: 500 // 5% fee
}
```

#### Test Specific Edge Cases

```typescript
describe('Custom Scenarios', () => {
  it('should handle zero-bond contracts', async () => {
    // Custom test logic
  })

  it('should handle maximum bid amounts', async () => {
    // Custom test logic
  })
})
```

### Debugging Tests

#### Enable Debug Output

```typescript
// Add console.log in tests
console.log('Current state:', contract.status)
console.log('Wallet balance:', await wallet.getHeight({}))
```

#### Run Single Test with Debug

```bash
# Run with Node.js inspect
node --inspect-brk node_modules/.bin/jest tests/happy-path.test.ts

# Open Chrome DevTools: chrome://inspect
```

#### Use Jest Debug Mode

```bash
# Install globally
npm install -g jest

# Run with debugging
jest --runInBand --detectOpenHandles tests/happy-path.test.ts
```

### Writing New Tests

#### Test Template

```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { TEST_GLOBAL_CONFIG, TEST_SEEKER_PRIVATE_KEY } from './test-config.js'
import { MockWallet, TestCleanup } from './test-utils.js'

describe('My New Test Suite', () => {
  let wallet: MockWallet
  let cleanup: TestCleanup

  beforeEach(() => {
    wallet = new MockWallet(TEST_SEEKER_PRIVATE_KEY)
    cleanup = new TestCleanup()
  })

  afterEach(async () => {
    await cleanup.cleanup()
  })

  it('should test something', async () => {
    // Arrange
    const input = 'test'

    // Act
    const result = someFunction(input)

    // Assert
    expect(result).toBe('expected')
  })
})
```

---

## Quick Reference

### Most Common Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- tests/happy-path.test.ts

# Run with coverage
npm run test:coverage

# Run specific test case
npm test -- --testNamePattern="should complete"

# Rebuild before testing
npm run build && npm test

# Verbose output
npm test -- --verbose
```

### Test Development Workflow

1. **Write test** in `tests/my-test.test.ts`
2. **Build project**: `npm run build`
3. **Run test**: `npm test -- tests/my-test.test.ts`
4. **Debug if needed**: Add `console.log`, increase timeout
5. **Verify passes**: `npm test`
6. **Check coverage**: `npm run test:coverage`

### Expected Test Execution Time

- Unit tests: ~2-5 seconds
- Happy path: ~5-10 seconds
- Dispute resolution: ~5-10 seconds
- Integration: ~10-15 seconds
- **Total**: ~30-45 seconds for full suite

---

## Getting Help

### Resources

- **BSV SDK Docs**: https://docs.bsvblockchain.org/
- **sCrypt Docs**: https://docs.scrypt.io/
- **Jest Docs**: https://jestjs.io/docs/getting-started
- **TypeScript Docs**: https://www.typescriptlang.org/docs/

### Common Questions

**Q: Do I need a real BSV wallet to run tests?**
A: No, tests use MockWallet. Real wallet only needed for testnet integration tests.

**Q: Why do tests need to build first?**
A: Jest runs the compiled JavaScript, not TypeScript source.

**Q: Can I run tests without internet?**
A: Yes, all tests use mocks and run offline.

**Q: How do I add a new test?**
A: Create a new `.test.ts` file in `tests/` directory and run `npm test`.

**Q: Tests are slow, how to speed up?**
A: Run specific test files instead of full suite, use `--runInBand` flag.

---

## Summary

You're now ready to test the Babbage Escrow System!

**Quick Start Checklist:**

- [ ] Node.js 18+ installed
- [ ] Dependencies installed (`npm install`)
- [ ] Project built (`npm run build`)
- [ ] Tests pass (`npm test`)

**Next Steps:**

1. Run all tests to verify setup
2. Explore test files to understand scenarios
3. Modify tests for your use case
4. Write custom tests for new features

Happy testing! 🚀
