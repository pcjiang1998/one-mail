import { afterEach, describe, expect, it, vi } from 'vitest'

import { applyAppTheme, getAppThemeMode, getStoredAppTheme } from './theme'

describe('application themes', () => {
  afterEach(() => {
    document.documentElement.classList.remove('light', 'dark')
    delete document.documentElement.dataset.colorTheme
    window.localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('applies and persists light and dark color schemes', () => {
    applyAppTheme('green-dark')

    expect(document.documentElement).toHaveClass('dark')
    expect(document.documentElement.dataset.colorTheme).toBe('green-dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(window.localStorage.getItem('theme')).toBe('green-dark')

    applyAppTheme('rose-light')
    expect(document.documentElement).toHaveClass('light')
    expect(document.documentElement).not.toHaveClass('dark')
    expect(document.documentElement.dataset.colorTheme).toBe('rose-light')
  })

  it('restores valid themes and rejects unknown stored values', () => {
    window.localStorage.setItem('theme', 'blue-dark')
    expect(getStoredAppTheme()).toBe('blue-dark')
    expect(getAppThemeMode('blue-dark')).toBe('dark')

    window.localStorage.setItem('theme', 'unknown-theme')
    expect(getStoredAppTheme()).toBe('light')
  })
})
