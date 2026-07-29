import { describe, expect, it } from 'vitest'

import { isValidCustomProxyUrl, parseCustomProxyUrl } from './proxy-url'

describe('custom proxy URL', () => {
  it.each([
    'http://127.0.0.1:8080',
    'https://proxy.example.com:8443',
    'socks4://127.0.0.1:1080',
    'socks4a://proxy.example.com:1080',
    'socks5://user:password@127.0.0.1:1080',
    'socks5h://proxy.example.com:1080'
  ])('accepts %s', (value) => {
    expect(isValidCustomProxyUrl(value)).toBe(true)
  })

  it.each(['', 'ftp://example.com:21', 'http://', 'proxy.example.com:8080'])(
    'rejects %s',
    (value) => {
      expect(isValidCustomProxyUrl(value)).toBe(false)
    }
  )

  it('preserves proxy credentials', () => {
    const url = parseCustomProxyUrl('https://user:secret@proxy.example.com:8443')
    expect(url?.username).toBe('user')
    expect(url?.password).toBe('secret')
  })
})
