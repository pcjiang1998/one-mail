import type { AppSettings, MailAccount } from '../../shared/types'

export type ResolvedSyncPolicy = {
  mode: 'idle' | 'interval' | 'manual'
  intervalMinutes?: number
}

export function resolveAccountSyncPolicy(
  account: MailAccount,
  settings: AppSettings
): ResolvedSyncPolicy {
  const supportsIdle = account.receiveProtocol === 'imap' && account.idleSupported === true
  const fallback = (): ResolvedSyncPolicy =>
    settings.fallbackSyncMode === 'manual'
      ? { mode: 'manual' }
      : { mode: 'interval', intervalMinutes: positive(settings.fallbackSyncIntervalMinutes, 5) }

  if (account.receiveProtocol === 'pop3') return fallback()

  switch (account.syncMode) {
    case 'manual':
      return { mode: 'manual' }
    case 'interval':
      return { mode: 'interval', intervalMinutes: positive(account.accountSyncIntervalMinutes, 15) }
    case 'fallback':
      return fallback()
    case 'idle':
      return supportsIdle ? { mode: 'idle' } : fallback()
    case 'global':
    default:
      if (settings.globalSyncMode === 'manual') return { mode: 'manual' }
      if (settings.globalSyncMode === 'interval') {
        return {
          mode: 'interval',
          intervalMinutes: positive(settings.globalSyncIntervalMinutes, 15)
        }
      }
      return supportsIdle ? { mode: 'idle' } : fallback()
  }
}

function positive(value: number, fallback: number): number {
  return Number.isInteger(value) && value > 0 ? value : fallback
}
