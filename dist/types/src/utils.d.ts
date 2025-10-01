import { CreateActionOutput, LookupAnswer, WalletInterface } from "@bsv/sdk";
import { EscrowRecord, EscrowTX, GlobalConfig } from "./constants.js";
import { EscrowContract } from "./contracts/Escrow.js";
export declare const recordFromContract: (txid: string, outputIndex: number, escrow: EscrowContract) => EscrowRecord;
export declare const recordsFromAnswer: (answer: LookupAnswer) => Array<EscrowTX>;
export declare const contractFromGlobalConfigAndParams: (config: GlobalConfig, seekerKey: string, workDescription: string, workCompletionDeadline: number) => EscrowContract;
export declare const callContractMethod: (wallet: WalletInterface, escrow: EscrowTX, methodName: string, params: Array<any>, nextOutputAmount?: number, otherOutputs?: Array<CreateActionOutput>, sequenceNumber?: number, lockTime?: number, unlockingScriptLength?: number) => Promise<import("@bsv/sdk").SignActionResult>;
//# sourceMappingURL=utils.d.ts.map