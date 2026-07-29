import { describe, expect, it } from 'vitest'

import type { Account } from '@renderer/components/mail/types'
import { moveAccounts } from './account-management-settings'

describe('moveAccounts', () => {
  const accounts = [createAccount(1), createAccount(2), createAccount(3), createAccount(4)]

  it('moves one account before a target', () => {
    expect(moveAccounts(accounts, [4], 2, 'before').map((account) => account.accountId)).toEqual([
      1, 4, 2, 3
    ])
  })

  it('moves a selected group together while preserving its displayed order', () => {
    expect(moveAccounts(accounts, [3, 1], 4, 'after').map((account) => account.accountId)).toEqual([
      2, 4, 1, 3
    ])
  })
})

function createAccount(accountId: number): Account {
  return {
    id: String(accountId),
    accountId,
    name: `Account ${accountId}`,
    address: `account${accountId}@example.com`,
    unread: 0,
    status: 'active',
    accent: '#000000'
  }
}
