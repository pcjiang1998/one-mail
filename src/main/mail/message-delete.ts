import { getAccount } from '../db/repositories/account.repository'
import {
  getMessageDeleteTarget,
  markMessageDeleteError,
  markMessageRemoteDeleted,
  restoreMessageLocally,
  markMessageUserHidden,
  type MessageDeleteTarget
} from '../db/repositories/message.repository'
import { authenticateImapSession } from './imap-auth'
import { SimpleImapSession } from './imap-session'
import { detectSpecialFolderRole, findFolderByRole } from './special-folders'

export type MessageDeleteResult = {
  messageId: number
  accountId: number
  folderId: number
  action: 'trash' | 'permanent_delete' | 'local_hide' | 'restore'
  localOnly?: boolean
}

export type BulkDeleteOptions = {
  localOnly?: boolean
  permanent?: boolean
}

export type BulkDeleteFailure = {
  messageId: number
  error: string
}

export type BulkDeleteResult = {
  succeededMessageIds: number[]
  failedItems: BulkDeleteFailure[]
  deletedCount: number
  failedCount: number
}

export async function permanentlyDeleteMessage(messageId: number): Promise<MessageDeleteResult> {
  const target = requireDeleteTarget(messageId)

  const account = getAccount(target.accountId)
  if (!account) throw new Error(`Account not found: ${target.accountId}`)

  if (account.receiveProtocol === 'pop3') {
    markMessageRemoteDeleted(messageId)
    return {
      messageId,
      accountId: target.accountId,
      folderId: target.folderId,
      action: 'permanent_delete',
      localOnly: true
    }
  }

  const client = await SimpleImapSession.connect(account, 'P')

  try {
    await authenticateImapSession(account, client)
    const location = await resolvePermanentDeleteLocation(client, target)
    await client.selectMailbox(location.folderPath)
    for (const uid of location.uids) {
      await client.setDeletedFlag(uid, true)
    }
    await client.expunge()
    markMessageRemoteDeleted(messageId)

    return {
      messageId,
      accountId: target.accountId,
      folderId: target.folderId,
      action: 'permanent_delete'
    }
  } catch (error) {
    markMessageDeleteError(messageId, getErrorMessage(error))
    throw error
  } finally {
    await client.logout().catch(() => undefined)
  }
}

export async function deleteMessageToTrash(messageId: number): Promise<MessageDeleteResult> {
  const target = requireDeleteTarget(messageId)

  if (requiresPermanentRemoteDelete(target)) {
    return permanentlyDeleteMessage(messageId)
  }

  return hideMessageLocally(messageId)
}

async function resolvePermanentDeleteLocation(
  client: SimpleImapSession,
  target: MessageDeleteTarget
): Promise<{ folderPath: string; uids: number[] }> {
  if (!target.userDeleted || isTrashTarget(target)) {
    return { folderPath: target.folderPath, uids: [target.uid] }
  }

  const trash = findFolderByRole(target.accountId, 'trash')
  if (!trash || !target.rfc822MessageId) {
    throw new Error('无法定位远端已删除邮件，请先同步该邮箱后重试。')
  }

  await client.selectMailbox(trash.path)
  const uids = await client.searchByMessageId(target.rfc822MessageId)
  if (uids.length === 0) throw new Error('远端已删除邮件不存在，请同步该邮箱后重试。')
  return { folderPath: trash.path, uids }
}

export function hideMessageLocally(messageId: number): MessageDeleteResult {
  const target = requireDeleteTarget(messageId)
  markMessageUserHidden(messageId)

  return {
    messageId,
    accountId: target.accountId,
    folderId: target.folderId,
    action: 'local_hide'
  }
}

export async function restoreMessage(messageId: number): Promise<MessageDeleteResult> {
  const target = requireRestoreTarget(messageId)

  if (target.userHidden && !target.userDeleted) {
    restoreMessageLocally(messageId)
    return {
      messageId,
      accountId: target.accountId,
      folderId: target.folderId,
      action: 'restore',
      localOnly: true
    }
  }

  if (!isTrashTarget(target)) {
    restoreMessageLocally(messageId)
    return {
      messageId,
      accountId: target.accountId,
      folderId: target.folderId,
      action: 'restore',
      localOnly: true
    }
  }

  const inbox = findFolderByRole(target.accountId, 'inbox')
  if (!inbox) throw new Error('未找到该账号的收件箱，无法恢复邮件。')

  const account = getAccount(target.accountId)
  if (!account) throw new Error(`Account not found: ${target.accountId}`)

  if (account.receiveProtocol === 'pop3') {
    restoreMessageLocally(messageId)
    return {
      messageId,
      accountId: target.accountId,
      folderId: target.folderId,
      action: 'restore',
      localOnly: true
    }
  }

  const client = await SimpleImapSession.connect(account, 'R')

  try {
    await authenticateImapSession(account, client)
    const capabilities = await client.capability().catch(() => new Set<string>())
    await client.selectMailbox(target.folderPath)

    if (capabilities.has('MOVE')) {
      await client.uidMove(target.uid, inbox.path)
    } else {
      await client.uidCopy(target.uid, inbox.path)
      await client.setDeletedFlag(target.uid, true)
      await client.expunge()
    }

    restoreMessageLocally(messageId)
    return {
      messageId,
      accountId: target.accountId,
      folderId: target.folderId,
      action: 'restore',
      localOnly: false
    }
  } catch (error) {
    markMessageDeleteError(messageId, getErrorMessage(error))
    throw error
  } finally {
    await client.logout().catch(() => undefined)
  }
}

export async function bulkDelete(
  messageIds: number[],
  options: BulkDeleteOptions = {}
): Promise<BulkDeleteResult> {
  const succeededMessageIds: number[] = []
  const failedItems: BulkDeleteFailure[] = []

  for (const messageId of uniqueMessageIds(messageIds)) {
    try {
      if (options.localOnly) hideMessageLocally(messageId)
      else if (options.permanent) await permanentlyDeleteMessage(messageId)
      else await deleteMessageToTrash(messageId)
      succeededMessageIds.push(messageId)
    } catch (error) {
      failedItems.push({ messageId, error: getErrorMessage(error) })
    }
  }

  return toBulkResult(succeededMessageIds, failedItems)
}

function requireDeleteTarget(messageId: number): MessageDeleteTarget {
  const target = getMessageDeleteTarget(messageId)
  if (!target) throw new Error('邮件不存在。')
  if (target.remoteDeleted) throw new Error('邮件已从远端删除。')
  return target
}

function requireRestoreTarget(messageId: number): MessageDeleteTarget {
  const target = getMessageDeleteTarget(messageId)
  if (!target) throw new Error('邮件不存在。')
  if (target.remoteDeleted) throw new Error('邮件已从远端删除，无法恢复。')
  return target
}

function isTrashTarget(target: MessageDeleteTarget): boolean {
  return target.folderRole === 'trash' || detectSpecialFolderRole(target.folderPath) === 'trash'
}

function requiresPermanentRemoteDelete(target: MessageDeleteTarget): boolean {
  if (target.userHidden) return true
  const role = detectSpecialFolderRole(target.folderPath) ?? target.folderRole
  return role === 'sent' || role === 'drafts' || role === 'junk'
}

function uniqueMessageIds(messageIds: number[]): number[] {
  return Array.from(
    new Set(messageIds.filter((messageId) => Number.isInteger(messageId) && messageId > 0))
  )
}

function toBulkResult(
  succeededMessageIds: number[],
  failedItems: BulkDeleteFailure[]
): BulkDeleteResult {
  return {
    succeededMessageIds,
    failedItems,
    deletedCount: succeededMessageIds.length,
    failedCount: failedItems.length
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '删除邮件失败。'
}
