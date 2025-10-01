// Implements a Lookup StorageEngine for Meter
export class EscrowStorage {
    db;
    records;
    /**
     * Constructs a new MeterStorageEngine instance
     * @param {Db} db - connected mongo database instance
     */
    constructor(db) {
        this.db = db;
        this.records = db.collection('EscrowRecords');
    }
    /**
     * Stores escrow record
     * @param {string} txid transaction id
     * @param {number} outputIndex index of the UTXO
     * @param {string} value - meter value to save
     */
    async storeRecord(record) {
        console.log('STORING', record);
        await this.records.insertOne(record);
    }
    /**
     * Delete a matching Escrow record
     * @param {string} txid transaction id
     * @param {number} outputIndex Output index of the UTXO
     */
    async deleteRecord(txid, outputIndex) {
        await this.records.deleteOne({ txid, outputIndex });
    }
    /**
     * Returns all results tracked by the overlay
     * @returns {Promise<UTXOReference[]>} returns matching UTXO references
     */
    async findAll() {
        console.log('Finding All');
        return await this.records.find({})
            .project({ txid: 1, outputIndex: 1 })
            .toArray()
            .then(results => results.map(record => ({
            txid: record.txid,
            outputIndex: record.outputIndex
        })));
    }
    /**
     * Find escrow by txid and optional outputIndex
     */
    async findByTxid(txid, outputIndex) {
        const filter = { txid };
        if (outputIndex !== undefined) {
            filter.outputIndex = outputIndex;
        }
        return await this.records.find(filter)
            .project({ txid: 1, outputIndex: 1 })
            .toArray()
            .then(results => results.map(record => ({
            txid: record.txid,
            outputIndex: record.outputIndex
        })));
    }
    /**
     * Find all disputed escrows for a specific platform
     */
    async findDisputed(platformKey) {
        return await this.records.find({
            platformKey,
            status: { $in: ['disputed-by-seeker', 'disputed-by-furnisher'] }
        })
            .project({ txid: 1, outputIndex: 1 })
            .toArray()
            .then(results => results.map(record => ({
            txid: record.txid,
            outputIndex: record.outputIndex
        })));
    }
    /**
     * Find escrows by platform key
     */
    async findByPlatformKey(platformKey) {
        return await this.records.find({ platformKey })
            .project({ txid: 1, outputIndex: 1 })
            .toArray()
            .then(results => results.map(record => ({
            txid: record.txid,
            outputIndex: record.outputIndex
        })));
    }
    /**
     * Find escrows by seeker key
     */
    async findBySeekerKey(seekerKey) {
        return await this.records.find({ seekerKey })
            .project({ txid: 1, outputIndex: 1 })
            .toArray()
            .then(results => results.map(record => ({
            txid: record.txid,
            outputIndex: record.outputIndex
        })));
    }
    /**
     * Find escrows by furnisher key (in acceptedBid)
     */
    async findByFurnisherKey(furnisherKey) {
        return await this.records.find({ 'acceptedBid.furnisherKey': furnisherKey })
            .project({ txid: 1, outputIndex: 1 })
            .toArray()
            .then(results => results.map(record => ({
            txid: record.txid,
            outputIndex: record.outputIndex
        })));
    }
}
//# sourceMappingURL=EscrowStorage.js.map