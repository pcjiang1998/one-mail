import { describe, expect, it } from 'vitest'

import { isRequiredFolderRole } from './account-mailboxes'

describe('required account mail folders', () => {
  it('always includes Inbox, Sent and Junk', () => {
    expect(isRequiredFolderRole('inbox')).toBe(true)
    expect(isRequiredFolderRole('sent')).toBe(true)
    expect(isRequiredFolderRole('junk')).toBe(true)
  })

  it('leaves other remote folders under user selection', () => {
    expect(isRequiredFolderRole('drafts')).toBe(false)
    expect(isRequiredFolderRole('trash')).toBe(false)
    expect(isRequiredFolderRole('archive')).toBe(false)
  })
})
