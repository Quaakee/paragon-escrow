import { WalletInterface, TopicBroadcaster, LookupResolver } from '@bsv/sdk';
import type { EscrowTX, GlobalConfig } from '../constants.js';
export default class Seeker {
    private readonly globalConfig;
    private readonly wallet;
    private derivedPublicKey;
    private readonly broadcaster;
    private readonly resolver;
    constructor(globalConfig: GlobalConfig, wallet?: WalletInterface, broadcaster?: TopicBroadcaster | 'DEFAULT', resolver?: LookupResolver | 'DEFAULT');
    seek(workDescription: string, workCompletionDeadline: number, bounty?: number): Promise<void>;
    getMyOpenContracts(): Promise<EscrowTX[]>;
    cancelBeforeAccept(escrow: EscrowTX): Promise<void>;
    increaseBounty(escrow: EscrowTX, increaseBy: number): Promise<void>;
    acceptBid(escrow: EscrowTX, bidIndex: number): Promise<void>;
    cancelBidApprovalAfterDelay(escrow: EscrowTX): Promise<void>;
    approveCompletedWork(escrow: EscrowTX): Promise<void>;
    disputeWork(record: EscrowTX, evidence?: number[]): Promise<void>;
    listDisputes(active?: boolean): Promise<{
        active: EscrowTX[];
        historical: any[];
    }>;
    reclaimAfterDispute(record: EscrowTX, reconstitute?: boolean): Promise<void>;
    private populateDerivedPublicKey;
    private signatory;
    getCurrentLockTime(): Promise<number>;
}
//# sourceMappingURL=Seeker.d.ts.map