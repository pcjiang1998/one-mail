import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { app, shell } from 'electron'

import type { DefaultMailClientStatus } from '../../shared/types'

export const WINDOWS_MAILTO_PROG_ID = 'OneMailNext.mailto'
export const WINDOWS_REGISTERED_APP_NAME = 'OneMail Next'

type WindowsRegistryValue = {
  key: string
  name?: string
  data: string
}

let registrationSucceeded = false

export function ensureDefaultMailClientRegistration(): boolean {
  if (process.env.ONE_MAIL_SKIP_PROTOCOL_REGISTRATION === '1') return false

  if (process.platform === 'win32' && app.isPackaged) {
    try {
      registerWindowsMailClient(process.execPath)
      registrationSucceeded = true
    } catch (error) {
      registrationSucceeded = false
      console.warn(
        `[default-mail-client] Windows registration failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
    return registrationSucceeded
  }

  registrationSucceeded = registerElectronMailtoProtocol()
  return registrationSucceeded
}

export function getDefaultMailClientStatus(): DefaultMailClientStatus {
  const supported = ['win32', 'darwin', 'linux'].includes(process.platform)
  const isDefault = supported ? isDefaultMailtoProtocolClient() : false
  const registered =
    process.platform === 'win32'
      ? isWindowsMailClientRegistered()
      : registrationSucceeded || isDefault
  return {
    supported,
    registered,
    isDefault,
    requiresSystemSelection: process.platform === 'win32' && registered && !isDefault
  }
}

export async function configureDefaultMailClient(): Promise<DefaultMailClientStatus> {
  const registered = ensureDefaultMailClientRegistration()
  if (!registered) throw new Error('无法注册 OneMail Next 邮件处理器。')

  if (process.platform === 'win32') {
    const registeredApp = encodeURIComponent(WINDOWS_REGISTERED_APP_NAME)
    try {
      await shell.openExternal(`ms-settings:defaultapps?registeredAppUser=${registeredApp}`)
    } catch {
      await shell.openExternal('ms-settings:defaultapps')
    }
  }

  return getDefaultMailClientStatus()
}

export function getWindowsMailClientRegistryValues(executablePath: string): WindowsRegistryValue[] {
  const classesKey = `HKCU\\Software\\Classes\\${WINDOWS_MAILTO_PROG_ID}`
  const clientKey = `HKCU\\Software\\Clients\\Mail\\${WINDOWS_REGISTERED_APP_NAME}`
  const command = `"${executablePath}" "%1"`
  const icon = `"${executablePath}",0`

  return [
    { key: classesKey, data: 'URL:OneMail Next Mail Protocol' },
    { key: classesKey, name: 'URL Protocol', data: '' },
    { key: `${classesKey}\\DefaultIcon`, data: icon },
    { key: `${classesKey}\\shell\\open\\command`, data: command },
    { key: clientKey, data: WINDOWS_REGISTERED_APP_NAME },
    { key: `${clientKey}\\shell\\open\\command`, data: `"${executablePath}"` },
    { key: `${clientKey}\\Protocols\\mailto`, data: 'URL:OneMail Next Mail Protocol' },
    { key: `${clientKey}\\Protocols\\mailto`, name: 'URL Protocol', data: '' },
    { key: `${clientKey}\\Protocols\\mailto\\DefaultIcon`, data: icon },
    { key: `${clientKey}\\Protocols\\mailto\\shell\\open\\command`, data: command },
    {
      key: `${clientKey}\\Capabilities`,
      name: 'ApplicationName',
      data: WINDOWS_REGISTERED_APP_NAME
    },
    {
      key: `${clientKey}\\Capabilities`,
      name: 'ApplicationDescription',
      data: 'OneMail Next desktop email client'
    },
    { key: `${clientKey}\\Capabilities`, name: 'ApplicationIcon', data: icon },
    {
      key: `${clientKey}\\Capabilities\\URLAssociations`,
      name: 'mailto',
      data: WINDOWS_MAILTO_PROG_ID
    },
    {
      key: 'HKCU\\Software\\RegisteredApplications',
      name: WINDOWS_REGISTERED_APP_NAME,
      data: `Software\\Clients\\Mail\\${WINDOWS_REGISTERED_APP_NAME}\\Capabilities`
    }
  ]
}

function registerWindowsMailClient(executablePath: string): void {
  for (const value of getWindowsMailClientRegistryValues(executablePath)) {
    const args = ['ADD', value.key]
    if (value.name === undefined) args.push('/ve')
    else args.push('/v', value.name)
    args.push('/t', 'REG_SZ', '/d', value.data, '/f')
    execFileSync('reg.exe', args, { stdio: 'ignore', windowsHide: true })
  }
}

function registerElectronMailtoProtocol(): boolean {
  if (process.defaultApp) {
    const entryPath = process.argv[1]
    return entryPath
      ? app.setAsDefaultProtocolClient('mailto', process.execPath, [resolve(entryPath)])
      : false
  }

  return app.setAsDefaultProtocolClient('mailto')
}

function isDefaultMailtoProtocolClient(): boolean {
  if (process.platform === 'win32' && app.isPackaged && isWindowsMailtoUserChoice()) return true
  if (process.defaultApp) {
    const entryPath = process.argv[1]
    return entryPath
      ? app.isDefaultProtocolClient('mailto', process.execPath, [resolve(entryPath)])
      : false
  }
  return app.isDefaultProtocolClient('mailto')
}

function isWindowsMailtoUserChoice(): boolean {
  try {
    const output = execFileSync(
      'reg.exe',
      [
        'QUERY',
        'HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\mailto\\UserChoice',
        '/v',
        'ProgId'
      ],
      { encoding: 'utf8', windowsHide: true }
    )
    return output.toLowerCase().includes(WINDOWS_MAILTO_PROG_ID.toLowerCase())
  } catch {
    return false
  }
}

function isWindowsMailClientRegistered(): boolean {
  try {
    const output = execFileSync(
      'reg.exe',
      ['QUERY', 'HKCU\\Software\\RegisteredApplications', '/v', WINDOWS_REGISTERED_APP_NAME],
      { encoding: 'utf8', windowsHide: true }
    )
    const expectedCapabilities =
      `Software\\Clients\\Mail\\${WINDOWS_REGISTERED_APP_NAME}\\Capabilities`.toLowerCase()
    return output.toLowerCase().includes(expectedCapabilities)
  } catch {
    return false
  }
}
