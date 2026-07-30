import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { Message } from '@renderer/components/mail/types'
import { useMessageSelection } from './use-message-selection'

function createMessage(id: string): Message {
  return {
    id,
    messageId: Number(id),
    accountId: 1,
    folderId: 1,
    from: `Sender ${id}`,
    subject: `Subject ${id}`,
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

const messages = [createMessage('1'), createMessage('2')]

describe('useMessageSelection', () => {
  it('toggles select all back to an empty selection', () => {
    const { result } = renderHook(() =>
      useMessageSelection({ messages, resetKey: 'account-1:inbox' })
    )

    act(() => result.current.selectAllVisible())
    expect(result.current.allVisibleSelected).toBe(true)
    expect([...result.current.selectedMessageIds]).toEqual(['1', '2'])

    act(() => result.current.selectAllVisible())
    expect(result.current.allVisibleSelected).toBe(false)
    expect(result.current.selectedMessageIds.size).toBe(0)
  })

  it('exposes no selection after switching the mailbox view', () => {
    const { result, rerender } = renderHook(
      ({ resetKey }) => useMessageSelection({ messages, resetKey }),
      { initialProps: { resetKey: 'account-1:inbox' } }
    )

    act(() => result.current.selectMessageForContext('1'))
    expect([...result.current.selectedMessageIds]).toEqual(['1'])

    rerender({ resetKey: 'account-1:sent' })
    expect(result.current.selectedMessageIds.size).toBe(0)
    expect(result.current.selectedMessages).toEqual([])
  })
})
