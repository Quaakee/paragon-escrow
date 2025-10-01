# Transaction Signing Methods

*This is a How-To guide for different transaction signing approaches with the BSV TypeScript SDK.*

## Overview

This guide demonstrates two different approaches to signing Bitcoin transactions with the BSV TypeScript SDK:

1. **Using `WalletClient`** - A high-level approach that abstracts key management and signing details
2. **Using Low-level APIs** - A direct approach with more control over the transaction signing process

Each method has its advantages depending on your use case. The `WalletClient` approach is recommended for production applications where security is paramount, while the low-level approach gives you more control and is useful for educational purposes or specialized applications.

## Prerequisites

- Completed the [Key Management and Cryptography tutorial](../tutorials/key-management.md)
- Familiarity with Bitcoin transaction structure
- Understanding of basic cryptographic principles

> **📚 Related Concepts**: This guide builds on [Digital Signatures](../concepts/signatures.md), [Key Management](../concepts/key-management.md), [Transaction Structure](../concepts/transaction-structure.md), and [Wallet Integration](../concepts/wallet-integration.md).

## Method 1: `WalletClient` Signing (Recommended)

The `WalletClient` provides a secure, high-level interface for managing keys and signing transactions. This approach is recommended for production applications as it:

- Abstracts away complex key management
- Provides better security by isolating private keys
- Handles transaction construction and signing in a unified way

### Example Code

```typescript
import { WalletClient, Transaction } from '@bsv/sdk'

async function walletTransactionDemo() {
  console.log('\n=== Transaction Signing with WalletClient ===')
  
  try {
    // 1. WalletClient Key Management
    const wallet = new WalletClient('auto', 'localhost')
    console.log('\n1. WalletClient Key Management')
    
    // Define protocol and key identifiers for wallet operations
    // Use 1 to represent medium security level
    // Cast it to any to bypass strict type checking since we don't have the SecurityLevel enum
    const protocolID = [1, 'example'] as any
    const keyID = 'transaction-signing-key'
    
    console.log(`Protocol ID: ${protocolID[0]}-${protocolID[1]}`)
    console.log(`Key ID: ${keyID}`)
    
    // Get a public key from the wallet
    // In a real application, this would be a key securely managed by the wallet
    const publicKeyResult = await wallet.getPublicKey({ protocolID, keyID })
    const publicKeyHex = publicKeyResult.publicKey
    console.log(`Public Key: ${publicKeyHex}`)
    
    // 2. Creating a transaction with WalletClient
    console.log('\n2. Creating a transaction with WalletClient')
    
    // Get our own address to send payment to self (realistic example)
    const ourAddress = await wallet.getAddress()
    const amountSatoshis = 100
    
    console.log(`Our wallet address: ${ourAddress}`)
    
    // Create a proper P2PKH locking script for our address
    const lockingScript = new P2PKH().lock(ourAddress)
    
    // Create a payment action using WalletClient
    // This builds a complete transaction structure internally
    const actionResult = await wallet.createAction({
      description: `Self-payment demonstration`,
      // Define outputs for the transaction
      outputs: [
        {
          // Use proper P2PKH script construction
          lockingScript: lockingScript.toHex(),
          satoshis: amountSatoshis,
          basket: 'tutorial',
          outputDescription: `Payment to our own address`
        }
      ],
      // Set options to ensure we get a signable transaction
      options: {
        signAndProcess: false // This ensures we get a signable transaction back
      }
    })
    
    console.log('Payment action created:')
    if (actionResult.signableTransaction) {
      console.log(`- Action Reference: ${actionResult.signableTransaction.reference}`)
    } else {
      console.log('No signable transaction returned - check wallet configuration')
      return
    }
    console.log(`- Description: Payment demonstration`)
    console.log(`- Amount: ${amountSatoshis} satoshis`)
    console.log(`- Recipient: ${ourAddress} (our own address)`)
    
    // 3. Sign the transaction with WalletClient
    console.log('\n3. Signing transaction with WalletClient')
    
    // Request wallet to sign the action/transaction
    const signResult = await wallet.signAction({
      // Use the reference from the createAction result
      reference: actionResult.signableTransaction.reference,
      // The spends parameter is a map of input indexes to unlocking scripts
      // For wallet-managed keys, we provide an empty map and let the wallet handle it
      spends: {}
    })
    
    console.log('Transaction signed successfully!')
    if (signResult.txid) {
      console.log(`Transaction ID: ${signResult.txid}`)
    }
    
    // 4. Examine the transaction (retrieve it from the network and inspect it)
    console.log('\n4. Examining the transaction')
    
    // Check if we have a transaction ID from the sign result
    if (signResult.txid) {
      console.log(`Transaction ID: ${signResult.txid}`)
      console.log('Transaction was successfully signed and broadcast!')
      
      // Actually retrieve and inspect the transaction using the wallet
      try {
        // Wait a moment for the transaction to propagate
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Retry logic to find the transaction outputs
        const maxRetries = 5 // 30 seconds with 5-second intervals
        const retryInterval = 5000 // 5 seconds
        let relatedOutputs: any[] = []
        let retryCount = 0
        
        console.log('\nSearching for transaction outputs...')
        
        while (retryCount < maxRetries && relatedOutputs.length === 0) {
          try {
            // List our outputs to see the transaction result
            const { outputs } = await wallet.listOutputs({ basket: 'tutorial' })
            
            // Find outputs related to our transaction
            // Extract txid from outpoint (format: "txid.outputIndex")
            relatedOutputs = outputs.filter(output => {
              const [outputTxid] = output.outpoint.split('.')
              return outputTxid === signResult.txid
            })
            
            if (relatedOutputs.length > 0) {
              console.log('\nTransaction inspection results:')
              console.log(`- Found ${relatedOutputs.length} output(s) from this transaction`)
              
              relatedOutputs.forEach((output, index) => {
                console.log(`\nOutput ${index + 1}:`)
                console.log(`  - Value: ${output.satoshis} satoshis`)
                console.log(`  - Outpoint: ${output.outpoint}`)
                console.log(`  - Locking Script: ${output.lockingScript}`)
                console.log(`  - Spendable: ${output.spendable ? 'Yes' : 'No'}`)
                if (output.tags && output.tags.length > 0) {
                  console.log(`  - Tags: ${output.tags.join(', ')}`)
                }
              })
              
              // Analyze the locking script
              const firstOutput = relatedOutputs[0]
              console.log('\nScript Analysis:')
              console.log(`- Script Type: P2PKH (Pay-to-Public-Key-Hash)`)
              console.log(`- Script validates payment to: ${ourAddress}`)
              console.log(`- This output can be spent by providing a valid signature`)
              
              break // Found the outputs, exit the retry loop
            } else {
              retryCount++
              if (retryCount < maxRetries) {
                console.log(`Attempt ${retryCount}/${maxRetries}: Transaction not propagated yet, retrying in ${retryInterval/1000} seconds...`)
                await new Promise(resolve => setTimeout(resolve, retryInterval))
              }
            }
          } catch (listError: any) {
            retryCount++
            if (retryCount < maxRetries) {
              console.log(`Attempt ${retryCount}/${maxRetries}: Error listing outputs, retrying in ${retryInterval/1000} seconds...`)
              console.log(`Error: ${listError.message}`)
              await new Promise(resolve => setTimeout(resolve, retryInterval))
            } else {
              throw listError // Re-throw on final attempt
            }
          }
        }
        
        if (relatedOutputs.length === 0) {
          console.log('\nTransaction outputs not found after 30 seconds.')
          console.log('This might be because:')
          console.log('- The outputs went to a different basket')
          console.log('- The transaction is taking longer to sync')
          console.log('- Network connectivity issues')
          console.log('\nYou can check the transaction on WhatsOnChain:')
          console.log(`https://whatsonchain.com/tx/${signResult.txid}`)
        }
        
      } catch (inspectionError) {
        console.log('\nCould not inspect transaction details:')
        console.log('This is normal and can happen because:')
        console.log('- Transaction is still propagating through the network')
        console.log('- Wallet needs time to sync with the blockchain')
        console.log('- Network connectivity issues')
        console.log(`\nError details: ${inspectionError.message}`)
      }
      
    } else {
      console.log('No transaction ID available - transaction may not have been broadcast')
    }
  } catch (error) {
    console.error('Error during wallet transaction operations:', error)
  }
}

// Run the demo
walletTransactionDemo().catch(console.error)
```

### Key Benefits of the `WalletClient` Approach

1. **Security**: Private keys are managed by the wallet service, reducing exposure
2. **Abstraction**: Complex transaction construction details are handled internally
3. **Integration**: Designed for integration with secure key management systems
4. **Consistency**: Provides a standardized approach to transaction creation and signing

## Method 2: Transaction Signing with Low-level APIs

The low-level approach gives you direct control over the transaction signing process. This is useful for:

- Educational purposes to understand the underlying mechanics
- Specialized applications requiring custom transaction structures
- Custom fee calculation and UTXO management
- Advanced transaction types and complex scripts

```typescript
import { PrivateKey, Transaction, P2PKH, Script } from '@bsv/sdk'

async function lowLevelTransactionDemo() {
  console.log('\n=== Low-Level Transaction Signing Demo ===')
  
  // 1. Generate keys for our demonstration
  const privateKey = PrivateKey.fromRandom()
  const publicKey = privateKey.toPublicKey()
  const address = privateKey.toAddress()
  
  console.log('\n1. Key Generation:')
  console.log(`Private Key (WIF): ${privateKey.toWif()}`)
  console.log(`Public Key: ${publicKey.toString()}`)
  console.log(`Address: ${address}`)
  
  // 2. Create a realistic transaction with proper structure
  console.log('\n2. Creating Transaction Structure:')
  
  // Create a transaction that demonstrates real Bitcoin transaction patterns
  const tx = new Transaction()
  
  // For this demo, we'll create a transaction that spends from a P2PKH output
  // and creates a new P2PKH output (self-payment) plus an OP_RETURN data output
  
  // First, create a source transaction that contains funds we can spend
  const sourceTransaction = new Transaction()
  sourceTransaction.addOutput({
    lockingScript: new P2PKH().lock(address),
    satoshis: 1000 // Source has 1000 satoshis
  })
  
  // Add input that spends from our source transaction
  tx.addInput({
    sourceTransaction,
    sourceOutputIndex: 0,
    unlockingScriptTemplate: new P2PKH().unlock(privateKey)
  })
  
  // Add a P2PKH output (payment to ourselves)
  tx.addOutput({
    lockingScript: new P2PKH().lock(address),
    satoshis: 500
  })
  
  // Add an OP_RETURN data output
  tx.addOutput({
    lockingScript: Script.fromASM('OP_RETURN 48656c6c6f20426974636f696e21'), // "Hello Bitcoin!" in hex
    satoshis: 0
  })
  
  // Add change output
  tx.addOutput({
    lockingScript: new P2PKH().lock(address),
    change: true // Automatically calculates change amount after fees
  })
  
  console.log('Transaction structure created:')
  console.log(`- Inputs: ${tx.inputs.length}`)
  console.log(`- Outputs: ${tx.outputs.length}`)
  console.log(`- Input amount: 1000 satoshis`)
  console.log(`- Payment output: 500 satoshis`)
  console.log(`- Data output: 0 satoshis (OP_RETURN)`)
  console.log(`- Change output: Will be calculated automatically`)
  
  // 3. Calculate fees and finalize the transaction
  console.log('\n3. Fee Calculation and Signing:')
  
  // Calculate appropriate fees based on transaction size
  await tx.fee()
  
  // Display fee information
  const changeOutput = tx.outputs.find(output => output.change)
  if (changeOutput && changeOutput.satoshis !== undefined) {
    console.log(`Fee calculated: ${1000 - 500 - changeOutput.satoshis} satoshis`)
    console.log(`Change amount: ${changeOutput.satoshis} satoshis`)
  }
  
  // Sign the transaction
  console.log('\nSigning transaction...')
  await tx.sign()
  
  // 4. Examine the signed transaction
  console.log('\n4. Transaction Analysis:')
  console.log(`Transaction ID: ${Buffer.from(tx.id()).toString('hex')}`)
  
  // Check if the input has been properly signed
  const input = tx.inputs[0]
  if (input.unlockingScript) {
    const unlockingASM = input.unlockingScript.toASM()
    console.log(`\nUnlocking Script (ASM): ${unlockingASM}`)
    
    // Parse the signature and public key from the unlocking script
    const scriptParts = unlockingASM.split(' ')
    if (scriptParts.length >= 2) {
      console.log(`- Signature present: ✓ (${scriptParts[0].length} chars)`)
      console.log(`- Public key present: ✓ (${scriptParts[1].length} chars)`)
    }
  }
  
  // 5. Verify the transaction
  console.log('\n5. Transaction Verification:')
  
  try {
    const isValid = await tx.verify()
    console.log(`Transaction verification: ${isValid ? 'Valid ✓' : 'Invalid ✗'}`)
    
    if (isValid) {
      console.log('\n✓ Transaction is properly constructed and signed!')
      console.log('✓ All inputs have valid signatures')
      console.log('✓ All outputs have valid locking scripts')
      console.log('✓ Fee calculation is correct')
    }
  } catch (error: any) {
    console.log(`Verification error: ${error.message}`)
  }
  
  // 6. Display transaction hex
  const txHex = tx.toHex()
  console.log('\n6. Transaction Serialization:')
  console.log(`Transaction size: ${txHex.length / 2} bytes`)
  console.log(`Transaction hex (first 100 chars): ${txHex.substring(0, 100)}...`)
  
  // 7. Demonstrate transaction structure analysis
  console.log('\n7. Transaction Structure Analysis:')
  console.log('Outputs breakdown:')
  tx.outputs.forEach((output, index) => {
    const script = output.lockingScript
    let scriptType = 'Unknown'
    
    if (script.toASM().startsWith('OP_DUP OP_HASH160')) {
      scriptType = 'P2PKH (Pay-to-Public-Key-Hash)'
    } else if (script.toASM().startsWith('OP_RETURN')) {
      scriptType = 'OP_RETURN (Data)'
    }
    
    console.log(`  Output ${index}: ${output.satoshis} satoshis - ${scriptType}`)
    if (output.change) {
      console.log(`    (Change output)`)
    }
  })
  
  console.log('\n✓ Low-level transaction signing demonstration complete!')
  console.log('This transaction demonstrates:')
  console.log('- Proper input/output construction')
  console.log('- Automatic fee calculation')
  console.log('- Digital signature creation and verification')
  console.log('- Multiple output types (P2PKH + OP_RETURN)')
  console.log('- Change handling')
}

// Run the demonstration
lowLevelTransactionDemo().catch(console.error)
```

### Key Benefits of the Low-level Approach

1. **Control**: Direct control over every aspect of the transaction
2. **Transparency**: Clear visibility into the transaction structure and signing process
3. **Flexibility**: Ability to customize transaction construction for specialized use cases
4. **Educational Value**: Better understanding of the underlying Bitcoin transaction mechanics

## Choosing the Right Approach

Consider the following factors when deciding which approach to use:

| Factor | `WalletClient` Approach | Low-level Approach |
|--------|----------------------|-------------------|
| Security | Higher (keys managed by wallet) | Lower (direct key handling) |
| Complexity | Lower (abstracted API) | Higher (manual transaction construction) |
| Control | Limited (managed by wallet) | Complete (direct access) |
| Use Case | Production applications | Educational, specialized applications |
| Integration | Better for enterprise systems | Better for custom implementations |

## Related Resources

- [Key Management and Cryptography Tutorial](../tutorials/key-management.md)
- [Advanced Transaction Signing](./advanced-transaction-signing.md)
- [Transaction Signatures Reference](../reference/transaction-signatures.md)
- [Bitcoin Transaction Specification](https://reference.cash/protocol/blockchain/transaction)
