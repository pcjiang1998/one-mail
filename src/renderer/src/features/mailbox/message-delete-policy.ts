import type { Message } from '@renderer/components/mail/types'
import type { MessageDeleteMode } from '../../../../shared/types'

export type MessageDeleteBehavior = {
  mode: MessageDeleteMode
  requiresConfirmation: boolean
}

export function getMessageDeleteBehavior(
  messages: Message[],
  localDeletedOnly: boolean
): MessageDeleteBehavior {
  if (localDeletedOnly) return { mode: 'permanent', requiresConfirmation: true }

  const roles = new Set(messages.map((message) => message.folderRole))
  if (roles.has('sent') || roles.has('drafts')) {
    return { mode: 'permanent', requiresConfirmation: true }
  }
  if (roles.has('junk')) return { mode: 'permanent', requiresConfirmation: false }

  return { mode: 'local_hide', requiresConfirmation: false }
}
