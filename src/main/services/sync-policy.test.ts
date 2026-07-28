import { describe, expect, it } from 'vitest'

import type { AppSettings, MailAccount } from '../../shared/types'
import { resolveAccountSyncPolicy } from './sync-policy'

const settings = {
  globalSyncMode: 'idle',
  globalSyncIntervalMinutes: 20,
  fallbackSyncMode: 'interval',
  fallbackSyncIntervalMinutes: 7
} as AppSettings

const account = {
  receiveProtocol: 'imap',
  idleSupported: true,
  syncMode: 'global',
  accountSyncIntervalMinutes: 15
} as MailAccount

describe('account sync policy', () => {
  it('uses IDLE only for confirmed capable IMAP accounts', () => {
    expect(resolveAccountSyncPolicy(account, settings)).toEqual({ mode: 'idle' })
    expect(resolveAccountSyncPolicy({ ...account, idleSupported: undefined }, settings)).toEqual({
      mode: 'interval',
      intervalMinutes: 7
    })
  })

  it('always uses fallback for POP3 accounts', () => {
    expect(
      resolveAccountSyncPolicy(
        { ...account, receiveProtocol: 'pop3', idleSupported: false, syncMode: 'idle' },
        settings
      )
    ).toEqual({ mode: 'interval', intervalMinutes: 7 })
  })

  it('honors account interval and manual overrides', () => {
    expect(
      resolveAccountSyncPolicy(
        { ...account, syncMode: 'interval', accountSyncIntervalMinutes: 12 },
        settings
      )
    ).toEqual({ mode: 'interval', intervalMinutes: 12 })
    expect(resolveAccountSyncPolicy({ ...account, syncMode: 'manual' }, settings)).toEqual({
      mode: 'manual'
    })
  })
})
