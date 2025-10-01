import { WalletInterface } from '@bsv/sdk';
export interface WalletHealthStatus {
    available: boolean;
    authenticated: boolean;
    error?: string;
}
/**
 * Utility for checking MetaNet Desktop wallet health and connectivity.
 *
 * This helper provides detailed error messages when MetaNet Desktop is not
 * running, not authenticated, or experiencing connectivity issues.
 *
 * @example
 * ```typescript
 * const checker = new WalletHealthChecker(wallet)
 * await checker.ensureAvailable() // Throws descriptive error if unavailable
 * ```
 */
export declare class WalletHealthChecker {
    private wallet;
    constructor(wallet: WalletInterface);
    /**
     * Check wallet connection and authentication status.
     * Returns detailed status without throwing errors.
     *
     * @param timeoutMs Timeout in milliseconds (default: 5000ms)
     * @returns Health status with availability, authentication, and error details
     */
    checkConnection(timeoutMs?: number): Promise<WalletHealthStatus>;
    /**
     * Ensure wallet is available and authenticated.
     * Throws descriptive error if wallet is not ready.
     *
     * @throws Error with detailed message about wallet status
     */
    ensureAvailable(): Promise<void>;
    /**
     * Wait for wallet to become available with timeout.
     * Useful during startup when wallet might be starting up.
     *
     * @param timeoutMs Maximum time to wait (default: 30000ms)
     * @param pollIntervalMs How often to check (default: 1000ms)
     * @returns True if wallet becomes available within timeout
     */
    waitForAvailability(timeoutMs?: number, pollIntervalMs?: number): Promise<boolean>;
    /**
     * Get user-friendly status message for display.
     * @returns Human-readable status string
     */
    getStatusMessage(): Promise<string>;
    private isConnectionError;
    private isTimeoutError;
    private isPermissionError;
}
/**
 * Quick helper to check if MetaNet Desktop is available.
 * @param wallet Wallet interface instance
 * @returns True if wallet is available and authenticated
 */
export declare function isWalletAvailable(wallet: WalletInterface): Promise<boolean>;
/**
 * Quick helper to get wallet status with automatic error handling.
 * @param wallet Wallet interface instance
 * @returns User-friendly status message
 */
export declare function getWalletStatus(wallet: WalletInterface): Promise<string>;
//# sourceMappingURL=wallet-health.d.ts.map