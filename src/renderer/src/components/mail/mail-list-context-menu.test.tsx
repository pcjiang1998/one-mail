import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@renderer/lib/i18n'
import { MailList } from './mail-list'
import type { Account, Message } from './types'

const account: Account = {
  id: '1',
  accountId: 1,
  name: 'Test account',
  address: 'user@example.com',
  unread: 2,
  status: 'active',
  accent: 'bg-primary'
}

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

function renderMailList(
  messages: Message[],
  options: {
    selectedMessageIds?: Set<string>
    onReplyMessage?: (message: Message, replyAll: boolean) => void
    onForwardMessages?: (messages: Message[], asAttachments: boolean) => void
  } = {}
): void {
  render(
    <I18nProvider initialLocale="en-US">
      <MailList
        account={account}
        messages={messages}
        selectedMessageId=""
        filters={[]}
        searchKeyword=""
        selectedMessageIds={options.selectedMessageIds}
        onSelectMessage={() => undefined}
        onChangeFilters={() => undefined}
        onChangeSearchKeyword={() => undefined}
        onLoadMore={() => undefined}
        onReplyMessage={options.onReplyMessage}
        onForwardMessages={options.onForwardMessages}
      />
    </I18nProvider>
  )
}

describe('MailList native context menu', () => {
  it('opens the single-message actions on a native right click', async () => {
    const onReplyMessage = vi.fn()
    const message = createMessage('1')
    renderMailList([message], { onReplyMessage })

    fireEvent.contextMenu(screen.getByText('Subject 1').closest('[role="button"]')!, {
      clientX: 120,
      clientY: 80
    })

    const replyAll = await screen.findByRole('menuitem', { name: 'Reply all' })
    expect(screen.getByRole('menuitem', { name: 'Mark as read' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Reply' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Forward' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeVisible()

    fireEvent.click(replyAll)
    expect(onReplyMessage).toHaveBeenCalledWith(message, true)
  })

  it('opens the multi-message forwarding actions on a native right click', async () => {
    const onForwardMessages = vi.fn()
    const messages = [createMessage('1'), createMessage('2')]
    renderMailList(messages, {
      selectedMessageIds: new Set(['1', '2']),
      onForwardMessages
    })

    fireEvent.contextMenu(screen.getByText('Subject 1').closest('[role="button"]')!, {
      clientX: 120,
      clientY: 80
    })

    expect(await screen.findByRole('menuitem', { name: 'Forward individually' })).toBeVisible()
    const forwardOriginal = screen.getByRole('menuitem', { name: 'Forward as original mail' })
    expect(forwardOriginal).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Mark as read' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeVisible()

    fireEvent.click(forwardOriginal)
    expect(onForwardMessages).toHaveBeenCalledWith(messages, true)
  })
})
