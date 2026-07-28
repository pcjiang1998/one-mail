import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const electronMock = vi.hoisted(() => ({
  app: {
    getLoginItemSettings: vi.fn(() => ({ openAtLogin: false })),
    getPath: vi.fn(() => tmpdir()),
    setLoginItemSettings: vi.fn()
  }
}))

vi.mock('electron', () => electronMock)

import {
  closeDatabase,
  getDatabase,
  initializeDatabase,
  setDatabaseKey,
  setDatabasePath
} from '../connection'
import {
  getBackupSyncSettings,
  getSettings,
  deleteSignature,
  saveSignature,
  updateBackupSyncSettings,
  updateSettings
} from './settings.repository'

describe('settings repository backup sync', () => {
  let testDir = ''

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'onemail-settings-test-'))
    electronMock.app.getPath.mockReturnValue(testDir)
    setDatabaseKey('k00000000000000000000000000')
    const databasePath = join(testDir, 'test.sqlite')
    setDatabasePath(databasePath)
    initializeDatabase(databasePath)
  })

  afterEach(() => {
    closeDatabase()
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true })
      testDir = ''
    }
  })

  it('stores encrypted backup sync settings using a schema-compatible value type', () => {
    const saved = updateBackupSyncSettings({
      provider: 'webdav',
      remoteUrl: 'https://dav.example.com/onemail-backup.sql',
      username: 'user',
      password: 'secret',
      readKey: 'read-key-123'
    })

    expect(saved).toEqual({
      provider: 'webdav',
      remoteUrl: 'https://dav.example.com/onemail-backup.sql',
      username: 'user',
      passwordConfigured: true,
      readKeyConfigured: true
    })
    expect(getBackupSyncSettings()).toEqual(saved)

    const row = getDatabase()
      .prepare<{
        value_type: string
      }>("SELECT value_type FROM onemail_app_settings WHERE setting_key = 'backup_sync_settings'")
      .get()
    expect(row?.value_type).toBe('json')
  })

  it('defaults remote deletion sync on and persists changes', () => {
    expect(getSettings().syncDeleteToRemote).toBe(true)

    expect(updateSettings({ syncDeleteToRemote: false }).syncDeleteToRemote).toBe(false)
    expect(getSettings().syncDeleteToRemote).toBe(false)
  })

  it('accepts an unlimited cache window and validates advanced settings', () => {
    expect(updateSettings({ syncWindowDays: 0 }).syncWindowDays).toBe(0)
    expect(() => updateSettings({ syncWindowDays: -1 })).toThrow('缓存窗口')
    expect(() =>
      updateSettings({ globalProxyMode: 'custom', globalProxyUrl: 'http://127.0.0.1:8080' })
    ).toThrow('SOCKS5')
    expect(() => updateSettings({ fallbackSyncIntervalMinutes: 0 })).toThrow('回退同步间隔')
  })

  it('creates, selects, and deletes mail signatures', () => {
    expect(() => saveSignature({ title: '<invalid>', content: 'nope' })).toThrow('< 或 >')

    const signature = saveSignature({ title: 'Work', content: 'Regards' })
    expect(updateSettings({ globalSignatureId: signature.signatureId }).globalSignatureId).toBe(
      signature.signatureId
    )
    expect(deleteSignature(signature.signatureId)).toBe(true)
    expect(getSettings().globalSignatureId).toBeNull()
  })
})
