import { Db } from 'mongodb';
import { EscrowRecord, UTXOReference } from '../constants.js';
export declare class EscrowStorage {
    private readonly db;
    private readonly records;
    /**
     * Constructs a new MeterStorageEngine instance
     * @param {Db} db - connected mongo database instance
     */
    constructor(db: Db);
    /**
     * Stores escrow record
     * @param {string} txid transaction id
     * @param {number} outputIndex index of the UTXO
     * @param {string} value - meter value to save
     */
    storeRecord(record: EscrowRecord): Promise<void>;
    /**
     * Delete a matching Escrow record
     * @param {string} txid transaction id
     * @param {number} outputIndex Output index of the UTXO
     */
    deleteRecord(txid: string, outputIndex: number): Promise<void>;
    /**
     * Returns all results tracked by the overlay
     * @returns {Promise<UTXOReference[]>} returns matching UTXO references
     */
    findAll(): Promise<UTXOReference[]>;
    /**
     * Find escrow by txid and optional outputIndex
     */
    findByTxid(txid: string, outputIndex?: number): Promise<UTXOReference[]>;
    /**
     * Find all disputed escrows for a specific platform
     */
    findDisputed(platformKey: string): Promise<UTXOReference[]>;
    /**
     * Find escrows by platform key
     */
    findByPlatformKey(platformKey: string): Promise<UTXOReference[]>;
    /**
     * Find escrows by seeker key
     */
    findBySeekerKey(seekerKey: string): Promise<UTXOReference[]>;
    /**
     * Find escrows by furnisher key (in acceptedBid)
     */
    findByFurnisherKey(furnisherKey: string): Promise<UTXOReference[]>;
}
//# sourceMappingURL=EscrowStorage.d.ts.map