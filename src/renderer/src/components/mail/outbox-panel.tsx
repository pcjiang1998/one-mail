import * as React from 'react'
import { FilePenLine, RotateCcw, Trash2 } from 'lucide-react'

import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { DeleteDraftDialog } from '@renderer/components/mail/delete-draft-dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@renderer/components/ui/sheet'
import type { OutboxMessage } from '@renderer/lib/api'
import { useI18n, type TranslationKey } from '@renderer/lib/i18n'

type OutboxPanelProps = {
  open: boolean
  pending?: boolean
  outboxMessages: OutboxMessage[]
  onOpenChange: (open: boolean) => void
  onRefresh: () => void
  onOpenDraft: (message: OutboxMessage) => void
  onRetry: (message: OutboxMessage) => void
  onDelete: (message: OutboxMessage) => Promise<void>
  view?: 'queue' | 'drafts'
}

export function OutboxPanel({
  open,
  pending = false,
  outboxMessages,
  onOpenChange,
  onRefresh,
  onOpenDraft,
  onRetry,
  onDelete,
  view = 'queue'
}: OutboxPanelProps): React.JSX.Element {
  const { t } = useI18n()
  const [deleteDraftCandidate, setDeleteDraftCandidate] = React.useState<OutboxMessage | null>(null)

  React.useEffect(() => {
    if (open) onRefresh()
  }, [onRefresh, open])

  async function handleDeleteDraft(): Promise<void> {
    if (!deleteDraftCandidate) return
    await onDelete(deleteDraftCandidate)
    setDeleteDraftCandidate(null)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader className="border-b">
            <SheetTitle>
              {view === 'drafts' ? t('mail.outbox.draftsTitle') : t('mail.outbox.title')}
            </SheetTitle>
            <SheetDescription>
              {view === 'drafts'
                ? t('mail.outbox.draftsDescription')
                : t('mail.outbox.description')}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
            {outboxMessages.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
                {t('mail.outbox.empty')}
              </div>
            ) : (
              <div className="grid gap-2">
                {outboxMessages.map((message) => (
                  <div key={message.outboxId} className="rounded-md border p-3">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {message.subject || t('mail.outbox.noSubject')}
                        </div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">
                          {message.to.length > 0
                            ? message.to.join(', ')
                            : t('mail.outbox.noRecipients')}
                        </div>
                      </div>
                      <Badge variant={message.status === 'failed' ? 'destructive' : 'outline'}>
                        {getStatusLabel(message.status, t)}
                      </Badge>
                    </div>
                    {message.lastError ? (
                      <p className="mt-2 line-clamp-2 text-xs text-destructive">
                        {message.lastError}
                      </p>
                    ) : null}
                    {message.lastWarning ? (
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                        {message.lastWarning}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      {message.status === 'draft' ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          onClick={() => onOpenDraft(message)}
                        >
                          <FilePenLine data-icon="inline-start" />
                          {t('common.edit')}
                        </Button>
                      ) : null}
                      {message.status === 'failed' ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          onClick={() => onRetry(message)}
                        >
                          <RotateCcw data-icon="inline-start" />
                          {t('common.retry')}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending || message.status === 'sending'}
                        onClick={() => {
                          if (message.status === 'draft') setDeleteDraftCandidate(message)
                          else void onDelete(message)
                        }}
                      >
                        <Trash2 data-icon="inline-start" />
                        {t('common.delete')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <DeleteDraftDialog
        open={Boolean(deleteDraftCandidate)}
        pending={pending}
        subject={deleteDraftCandidate?.subject}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeleteDraftCandidate(null)
        }}
        onConfirm={() => {
          void handleDeleteDraft()
        }}
      />
    </>
  )
}

function getStatusLabel(
  status: OutboxMessage['status'],
  t: (key: TranslationKey) => string
): string {
  if (status === 'draft') return t('mail.outbox.statusDraft')
  if (status === 'queued') return t('mail.outbox.statusQueued')
  if (status === 'failed') return t('mail.outbox.statusFailed')
  if (status === 'sending') return t('mail.outbox.statusSending')
  if (status === 'sent') return t('mail.outbox.statusSent')
  return status
}
