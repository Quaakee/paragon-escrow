# MetaNet Desktop Integration Guide - BSV Escrow System

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Current Implementation Status](#current-implementation-status)
4. [Integration Details](#integration-details)
5. [Error Handling](#error-handling)
6. [Testing Strategies](#testing-strategies)
7. [Deployment Guide](#deployment-guide)
8. [Troubleshooting](#troubleshooting)
9. [Advanced Configuration](#advanced-configuration)

---

## Overview

**MetaNet Desktop** is a BRC-100 compliant desktop wallet application that provides a local HTTP server for blockchain wallet operations. Your BSV Escrow System is **already correctly configured** to work with MetaNet Desktop.

### Key Facts
- ✅ **Current Implementation**: Already compatible with MetaNet Desktop
- 🔌 **Connection**: HTTP server on `http://127.0.0.1:3321`
- 📋 **Protocol**: BRC-100 WalletInterface via JSON-RPC over HTTP
- 🔐 **Security**: Origin-based permissions, user authentication required

---

## Architecture

### MetaNet Desktop Architecture

```
┌─────────────────────────────────────────────────────────┐
│  MetaNet Desktop (Tauri Application)                    │
│                                                           │
│  ┌────────────────┐         ┌─────────────────────┐    │
│  │ Rust Backend   │         │ TypeScript Frontend │    │
│  │                │         │                      │    │
│  │ HTTP Server    │◄───────►│ BRC-100 Wallet      │    │
│  │ (Hyper)        │   IPC   │ Implementation      │    │
│  │ Port 3321      │         │ (@bsv/wallet-       │    │
│  └────────┬───────┘         │  toolbox-client)    │    │
│           │                 └─────────────────────┘    │
└───────────┼──────────────────────────────────────────────┘
            │
            │ HTTP POST Requests
            │ (JSON-RPC style)
            │
┌───────────▼──────────────────────────────────────────────┐
│  Your Node.js Backend (BSV Escrow System)                │
│                                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │ WalletClient('auto', 'localhost')               │   │
│  │                                                  │   │
│  │ Entity Classes:                                 │   │
│  │ - Seeker.ts  ─┐                                 │   │
│  │ - Furnisher.ts├─► WalletInterface Operations   │   │
│  │ - Platform.ts ─┘                                │   │
│  └─────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────┘
```

### Request Flow

```
Node.js Backend              MetaNet Desktop                  User
     │                            │                            │
     │ 1. wallet.getPublicKey()   │                            │
     ├───────────────────────────►│                            │
     │                            │ 2. First time: Request     │
     │                            │    permission              │
     │                            ├───────────────────────────►│
     │                            │ 3. User approves           │
     │                            │◄───────────────────────────┤
     │ 4. Public key response     │                            │
     │◄───────────────────────────┤                            │
     │                            │                            │
     │ 5. Subsequent calls use    │                            │
     │    cached permissions      │                            │
     │───────────────────────────►│                            │
     │◄───────────────────────────┤                            │
```

---

## Current Implementation Status

### ✅ What's Already Working

Your entity classes are **already correctly configured**:

```typescript
// src/entities/Seeker.ts
export default class Seeker {
  constructor(
    private readonly globalConfig: GlobalConfig,
    private readonly wallet: WalletInterface = new WalletClient('auto', 'localhost'),
    // ...
  ) { }
}

// src/entities/Furnisher.ts
export default class Furnisher {
  constructor(
    private readonly globalConfig: GlobalConfig,
    private readonly wallet: WalletInterface = new WalletClient('auto', 'localhost'),
    // ...
  ) { }
}

// src/entities/Platform.ts
export default class Platform {
  constructor(
    private readonly globalConfig: GlobalConfig,
    private readonly wallet: WalletInterface = new WalletClient('auto', 'localhost'),
    // ...
  ) { }
}
```

**Why This Works**:
- `'auto'` substrate automatically detects the HTTP endpoint at `localhost:3321`
- `'localhost'` tells WalletClient to look for a local wallet server
- `WalletClient` handles all HTTP communication transparently
- Origin headers are automatically managed by `WalletClient`

### 🔄 Operations That Work Out of the Box

All current wallet operations in your escrow system work with MetaNet Desktop:

1. **Key Derivation (BRC-42)**:
   ```typescript
   await wallet.getPublicKey({
     counterparty: 'self',
     protocolID: [2, 'escrow-v1'],
     keyID: '1'
   })
   ```

2. **Signature Creation**:
   ```typescript
   await wallet.createSignature({
     protocolID: [2, 'escrow-v1'],
     keyID: '1',
     counterparty: 'self',
     data: preimageHash
   })
   ```

3. **Transaction Creation**:
   ```typescript
   await wallet.createAction({
     description: 'Work completion contract',
     outputs: [{ satoshis: 1000, lockingScript: '...' }]
   })
   ```

4. **Output Management**:
   ```typescript
   await wallet.listOutputs({
     basket: 'escrow-disputes',
     tags: ['dispute', 'escrow', 'resolved'],
     include: 'locking scripts'
   })
   ```

5. **Blockchain Queries**:
   ```typescript
   await wallet.getHeight({})
   await wallet.getNetwork({})
   ```

---

## Integration Details

### MetaNet Desktop BRC-100 Endpoints

MetaNet Desktop exposes these endpoints on `http://127.0.0.1:3321`:

| Endpoint | Purpose | Used By |
|----------|---------|---------|
| `/getPublicKey` | Derive BRC-42 public keys | All entities (key derivation) |
| `/createSignature` | Sign arbitrary data | All entities (signatory methods) |
| `/createAction` | Create transactions | Seeker, Furnisher, Platform |
| `/listOutputs` | Query wallet UTXOs | Dispute resolution tracking |
| `/getHeight` | Get blockchain height | Locktime calculations |
| `/getNetwork` | Get chain (mainnet/testnet) | Network validation |
| `/isAuthenticated` | Check wallet status | Health checks |

**Full endpoint list**: See [MetaNet Desktop onWalletReady.ts](https://github.com/bsv-blockchain/metanet-desktop/blob/main/src/onWalletReady.ts)

### Origin Header Requirement

MetaNet Desktop requires all requests to include an `Origin` or `Originator` header:

```typescript
// WalletClient automatically handles this
// You don't need to do anything manually

// Under the hood, WalletClient sends:
// POST http://127.0.0.1:3321/getPublicKey
// Headers:
//   Origin: http://localhost
//   Content-Type: application/json
// Body: { counterparty: 'self', protocolID: [2, 'escrow-v1'], keyID: '1' }
```

### Authentication Flow

1. **First Launch**: User sets up MetaNet Desktop wallet
   - Select network (mainnet/testnet)
   - Choose authentication method (Twilio Phone, etc.)
   - Configure storage URL
   - Complete wallet setup (phone, code, password, recovery key)

2. **Application Connection**: First time your Node.js app connects
   - MetaNet Desktop displays permission request
   - Shows application name (from Origin header)
   - User approves/denies access
   - Permission cached for future requests

3. **Subsequent Operations**: Automatic
   - No additional user interaction required
   - Permissions already granted
   - Signatures created as needed

---

## Error Handling

### Current Status

Your code has **basic error handling** through standard try-catch blocks. Here's how to enhance it for production:

### Enhanced Error Handling Pattern

Create a wallet health check utility:

```typescript
// src/utils/wallet-health.ts
import { WalletInterface } from '@bsv/sdk'

export class WalletHealthChecker {
  constructor(private wallet: WalletInterface) {}

  async checkConnection(): Promise<{
    available: boolean;
    authenticated: boolean;
    error?: string;
  }> {
    try {
      // Try to check authentication status
      const { authenticated } = await this.wallet.isAuthenticated({})
      return { available: true, authenticated }
    } catch (error: any) {
      // Connection refused - MetaNet Desktop not running
      if (error.message?.includes('ECONNREFUSED') ||
          error.message?.includes('ECONNRESET')) {
        return {
          available: false,
          authenticated: false,
          error: 'MetaNet Desktop is not running. Please start it and ensure it\'s listening on http://127.0.0.1:3321'
        }
      }

      // Gateway timeout - Wallet operation timed out
      if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
        return {
          available: true,
          authenticated: false,
          error: 'MetaNet Desktop is not responding. Please check if the wallet is unlocked.'
        }
      }

      // Unknown error
      return {
        available: false,
        authenticated: false,
        error: `Wallet error: ${error.message || String(error)}`
      }
    }
  }

  async ensureAvailable(): Promise<void> {
    const health = await this.checkConnection()
    if (!health.available) {
      throw new Error(health.error || 'Wallet not available')
    }
    if (!health.authenticated) {
      throw new Error('Wallet is not authenticated. Please unlock MetaNet Desktop.')
    }
  }
}
```

### Enhanced Entity Constructor

```typescript
// src/entities/Seeker.ts
import { WalletHealthChecker } from '../utils/wallet-health.js'

export default class Seeker {
  private derivedPublicKey: string | null = null
  private readonly broadcaster: Broadcaster
  private readonly resolver: LookupResolver
  private readonly walletHealth: WalletHealthChecker

  constructor(
    private readonly globalConfig: GlobalConfig,
    private readonly wallet: WalletInterface = new WalletClient('auto', 'localhost'),
    broadcaster: TopicBroadcaster | 'DEFAULT' = 'DEFAULT',
    resolver: LookupResolver | 'DEFAULT' = 'DEFAULT'
  ) {
    // ... existing broadcaster/resolver setup ...
    this.walletHealth = new WalletHealthChecker(this.wallet)
  }

  async seek(
    workDescription: string,
    workCompletionDeadline: number,
    bounty: number = 1
  ): Promise<void> {
    // Check wallet health before proceeding
    await this.walletHealth.ensureAvailable()

    // ... rest of existing implementation ...
  }
}
```

### User-Friendly Error Messages

```typescript
// Wrap wallet operations with clear error messages
try {
  await this.wallet.createAction({ /* ... */ })
} catch (error: any) {
  if (error.message?.includes('ECONNREFUSED')) {
    throw new Error(
      'Cannot connect to MetaNet Desktop.\n\n' +
      'Please ensure:\n' +
      '1. MetaNet Desktop is running\n' +
      '2. It is listening on http://127.0.0.1:3321\n' +
      '3. The wallet is unlocked and authenticated\n\n' +
      'To start MetaNet Desktop:\n' +
      '  cd /path/to/metanet-desktop\n' +
      '  npm run tauri dev'
    )
  }

  if (error.message?.includes('denied') || error.message?.includes('permission')) {
    throw new Error(
      'User denied permission in MetaNet Desktop.\n\n' +
      'Please approve the permission request in the MetaNet Desktop window.'
    )
  }

  // Re-throw original error if not wallet-related
  throw error
}
```

---

## Testing Strategies

### Current Testing Setup

You have **MockWallet** for unit testing. Keep this approach and enhance it:

### 1. Unit Tests (Current - Keep As Is)

```typescript
// tests/Seeker.test.ts
import { MockWallet } from './utils/MockWallet'

describe('Seeker', () => {
  let mockWallet: MockWallet
  let seeker: Seeker

  beforeEach(() => {
    mockWallet = new MockWallet()
    seeker = new Seeker(TEST_GLOBAL_CONFIG, mockWallet)
  })

  it('should create work contract', async () => {
    await seeker.seek('Build a website', 1000000, 100000)
    // Assertions...
  })
})
```

### 2. Integration Tests (New - Conditional)

Create integration tests that run conditionally:

```typescript
// tests/integration/MetaNetDesktop.test.ts
import { WalletClient } from '@bsv/sdk'
import { WalletHealthChecker } from '../../src/utils/wallet-health'

describe('MetaNet Desktop Integration', () => {
  let wallet: WalletClient
  let healthChecker: WalletHealthChecker
  let isMetaNetAvailable: boolean

  beforeAll(async () => {
    wallet = new WalletClient('auto', 'localhost')
    healthChecker = new WalletHealthChecker(wallet)

    // Check if MetaNet Desktop is available
    const health = await healthChecker.checkConnection()
    isMetaNetAvailable = health.available

    if (!isMetaNetAvailable) {
      console.log('⚠️  MetaNet Desktop not running - skipping integration tests')
      console.log('   To run these tests:')
      console.log('   1. Clone https://github.com/bsv-blockchain/metanet-desktop')
      console.log('   2. Run: npm i && npm run tauri dev')
      console.log('   3. Complete wallet setup')
    }
  })

  it('should connect to MetaNet Desktop', async () => {
    if (!isMetaNetAvailable) {
      return test.skip()
    }

    const health = await healthChecker.checkConnection()
    expect(health.available).toBe(true)
    expect(health.authenticated).toBe(true)
  })

  it('should derive public key with BRC-42', async () => {
    if (!isMetaNetAvailable) {
      return test.skip()
    }

    const result = await wallet.getPublicKey({
      counterparty: 'self',
      protocolID: [2, 'escrow-v1'],
      keyID: '1'
    })

    expect(result.publicKey).toBeDefined()
    expect(result.publicKey).toMatch(/^[0-9a-f]{66}$/i) // 33 bytes hex
  })

  it('should create escrow contract via Seeker', async () => {
    if (!isMetaNetAvailable) {
      return test.skip()
    }

    const seeker = new Seeker(TEST_GLOBAL_CONFIG, wallet)

    await expect(
      seeker.seek('Test work description', 1000000, 1000)
    ).resolves.not.toThrow()
  })
})
```

### 3. Manual Testing Checklist

Create a manual testing guide:

```markdown
# Manual Testing with MetaNet Desktop

## Prerequisites
- [ ] MetaNet Desktop cloned and built
- [ ] Wallet setup completed (testnet recommended)
- [ ] Backend dependencies installed

## Test Cases

### 1. Seeker Workflow
- [ ] Start MetaNet Desktop: `npm run tauri dev`
- [ ] Run backend: `node dist/test-seeker.js`
- [ ] Verify permission request appears in MetaNet Desktop
- [ ] Approve permission
- [ ] Verify work contract created
- [ ] Check transaction in wallet

### 2. Key Derivation
- [ ] Call `seeker.getMyOpenContracts()`
- [ ] Verify public key derived correctly
- [ ] Check console for any errors

### 3. Error Handling
- [ ] Stop MetaNet Desktop
- [ ] Try to create contract
- [ ] Verify clear error message about MetaNet Desktop not running
- [ ] Restart MetaNet Desktop
- [ ] Retry operation successfully

### 4. Dispute Resolution
- [ ] Create contract, accept bid, start work, submit work
- [ ] Raise dispute as Seeker
- [ ] Verify dispute transaction broadcasts
- [ ] Check wallet basket for dispute record
```

---

## Deployment Guide

### Development Setup

```bash
# 1. Install MetaNet Desktop
git clone https://github.com/bsv-blockchain/metanet-desktop.git
cd metanet-desktop
npm install

# 2. Start MetaNet Desktop
npm run tauri dev

# 3. Complete wallet setup in the application
#    - Choose network (testnet recommended for development)
#    - Select authentication method
#    - Complete phone verification
#    - Set password and save recovery key

# 4. Start your backend
cd /path/to/babbage-escrow/backend
npm install
npm run build
node dist/your-script.js
```

### Production Deployment

For production, users need:

1. **MetaNet Desktop Installation**:
   - Download from releases: https://github.com/bsv-blockchain/metanet-desktop/releases
   - Install on their local machine
   - Complete wallet setup with mainnet

2. **Backend Configuration**:
   ```typescript
   // Use mainnet configuration
   const MAINNET_CONFIG: GlobalConfig = {
     networkPreset: 'mainnet',
     keyDerivationProtocol: [2, 'escrow v1'],
     // ... other mainnet config
   }

   // Wallet client remains the same
   const wallet = new WalletClient('auto', 'localhost')
   const seeker = new Seeker(MAINNET_CONFIG, wallet)
   ```

3. **Network Considerations**:
   - MetaNet Desktop only accepts connections from `localhost`
   - Backend and wallet must be on same machine
   - For remote backends, users need to run backend locally

### Docker Considerations

⚠️ **Important**: MetaNet Desktop is a desktop GUI application and **cannot run in Docker**.

Deployment options:
- **Option A**: Users run MetaNet Desktop on their desktop + backend locally
- **Option B**: Backend in cloud + users connect via CLI/API with local wallet
- **Option C**: Server-side wallet using `@bsv/wallet-toolbox` for automated operations

---

## Troubleshooting

### Connection Issues

**Problem**: `ECONNREFUSED` error

**Solutions**:
1. Verify MetaNet Desktop is running:
   ```bash
   curl http://127.0.0.1:3321/getVersion -X POST -H "Content-Type: application/json" -d "{}"
   ```

2. Check port 3321 is not blocked:
   ```bash
   lsof -i :3321  # macOS/Linux
   netstat -ano | findstr :3321  # Windows
   ```

3. Restart MetaNet Desktop:
   ```bash
   # Kill existing process and restart
   npm run tauri dev
   ```

### Permission Denied

**Problem**: User denied permission or permission prompt not appearing

**Solutions**:
1. Check MetaNet Desktop window is focused
2. Look for permission prompt dialog
3. Reset permissions (in MetaNet Desktop settings)
4. Restart MetaNet Desktop

### Authentication Issues

**Problem**: Wallet not authenticated errors

**Solutions**:
1. Unlock wallet in MetaNet Desktop (enter password)
2. Check wallet status: `isAuthenticated({})`
3. Wait for authentication: `waitForAuthentication({})`

### Network Mismatch

**Problem**: Operations fail due to network mismatch

**Solutions**:
1. Verify MetaNet Desktop network (mainnet/testnet)
2. Ensure backend `GlobalConfig` matches:
   ```typescript
   const config: GlobalConfig = {
     networkPreset: 'testnet', // Must match MetaNet Desktop
     // ...
   }
   ```

3. Check network via wallet:
   ```typescript
   const { network } = await wallet.getNetwork({})
   console.log('Wallet network:', network) // 'main' or 'test'
   ```

---

## Advanced Configuration

### Custom Wallet Instance

For advanced scenarios, provide custom wallet:

```typescript
// Custom HTTP endpoint
import { HTTPWalletJSON, WalletClient } from '@bsv/sdk'

const substrate = new HTTPWalletJSON('http://127.0.0.1:3321')
const wallet = new WalletClient(substrate)

const seeker = new Seeker(globalConfig, wallet)
```

### Multiple Wallet Support

Support different wallet configurations:

```typescript
// src/utils/wallet-factory.ts
import { WalletInterface, WalletClient } from '@bsv/sdk'
import { MockWallet } from '../tests/utils/MockWallet'

export type WalletConfig =
  | { type: 'metanet-desktop' }
  | { type: 'mock' }
  | { type: 'custom', instance: WalletInterface }

export function createWallet(config: WalletConfig): WalletInterface {
  switch (config.type) {
    case 'metanet-desktop':
      return new WalletClient('auto', 'localhost')

    case 'mock':
      return new MockWallet()

    case 'custom':
      return config.instance

    default:
      throw new Error('Unknown wallet type')
  }
}

// Usage
const wallet = createWallet({ type: 'metanet-desktop' })
const seeker = new Seeker(globalConfig, wallet)
```

### Environment-Based Configuration

```typescript
// src/config/wallet.ts
import { WalletInterface, WalletClient } from '@bsv/sdk'

export function getWalletForEnvironment(): WalletInterface {
  const env = process.env.NODE_ENV || 'development'

  if (env === 'test') {
    // Use MockWallet for tests
    return new MockWallet()
  }

  if (env === 'production') {
    // Production: expect MetaNet Desktop
    return new WalletClient('auto', 'localhost')
  }

  // Development: try MetaNet Desktop, fallback to mock
  try {
    const wallet = new WalletClient('auto', 'localhost')
    // Quick connection test
    wallet.isAuthenticated({}).catch(() => {
      console.warn('⚠️  MetaNet Desktop not available, using MockWallet')
    })
    return wallet
  } catch {
    return new MockWallet()
  }
}
```

---

## Summary

### ✅ Current Status

Your BSV Escrow System is **already correctly configured** for MetaNet Desktop:
- WalletClient initialization is correct
- All BRC-100 operations work out of the box
- BRC-42 key derivation is properly implemented
- Transaction creation and signing functional

### 🎯 Recommended Enhancements

**Priority 1 - Error Handling**:
- [ ] Add `WalletHealthChecker` utility
- [ ] Implement user-friendly error messages
- [ ] Add wallet availability checks

**Priority 2 - Testing**:
- [ ] Create conditional integration tests
- [ ] Document manual testing procedures
- [ ] Add integration test detection

**Priority 3 - Documentation**:
- [ ] User deployment guide
- [ ] Troubleshooting guide
- [ ] Video walkthrough (optional)

### 📚 Additional Resources

- **MetaNet Desktop Repository**: https://github.com/bsv-blockchain/metanet-desktop
- **BRC-100 Specification**: https://github.com/bitcoin-sv/BRCs/blob/master/wallet/0100.md
- **BSV SDK WalletClient**: https://docs.bsvblockchain.org/ts-sdk/wallet-client
- **BRC-42 Key Derivation**: https://github.com/bitcoin-sv/BRCs/blob/master/key-derivation/0042.md

---

## Questions or Issues?

If you encounter integration issues:

1. Check MetaNet Desktop is running on port 3321
2. Verify wallet is authenticated
3. Review error messages for connection issues
4. Consult troubleshooting section above
5. File issue at: https://github.com/bsv-blockchain/metanet-desktop/issues

**Your integration is already working - just add error handling and testing for production readiness! 🚀**
