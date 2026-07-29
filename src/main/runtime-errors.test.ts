import { describe, expect, it } from 'vitest'

import { isRecoverableNetworkRuntimeError } from './runtime-errors'

describe('runtime network errors', () => {
  it.each(['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EPIPE', 'ESOCKET', 'ECONNECTION'])(
    'treats %s as recoverable',
    (code) => {
      const error = Object.assign(new Error('SMTP connection failed'), { code })
      expect(isRecoverableNetworkRuntimeError(error)).toBe(true)
    }
  )

  it('recognizes a wrapped Nodemailer socket error by its message', () => {
    const error = Object.assign(new Error('read ECONNRESET'), { code: 'EUNKNOWN' })
    expect(isRecoverableNetworkRuntimeError(error)).toBe(true)
  })

  it('does not hide unrelated programming errors', () => {
    expect(isRecoverableNetworkRuntimeError(new TypeError('invalid state'))).toBe(false)
  })
})
