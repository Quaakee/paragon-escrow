import { WalletInterface } from '@bsv/sdk'

export interface WalletHealthStatus {
  available: boolean
  authenticated: boolean
  error?: string
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
export class WalletHealthChecker {
  constructor (private wallet: WalletInterface) {}

  /**
   * Check wallet connection and authentication status.
   * Returns detailed status without throwing errors.
   *
   * @param timeoutMs Timeout in milliseconds (default: 5000ms)
   * @returns Health status with availability, authentication, and error details
   */
  async checkConnection (timeoutMs: number = 5000): Promise<WalletHealthStatus> {
    try {
      // Try to check authentication status with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)
      })

      const authPromise = this.wallet.isAuthenticated({})
      const { authenticated } = await Promise.race([authPromise, timeoutPromise]) as any

      return { available: true, authenticated }
    } catch (error: any) {
      // Timeout
      if (error.message === 'TIMEOUT') {
        return {
          available: false,
          authenticated: false,
          error:
            'MetaNet Desktop connection timed out.\n\n' +
            'The wallet did not respond within 5 seconds. This usually means:\n' +
            '1. MetaNet Desktop is not running\n' +
            '2. The wallet is on a different port\n' +
            '3. The wallet is frozen or unresponsive\n\n' +
            'To start MetaNet Desktop:\n' +
            '  cd /path/to/metanet-desktop\n' +
            '  npm run tauri dev'
        }
      }
      // Connection refused - MetaNet Desktop not running
      if (this.isConnectionError(error)) {
        return {
          available: false,
          authenticated: false,
          error:
            'MetaNet Desktop is not running or not accessible.\n\n' +
            'Please ensure:\n' +
            '1. MetaNet Desktop is started and running\n' +
            '2. It is listening on http://127.0.0.1:3321\n' +
            '3. No firewall is blocking port 3321\n\n' +
            'To start MetaNet Desktop:\n' +
            '  cd /path/to/metanet-desktop\n' +
            '  npm run tauri dev\n\n' +
            'Or download the compiled version from:\n' +
            '  https://github.com/bsv-blockchain/metanet-desktop/releases'
        }
      }

      // Gateway timeout - Wallet operation timed out
      if (this.isTimeoutError(error)) {
        return {
          available: true,
          authenticated: false,
          error:
            'MetaNet Desktop is not responding.\n\n' +
            'Please check:\n' +
            '1. The wallet is unlocked (enter your password)\n' +
            '2. MetaNet Desktop window is not frozen\n' +
            '3. Your system has sufficient resources\n\n' +
            'Try restarting MetaNet Desktop if the issue persists.'
        }
      }

      // Permission denied
      if (this.isPermissionError(error)) {
        return {
          available: true,
          authenticated: false,
          error:
            'Permission denied by MetaNet Desktop.\n\n' +
            'Please:\n' +
            '1. Check for a permission request dialog in MetaNet Desktop\n' +
            '2. Approve the permission request\n' +
            '3. Ensure your application is trusted\n\n' +
            'You may need to reset permissions in MetaNet Desktop settings.'
        }
      }

      // Unknown error
      return {
        available: false,
        authenticated: false,
        error: `Wallet error: ${error.message || String(error)}`
      }
    }
  }

  /**
   * Ensure wallet is available and authenticated.
   * Throws descriptive error if wallet is not ready.
   *
   * @throws Error with detailed message about wallet status
   */
  async ensureAvailable (): Promise<void> {
    const health = await this.checkConnection()

    if (!health.available) {
      throw new Error(health.error || 'Wallet not available')
    }

    if (!health.authenticated) {
      throw new Error(
        health.error ||
          'Wallet is not authenticated. Please unlock MetaNet Desktop.'
      )
    }
  }

  /**
   * Wait for wallet to become available with timeout.
   * Useful during startup when wallet might be starting up.
   *
   * @param timeoutMs Maximum time to wait (default: 30000ms)
   * @param pollIntervalMs How often to check (default: 1000ms)
   * @returns True if wallet becomes available within timeout
   */
  async waitForAvailability (
    timeoutMs: number = 30000,
    pollIntervalMs: number = 1000
  ): Promise<boolean> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeoutMs) {
      const health = await this.checkConnection()

      if (health.available && health.authenticated) {
        return true
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
    }

    return false
  }

  /**
   * Get user-friendly status message for display.
   * @returns Human-readable status string
   */
  async getStatusMessage (): Promise<string> {
    const health = await this.checkConnection()

    if (health.available && health.authenticated) {
      return '✅ MetaNet Desktop connected and authenticated'
    }

    if (health.available && !health.authenticated) {
      return '🔒 MetaNet Desktop connected but not authenticated'
    }

    return '❌ MetaNet Desktop not available'
  }

  // Error detection helpers

  private isConnectionError (error: any): boolean {
    const message = error.message?.toLowerCase() || ''
    const code = error.code?.toUpperCase() || ''

    return (
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      code === 'ECONNREFUSED' ||
      code === 'ECONNRESET' ||
      message.includes('connect') ||
      message.includes('connection refused')
    )
  }

  private isTimeoutError (error: any): boolean {
    const message = error.message?.toLowerCase() || ''
    const code = error.code?.toUpperCase() || ''

    return (
      message.includes('timeout') ||
      message.includes('timed out') ||
      code === 'ETIMEDOUT' ||
      code === 'ESOCKETTIMEDOUT'
    )
  }

  private isPermissionError (error: any): boolean {
    const message = error.message?.toLowerCase() || ''

    return (
      message.includes('denied') ||
      message.includes('permission') ||
      message.includes('unauthorized') ||
      message.includes('forbidden')
    )
  }
}

/**
 * Quick helper to check if MetaNet Desktop is available.
 * @param wallet Wallet interface instance
 * @returns True if wallet is available and authenticated
 */
export async function isWalletAvailable (
  wallet: WalletInterface
): Promise<boolean> {
  const checker = new WalletHealthChecker(wallet)
  const health = await checker.checkConnection()
  return health.available && health.authenticated
}

/**
 * Quick helper to get wallet status with automatic error handling.
 * @param wallet Wallet interface instance
 * @returns User-friendly status message
 */
export async function getWalletStatus (
  wallet: WalletInterface
): Promise<string> {
  const checker = new WalletHealthChecker(wallet)
  return await checker.getStatusMessage()
}
