import {
  getDatabase,
  toBoolean,
  toNullableParam,
  toNumber,
  toOptionalString,
  type SqliteRow
} from '../connection'
import type {
  AccountCreateInput,
  AccountMailFolder,
  AccountUpdateInput,
  MailAccount
} from '../../ipc/types'

type AccountRow = SqliteRow & {
  account_id: number
  provider_key: string
  email: string
  display_name: string | null
  account_label: string | null
  auth_type: MailAccount['authType']
  receive_protocol: MailAccount['receiveProtocol']
  imap_host: string
  imap_port: number
  imap_security: MailAccount['imapSecurity']
  smtp_host: string | null
  smtp_port: number | null
  smtp_security: MailAccount['smtpSecurity'] | null
  smtp_auth_type: MailAccount['smtpAuthType'] | null
  smtp_enabled: number
  pop_host: string | null
  pop_port: number | null
  pop_security: MailAccount['popSecurity'] | null
  idle_supported: number | null
  proxy_mode: MailAccount['proxyMode']
  custom_proxy_url: string | null
  signature_mode: MailAccount['signatureMode']
  signature_id: number | null
  account_sync_mode: MailAccount['syncMode']
  sync_interval_minutes: number
  sync_enabled: number
  remote_delete_policy: MailAccount['remoteDeletePolicy']
  credential_state: MailAccount['credentialState']
  status: MailAccount['status']
  last_sync_at: string | null
  last_error: string | null
}

export function listAccounts(): MailAccount[] {
  const rows = getDatabase()
    .prepare<AccountRow>(
      `
      SELECT
        account_id,
        provider_key,
        email,
        display_name,
        account_label,
        auth_type,
        receive_protocol,
        imap_host,
        imap_port,
        imap_security,
        smtp_host,
        smtp_port,
        smtp_security,
        smtp_auth_type,
        smtp_enabled,
        pop_host,
        pop_port,
        pop_security,
        idle_supported,
        proxy_mode,
        custom_proxy_url,
        signature_mode,
        signature_id,
        account_sync_mode,
        sync_interval_minutes,
        sync_enabled,
        remote_delete_policy,
        CASE
          WHEN encrypted_password IS NOT NULL THEN 'stored'
          WHEN auth_type = 'oauth2' AND EXISTS (
            SELECT 1 FROM onemail_oauth_tokens t WHERE t.account_id = onemail_mail_accounts.account_id
          ) THEN 'stored'
          ELSE credential_state
        END AS credential_state,
        status,
        last_sync_at,
        last_error
      FROM onemail_mail_accounts
      ORDER BY sort_order ASC, account_id ASC
      `
    )
    .all()

  return rows.map(mapAccountRow)
}

export function getAccount(accountId: number): MailAccount | null {
  const row = getDatabase()
    .prepare<AccountRow>(
      `
      SELECT
        account_id,
        provider_key,
        email,
        display_name,
        account_label,
        auth_type,
        receive_protocol,
        imap_host,
        imap_port,
        imap_security,
        smtp_host,
        smtp_port,
        smtp_security,
        smtp_auth_type,
        smtp_enabled,
        pop_host,
        pop_port,
        pop_security,
        idle_supported,
        proxy_mode,
        custom_proxy_url,
        signature_mode,
        signature_id,
        account_sync_mode,
        sync_interval_minutes,
        sync_enabled,
        remote_delete_policy,
        CASE
          WHEN encrypted_password IS NOT NULL THEN 'stored'
          WHEN auth_type = 'oauth2' AND EXISTS (
            SELECT 1 FROM onemail_oauth_tokens t WHERE t.account_id = onemail_mail_accounts.account_id
          ) THEN 'stored'
          ELSE credential_state
        END AS credential_state,
        status,
        last_sync_at,
        last_error
      FROM onemail_mail_accounts
      WHERE account_id = :accountId
      `
    )
    .get({ accountId })

  return row ? mapAccountRow(row) : null
}

export function createAccount(input: AccountCreateInput): MailAccount {
  if (!input.email?.trim()) {
    throw new Error('邮箱地址不能为空。')
  }

  const normalizedEmail = input.email.trim().toLowerCase()
  const accountLabel = input.accountLabel?.trim() || normalizedEmail
  const smtpSettings = resolveSmtpSettings(input, normalizedEmail)
  const receiveProtocol = input.receiveProtocol ?? 'imap'
  const proxyMode = input.proxyMode ?? 'global'
  const customProxyUrl = proxyMode === 'custom' ? requireProxyUrl(input.customProxyUrl) : undefined
  const signatureMode = input.signatureMode ?? 'global'
  const signatureId = resolveSignatureId(signatureMode, input.signatureId)
  const accountSyncMode = normalizeCreatedSyncMode(receiveProtocol, input.syncMode)
  const syncIntervalMinutes = validateSyncInterval(input.accountSyncIntervalMinutes ?? 15)
  const db = getDatabase()

  db.prepare(
    `
    INSERT OR IGNORE INTO onemail_provider_presets (
      provider_key,
      display_name,
      domains_json,
      auth_type,
      imap_host,
      imap_port,
      imap_security,
      smtp_host,
      smtp_port,
      smtp_security,
      smtp_auth_type,
      smtp_requires_auth,
      is_builtin,
      is_active
    )
    VALUES (
      :providerKey,
      :displayName,
      '[]',
      :authType,
      :imapHost,
      :imapPort,
      :imapSecurity,
      :smtpHost,
      :smtpPort,
      :smtpSecurity,
      :smtpAuthType,
      1,
      0,
      1
    )
    `
  ).run({
    providerKey: input.providerKey,
    displayName: input.providerKey,
    authType: input.authType,
    imapHost: input.imapHost,
    imapPort: input.imapPort,
    imapSecurity: input.imapSecurity,
    smtpHost: toNullableParam(smtpSettings.smtpHost),
    smtpPort: toNullableParam(smtpSettings.smtpPort),
    smtpSecurity: toNullableParam(smtpSettings.smtpSecurity),
    smtpAuthType: toNullableParam(smtpSettings.smtpAuthType)
  })

  db.prepare(
    `
    UPDATE onemail_provider_presets
    SET
      smtp_host = :smtpHost,
      smtp_port = :smtpPort,
      smtp_security = :smtpSecurity,
      smtp_auth_type = :smtpAuthType,
      smtp_requires_auth = 1,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE provider_key = :providerKey
    `
  ).run({
    providerKey: input.providerKey,
    smtpHost: toNullableParam(smtpSettings.smtpHost),
    smtpPort: toNullableParam(smtpSettings.smtpPort),
    smtpSecurity: toNullableParam(smtpSettings.smtpSecurity),
    smtpAuthType: toNullableParam(smtpSettings.smtpAuthType)
  })

  const result = db
    .prepare(
      `
      INSERT INTO onemail_mail_accounts (
        provider_key,
        email,
        normalized_email,
        display_name,
        account_label,
        avatar_text,
        auth_type,
        receive_protocol,
        imap_host,
        imap_port,
        imap_security,
        smtp_host,
        smtp_port,
        smtp_security,
        smtp_auth_type,
        smtp_enabled,
        pop_host,
        pop_port,
        pop_security,
        proxy_mode,
        custom_proxy_url,
        signature_mode,
        signature_id,
        account_sync_mode,
        sync_interval_minutes,
        remote_delete_policy,
        credential_state,
        status
      )
      VALUES (
        :providerKey,
        :email,
        :normalizedEmail,
        :displayName,
        :accountLabel,
        :avatarText,
        :authType,
        :receiveProtocol,
        :imapHost,
        :imapPort,
        :imapSecurity,
        :smtpHost,
        :smtpPort,
        :smtpSecurity,
        :smtpAuthType,
        :smtpEnabled,
        :popHost,
        :popPort,
        :popSecurity,
        :proxyMode,
        :customProxyUrl,
        :signatureMode,
        :signatureId,
        :accountSyncMode,
        :syncIntervalMinutes,
        :remoteDeletePolicy,
        'pending',
        'active'
      )
      `
    )
    .run({
      providerKey: input.providerKey,
      email: input.email,
      normalizedEmail,
      displayName: null,
      accountLabel,
      avatarText: normalizedEmail.slice(0, 1).toUpperCase(),
      authType: input.authType,
      receiveProtocol,
      imapHost: input.imapHost,
      imapPort: input.imapPort,
      imapSecurity: input.imapSecurity,
      smtpHost: toNullableParam(smtpSettings.smtpHost),
      smtpPort: toNullableParam(smtpSettings.smtpPort),
      smtpSecurity: toNullableParam(smtpSettings.smtpSecurity),
      smtpAuthType: toNullableParam(smtpSettings.smtpAuthType),
      smtpEnabled: smtpSettings.smtpEnabled ? 1 : 0,
      popHost: toNullableParam(input.popHost),
      popPort: toNullableParam(input.popPort),
      popSecurity: toNullableParam(input.popSecurity),
      proxyMode,
      customProxyUrl: toNullableParam(customProxyUrl),
      signatureMode,
      signatureId: toNullableParam(signatureId),
      accountSyncMode,
      syncIntervalMinutes,
      remoteDeletePolicy: input.remoteDeletePolicy ?? 'inherit'
    })

  const account = getAccount(Number(result.lastInsertRowid))
  if (!account) {
    throw new Error('Account insert did not return a row.')
  }

  return account
}

export function updateAccount(input: AccountUpdateInput): MailAccount {
  const current = getAccount(input.accountId)
  if (!current) {
    throw new Error(`Account not found: ${input.accountId}`)
  }

  const proxyMode = input.proxyMode ?? current.proxyMode
  const customProxyUrl =
    proxyMode === 'custom'
      ? requireProxyUrl(input.customProxyUrl ?? current.customProxyUrl)
      : undefined
  const signatureMode = input.signatureMode ?? current.signatureMode
  const signatureId = resolveSignatureId(
    signatureMode,
    input.signatureId ?? (current.signatureMode === 'custom' ? current.signatureId : undefined)
  )
  const accountSyncMode = input.syncMode ?? current.syncMode
  if (
    current.receiveProtocol === 'pop3' &&
    input.syncMode !== undefined &&
    (accountSyncMode === 'global' || accountSyncMode === 'idle')
  ) {
    throw new Error('POP3 账号只能使用回退、间隔或手动同步。')
  }
  if (
    current.idleSupported === false &&
    input.syncMode !== undefined &&
    (accountSyncMode === 'global' || accountSyncMode === 'idle')
  ) {
    throw new Error('此账号不支持 IMAP IDLE，请使用回退、间隔或手动同步。')
  }
  const syncIntervalMinutes = validateSyncInterval(
    input.accountSyncIntervalMinutes ?? current.accountSyncIntervalMinutes
  )

  getDatabase()
    .prepare(
      `
      UPDATE onemail_mail_accounts
      SET
        provider_key = :providerKey,
        display_name = :displayName,
        account_label = :accountLabel,
        auth_type = :authType,
        receive_protocol = :receiveProtocol,
        imap_host = :imapHost,
        imap_port = :imapPort,
        imap_security = :imapSecurity,
        smtp_host = :smtpHost,
        smtp_port = :smtpPort,
        smtp_security = :smtpSecurity,
        smtp_auth_type = :smtpAuthType,
        smtp_enabled = :smtpEnabled,
        pop_host = :popHost,
        pop_port = :popPort,
        pop_security = :popSecurity,
        proxy_mode = :proxyMode,
        custom_proxy_url = :customProxyUrl,
        signature_mode = :signatureMode,
        signature_id = :signatureId,
        account_sync_mode = :accountSyncMode,
        sync_interval_minutes = :syncIntervalMinutes,
        sync_enabled = :syncEnabled,
        remote_delete_policy = :remoteDeletePolicy,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE account_id = :accountId
      `
    )
    .run({
      accountId: input.accountId,
      providerKey: input.providerKey ?? current.providerKey,
      displayName: toNullableParam(input.displayName ?? current.displayName),
      accountLabel:
        input.accountLabel === undefined
          ? (current.accountLabel ?? current.email)
          : input.accountLabel.trim() || current.email,
      authType: input.authType ?? current.authType,
      receiveProtocol: input.receiveProtocol ?? current.receiveProtocol,
      imapHost: input.imapHost ?? current.imapHost,
      imapPort: input.imapPort ?? current.imapPort,
      imapSecurity: input.imapSecurity ?? current.imapSecurity,
      smtpHost: toNullableParam(input.smtpHost ?? current.smtpHost),
      smtpPort: toNullableParam(input.smtpPort ?? current.smtpPort),
      smtpSecurity: toNullableParam(input.smtpSecurity ?? current.smtpSecurity),
      smtpAuthType: toNullableParam(input.smtpAuthType ?? current.smtpAuthType),
      smtpEnabled: (input.smtpEnabled ?? current.smtpEnabled) ? 1 : 0,
      popHost: toNullableParam(input.popHost ?? current.popHost),
      popPort: toNullableParam(input.popPort ?? current.popPort),
      popSecurity: toNullableParam(input.popSecurity ?? current.popSecurity),
      proxyMode,
      customProxyUrl: toNullableParam(customProxyUrl),
      signatureMode,
      signatureId: toNullableParam(signatureId),
      accountSyncMode,
      syncIntervalMinutes,
      syncEnabled: (input.syncEnabled ?? current.syncEnabled) ? 1 : 0,
      remoteDeletePolicy: input.remoteDeletePolicy ?? current.remoteDeletePolicy
    })

  const updated = getAccount(input.accountId)
  if (!updated) {
    throw new Error(`Account not found after update: ${input.accountId}`)
  }

  return updated
}

export function disableAccount(accountId: number): MailAccount {
  getDatabase()
    .prepare(
      `
      UPDATE onemail_mail_accounts
      SET
        sync_enabled = 0,
        status = 'disabled',
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE account_id = :accountId
      `
    )
    .run({ accountId })

  const updated = getAccount(accountId)
  if (!updated) {
    throw new Error(`Account not found: ${accountId}`)
  }

  return updated
}

export function updateAccountIdleSupport(accountId: number, supported: boolean): void {
  getDatabase()
    .prepare(
      `UPDATE onemail_mail_accounts
       SET idle_supported = :supported,
           account_sync_mode = CASE
             WHEN :supported = 0 AND account_sync_mode IN ('global', 'idle') THEN 'fallback'
             ELSE account_sync_mode
           END,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE account_id = :accountId`
    )
    .run({ accountId, supported: supported ? 1 : 0 })
}

export function markAccountAuthError(accountId: number, message: string): void {
  getDatabase()
    .prepare(
      `
      UPDATE onemail_mail_accounts
      SET
        status = 'auth_error',
        credential_state = 'invalid',
        last_error = :message,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE account_id = :accountId
      `
    )
    .run({ accountId, message })
}

export function removeAccount(accountId: number): boolean {
  const result = getDatabase()
    .prepare('DELETE FROM onemail_mail_accounts WHERE account_id = :accountId')
    .run({ accountId })

  return result.changes > 0
}

function mapAccountRow(row: AccountRow): MailAccount {
  return {
    accountId: toNumber(row.account_id),
    providerKey: row.provider_key,
    email: row.email,
    displayName: toOptionalString(row.display_name),
    accountLabel: toOptionalString(row.account_label),
    authType: row.auth_type,
    receiveProtocol: row.receive_protocol,
    imapHost: row.imap_host,
    imapPort: toNumber(row.imap_port),
    imapSecurity: row.imap_security,
    smtpHost: toOptionalString(row.smtp_host),
    smtpPort: row.smtp_port === null ? undefined : toNumber(row.smtp_port),
    smtpSecurity: row.smtp_security ?? undefined,
    smtpAuthType: row.smtp_auth_type ?? undefined,
    smtpEnabled: toBoolean(row.smtp_enabled),
    popHost: toOptionalString(row.pop_host),
    popPort: row.pop_port === null ? undefined : toNumber(row.pop_port),
    popSecurity: row.pop_security ?? undefined,
    idleSupported: row.idle_supported === null ? undefined : toBoolean(row.idle_supported),
    proxyMode: row.proxy_mode,
    customProxyUrl: toOptionalString(row.custom_proxy_url),
    signatureMode: row.signature_mode,
    signatureId: row.signature_id === null ? undefined : toNumber(row.signature_id),
    syncMode: row.account_sync_mode,
    accountSyncIntervalMinutes: toNumber(row.sync_interval_minutes),
    syncEnabled: toBoolean(row.sync_enabled),
    credentialState: row.credential_state,
    status: row.status,
    lastSyncAt: toOptionalString(row.last_sync_at),
    lastError: toOptionalString(row.last_error),
    remoteDeletePolicy: row.remote_delete_policy,
    folders: listStoredFolders(toNumber(row.account_id))
  }
}

function normalizeProxyUrl(value?: string): string | undefined {
  const proxyUrl = value?.trim()
  if (!proxyUrl) return undefined
  const parsed = new URL(proxyUrl)
  if (parsed.protocol !== 'socks5:') {
    throw new Error('自定义代理仅支持 socks5:// 地址。')
  }
  if (!parsed.hostname || !parsed.port) throw new Error('SOCKS5 代理地址缺少主机或端口。')
  return parsed.toString()
}

function requireProxyUrl(value?: string): string {
  const proxyUrl = normalizeProxyUrl(value)
  if (!proxyUrl) throw new Error('请输入 SOCKS5 代理地址。')
  return proxyUrl
}

function resolveSignatureId(
  mode: MailAccount['signatureMode'],
  signatureId?: number
): number | undefined {
  if (mode !== 'custom') return undefined
  const normalizedId = Number(signatureId)
  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    throw new Error('请选择有效的邮件签名。')
  }
  const exists = getDatabase()
    .prepare('SELECT 1 FROM onemail_mail_signatures WHERE signature_id = :signatureId')
    .get({ signatureId: normalizedId })
  if (!exists) throw new Error('选择的邮件签名不存在。')
  return normalizedId
}

function normalizeCreatedSyncMode(
  receiveProtocol: MailAccount['receiveProtocol'],
  mode: MailAccount['syncMode'] | undefined
): MailAccount['syncMode'] {
  const value = mode ?? (receiveProtocol === 'pop3' ? 'fallback' : 'global')
  return receiveProtocol === 'pop3' && (value === 'global' || value === 'idle') ? 'fallback' : value
}

function validateSyncInterval(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 1440) {
    throw new Error('同步间隔必须是 1 到 1440 之间的整数。')
  }
  return value
}

function listStoredFolders(accountId: number): AccountMailFolder[] {
  return getDatabase()
    .prepare<
      SqliteRow & {
        folder_id: number
        path: string
        name: string
        delimiter: string | null
        role: AccountMailFolder['role']
        attributes_json: string
        is_selectable: number
        sync_enabled: number
        total_count: number
        unread_count: number
      }
    >(
      `
      SELECT folder_id, path, name, delimiter, role, attributes_json,
             is_selectable, sync_enabled, total_count, unread_count
      FROM onemail_mail_folders
      WHERE account_id = :accountId AND sync_enabled = 1
      ORDER BY sort_order ASC, folder_id ASC
      `
    )
    .all({ accountId })
    .map((row) => ({
      folderId: toNumber(row.folder_id),
      path: row.path,
      name: row.name,
      delimiter: toOptionalString(row.delimiter),
      role: row.role,
      attributes: parseStringArray(row.attributes_json),
      selectable: toBoolean(row.is_selectable),
      selected: toBoolean(row.sync_enabled),
      totalCount: toNumber(row.total_count),
      unreadCount: toNumber(row.unread_count)
    }))
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

type SmtpSettings = {
  smtpHost?: string
  smtpPort?: number
  smtpSecurity?: MailAccount['smtpSecurity']
  smtpAuthType?: MailAccount['smtpAuthType']
  smtpEnabled: boolean
}

function resolveSmtpSettings(input: AccountCreateInput, normalizedEmail: string): SmtpSettings {
  const preset = getProviderSmtpPreset(input.providerKey, normalizedEmail, input.authType)

  return {
    smtpHost: input.smtpHost ?? preset.smtpHost,
    smtpPort: input.smtpPort ?? preset.smtpPort,
    smtpSecurity: input.smtpSecurity ?? preset.smtpSecurity,
    smtpAuthType: input.smtpAuthType ?? preset.smtpAuthType ?? input.authType,
    smtpEnabled: input.smtpEnabled ?? preset.smtpEnabled
  }
}

function getProviderSmtpPreset(
  providerKey: string,
  normalizedEmail: string,
  authType: MailAccount['authType']
): SmtpSettings {
  const normalizedProviderKey = providerKey.toLowerCase()
  const domain = normalizedEmail.split('@').at(1) ?? ''

  if (normalizedProviderKey.includes('gmail') || domain === 'gmail.com') {
    return {
      smtpHost: 'smtp.gmail.com',
      smtpPort: 465,
      smtpSecurity: 'ssl_tls',
      smtpAuthType: authType,
      smtpEnabled: true
    }
  }

  if (normalizedProviderKey.includes('yahoo') || domain === 'yahoo.com') {
    return {
      smtpHost: 'smtp.mail.yahoo.com',
      smtpPort: 465,
      smtpSecurity: 'ssl_tls',
      smtpAuthType: authType,
      smtpEnabled: true
    }
  }

  if (normalizedProviderKey === 'aliyun' || domain === 'aliyun.com') {
    return {
      smtpHost: 'smtp.aliyun.com',
      smtpPort: 465,
      smtpSecurity: 'ssl_tls',
      smtpAuthType: authType,
      smtpEnabled: true
    }
  }

  if (
    normalizedProviderKey.includes('aliyun_enterprise') ||
    normalizedProviderKey.includes('alibaba')
  ) {
    return {
      smtpHost: 'smtp.qiye.aliyun.com',
      smtpPort: 465,
      smtpSecurity: 'ssl_tls',
      smtpAuthType: authType,
      smtpEnabled: true
    }
  }

  if (normalizedProviderKey.includes('189') || domain === '189.cn') {
    return {
      smtpHost: 'smtp.189.cn',
      smtpPort: 465,
      smtpSecurity: 'ssl_tls',
      smtpAuthType: authType,
      smtpEnabled: true
    }
  }

  if (normalizedProviderKey.includes('sohu') || domain === 'sohu.com') {
    return {
      smtpHost: 'smtp.sohu.com',
      smtpPort: 465,
      smtpSecurity: 'ssl_tls',
      smtpAuthType: authType,
      smtpEnabled: true
    }
  }

  if (normalizedProviderKey.includes('qq_enterprise') || normalizedProviderKey.includes('exmail')) {
    return {
      smtpHost: 'smtp.exmail.qq.com',
      smtpPort: 465,
      smtpSecurity: 'ssl_tls',
      smtpAuthType: authType,
      smtpEnabled: true
    }
  }

  if (normalizedProviderKey.includes('qq') || domain === 'qq.com' || domain === 'foxmail.com') {
    return {
      smtpHost: 'smtp.qq.com',
      smtpPort: 465,
      smtpSecurity: 'ssl_tls',
      smtpAuthType: authType,
      smtpEnabled: true
    }
  }

  if (
    normalizedProviderKey.includes('163') ||
    normalizedProviderKey.includes('netease') ||
    domain === '163.com' ||
    domain === '126.com' ||
    domain === 'yeah.net'
  ) {
    return {
      smtpHost: 'smtp.163.com',
      smtpPort: 465,
      smtpSecurity: 'ssl_tls',
      smtpAuthType: authType,
      smtpEnabled: true
    }
  }

  if (normalizedProviderKey.includes('sina') || domain === 'sina.com' || domain === 'sina.cn') {
    return {
      smtpHost: 'smtp.sina.com',
      smtpPort: 465,
      smtpSecurity: 'ssl_tls',
      smtpAuthType: authType,
      smtpEnabled: true
    }
  }

  if (normalizedProviderKey.includes('139') || domain === '139.com') {
    return {
      smtpHost: 'smtp.139.com',
      smtpPort: 465,
      smtpSecurity: 'ssl_tls',
      smtpAuthType: authType,
      smtpEnabled: true
    }
  }

  if (normalizedProviderKey.includes('21cn') || domain === '21cn.com') {
    return {
      smtpHost: 'smtp.21cn.com',
      smtpPort: 465,
      smtpSecurity: 'ssl_tls',
      smtpAuthType: authType,
      smtpEnabled: true
    }
  }

  if (
    normalizedProviderKey.includes('perfect') ||
    domain === '88.com' ||
    domain === '111.com' ||
    domain === 'email.cn'
  ) {
    return {
      smtpHost: `smtp.${domain === '111.com' || domain === 'email.cn' ? domain : '88.com'}`,
      smtpPort: 465,
      smtpSecurity: 'ssl_tls',
      smtpAuthType: authType,
      smtpEnabled: true
    }
  }

  if (
    normalizedProviderKey.includes('icloud') ||
    domain === 'icloud.com' ||
    domain === 'me.com' ||
    domain === 'mac.com'
  ) {
    return {
      smtpHost: 'smtp.mail.me.com',
      smtpPort: 587,
      smtpSecurity: 'starttls',
      smtpAuthType: authType,
      smtpEnabled: true
    }
  }

  if (normalizedProviderKey.includes('aol') || domain === 'aol.com') {
    return {
      smtpHost: 'smtp.aol.com',
      smtpPort: 465,
      smtpSecurity: 'ssl_tls',
      smtpAuthType: authType,
      smtpEnabled: true
    }
  }

  if (normalizedProviderKey.includes('yandex') || domain === 'yandex.com') {
    return {
      smtpHost: 'smtp.yandex.com',
      smtpPort: 465,
      smtpSecurity: 'ssl_tls',
      smtpAuthType: authType,
      smtpEnabled: true
    }
  }

  if (normalizedProviderKey.includes('mailru') || domain === 'mail.ru') {
    return {
      smtpHost: 'smtp.mail.ru',
      smtpPort: 465,
      smtpSecurity: 'ssl_tls',
      smtpAuthType: authType,
      smtpEnabled: true
    }
  }

  if (
    normalizedProviderKey.includes('outlook') ||
    normalizedProviderKey.includes('microsoft') ||
    domain === 'outlook.com' ||
    domain === 'hotmail.com' ||
    domain === 'live.com'
  ) {
    return {
      smtpHost: 'smtp.office365.com',
      smtpPort: 587,
      smtpSecurity: 'starttls',
      smtpAuthType: 'oauth2',
      smtpEnabled: true
    }
  }

  return {
    smtpHost: undefined,
    smtpPort: undefined,
    smtpSecurity: undefined,
    smtpAuthType: authType,
    smtpEnabled: true
  }
}
