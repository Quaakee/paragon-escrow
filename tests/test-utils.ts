import {
  WalletInterface,
  Transaction,
  PrivateKey,
  PublicKey,
  LockingScript,
  P2PKH
} from '@bsv/sdk'
import type {
  CreateActionResult,
  CreateActionArgs,
  SignActionResult,
  SignActionArgs,
  AbortActionResult,
  AbortActionArgs,
  GetPublicKeyResult,
  GetPublicKeyArgs,
  CreateSignatureResult,
  CreateSignatureArgs,
  GetHeightResult,
  ListOutputsResult,
  ListOutputsArgs,
  AtomicBEEF
} from '@bsv/sdk'

/**
 * Mock Wallet Implementation for Testing
 *
 * This mock wallet simulates the behavior of a real wallet without
 * requiring actual blockchain connections or funds.
 */
export class MockWallet implements WalletInterface {
  private privateKey: PrivateKey
  private publicKey: PublicKey
  private height: number = 800000 // Simulated blockchain height
  private outputs: any[] = [] // Simulated wallet outputs/baskets

  constructor(privateKey: PrivateKey) {
    this.privateKey = privateKey
    this.publicKey = privateKey.toPublicKey()
  }

  async createAction(args: CreateActionArgs): Promise<CreateActionResult> {
    // Create a mock transaction
    const tx = new Transaction()

    // Add inputs if provided
    if (args.inputs) {
      for (const input of args.inputs) {
        const [_txid, outputIndex] = input.outpoint.split('.')
        const sourceTx = args.inputBEEF
          ? Transaction.fromBEEF(args.inputBEEF)
          : new Transaction()

        tx.addInput({
          sourceTransaction: sourceTx,
          sourceOutputIndex: parseInt(outputIndex),
          unlockingScriptTemplate: new P2PKH().unlock(this.privateKey)
        })
      }
    }

    // Add outputs
    if (args.outputs) {
      for (const output of args.outputs) {
        tx.addOutput({
          lockingScript: LockingScript.fromHex(output.lockingScript),
          satoshis: output.satoshis
        })
      }
    }

    // Sign the transaction
    await tx.sign()

    // Generate a reference ID
    const reference = `mock-action-${Date.now()}-${Math.random().toString(36).substring(7)}`

    // Convert transaction to AtomicBEEF format
    const atomicBeef: AtomicBEEF = tx.toAtomicBEEF()

    return {
      txid: tx.id('hex'),
      tx: atomicBeef,
      signableTransaction: {
        tx: atomicBeef,
        reference
      }
    }
  }

  async signAction(_args: SignActionArgs): Promise<SignActionResult> {
    // Mock signing - create a simple BEEF for testing
    const tx = new Transaction()
    const atomicBeef: AtomicBEEF = tx.toAtomicBEEF()

    return {
      tx: atomicBeef
    }
  }

  async abortAction(_args: AbortActionArgs): Promise<AbortActionResult> {
    // Mock abort - return success
    return {
      aborted: true
    }
  }

  async getPublicKey(_args: GetPublicKeyArgs): Promise<GetPublicKeyResult> {
    // Return the wallet's public key
    return {
      publicKey: this.publicKey.toString()
    }
  }

  async createSignature(args: CreateSignatureArgs): Promise<CreateSignatureResult> {
    // Create a real signature for the data
    const dataToSign = Array.isArray(args.data) ? args.data : Array.from(args.data as any)
    const signature = this.privateKey.sign(dataToSign as number[])

    return {
      signature: (signature.toDER() as number[])
    }
  }

  async getHeight(_args: object): Promise<GetHeightResult> {
    return {
      height: this.height
    }
  }

  async listOutputs(args?: ListOutputsArgs): Promise<ListOutputsResult> {
    // Filter outputs by basket/tags if specified
    let filtered = this.outputs

    if (args?.basket) {
      filtered = filtered.filter(o => o.basket === args.basket)
    }

    if (args?.tags) {
      filtered = filtered.filter(o =>
        args.tags!.every(tag => o.tags?.includes(tag))
      )
    }

    return {
      totalOutputs: filtered.length,
      outputs: filtered
    }
  }

  // Stub implementations for remaining WalletInterface methods
  async revealCounterpartyKeyLinkage(_args: any): Promise<any> {
    throw new Error('Not implemented in mock wallet')
  }

  async revealSpecificKeyLinkage(_args: any): Promise<any> {
    throw new Error('Not implemented in mock wallet')
  }

  async encrypt(_args: any): Promise<any> {
    throw new Error('Not implemented in mock wallet')
  }

  async decrypt(_args: any): Promise<any> {
    throw new Error('Not implemented in mock wallet')
  }

  async createHmac(_args: any): Promise<any> {
    throw new Error('Not implemented in mock wallet')
  }

  async verifyHmac(_args: any): Promise<any> {
    throw new Error('Not implemented in mock wallet')
  }

  async verifySignature(_args: any): Promise<any> {
    throw new Error('Not implemented in mock wallet')
  }

  async listActions(_args: any): Promise<any> {
    throw new Error('Not implemented in mock wallet')
  }

  async internalizeAction(_args: any): Promise<any> {
    throw new Error('Not implemented in mock wallet')
  }

  async relinquishOutput(_args: any): Promise<any> {
    throw new Error('Not implemented in mock wallet')
  }

  async acquireCertificate(_args: any): Promise<any> {
    throw new Error('Not implemented in mock wallet')
  }

  async listCertificates(_args: any): Promise<any> {
    throw new Error('Not implemented in mock wallet')
  }

  async proveCertificate(_args: any): Promise<any> {
    throw new Error('Not implemented in mock wallet')
  }

  async relinquishCertificate(_args: any): Promise<any> {
    throw new Error('Not implemented in mock wallet')
  }

  async discoverByIdentityKey(_args: any): Promise<any> {
    throw new Error('Not implemented in mock wallet')
  }

  async discoverByAttributes(_args: any): Promise<any> {
    throw new Error('Not implemented in mock wallet')
  }

  async isAuthenticated(_args: object): Promise<any> {
    return { authenticated: true }
  }

  async waitForAuthentication(_args: object): Promise<any> {
    return { authenticated: true }
  }

  async getHeaderForHeight(_args: any): Promise<any> {
    throw new Error('Not implemented in mock wallet')
  }

  async getNetwork(_args: object): Promise<any> {
    return { network: 'testnet' }
  }

  async getVersion(_args: object): Promise<any> {
    return { version: 'mock-1.0.0' }
  }

  // Helper methods for testing

  /**
   * Set the simulated blockchain height (for locktime testing)
   */
  setHeight(height: number): void {
    this.height = height
  }

  /**
   * Advance the blockchain height by N blocks
   */
  advanceHeight(blocks: number): void {
    this.height += blocks
  }

  /**
   * Add a mock output to the wallet (for basket testing)
   */
  addOutput(output: any): void {
    this.outputs.push(output)
  }

  /**
   * Clear all outputs (for test cleanup)
   */
  clearOutputs(): void {
    this.outputs = []
  }

  /**
   * Get the wallet's private key (for testing)
   */
  getPrivateKey(): PrivateKey {
    return this.privateKey
  }

  /**
   * Get the wallet's public key (for testing)
   */
  getPublicKeySync(): PublicKey {
    return this.publicKey
  }
}

/**
 * Mock Broadcaster for testing
 */
export class MockBroadcaster {
  public broadcastedTransactions: Transaction[] = []

  async broadcast(tx: Transaction): Promise<{ txid: string; message: string }> {
    this.broadcastedTransactions.push(tx)
    return {
      txid: tx.id('hex'),
      message: 'Transaction broadcasted successfully (mock)'
    }
  }

  clear(): void {
    this.broadcastedTransactions = []
  }

  getLastTransaction(): Transaction | undefined {
    return this.broadcastedTransactions[this.broadcastedTransactions.length - 1]
  }
}

/**
 * Mock LookupResolver for testing
 */
export class MockLookupResolver {
  private storedRecords: Map<string, any[]> = new Map()

  async query(args: { service: string; query: any }): Promise<any> {
    const key = JSON.stringify(args.query)
    const records = this.storedRecords.get(key) || []

    return {
      type: 'output-list',
      outputs: records
    }
  }

  /**
   * Store a mock record for later retrieval
   */
  storeRecord(query: any, record: any): void {
    const key = JSON.stringify(query)
    const existing = this.storedRecords.get(key) || []
    existing.push(record)
    this.storedRecords.set(key, existing)
  }

  /**
   * Clear all stored records
   */
  clear(): void {
    this.storedRecords.clear()
  }
}

/**
 * Test Data Generators
 */

/**
 * Generate a random work description
 */
export function generateWorkDescription(): string {
  const tasks = [
    'Build a mobile app',
    'Design a logo',
    'Write documentation',
    'Fix security bugs',
    'Implement API endpoints',
    'Create marketing materials'
  ]
  return tasks[Math.floor(Math.random() * tasks.length)]
}

/**
 * Generate a random bid amount within reasonable bounds
 */
export function generateBidAmount(min = 1000, max = 100000): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Generate a random bond amount
 */
export function generateBondAmount(bidAmount: number): number {
  // Bond is typically 10-20% of bid amount
  return Math.floor(bidAmount * (0.1 + Math.random() * 0.1))
}

/**
 * Generate a random time estimate (in seconds)
 */
export function generateTimeEstimate(minHours = 24, maxHours = 168): number {
  const hours = Math.floor(Math.random() * (maxHours - minHours + 1)) + minHours
  return hours * 3600
}

/**
 * Assertion Helpers
 */

/**
 * Assert that a value is defined (not null or undefined)
 */
export function assertDefined<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || 'Expected value to be defined')
  }
}

/**
 * Assert that an array is not empty
 */
export function assertNotEmpty<T>(array: T[], message?: string): void {
  if (array.length === 0) {
    throw new Error(message || 'Expected array to not be empty')
  }
}

/**
 * Assert that a transaction was broadcasted
 */
export function assertBroadcasted(broadcaster: MockBroadcaster, message?: string): void {
  if (broadcaster.broadcastedTransactions.length === 0) {
    throw new Error(message || 'Expected at least one transaction to be broadcasted')
  }
}

/**
 * Wait for a condition to be true (polling)
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeoutMs = 5000,
  intervalMs = 100
): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }

  throw new Error('Timeout waiting for condition')
}

/**
 * Create a delay (for testing time-sensitive operations)
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Generate a mock BEEF (Binary Executable Exchange Format) for testing
 */
export function generateMockBEEF(tx: Transaction): number[] {
  // Simplified BEEF generation - in real scenarios this would be more complex
  return Array.from(tx.toBinary())
}

/**
 * Create a mock dispute record
 */
export function createMockDisputeRecord(escrowTxid: string, seekerKey: string, furnisherKey: string): any {
  return {
    escrowTxid,
    escrowOutputIndex: 0,
    seekerKey,
    furnisherKey,
    workDescription: 'Test work',
    disputeStatus: 'disputed-by-seeker',
    resolvedAt: new Date().toISOString(),
    originalBounty: 5000
  }
}

/**
 * Cleanup utility for tests
 */
export class TestCleanup {
  private cleanupFunctions: Array<() => void | Promise<void>> = []

  /**
   * Register a cleanup function
   */
  register(fn: () => void | Promise<void>): void {
    this.cleanupFunctions.push(fn)
  }

  /**
   * Run all cleanup functions
   */
  async cleanup(): Promise<void> {
    for (const fn of this.cleanupFunctions) {
      await fn()
    }
    this.cleanupFunctions = []
  }
}

/**
 * Test scenario builder for common workflows
 */
export class ScenarioBuilder {
  private steps: Array<{ name: string; fn: () => Promise<void> }> = []

  /**
   * Add a step to the scenario
   */
  step(name: string, fn: () => Promise<void>): this {
    this.steps.push({ name, fn })
    return this
  }

  /**
   * Execute all steps in order
   */
  async execute(): Promise<void> {
    for (const step of this.steps) {
      try {
        console.log(`Executing: ${step.name}`)
        await step.fn()
        console.log(`✓ ${step.name}`)
      } catch (error) {
        console.error(`✗ ${step.name} failed:`, error)
        throw error
      }
    }
  }
}
