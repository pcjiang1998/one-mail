import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

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

afterEach(() => {
  vi.useRealTimers()
})

describe('MailList range selection', () => {
  it('does not toggle the range endpoint again when the pointer is released', () => {
    vi.useFakeTimers()
    const onToggleMessageSelection = vi.fn()

    render(
      <I18nProvider initialLocale="en-US">
        <MailList
          account={account}
          messages={[createMessage('1'), createMessage('2')]}
          selectedMessageId="1"
          filters={[]}
          searchKeyword=""
          selectedMessageIds={new Set(['1'])}
          onSelectMessage={() => undefined}
          onChangeFilters={() => undefined}
          onChangeSearchKeyword={() => undefined}
          onLoadMore={() => undefined}
          onToggleMessageSelection={onToggleMessageSelection}
        />
      </I18nProvider>
    )

    const checkbox = screen.getByRole('checkbox', { name: 'Select Subject 2' })
    fireEvent.pointerDown(checkbox, { shiftKey: true })
    fireEvent.pointerUp(checkbox, { shiftKey: true })
    fireEvent.click(checkbox, { shiftKey: true })

    expect(onToggleMessageSelection).toHaveBeenCalledTimes(1)
    expect(onToggleMessageSelection).toHaveBeenLastCalledWith('2', true)

    vi.runAllTimers()
    fireEvent.click(checkbox)
    expect(onToggleMessageSelection).toHaveBeenCalledTimes(2)
    expect(onToggleMessageSelection).toHaveBeenLastCalledWith('2', false)
  })
})
