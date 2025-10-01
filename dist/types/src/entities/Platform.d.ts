import { WalletInterface, TopicBroadcaster, LookupResolver } from '@bsv/sdk';
import type { EscrowRecord, EscrowTX, GlobalConfig } from '../constants.js';
export default class Platform {
    private readonly globalConfig;
    private readonly wallet;
    private derivedPublicKey;
    private readonly broadcaster;
    private readonly resolver;
    constructor(globalConfig: GlobalConfig, wallet?: WalletInterface, broadcaster?: TopicBroadcaster | 'DEFAULT', resolver?: LookupResolver | 'DEFAULT');
    listActiveDisputes(): Promise<EscrowTX[]>;
    listHistoricalDisputes(): Promise<any[]>;
    decideDispute(record: EscrowRecord, amountForSeeker: number, amountForFurnisher: number, notes: number[]): Promise<void>;
    private signatory;
    private getEscrowTX;
    private populateDerivedPublicKey;
}
//# sourceMappingURL=Platform.d.ts.map