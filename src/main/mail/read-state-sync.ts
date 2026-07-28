import type {
  MessageBulkReadStateResult,
  MessageListQuery,
  MessageReadStateUpdate
} from '../ipc/types'
import { getAccount } from '../db/repositories/account.repository'
import {
  getMessageReadStateTarget,
  listUnreadMessageIds,
  type MessageReadStateTarget,
  updateMessageReadState
} from '../db/repositories/message.repository'
import { authenticateImapSession } from './imap-auth'
import { SimpleImapSession } from './imap-session'

export async function syncMessageReadState(
  messageId: number,
  isRead: boolean
): Promise<MessageReadStateUpdate> {
  const target = getMessageReadStateTarget(messageId)
  if (!target) {
    throw new Error('邮件不存在或已从远端删除。')
  }

  if (target.isRead === isRead) {
    return {
      messageId,
      accountId: target.accountId,
      folderId: target.folderId,
      isRead
    }
  }

  const account = getAccount(target.accountId)
  if (!account) {
    throw new Error(`Account not found: ${target.accountId}`)
  }

  if (account.receiveProtocol === 'pop3') {
    return updateMessageReadState(messageId, isRead)
  }

  const client = await SimpleImapSession.connect(account, 'R')

  try {
    await authenticateImapSession(account, client)
    await client.selectMailbox(target.folderPath)
    await client.setSeenFlag(target.uid, isRead)
  } finally {
    await client.logout().catch(() => undefined)
  }

  return updateMessageReadState(messageId, isRead)
}

export async function syncMessagesReadState(
  messageIds: number[],
  isRead: boolean
): Promise<MessageBulkReadStateResult> {
  const succeededMessageIds: number[] = []
  const updates: MessageReadStateUpdate[] = []
  const failedItems: MessageBulkReadStateResult['failedItems'] = []
  const targets = uniqueMessageIds(messageIds).map((messageId) => ({
    messageId,
    target: getMessageReadStateTarget(messageId)
  }))
  const groups = groupReadStateTargets(
    targets.filter(hasReadStateTarget).map((item) => item.target)
  )

  for (const { messageId, target } of targets) {
    if (!target) {
      failedItems.push({ messageId, error: '邮件不存在或已从远端删除。' })
    }
  }

  for (const group of groups) {
    const account = getAccount(group.accountId)
    if (!account) {
      for (const target of group.targets) {
        failedItems.push({
          messageId: target.messageId,
          accountId: target.accountId,
          error: `Account not found: ${target.accountId}`
        })
      }
      continue
    }

    if (account.receiveProtocol === 'pop3') {
      for (const target of group.targets) {
        updates.push(updateMessageReadState(target.messageId, isRead))
        succeededMessageIds.push(target.messageId)
      }
      continue
    }

    const client = await SimpleImapSession.connect(account, 'R')

    try {
      await authenticateImapSession(account, client)
      await client.selectMailbox(group.folderPath)

      for (const target of group.targets) {
        try {
          const update =
            target.isRead === isRead
              ? {
                  messageId: target.messageId,
                  accountId: target.accountId,
                  folderId: target.folderId,
                  isRead
                }
              : undefined
          if (target.isRead !== isRead) {
            await client.setSeenFlag(target.uid, isRead)
          }
          updates.push(update ?? updateMessageReadState(target.messageId, isRead))
          succeededMessageIds.push(target.messageId)
        } catch (error) {
          failedItems.push({
            messageId: target.messageId,
            accountId: target.accountId,
            error: getReadStateErrorMessage(error)
          })
        }
      }
    } catch (error) {
      const message = getReadStateErrorMessage(error)
      for (const target of group.targets) {
        failedItems.push({
          messageId: target.messageId,
          accountId: target.accountId,
          error: message
        })
      }
    } finally {
      await client.logout().catch(() => undefined)
    }
  }

  return {
    isRead,
    updates,
    succeededMessageIds,
    failedItems,
    updatedCount: succeededMessageIds.length,
    failedCount: failedItems.length
  }
}

export async function markUnreadMessagesRead(
  query?: MessageListQuery
): Promise<MessageBulkReadStateResult> {
  const messageIds = listUnreadMessageIds(query)
  return syncMessagesReadState(messageIds, true)
}

function groupReadStateTargets(targets: MessageReadStateTarget[]): Array<{
  accountId: number
  folderId: number
  folderPath: string
  targets: MessageReadStateTarget[]
}> {
  const groups = new Map<
    string,
    {
      accountId: number
      folderId: number
      folderPath: string
      targets: MessageReadStateTarget[]
    }
  >()

  for (const target of targets) {
    const key = `${target.accountId}:${target.folderId}`
    const group = groups.get(key) ?? {
      accountId: target.accountId,
      folderId: target.folderId,
      folderPath: target.folderPath,
      targets: []
    }
    group.targets.push(target)
    groups.set(key, group)
  }

  return Array.from(groups.values())
}

function hasReadStateTarget(item: {
  messageId: number
  target: MessageReadStateTarget | null
}): item is { messageId: number; target: MessageReadStateTarget } {
  return item.target !== null
}

function uniqueMessageIds(messageIds: number[]): number[] {
  return Array.from(
    new Set(messageIds.filter((messageId) => Number.isInteger(messageId) && messageId > 0))
  )
}

function getReadStateErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '同步已读状态失败。'
}
