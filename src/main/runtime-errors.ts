const BORINGSSL_BAD_DECRYPT_PATTERN =
  /Cipher functions:OPENSSL_internal:BAD_DECRYPT|OPENSSL_internal:BAD_DECRYPT|e_aes\.cc\.inc/i
const RECOVERABLE_NETWORK_ERROR_CODES = new Set([
  'ECONNABORTED',
  'ECONNECTION',
  'ECONNREFUSED',
  'ECONNRESET',
  'EDNS',
  'EHOSTUNREACH',
  'ENETDOWN',
  'ENETUNREACH',
  'ENOTFOUND',
  'EPIPE',
  'ESOCKET',
  'ETLS',
  'ETIMEDOUT'
])

let installed = false

export function installRuntimeErrorGuards(): void {
  if (installed) return
  installed = true

  process.on('uncaughtException', handleUncaughtException)
  process.on('unhandledRejection', handleUnhandledRejection)
}

export function isBoringSslBadDecryptError(error: unknown): boolean {
  return BORINGSSL_BAD_DECRYPT_PATTERN.test(getErrorMessage(error))
}

export function isRecoverableNetworkRuntimeError(error: unknown): boolean {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '').toUpperCase()
      : ''
  if (RECOVERABLE_NETWORK_ERROR_CODES.has(code)) return true

  return /\b(?:ECONNABORTED|ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETDOWN|ENETUNREACH|ENOTFOUND|EPIPE|ETIMEDOUT)\b|socket hang up|network socket disconnected|proxy connection.*closed|代理连接已断开|IMAP IDLE 连接已断开/i.test(
    getErrorMessage(error)
  )
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.stack || error.message
  if (typeof error === 'string') return error

  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

function handleUncaughtException(error: Error): void {
  if (isBoringSslBadDecryptError(error) || isRecoverableNetworkRuntimeError(error)) {
    console.warn(`Ignored recoverable runtime error: ${getErrorMessage(error)}`)
    return
  }

  process.off('uncaughtException', handleUncaughtException)
  throw error
}

function handleUnhandledRejection(reason: unknown): void {
  if (isBoringSslBadDecryptError(reason) || isRecoverableNetworkRuntimeError(reason)) {
    console.warn(`Ignored recoverable unhandled rejection: ${getErrorMessage(reason)}`)
    return
  }

  throw reason instanceof Error ? reason : new Error(getErrorMessage(reason))
}
