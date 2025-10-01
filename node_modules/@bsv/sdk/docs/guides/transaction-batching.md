# Implementing Transaction Batching

This guide demonstrates how to efficiently batch multiple payments into single transactions using the BSV TypeScript SDK, optimizing for fees, network efficiency, and throughput.

## Overview

Transaction batching combines multiple payments into a single transaction, reducing fees and network load. This guide covers various batching strategies from simple multi-output transactions to advanced batch processing systems.

## Basic Multi-Output Batching

### Simple Batch Payment

The most straightforward batching approach combines multiple payments into one transaction:

```typescript
import { WalletClient } from '@bsv/sdk'

async function createBatchPayment() {
  const wallet = new WalletClient('auto', 'localhost')

  // Define multiple recipients with proper P2PKH locking scripts
  const recipients = [
    { lockingScript: '76a914389ffce9cd9ae88dcc0631e88a821ffdbe9bfe2688ac', amount: 100, description: 'Payment 1' },
    { lockingScript: '76a91477bde5cfd66c6d1c83b0008b8a6e3579a6e5c6b988ac', amount: 150, description: 'Payment 2' },
    { lockingScript: '76a914c42e7ef92fdb603af844d064faad95db9f7f1e9588ac', amount: 200, description: 'Payment 3' }
  ]

  // Create batch transaction
  const actionResult = await wallet.createAction({
    description: 'Batch payment to multiple recipients',
    outputs: recipients.map(recipient => ({
      satoshis: recipient.amount,
      lockingScript: recipient.lockingScript,
      outputDescription: recipient.description
    })),
  })

  console.log('Batch transaction created:', actionResult.txid)
  return actionResult
}
```

### Batch with Data Outputs

Combine payments with data storage in a single transaction:

```typescript
async function createBatchWithData() {
  const wallet = new WalletClient('auto', 'localhost')

  const outputs = [
    // Payment outputs
    {
      satoshis: 100,
      lockingScript: '76a914389ffce9cd9ae88dcc0631e88a821ffdbe9bfe2688ac',
      outputDescription: 'Payment 1'
    },
    {
      satoshis: 150,
      lockingScript: '76a91477bde5cfd66c6d1c83b0008b8a6e3579a6e5c6b988ac',
      outputDescription: 'Payment 2'
    },
    // Data outputs (OP_RETURN outputs use 1 satoshi)
    {
      satoshis: 1,
      lockingScript: '006a0c48656c6c6f20576f726c64', // OP_RETURN "Hello World"
      outputDescription: 'Batch metadata'
    },
    {
      satoshis: 1,
      lockingScript: '006a0a42617463682044617461', // OP_RETURN "Batch Data"
      outputDescription: 'Batch identifier'
    }
  ]

  const actionResult = await wallet.createAction({
    description: 'Batch payment with metadata',
    outputs,
  })

  return actionResult
}
```

### UTXO Consolidation Batching

Combine payments with UTXO consolidation for better wallet health:

```typescript
async function createConsolidationBatch() {
  const wallet = new WalletClient('auto', 'localhost')

  // Note: This example demonstrates the concept but uses simulated data
  // In practice, you would get UTXOs from wallet.listOutputs() with appropriate basket
  console.log('Creating consolidation batch with simulated UTXO data')

  // Create batch with payments only (consolidation would require actual UTXOs)
  const outputs = [
    // Regular payments
    {
      satoshis: 100,
      lockingScript: '76a914389ffce9cd9ae88dcc0631e88a821ffdbe9bfe2688ac',
      outputDescription: 'Batch payment 1'
    },
    {
      satoshis: 150,
      lockingScript: '76a91477bde5cfd66c6d1c83b0008b8a6e3579a6e5c6b988ac',
      outputDescription: 'Batch payment 2'
    },
    // Change output (simulating consolidation)
    {
      satoshis: 500,
      lockingScript: '76a914c42e7ef92fdb603af844d064faad95db9f7f1e9588ac',
      outputDescription: 'Change output'
    }
  ]

  // Let wallet automatically select inputs (no manual input specification)
  const actionResult = await wallet.createAction({
    description: 'Batch payment with change output',
    outputs,
  })

  return actionResult
}
```

## Conclusion

Transaction batching is a powerful technique for optimizing Bitcoin applications.

Understanding of `WalletClient` usage is essential for implementing these strategies effectively. While the `WalletClient` provides convenient single-transaction creation, batching multiple operations into fewer transactions can significantly improve efficiency and reduce costs. Integration with `WalletClient` is straightforward, and the benefits of batching can be substantial.
