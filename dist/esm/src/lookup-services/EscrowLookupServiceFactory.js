import { EscrowStorage } from './EscrowStorage.js';
import docs from './EscrowLookupDocs.md.js';
import escrowContractJson from '../../artifacts/Escrow.json' with { type: 'json' };
import { EscrowContract } from '../contracts/Escrow.js';
import { recordFromContract } from '../utils.js';
EscrowContract.loadArtifact(escrowContractJson);
/**
 * Implements an Escrow lookup service
 *
 * Note: The sCrypt contract is used to decode Escrow outputs.
 *
 * @public
 */
class EscrowLookupService {
    storage;
    admissionMode = 'locking-script';
    spendNotificationMode = 'none';
    constructor(storage) {
        this.storage = storage;
    }
    async outputAdmittedByTopic(payload) {
        if (payload.mode !== 'locking-script')
            throw new Error('Invalid payload');
        const { topic, txid, outputIndex, lockingScript } = payload;
        if (topic !== 'tm_escrow')
            return;
        try {
            // Decode the Escrow token fields from the Bitcoin outputScript with the contract class
            const escrow = EscrowContract.fromLockingScript(lockingScript.toHex());
            // Store the token fields for future lookup
            await this.storage.storeRecord(recordFromContract(txid, outputIndex, escrow));
        }
        catch (e) {
            console.error('Error indexing token in lookup database', e);
        }
    }
    async outputSpent(payload) {
        if (payload.mode !== 'none')
            throw new Error('Invalid payload');
        const { topic, txid, outputIndex } = payload;
        if (topic !== 'tm_escrow')
            return;
        await this.storage.deleteRecord(txid, outputIndex);
    }
    async outputEvicted(txid, outputIndex) {
        await this.storage.deleteRecord(txid, outputIndex);
    }
    async lookup(question) {
        if (question.query === undefined || question.query === null) {
            throw new Error('A valid query must be provided!');
        }
        if (question.service !== 'ls_escrow') {
            throw new Error('Lookup service not supported!');
        }
        const query = question.query;
        // Handle specific queries
        if (query.txid !== undefined) {
            return await this.storage.findByTxid(query.txid, query.outputIndex);
        }
        if (query.find === 'all-disputed' && query.platformKey) {
            return await this.storage.findDisputed(query.platformKey);
        }
        if (query.platformKey) {
            return await this.storage.findByPlatformKey(query.platformKey);
        }
        if (query.seekerKey) {
            return await this.storage.findBySeekerKey(query.seekerKey);
        }
        if (query.furnisherKey) {
            return await this.storage.findByFurnisherKey(query.furnisherKey);
        }
        // Default: return all
        return await this.storage.findAll();
    }
    async getDocumentation() {
        return docs;
    }
    async getMetaData() {
        return {
            name: 'Escrow Lookup Service',
            shortDescription: 'Tracks escrow contract UTXOs.'
        };
    }
}
export default (db) => {
    return new EscrowLookupService(new EscrowStorage(db));
};
//# sourceMappingURL=EscrowLookupServiceFactory.js.map