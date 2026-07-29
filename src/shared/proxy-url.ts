export const CUSTOM_PROXY_PROTOCOLS = [
  'http:',
  'https:',
  'socks4:',
  'socks4a:',
  'socks5:',
  'socks5h:'
] as const

export type CustomProxyProtocol = (typeof CUSTOM_PROXY_PROTOCOLS)[number]

export function parseCustomProxyUrl(value?: string): URL | null {
  const text = value?.trim()
  if (!text) return null

  try {
    const url = new URL(text)
    if (!CUSTOM_PROXY_PROTOCOLS.includes(url.protocol as CustomProxyProtocol)) return null
    if (!url.hostname) return null
    return url
  } catch {
    return null
  }
}

export function isValidCustomProxyUrl(value?: string): boolean {
  return parseCustomProxyUrl(value) !== null
}
