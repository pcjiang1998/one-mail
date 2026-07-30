import {
  CircleCheck,
  ExternalLink,
  GripVertical,
  LoaderCircle,
  Mail,
  MailCheck,
  Send,
  Trash2
} from 'lucide-react'
import * as React from 'react'

import type { Account } from '@renderer/components/mail/types'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@renderer/components/ui/alert-dialog'
import { Button } from '@renderer/components/ui/button'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { FieldError } from '@renderer/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { cn } from '@renderer/lib/utils'
import { useI18n } from '@renderer/lib/i18n'
import { configureDefaultMailClient, getDefaultMailClientStatus } from '@renderer/lib/api'
import type { DefaultMailClientStatus } from '../../../../shared/types'

type AccountManagementSettingsProps = {
  accounts: Account[]
  defaultComposeAccountId: number | null
  onDefaultComposeAccountChange: (accountId: number) => Promise<void>
  onRemoveAccounts: (accountIds: number[]) => Promise<void>
  onReorderAccounts: (accountIds: number[]) => Promise<void>
}

type DropPosition = 'before' | 'after'

type DragState = {
  accountIds: number[]
  overAccountId?: number
  position?: DropPosition
}

export function AccountManagementSettings({
  accounts,
  defaultComposeAccountId,
  onDefaultComposeAccountChange,
  onRemoveAccounts,
  onReorderAccounts
}: AccountManagementSettingsProps): React.JSX.Element {
  const { t } = useI18n()
  const [orderedAccountIds, setOrderedAccountIds] = React.useState(() =>
    accounts.flatMap((account) => account.accountId ?? [])
  )
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set())
  const [dragState, setDragState] = React.useState<DragState | null>(null)
  const [pending, setPending] = React.useState<'default' | 'delete' | 'reorder' | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [mailClientStatus, setMailClientStatus] = React.useState<DefaultMailClientStatus | null>(
    null
  )
  const [mailClientPending, setMailClientPending] = React.useState(false)
  const [mailClientError, setMailClientError] = React.useState<string | null>(null)
  const accountById = new Map(
    accounts.flatMap((account) =>
      account.accountId ? [[account.accountId, account] as const] : []
    )
  )
  const currentAccountIds = [...accountById.keys()]
  const hasCurrentOrder =
    orderedAccountIds.length === currentAccountIds.length &&
    orderedAccountIds.every((accountId) => accountById.has(accountId))
  const orderedAccounts = (hasCurrentOrder ? orderedAccountIds : currentAccountIds).flatMap(
    (accountId) => accountById.get(accountId) ?? []
  )
  const validSelectedIds = new Set(
    [...selectedIds].filter((accountId) => accountById.has(accountId))
  )
  const selectedCount = validSelectedIds.size
  const allSelected = orderedAccounts.length > 0 && selectedCount === orderedAccounts.length
  const selectionState: boolean | 'indeterminate' =
    selectedCount === 0 ? false : allSelected ? true : 'indeterminate'

  React.useEffect(() => {
    let cancelled = false
    const refreshStatus = (): void => {
      void getDefaultMailClientStatus()
        .then((status) => {
          if (!cancelled) setMailClientStatus(status)
        })
        .catch(() => {
          if (!cancelled) setMailClientStatus(null)
        })
    }
    const initialTimer = window.setTimeout(refreshStatus, 0)
    window.addEventListener('focus', refreshStatus)
    return () => {
      cancelled = true
      window.clearTimeout(initialTimer)
      window.removeEventListener('focus', refreshStatus)
    }
  }, [])

  function toggleAccount(accountId: number, checked: boolean): void {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (checked) next.add(accountId)
      else next.delete(accountId)
      return next
    })
  }

  function toggleAll(checked: boolean): void {
    setSelectedIds(
      checked ? new Set(orderedAccounts.flatMap((account) => account.accountId ?? [])) : new Set()
    )
  }

  function startDrag(event: React.DragEvent, accountId: number): void {
    const accountIds = validSelectedIds.has(accountId)
      ? orderedAccounts
          .flatMap((account) => account.accountId ?? [])
          .filter((candidateId) => validSelectedIds.has(candidateId))
      : [accountId]

    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', accountIds.join(','))
    setDragState({ accountIds })
    setError(null)
  }

  function updateDropTarget(event: React.DragEvent, accountId: number): void {
    if (!dragState || dragState.accountIds.includes(accountId)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const bounds = event.currentTarget.getBoundingClientRect()
    const position = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after'
    setDragState((current) =>
      current ? { ...current, overAccountId: accountId, position } : current
    )
  }

  async function finishDrop(event: React.DragEvent, accountId: number): Promise<void> {
    event.preventDefault()
    if (!dragState || dragState.accountIds.includes(accountId)) {
      setDragState(null)
      return
    }

    const nextAccounts = moveAccounts(
      orderedAccounts,
      dragState.accountIds,
      accountId,
      dragState.position ?? 'before'
    )
    setDragState(null)
    await persistOrder(nextAccounts)
  }

  async function persistOrder(nextAccounts: Account[]): Promise<void> {
    const previousIds = orderedAccounts.flatMap((account) => account.accountId ?? [])
    const nextIds = nextAccounts.flatMap((account) => account.accountId ?? [])
    if (nextIds.join(',') === previousIds.join(',')) {
      return
    }

    setOrderedAccountIds(nextIds)
    setPending('reorder')
    setError(null)
    try {
      await onReorderAccounts(nextIds)
    } catch (reorderError) {
      setOrderedAccountIds(previousIds)
      setError(
        reorderError instanceof Error ? reorderError.message : t('settings.accounts.reorderError')
      )
    } finally {
      setPending(null)
    }
  }

  async function handleDelete(): Promise<void> {
    if (validSelectedIds.size === 0) return
    setPending('delete')
    setError(null)
    try {
      await onRemoveAccounts([...validSelectedIds])
      setSelectedIds(new Set())
      setDeleteDialogOpen(false)
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : t('settings.accounts.deleteError')
      )
    } finally {
      setPending(null)
    }
  }

  async function handleDefaultAccountChange(value: string): Promise<void> {
    const accountId = Number(value)
    if (!Number.isInteger(accountId) || accountId <= 0) return

    setPending('default')
    setError(null)
    try {
      await onDefaultComposeAccountChange(accountId)
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : t('settings.accounts.defaultError')
      )
    } finally {
      setPending(null)
    }
  }

  async function handleConfigureMailClient(): Promise<void> {
    setMailClientPending(true)
    setMailClientError(null)
    try {
      setMailClientStatus(await configureDefaultMailClient())
    } catch {
      setMailClientError(t('settings.accounts.mailHandlerError'))
    } finally {
      setMailClientPending(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[620px] flex-col gap-3 p-3 sm:p-4">
      <div className="grid gap-3 rounded-md border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="flex min-w-0 gap-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <MailCheck className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium">{t('settings.accounts.mailHandlerTitle')}</div>
            <div className="mt-0.5 text-xs leading-snug text-muted-foreground">
              {t('settings.accounts.mailHandlerDescription')}
            </div>
            <div className="mt-1 text-xs font-medium">
              {mailClientStatus?.isDefault
                ? t('settings.accounts.mailHandlerDefault')
                : mailClientStatus?.registered
                  ? t('settings.accounts.mailHandlerRegistered')
                  : mailClientStatus?.supported === false
                    ? t('settings.accounts.mailHandlerUnsupported')
                    : t('settings.accounts.mailHandlerNotDefault')}
            </div>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={
            mailClientPending ||
            mailClientStatus?.isDefault === true ||
            mailClientStatus?.supported === false
          }
          onClick={() => void handleConfigureMailClient()}
        >
          {mailClientPending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" />
          ) : mailClientStatus?.isDefault ? (
            <CircleCheck data-icon="inline-start" />
          ) : (
            <ExternalLink data-icon="inline-start" />
          )}
          {mailClientStatus?.isDefault
            ? t('settings.accounts.mailHandlerConfigured')
            : mailClientStatus?.requiresSystemSelection
              ? t('settings.accounts.mailHandlerOpenSettings')
              : t('settings.accounts.mailHandlerConfigure')}
        </Button>
        {mailClientError ? (
          <FieldError className="sm:col-span-2">{mailClientError}</FieldError>
        ) : null}
      </div>

      <div className="grid gap-3 rounded-md border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
        <div className="flex min-w-0 gap-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Send className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium">{t('settings.accounts.defaultTitle')}</div>
            <div className="mt-0.5 text-xs leading-snug text-muted-foreground">
              {t('settings.accounts.defaultDescription')}
            </div>
          </div>
        </div>
        <Select
          value={defaultComposeAccountId ? String(defaultComposeAccountId) : undefined}
          disabled={Boolean(pending) || orderedAccounts.length === 0}
          onValueChange={(value) => void handleDefaultAccountChange(value)}
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue placeholder={t('settings.accounts.defaultPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {orderedAccounts.map((account) =>
              account.accountId ? (
                <SelectItem key={account.accountId} value={String(account.accountId)}>
                  {account.name || account.address}
                </SelectItem>
              ) : null
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="flex min-h-9 items-center justify-between gap-3 border-b pb-3">
        <label className="flex min-w-0 items-center gap-2 text-xs font-medium">
          <Checkbox
            checked={selectionState}
            disabled={Boolean(pending) || orderedAccounts.length === 0}
            aria-label={t('settings.accounts.selectAll')}
            onCheckedChange={(checked) => toggleAll(checked === true)}
          />
          <span className="truncate">
            {selectedCount > 0
              ? t('settings.accounts.selectedCount', { count: selectedCount })
              : t('settings.accounts.accountCount', { count: orderedAccounts.length })}
          </span>
        </label>
        <Button
          size="sm"
          variant="destructive"
          disabled={selectedCount === 0 || Boolean(pending)}
          onClick={() => setDeleteDialogOpen(true)}
        >
          {pending === 'delete' ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" />
          ) : (
            <Trash2 data-icon="inline-start" />
          )}
          {t('settings.accounts.deleteSelected')}
        </Button>
      </div>

      <div className="border-y">
        {orderedAccounts.length === 0 ? (
          <div className="flex min-h-32 flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
            <Mail className="size-5" aria-hidden="true" />
            <span>{t('settings.accounts.empty')}</span>
          </div>
        ) : (
          orderedAccounts.map((account) => {
            const accountId = account.accountId
            if (!accountId) return null
            const selected = validSelectedIds.has(accountId)
            const isDragged = dragState?.accountIds.includes(accountId) === true
            const showBefore =
              dragState?.overAccountId === accountId && dragState.position === 'before'
            const showAfter =
              dragState?.overAccountId === accountId && dragState.position === 'after'

            return (
              <div
                key={accountId}
                className={cn(
                  'relative flex min-h-14 items-center gap-3 border-b px-1 py-2 last:border-b-0',
                  selected && 'bg-muted/40',
                  isDragged && 'opacity-45',
                  showBefore &&
                    'before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-primary',
                  showAfter &&
                    'after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary'
                )}
                onDragOver={(event) => updateDropTarget(event, accountId)}
                onDrop={(event) => void finishDrop(event, accountId)}
              >
                <Checkbox
                  checked={selected}
                  disabled={Boolean(pending)}
                  aria-label={t('settings.accounts.selectAccount', { account: account.name })}
                  onCheckedChange={(checked) => toggleAccount(accountId, checked === true)}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {account.name || account.address}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{account.address}</div>
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  draggable={!pending}
                  title={t('settings.accounts.dragHandle')}
                  aria-label={t('settings.accounts.dragHandleFor', { account: account.name })}
                  className="flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
                  onDragStart={(event) => startDrag(event, accountId)}
                  onDragEnd={() => setDragState(null)}
                >
                  <GripVertical className="size-4" aria-hidden="true" />
                </span>
              </div>
            )
          })
        )}
      </div>

      {pending === 'reorder' ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
          {t('settings.accounts.savingOrder')}
        </div>
      ) : null}
      {error ? <FieldError>{error}</FieldError> : null}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.accounts.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.accounts.deleteDescription', { count: selectedCount })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              disabled={pending === 'delete'}
              onClick={() => setDeleteDialogOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={pending === 'delete'}
              onClick={() => void handleDelete()}
            >
              {pending === 'delete' ? (
                <LoaderCircle data-icon="inline-start" className="animate-spin" />
              ) : (
                <Trash2 data-icon="inline-start" />
              )}
              {t('settings.accounts.deleteConfirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Kept here so the reorder tests exercise the exact helper used by this component.
// eslint-disable-next-line react-refresh/only-export-components
export function moveAccounts(
  accounts: Account[],
  movingAccountIds: number[],
  targetAccountId: number,
  position: DropPosition
): Account[] {
  const movingSet = new Set(movingAccountIds)
  if (movingSet.has(targetAccountId)) return accounts

  const movingAccounts = accounts.filter(
    (account) => account.accountId !== undefined && movingSet.has(account.accountId)
  )
  const remainingAccounts = accounts.filter(
    (account) => account.accountId === undefined || !movingSet.has(account.accountId)
  )
  const targetIndex = remainingAccounts.findIndex(
    (account) => account.accountId === targetAccountId
  )
  if (targetIndex < 0 || movingAccounts.length === 0) return accounts

  const insertAt = targetIndex + (position === 'after' ? 1 : 0)
  return [
    ...remainingAccounts.slice(0, insertAt),
    ...movingAccounts,
    ...remainingAccounts.slice(insertAt)
  ]
}
