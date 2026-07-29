import { describe, expect, it } from 'vitest'

import { findMailtoUrl, parseMailtoUrl } from './mailto'

describe('mailto handling', () => {
  it('parses recipients and compose fields without allowing header newlines', () => {
    expect(
      parseMailtoUrl(
        'mailto:first@example.com,second@example.com?cc=copy%40example.com&bcc=hidden%40example.com&subject=Hello%0D%0AWorld&body=Line%201%0ALine%202'
      )
    ).toEqual({
      to: ['first@example.com', 'second@example.com'],
      cc: ['copy@example.com'],
      bcc: ['hidden@example.com'],
      subject: 'Hello World',
      body: 'Line 1\nLine 2'
    })
  })

  it('finds mailto command-line arguments case-insensitively', () => {
    expect(findMailtoUrl(['OneMailNext.exe', 'MAILTO:user@example.com'])).toBe(
      'MAILTO:user@example.com'
    )
    expect(findMailtoUrl(['OneMailNext.exe'])).toBeUndefined()
  })

  it('decodes percent-encoded recipients in the mailto path', () => {
    expect(parseMailtoUrl('mailto:first%40example.com%2Csecond%40example.com')?.to).toEqual([
      'first@example.com',
      'second@example.com'
    ])
  })

  it('rejects non-mail protocols', () => {
    expect(parseMailtoUrl('https://example.com')).toBeNull()
  })
})
