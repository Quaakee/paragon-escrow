import { WalletInterface, TopicBroadcaster, LookupResolver } from '@bsv/sdk';
import type { EscrowTX, GlobalConfig } from '../constants.js';
export default class Furnisher {
    private readonly globalConfig;
    private readonly wallet;
    private derivedPublicKey;
    private readonly broadcaster;
    private readonly resolver;
    constructor(globalConfig: GlobalConfig, wallet?: WalletInterface, broadcaster?: TopicBroadcaster | 'DEFAULT', resolver?: LookupResolver | 'DEFAULT');
    listAvailableWork(): Promise<EscrowTX[]>;
    placeBid(escrow: EscrowTX, amount: number, plans: string, timeRequired: number, bond: number): Promise<void>;
    startWork(escrow: EscrowTX): Promise<void>;
    completeWork(escrow: EscrowTX, workCompletionDescriptor: string): Promise<void>;
    claimBounty(escrow: EscrowTX): Promise<void>;
    raiseDispute(record: EscrowTX): Promise<void>;
    listDisputes(active?: boolean): Promise<{
        active: EscrowTX[];
        historical: any[];
    }>;
    claimAfterDispute(record: EscrowTX): Promise<void>;
    private populateDerivedPublicKey;
    private signatory;
    getCurrentLockTime(): Promise<number>;
}
//# sourceMappingURL=Furnisher.d.ts.map