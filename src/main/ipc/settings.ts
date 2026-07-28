import { ipcMain, type WebContents } from 'electron'
import {
  deleteSignature,
  getBackupSyncSettings,
  getSettings,
  saveSignature,
  updateBackupSyncSettings,
  updateSettings
} from '../db/repositories/settings.repository'
import { cleanupMessageCache } from '../db/repositories/cache.repository'
import {
  downloadBackupSync,
  downloadBackupSyncFromSettings,
  testBackupSync,
  uploadBackupSync
} from '../services/backup-sync'
import {
  exportDatabaseSqlBackup,
  importDatabaseSqlBackup,
  type BackupImportProgressReporter
} from '../services/database-backup'
import { refreshMailboxWatchers } from '../services/mailbox-watch'
import type {
  BackupImportProgress,
  BackupSyncSettings,
  MailSignatureInput,
  SettingsUpdateInput
} from './types'

export function registerSettingsIpc(): void {
  ipcMain.handle('settings/get', () => getSettings())
  ipcMain.handle('settings/update', (_event, input: SettingsUpdateInput) => {
    const settings = updateSettings(input)
    refreshMailboxWatchers()
    return settings
  })
  ipcMain.handle('settings/saveSignature', (_event, input: MailSignatureInput) =>
    saveSignature(input)
  )
  ipcMain.handle('settings/deleteSignature', (_event, signatureId: number) =>
    deleteSignature(signatureId)
  )
  ipcMain.handle('settings/cleanupCache', (_event, days: number) => cleanupMessageCache(days))
  ipcMain.handle('settings/getBackupSync', () => getBackupSyncSettings())
  ipcMain.handle('settings/updateBackupSync', (_event, input: BackupSyncSettings) =>
    updateBackupSyncSettings(input)
  )
  ipcMain.handle('settings/testBackupSync', (_event, input: BackupSyncSettings) =>
    testBackupSync(input)
  )
  ipcMain.handle('settings/uploadBackupSync', () => uploadBackupSync())
  ipcMain.handle('settings/downloadBackupSync', async (event, operationId?: string) => {
    const result = await downloadBackupSync(
      createBackupImportProgressReporter(event.sender, operationId)
    )
    if (result.imported) refreshMailboxWatchers()
    return result
  })
  ipcMain.handle(
    'settings/importBackupFromRemote',
    async (event, input: BackupSyncSettings, operationId?: string) => {
      const result = await downloadBackupSyncFromSettings(
        input,
        createBackupImportProgressReporter(event.sender, operationId)
      )
      if (result.imported) refreshMailboxWatchers()
      return result
    }
  )
  ipcMain.handle('settings/exportSql', () => exportDatabaseSqlBackup())
  ipcMain.handle('settings/importSql', async (event, operationId?: string) => {
    const result = await importDatabaseSqlBackup(
      createBackupImportProgressReporter(event.sender, operationId)
    )
    if (result.imported) refreshMailboxWatchers()
    return result
  })
}

function createBackupImportProgressReporter(
  webContents: WebContents,
  operationId?: string
): BackupImportProgressReporter | undefined {
  if (!operationId) return undefined

  return (progress): void => {
    webContents.send('settings/backupImportProgress', {
      operationId,
      ...progress
    } satisfies BackupImportProgress)
  }
}
