import { LookupService, LookupQuestion, LookupAnswer, LookupFormula, OutputSpent, OutputAdmittedByTopic, AdmissionMode, SpendNotificationMode } from '@bsv/overlay';
import { EscrowStorage } from './EscrowStorage.js';
import { Db } from 'mongodb';
/**
 * Implements an Escrow lookup service
 *
 * Note: The sCrypt contract is used to decode Escrow outputs.
 *
 * @public
 */
declare class EscrowLookupService implements LookupService {
    storage: EscrowStorage;
    readonly admissionMode: AdmissionMode;
    readonly spendNotificationMode: SpendNotificationMode;
    constructor(storage: EscrowStorage);
    outputAdmittedByTopic(payload: OutputAdmittedByTopic): Promise<void>;
    outputSpent(payload: OutputSpent): Promise<void>;
    outputEvicted(txid: string, outputIndex: number): Promise<void>;
    lookup(question: LookupQuestion): Promise<LookupAnswer | LookupFormula>;
    getDocumentation(): Promise<string>;
    getMetaData(): Promise<{
        name: string;
        shortDescription: string;
        iconURL?: string;
        version?: string;
        informationURL?: string;
    }>;
}
declare const _default: (db: Db) => EscrowLookupService;
export default _default;
//# sourceMappingURL=EscrowLookupServiceFactory.d.ts.map