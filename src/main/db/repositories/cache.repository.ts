import { getDatabase } from '../connection'
import type { CacheCleanupResult } from '../../ipc/types'

const ALLOWED_CACHE_CLEANUP_DAYS = new Set([7, 15, 30, 60, 90, 180, 360])

export function cleanupMessageCache(days: number): CacheCleanupResult {
  if (!ALLOWED_CACHE_CLEANUP_DAYS.has(days)) {
    throw new Error('不支持的缓存清理时间范围。')
  }

  const db = getDatabase()
  const modifier = `-${days} days`
  const rows = db
    .prepare<{ message_id: number }>(
      `SELECT message_id
       FROM onemail_mail_messages
       WHERE datetime(COALESCE(received_at, internal_date, created_at)) < datetime('now', :modifier)`
    )
    .all({ modifier })

  db.exec('BEGIN IMMEDIATE')
  try {
    const deleteSearch = db.prepare(
      'DELETE FROM onemail_message_search WHERE message_id = :messageId'
    )
    for (const row of rows) deleteSearch.run({ messageId: row.message_id })

    const deleted = db
      .prepare(
        `DELETE FROM onemail_mail_messages
         WHERE datetime(COALESCE(received_at, internal_date, created_at)) < datetime('now', :modifier)`
      )
      .run({ modifier })

    db.prepare(
      `UPDATE onemail_mail_folders
       SET total_count = (
             SELECT COUNT(*) FROM onemail_mail_messages m
             WHERE m.folder_id = onemail_mail_folders.folder_id AND m.remote_deleted = 0
           ),
           unread_count = (
             SELECT COUNT(*) FROM onemail_mail_messages m
             WHERE m.folder_id = onemail_mail_folders.folder_id
               AND m.remote_deleted = 0 AND m.is_read = 0
           ),
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
    ).run()
    db.exec('COMMIT')
    return { days, deletedMessages: deleted.changes }
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
