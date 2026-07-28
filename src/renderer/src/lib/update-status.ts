import type { AppUpdateStatus } from '../../../shared/types'

export const ONEMAIL_HOMEPAGE_URL = 'https://github.com/pcjiang1998/one-mail-next'

export function hasAvailableUpdate(status: AppUpdateStatus | null): boolean {
  return (
    status?.state === 'available' ||
    status?.state === 'downloading' ||
    status?.state === 'downloaded'
  )
}
