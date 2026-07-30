import { describe, expect, it } from 'vitest'

import type { Message } from '@renderer/components/mail/types'
import { getMessageDeleteBehavior } from './message-delete-policy'

describe('message delete policy', () => {
  it.each([
    ['inbox', false, 'local_hide', false],
    ['archive', false, 'local_hide', false],
    ['trash', false, 'local_hide', false],
    ['sent', false, 'permanent', true],
    ['drafts', false, 'permanent', true],
    ['junk', false, 'permanent', false]
  ] as const)('maps %s to %s', (folderRole, localDeletedOnly, mode, requiresConfirmation) => {
    expect(getMessageDeleteBehavior([createMessage(folderRole)], localDeletedOnly)).toEqual({
      mode,
      requiresConfirmation
    })
  })

  it('requires confirmation before permanently deleting from local Deleted', () => {
    expect(getMessageDeleteBehavior([createMessage('inbox')], true)).toEqual({
      mode: 'permanent',
      requiresConfirmation: true
    })
  })
})

function createMessage(folderRole: Message['folderRole']): Message {
  return {
    id: '1',
    messageId: 1,
    accountId: 1,
    folderId: 1,
    folderRole,
    from: 'sender@example.com',
    subject: 'Subject',
    preview: '',
    body: [],
    bodyStatus: 'none',
    bodyLoaded: false,
    detailLoaded: false,
    time: '12:00',
    dateLabel: 'Today',
    unread: true,
    starred: false,
    attachments: []
  }
}
