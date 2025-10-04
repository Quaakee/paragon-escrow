import {
  LookupService,
  LookupQuestion,
  LookupAnswer,
  LookupFormula,
  OutputSpent,
  OutputAdmittedByTopic,
  AdmissionMode,
  SpendNotificationMode
} from '@bsv/overlay'
import { EscrowStorage } from './EscrowStorage.js'
import docs from './EscrowLookupDocs.md.js'
import escrowContractJson from '../../artifacts/Escrow.json' with { type: 'json' }
import { EscrowContract } from '../contracts/Escrow.js'
import { Db } from 'mongodb'
import { recordFromContract } from '../utils.js'
EscrowContract.loadArtifact(escrowContractJson)

/**
 * Implements an Escrow lookup service
 *
 * Note: The sCrypt contract is used to decode Escrow outputs.
 *
 * @public
 */
class EscrowLookupService implements LookupService {
  readonly admissionMode: AdmissionMode = 'locking-script'
  readonly spendNotificationMode: SpendNotificationMode = 'none'
  constructor (public storage: EscrowStorage) {}

  async outputAdmittedByTopic (payload: OutputAdmittedByTopic): Promise<void> {
    if (payload.mode !== 'locking-script') throw new Error('Invalid payload')
    const { topic, txid, outputIndex, lockingScript } = payload
    if (topic !== 'tm_escrow') return
    try {
      // Decode the Escrow token fields from the Bitcoin outputScript with the contract class
      const escrow = EscrowContract.fromLockingScript(
        lockingScript.toHex()
      ) as EscrowContract

      // Store the token fields for future lookup
      await this.storage.storeRecord(recordFromContract(txid, outputIndex, escrow))
    } catch (e) {
      console.error('Error indexing token in lookup database', e)
    }
  }

  async outputSpent (payload: OutputSpent): Promise<void> {
    if (payload.mode !== 'none') throw new Error('Invalid payload')
    const { topic, txid, outputIndex } = payload
    if (topic !== 'tm_escrow') return
    await this.storage.deleteRecord(txid, outputIndex)
  }

  async outputEvicted (
    txid: string,
    outputIndex: number
  ): Promise<void> {
    await this.storage.deleteRecord(txid, outputIndex)
  }

  async lookup (
    question: LookupQuestion
  ): Promise<LookupAnswer | LookupFormula> {
    if (question.query === undefined || question.query === null) {
      throw new Error('A valid query must be provided!')
    }
    if (question.service !== 'ls_escrow') {
      throw new Error('Lookup service not supported!')
    }

    const query = question.query as {
      findAll?: boolean
      platformKey?: string
      seekerKey?: string
      furnisherKey?: string
      find?: string
      txid?: string
      outputIndex?: number
    }

    // Handle specific queries
    if (query.txid !== undefined) {
      return await this.storage.findByTxid(query.txid, query.outputIndex)
    }

    if (query.find === 'all-open') {
      return await this.storage.findAllOpen()
    }

    if (query.find === 'all-disputed' && query.platformKey) {
      return await this.storage.findDisputed(query.platformKey)
    }

    if (query.platformKey) {
      return await this.storage.findByPlatformKey(query.platformKey)
    }

    if (query.seekerKey) {
      return await this.storage.findBySeekerKey(query.seekerKey)
    }

    if (query.furnisherKey) {
      return await this.storage.findByFurnisherKey(query.furnisherKey)
    }

    // Default: return all
    return await this.storage.findAll()
  }

  async getDocumentation (): Promise<string> {
    return docs
  }

  async getMetaData (): Promise<{
    name: string
    shortDescription: string
    iconURL?: string
    version?: string
    informationURL?: string
  }> {
    return {
      name: 'Escrow Lookup Service',
      shortDescription: 'Tracks escrow contract UTXOs.'
    }
  }
}

export default (db: Db): EscrowLookupService => {
  return new EscrowLookupService(new EscrowStorage(db))
}
