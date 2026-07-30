import { describe, expect, it } from 'vitest'

import {
  getWindowsMailClientRegistryValues,
  WINDOWS_MAILTO_PROG_ID,
  WINDOWS_REGISTERED_APP_NAME
} from './default-mail-client'

describe('Windows default mail client registration', () => {
  it('registers a mailto ProgID and Default Apps capabilities for the packaged executable', () => {
    const executablePath = 'C:\\Program Files\\OneMailNext\\OneMailNext.exe'
    const values = getWindowsMailClientRegistryValues(executablePath)

    expect(values).toContainEqual({
      key: `HKCU\\Software\\Classes\\${WINDOWS_MAILTO_PROG_ID}\\shell\\open\\command`,
      data: `"${executablePath}" "%1"`
    })
    expect(values).toContainEqual({
      key: `HKCU\\Software\\Clients\\Mail\\${WINDOWS_REGISTERED_APP_NAME}\\Capabilities\\URLAssociations`,
      name: 'mailto',
      data: WINDOWS_MAILTO_PROG_ID
    })
    expect(values).toContainEqual({
      key: 'HKCU\\Software\\RegisteredApplications',
      name: WINDOWS_REGISTERED_APP_NAME,
      data: `Software\\Clients\\Mail\\${WINDOWS_REGISTERED_APP_NAME}\\Capabilities`
    })
  })
})
