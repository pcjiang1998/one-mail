import { describe, expect, it } from 'vitest'

import {
  createAccountSchema,
  defaultAccountFormValues,
  getProviderPreset
} from './account-form-types'

const translateKey = (key: string): string => key

describe('account provider presets', () => {
  it('uses Tencent Exmail IMAP and SMTP endpoints', () => {
    expect(getProviderPreset('qqEnterprise')).toEqual(
      expect.objectContaining({
        providerKey: 'qq_enterprise',
        imapHost: 'imap.exmail.qq.com',
        imapPort: 993,
        smtpHost: 'smtp.exmail.qq.com',
        smtpPort: 465,
        smtpEnabled: true
      })
    )
  })

  it.each([
    ['netease163', '163', 'imap.163.com', 'smtp.163.com', 'pop.163.com'],
    ['netease126', '126', 'imap.126.com', 'smtp.126.com', 'pop.126.com'],
    ['neteaseYeah', 'yeah', 'imap.yeah.net', 'smtp.yeah.net', 'pop.yeah.net']
  ] as const)(
    'uses the correct NetEase endpoints for %s',
    (kind, providerKey, imapHost, smtpHost, popHost) => {
      expect(getProviderPreset(kind)).toEqual(
        expect.objectContaining({
          providerKey,
          imapHost,
          imapPort: 993,
          smtpHost,
          smtpPort: 465,
          popHost,
          popPort: 995
        })
      )
    }
  )

  it('requires an SMTP host only when custom SMTP sending is enabled', () => {
    const schema = createAccountSchema(translateKey)
    const customAccount = {
      ...defaultAccountFormValues,
      kind: 'custom' as const,
      email: 'user@example.com',
      password: 'secret',
      accountLabel: '',
      providerKey: 'custom_imap',
      authType: 'manual' as const,
      imapHost: 'imap.example.com',
      imapPort: 993,
      imapSecurity: 'ssl_tls' as const,
      smtpHost: '',
      smtpPort: 465,
      smtpSecurity: 'ssl_tls' as const,
      smtpEnabled: true
    }

    expect(schema.safeParse(customAccount).success).toBe(false)
    expect(schema.safeParse({ ...customAccount, smtpEnabled: false }).success).toBe(true)
    expect(schema.safeParse({ ...customAccount, smtpHost: 'smtp.example.com' }).success).toBe(true)
  })
})
