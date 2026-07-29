import { ipcMain } from 'electron'

import {
  getTranslationSettings,
  updateTranslationSettings
} from '../db/repositories/settings.repository'
import { translateMailText } from '../services/mail-translation'
import type { TranslationRequest, TranslationSettings } from './types'

export function registerTranslationIpc(): void {
  ipcMain.handle('translations/getSettings', () => getTranslationSettings())
  ipcMain.handle('translations/updateSettings', (_event, input: TranslationSettings) =>
    updateTranslationSettings(input)
  )
  ipcMain.handle('translations/translate', (_event, input: TranslationRequest) =>
    translateMailText(input)
  )
}
