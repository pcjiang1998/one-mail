import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  checkForUpdates: vi.fn(async () => null),
  on: vi.fn(),
  quitAndInstall: vi.fn(),
  autoUpdaterError: undefined as Error | undefined,
  fetch: vi.fn(async () => ({
    ok: true,
    json: async () => ({ tag_name: 'v1.0.0' })
  }))
}))

vi.mock('electron', () => ({
  app: {
    getVersion: () => '1.0.0',
    isPackaged: true
  },
  BrowserWindow: {
    getAllWindows: () => []
  }
}))

vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: false }
}))

vi.mock('electron-updater', () => ({
  default: {
    get autoUpdater() {
      if (mocks.autoUpdaterError) throw mocks.autoUpdaterError
      return {
        checkForUpdates: mocks.checkForUpdates,
        on: mocks.on,
        quitAndInstall: mocks.quitAndInstall
      }
    }
  }
}))

import { startAutoUpdateChecks, stopAutoUpdateChecks } from './auto-update'

const DAY_MS = 1000 * 60 * 60 * 24

describe('automatic update scheduling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.checkForUpdates.mockClear()
    mocks.fetch.mockClear()
    mocks.autoUpdaterError = undefined
    vi.stubGlobal('fetch', mocks.fetch)
  })

  afterEach(() => {
    stopAutoUpdateChecks()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('does not perform background checks in manual mode', async () => {
    startAutoUpdateChecks('manual')
    await vi.advanceTimersByTimeAsync(DAY_MS * 8)

    expect(mocks.checkForUpdates).not.toHaveBeenCalled()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('keeps the app running when the auto-updater rejects the app version', async () => {
    mocks.autoUpdaterError = new Error('App version is not a valid semver version')

    expect(() => startAutoUpdateChecks('daily')).not.toThrow()
    await vi.advanceTimersByTimeAsync(0)

    expect(mocks.checkForUpdates).not.toHaveBeenCalled()
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })

  it('checks immediately and then once per day in daily mode', async () => {
    startAutoUpdateChecks('daily')
    await vi.advanceTimersByTimeAsync(0)
    expect(mocks.checkForUpdates).toHaveBeenCalledTimes(1)
    expect(mocks.fetch).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(DAY_MS)
    expect(mocks.checkForUpdates).toHaveBeenCalledTimes(2)
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
  })

  it('uses a seven-day interval in weekly mode', async () => {
    startAutoUpdateChecks('weekly')
    await vi.advanceTimersByTimeAsync(DAY_MS)
    expect(mocks.checkForUpdates).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(DAY_MS * 6)
    expect(mocks.checkForUpdates).toHaveBeenCalledTimes(2)
  })
})
