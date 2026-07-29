import { ipcMain } from 'electron'
import {
  checkForAppUpdates,
  checkGitHubReleaseForUpdates,
  getAppUpdateStatus,
  installDownloadedAppUpdate
} from '../services/auto-update'
import type { AppUpdateCheckResult, AppUpdateStatus } from './types'

export function registerUpdateIpc(): void {
  ipcMain.handle('updates/check', async (): Promise<AppUpdateCheckResult> => {
    const result = await checkForAppUpdates()
    checkGitHubReleaseForUpdates()
    return result
  })
  ipcMain.handle('updates/status', (): AppUpdateStatus => {
    return getAppUpdateStatus()
  })
  ipcMain.handle('updates/install', (): boolean => {
    return installDownloadedAppUpdate()
  })
}
