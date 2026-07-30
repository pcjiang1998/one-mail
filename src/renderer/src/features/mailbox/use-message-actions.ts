import * as React from 'react'
import { toast } from 'sonner'

import type { Message } from '@renderer/components/mail/types'
import {
  bulkDeleteMessages,
  deleteMessage,
  type BulkDeleteMessagesResult,
  type DeleteMessageResult
} from '@renderer/lib/api'
import { useI18n } from '@renderer/lib/i18n'
import type { MessageDeleteMode } from '../../../../shared/types'
import { getErrorMessage } from './mailbox-utils'
import { getMessageDeleteBehavior } from './message-delete-policy'

type DeleteRequest = {
  messages: Message[]
  mode: MessageDeleteMode
}

type UseMessageActionsInput = {
  removeMessages: (messageIds: string[]) => void
  clearSelection: () => void
  setError: React.Dispatch<React.SetStateAction<string | null>>
  localDeletedOnly: boolean
  onDeleted?: () => Promise<void> | void
}

export function useMessageActions({
  removeMessages,
  clearSelection,
  setError,
  localDeletedOnly,
  onDeleted
}: UseMessageActionsInput): {
  deleteRequest: DeleteRequest | null
  deletingMessageIds: Set<string>
  deleting: boolean
  requestDeleteMessages: (messages: Message[]) => void
  cancelDelete: () => void
  confirmDelete: () => Promise<void>
} {
  const { t } = useI18n()
  const [deleteRequest, setDeleteRequest] = React.useState<DeleteRequest | null>(null)
  const [deletingMessageIds, setDeletingMessageIds] = React.useState<Set<string>>(() => new Set())

  const cancelDelete = React.useCallback((): void => {
    if (deletingMessageIds.size > 0) return
    setDeleteRequest(null)
  }, [deletingMessageIds.size])

  const performDelete = React.useCallback(
    async (messages: Message[], mode: MessageDeleteMode): Promise<void> => {
      if (messages.length === 0 || deletingMessageIds.size > 0) return

      const messageIds = messages.map((message) => message.id)
      setDeletingMessageIds(new Set(messageIds))
      setError(null)

      try {
        if (messages.length === 1) {
          const result = await deleteMessage({ messageId: messages[0].messageId, mode })
          handleSingleDeleteResult(result, t)
          if (result.deleted || result.hidden) {
            removeMessages(messageIds)
            clearSelection()
            setDeleteRequest(null)
            await Promise.resolve(onDeleted?.()).catch(() => undefined)
          }
          return
        }

        const result = await bulkDeleteMessages({
          messageIds: messages.map((message) => message.messageId),
          mode
        })
        handleBulkDeleteResult(result, t)
        if (result.succeededMessageIds.length > 0) {
          const succeededIds = new Set(result.succeededMessageIds.map(String))
          removeMessages(messageIds.filter((messageId) => succeededIds.has(messageId)))
          await Promise.resolve(onDeleted?.()).catch(() => undefined)
        }
        if (result.failedCount === 0) {
          clearSelection()
          setDeleteRequest(null)
        }
      } catch (deleteError) {
        const message = getErrorMessage(deleteError, t('mail.delete.error'))
        setError(message)
        toast.error(message)
      } finally {
        setDeletingMessageIds(new Set())
      }
    },
    [clearSelection, deletingMessageIds.size, onDeleted, removeMessages, setError, t]
  )

  const requestDeleteMessages = React.useCallback(
    (messages: Message[]): void => {
      if (messages.length === 0 || deletingMessageIds.size > 0) return
      const behavior = getMessageDeleteBehavior(messages, localDeletedOnly)
      if (behavior.requiresConfirmation) {
        setDeleteRequest({ messages, mode: behavior.mode })
        return
      }
      void performDelete(messages, behavior.mode)
    },
    [deletingMessageIds.size, localDeletedOnly, performDelete]
  )

  const confirmDelete = React.useCallback(async (): Promise<void> => {
    if (!deleteRequest || deletingMessageIds.size > 0) return
    await performDelete(deleteRequest.messages, deleteRequest.mode)
  }, [deleteRequest, deletingMessageIds.size, performDelete])

  return {
    deleteRequest,
    deletingMessageIds,
    deleting: deletingMessageIds.size > 0,
    requestDeleteMessages,
    cancelDelete,
    confirmDelete
  }
}

function handleSingleDeleteResult(
  result: DeleteMessageResult,
  t: ReturnType<typeof useI18n>['t']
): void {
  if (result.deleted || result.hidden) {
    toast.success(t('mail.delete.successSingle'))
    return
  }

  toast.error(result.error ?? t('mail.delete.error'))
}

function handleBulkDeleteResult(
  result: BulkDeleteMessagesResult,
  t: ReturnType<typeof useI18n>['t']
): void {
  if (result.failedCount === 0) {
    toast.success(t('mail.delete.successBulk', { count: result.deletedCount }))
    return
  }

  const examples = result.failedItems
    .slice(0, 3)
    .map((item) => item.error)
    .join('；')
  toast.error(
    t('mail.delete.partialFailed', {
      deleted: result.deletedCount,
      failed: result.failedCount,
      examples
    })
  )
}
