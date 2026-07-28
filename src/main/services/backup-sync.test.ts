import { describe, expect, it } from 'vitest'

import { protectRemoteBackup, unprotectRemoteBackup } from './backup-sync'

describe('remote backup data protection', () => {
  it('round-trips encrypted backups with the matching read key', () => {
    const sql = 'CREATE TABLE example (id INTEGER);'
    const protectedValue = protectRemoteBackup(sql, 'read-key-123')

    expect(protectedValue).toMatch(/^ONEMAIL-REMOTE-BACKUP-V2\n/)
    expect(protectedValue).not.toContain(sql)
    expect(unprotectRemoteBackup(protectedValue, 'read-key-123')).toBe(sql)
  })

  it('rejects wrong keys and legacy plaintext backups', () => {
    const protectedValue = protectRemoteBackup('SELECT 1;', 'read-key-123')

    expect(() => unprotectRemoteBackup(protectedValue, 'wrong-key')).toThrow('读取密钥错误')
    expect(() => unprotectRemoteBackup('SELECT 1;', 'read-key-123')).toThrow('不兼容旧版明文')
  })
})
