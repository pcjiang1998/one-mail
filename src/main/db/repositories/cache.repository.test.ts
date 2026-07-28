import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getLoginItemSettings: vi.fn(() => ({ openAtLogin: false })),
    getPath: vi.fn(() => tmpdir()),
    setLoginItemSettings: vi.fn()
  }
}))

import {
  closeDatabase,
  getDatabase,
  initializeDatabase,
  setDatabaseKey,
  setDatabasePath
} from '../connection'
import { createAccount } from './account.repository'
import { cleanupMessageCache } from './cache.repository'

describe('mail cache cleanup', () => {
  let testDir = ''

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'onemail-cache-test-'))
    const databasePath = join(testDir, 'test.sqlite')
    setDatabaseKey('k00000000000000000000000000')
    setDatabasePath(databasePath)
    initializeDatabase(databasePath)
  })

  afterEach(() => {
    closeDatabase()
    if (testDir) rmSync(testDir, { recursive: true, force: true })
  })

  it('deletes only messages older than the selected age and refreshes folder counts', () => {
    const account = createAccount({
      providerKey: 'test',
      email: 'user@example.com',
      authType: 'manual',
      imapHost: 'imap.example.com',
      imapPort: 993,
      imapSecurity: 'ssl_tls',
      smtpEnabled: false
    })
    const db = getDatabase()
    const folderId = Number(
      db
        .prepare(
          `INSERT INTO onemail_mail_folders
             (account_id, path, name, role, sync_enabled, total_count, unread_count)
           VALUES (:accountId, 'INBOX', 'Inbox', 'inbox', 1, 2, 2)`
        )
        .run({ accountId: account.accountId }).lastInsertRowid
    )
    const insert = db.prepare(
      `INSERT INTO onemail_mail_messages
         (account_id, folder_id, uid, received_at, subject)
       VALUES (:accountId, :folderId, :uid, :receivedAt, :subject)`
    )
    insert.run({
      accountId: account.accountId,
      folderId,
      uid: 1,
      receivedAt: '2020-01-01T00:00:00.000Z',
      subject: 'old'
    })
    insert.run({
      accountId: account.accountId,
      folderId,
      uid: 2,
      receivedAt: new Date().toISOString(),
      subject: 'new'
    })

    expect(cleanupMessageCache(30)).toEqual({ days: 30, deletedMessages: 1 })
    expect(db.prepare('SELECT COUNT(*) AS count FROM onemail_mail_messages').get()).toEqual({
      count: 1
    })
    expect(
      db
        .prepare(
          'SELECT total_count, unread_count FROM onemail_mail_folders WHERE folder_id = :folderId'
        )
        .get({ folderId })
    ).toEqual({ total_count: 1, unread_count: 1 })
  })

  it('rejects cleanup ages outside the supported menu values', () => {
    expect(() => cleanupMessageCache(8)).toThrow('不支持')
  })
})
