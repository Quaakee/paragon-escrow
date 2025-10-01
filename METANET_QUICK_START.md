# MetaNet Desktop Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Install MetaNet Desktop (5 minutes)

```bash
# Clone the repository
git clone https://github.com/bsv-blockchain/metanet-desktop.git
cd metanet-desktop

# Install dependencies
npm install

# Start MetaNet Desktop
npm run tauri dev
```

### Step 2: Complete Wallet Setup (3 minutes)

When MetaNet Desktop opens:

1. **Choose Network**: Select `testnet` (recommended for development)
2. **Choose Authentication**: Select authentication method (Twilio Phone, etc.)
3. **Complete Setup**:
   - Enter phone number
   - Enter verification code
   - Set password
   - **IMPORTANT**: Save recovery key securely!
4. **Unlock Wallet**: Enter your password

✅ MetaNet Desktop is now running on `http://127.0.0.1:3321`

### Step 3: Run Your Escrow Backend (1 minute)

```bash
cd /path/to/babbage-escrow/backend

# Your code already works! Just run it:
npm run build
node dist/your-script.js
```

**That's it!** Your backend will automatically connect to MetaNet Desktop.

---

## 📝 Basic Usage Examples

### Example 1: Create a Work Contract (Seeker)

```typescript
import Seeker from './src/entities/Seeker'
import { TEST_GLOBAL_CONFIG } from './src/constants'

// Create seeker (wallet auto-connects to MetaNet Desktop)
const seeker = new Seeker(TEST_GLOBAL_CONFIG)

// Create work contract
await seeker.seek(
  'Build a website with React',  // Work description
  Date.now() + 86400,            // Deadline (24 hours)
  100000                         // Bounty in satoshis
)

console.log('Work contract created! Check MetaNet Desktop for transaction.')
```

### Example 2: List Available Work (Furnisher)

```typescript
import Furnisher from './src/entities/Furnisher'
import { TEST_GLOBAL_CONFIG } from './src/constants'

// Create furnisher
const furnisher = new Furnisher(TEST_GLOBAL_CONFIG)

// List available work
const contracts = await furnisher.listAvailableWork()

console.log(`Found ${contracts.length} available contracts:`)
contracts.forEach(contract => {
  console.log(`- ${contract.record.workDescription}`)
  console.log(`  Bounty: ${contract.satoshis} satoshis`)
})
```

### Example 3: Check Wallet Health

```typescript
import { WalletClient } from '@bsv/sdk'
import { WalletHealthChecker } from './src/utils/wallet-health'

// Create wallet client
const wallet = new WalletClient('auto', 'localhost')

// Check health
const checker = new WalletHealthChecker(wallet)
const health = await checker.checkConnection()

if (health.available && health.authenticated) {
  console.log('✅ MetaNet Desktop is ready!')
} else {
  console.log('❌ Issue:', health.error)
}
```

---

## 🔧 Troubleshooting

### Problem: "ECONNREFUSED"

**Cause**: MetaNet Desktop not running

**Solution**:
```bash
cd /path/to/metanet-desktop
npm run tauri dev
```

### Problem: "Wallet not authenticated"

**Cause**: Wallet locked

**Solution**: Open MetaNet Desktop and enter your password

### Problem: "Permission denied"

**Cause**: Permission request not approved

**Solution**: Look for permission dialog in MetaNet Desktop and approve

### Problem: "Network mismatch"

**Cause**: Backend expecting different network

**Solution**: Check `GlobalConfig.networkPreset` matches MetaNet Desktop network

---

## 📋 Verification Checklist

Before running your backend, verify:

- [ ] MetaNet Desktop is running
- [ ] Wallet is unlocked (password entered)
- [ ] Port 3321 is available
- [ ] Network matches (testnet/mainnet)

Quick test:
```bash
curl http://127.0.0.1:3321/getVersion \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost" \
  -d "{}"
```

Expected response: `{"version":"0.x.x"}`

---

## 🎓 Next Steps

1. **Read Full Guide**: See [METANET_DESKTOP_INTEGRATION.md](./METANET_DESKTOP_INTEGRATION.md)
2. **Run Tests**: `npm test -- tests/integration/MetaNetDesktop.test.ts`
3. **Try Examples**: Check `examples/` directory (if available)
4. **Join Community**: BSV Discord, Slack, or GitHub Discussions

---

## 💡 Key Concepts

### Your Code Already Works!

```typescript
// This constructor parameter:
new WalletClient('auto', 'localhost')

// Automatically:
// 1. Detects MetaNet Desktop at http://127.0.0.1:3321
// 2. Connects via HTTP
// 3. Handles all BRC-100 operations
// 4. Manages authentication and permissions
```

### No Configuration Needed!

Your entity classes already have correct defaults:

```typescript
constructor(
  private readonly globalConfig: GlobalConfig,
  private readonly wallet: WalletInterface = new WalletClient('auto', 'localhost')
  // ⬆️ This default is perfect for MetaNet Desktop!
)
```

### What MetaNet Desktop Provides

- ✅ BRC-100 compliant wallet
- ✅ BRC-42 key derivation
- ✅ Transaction signing
- ✅ UTXO management
- ✅ Secure local storage
- ✅ User authentication
- ✅ Permission management

---

## 🔗 Resources

- **MetaNet Desktop Repo**: https://github.com/bsv-blockchain/metanet-desktop
- **BRC-100 Spec**: https://github.com/bitcoin-sv/BRCs/blob/master/wallet/0100.md
- **BSV SDK Docs**: https://docs.bsvblockchain.org/ts-sdk
- **Full Integration Guide**: [METANET_DESKTOP_INTEGRATION.md](./METANET_DESKTOP_INTEGRATION.md)

---

## ❓ FAQ

**Q: Do I need to change my code?**
A: No! Your code already works with MetaNet Desktop.

**Q: Can I use this in production?**
A: Yes, but users must have MetaNet Desktop installed locally.

**Q: Can I run this on a server?**
A: MetaNet Desktop is for desktop use. For servers, use `@bsv/wallet-toolbox`.

**Q: What about testing?**
A: Use MockWallet for unit tests. MetaNet Desktop for integration tests.

**Q: Do I need to install anything in my project?**
A: No! You already have `@bsv/sdk` with WalletClient.

---

**Happy coding! 🚀**
