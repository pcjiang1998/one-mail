import { app } from 'electron'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getAccount } from '../db/repositories/account.repository'
import { getMessageComposeSource, getMessageRawSource } from '../db/repositories/message.repository'
import type { ComposeDraft, MailAttachmentInput } from '../ipc/types'
import { authenticateImapSession } from './imap-auth'
import { SimpleImapSession } from './imap-session'

export async function createBulkForwardDraft(messageIds: number[]): Promise<ComposeDraft> {
  const ids = Array.from(new Set(messageIds.filter((id) => Number.isInteger(id) && id > 0)))
  if (ids.length === 0) throw new Error('请选择需要批量转发的邮件。')

  const sources = ids.map((id) => {
    const source = getMessageComposeSource(id)
    if (!source) throw new Error(`邮件不存在：${id}`)
    return source
  })
  const attachments: MailAttachmentInput[] = []

  for (const source of sources) {
    const rawMessage = getMessageRawSource(source.messageId) ?? (await fetchRawMessage(source))
    const filename = createEmlFilename(source.subject, source.messageId)
    const directory = join(app.getPath('temp'), 'one-mail-next', 'forwarded-mail')
    mkdirSync(directory, { recursive: true })
    const filePath = join(directory, filename)
    writeFileSync(filePath, rawMessage, 'utf8')
    attachments.push({
      filePath,
      filename,
      mimeType: 'message/rfc822',
      sizeBytes: Buffer.byteLength(rawMessage, 'utf8')
    })
  }

  return {
    accountId: sources[0].accountId,
    mode: 'forward',
    to: [],
    cc: [],
    bcc: [],
    subject: `Fwd: ${sources.length} messages`,
    bodyText: `Forwarded messages (${sources.length}) are attached as original .eml files.`,
    attachments
  }
}

async function fetchRawMessage(
  source: NonNullable<ReturnType<typeof getMessageComposeSource>>
): Promise<string> {
  const account = getAccount(source.accountId)
  if (!account) throw new Error(`Account not found: ${source.accountId}`)
  if (account.receiveProtocol === 'pop3') {
    throw new Error('POP3 原始邮件缓存不存在，请先重新同步该邮件。')
  }

  const session = await SimpleImapSession.connect(account, 'B')
  try {
    await authenticateImapSession(account, session)
    await session.selectMailbox(source.folderPath)
    return await session.fetchRawMessage(source.uid)
  } finally {
    await session.logout().catch(() => undefined)
  }
}

function createEmlFilename(subject: string | undefined, messageId: number): string {
  const safeSubject = Array.from(subject || 'message', (character) => {
    const code = character.charCodeAt(0)
    return code <= 0x1f || '<>:"/\\|?*'.includes(character) ? '_' : character
  })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  return `${safeSubject || 'message'}-${messageId}.eml`
}
