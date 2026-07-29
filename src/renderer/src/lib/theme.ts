import type { AppColorTheme, AppTheme } from '../../../shared/types'

export const APP_COLOR_THEMES = [
  'light',
  'dark',
  'blue-light',
  'green-light',
  'rose-light',
  'blue-dark',
  'green-dark',
  'burgundy-dark'
] as const satisfies readonly AppColorTheme[]

export const APP_COLOR_THEME_SWATCHES: Record<AppColorTheme, string> = {
  light: '#ffffff',
  dark: '#171717',
  'blue-light': '#dbeafe',
  'green-light': '#dcfce7',
  'rose-light': '#ffe4e6',
  'blue-dark': '#172554',
  'green-dark': '#052e16',
  'burgundy-dark': '#4c0519'
}

export function applyAppTheme(theme: AppColorTheme): void {
  const root = document.documentElement
  const mode = getAppThemeMode(theme)
  root.classList.remove('light', 'dark')
  root.classList.add(mode)
  root.dataset.colorTheme = theme
  root.style.colorScheme = mode
  window.localStorage.setItem('theme', theme)
  void window.api?.system?.setTitleBarTheme?.(mode)
}

export function getStoredAppTheme(): AppColorTheme {
  const storedTheme = window.localStorage.getItem('theme')
  return isAppColorTheme(storedTheme) ? storedTheme : 'light'
}

export function getAppThemeMode(theme: AppColorTheme): AppTheme {
  return theme === 'dark' || theme.endsWith('-dark') ? 'dark' : 'light'
}

export function isAppColorTheme(value: unknown): value is AppColorTheme {
  return APP_COLOR_THEMES.includes(value as AppColorTheme)
}
