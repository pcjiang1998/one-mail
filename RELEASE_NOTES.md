# OneMail Next v26.730.1039

## 中文

### 新功能

- 重构邮箱文件夹视图。每个邮箱固定显示收件箱、本地草稿箱、发件箱、垃圾箱和已删除，并显示用户选择同步的其他文件夹；“全部邮箱”仅汇总各邮箱收件箱。
- 新增邮件列表 Ctrl/Command 多选、全选与取消全选，以及单封和多封邮件右键菜单。单封邮件支持标为已读、回复、回复全部、转发和删除；多封邮件支持标为已读、逐个转发、批量转发原始 EML 和删除。
- 已发送邮件会保存至对应邮箱的发件箱。全局发送状态入口仅保留正在发送、等待发送和发送失败的邮件。
- 网易邮箱拆分为网易 163、网易 126 和网易 Yeah，并分别使用对应的 IMAP、POP3 与 SMTP 服务器预设。
- 设置 > 邮箱管理新增系统默认邮件处理器状态和配置入口，并完善 Windows `mailto:` 注册信息。

### 修复与改进

- 修复修改邮箱文件夹选择时保存无响应，以及更新已有文件夹时出现 `Unknown named parameter 'accountId'` 的问题。
- 普通文件夹现可取消同步；保存后会删除该邮箱对应的本地文件夹记录与缓存，不影响服务器上的远端文件夹。INBOX、Sent 和 Junk 在界面及后端均强制保留。
- 批量标为已读期间新增进度提示，并在完成后同步刷新文件夹、邮箱及全部邮箱的未读计数。
- 普通点击邮件摘要会退出多选并打开邮件；切换邮箱、文件夹、筛选条件或搜索视图时会自动清空选择。
- 修复邮件摘要右键事件未传递至实际 DOM 节点，导致右键菜单无法打开的问题。
- 修复邮件签名保存后切换设置页面会丢失的问题。
- 调整邮件删除规则：普通文件夹删除仅进入本地“已删除”；发件箱、垃圾箱及本地“已删除”按固定永久删除规则处理，并在需要时要求确认。
- 增强批量转发：优先使用本地缓存的原始邮件，必要时再从 IMAP 服务器读取 EML。

### 兼容性与限制

- 本版本调整了邮箱文件夹同步与删除策略。收件箱、发件箱和垃圾箱现为固定同步目录，旧版全局及账号级“同步删除到远程”设置不再决定删除行为。普通文件夹中的邮件删除后仅进入本地“已删除”，发件箱、垃圾箱及本地“已删除”中的删除按新的固定规则执行。升级后原有文件夹选择和删除行为可能发生变化。
- 取消普通文件夹同步会删除其本地缓存，但不会删除服务器上的文件夹或邮件；重新选择后需要重新同步。
- POP3 不支持向远端发件箱追加已发送邮件。IMAP 服务器未提供可用的 Sent 文件夹时，发送可以完成，但应用只能返回远端追加警告。
- Windows 仍可能要求用户在系统“默认应用”页面中确认 OneMail Next 为 `mailto:` 处理器。

## English

### New features

- Reworked mailbox folders. Each account now exposes Inbox, Local Drafts, Sent, Junk, Deleted, and any additional folders selected for synchronization. All Accounts aggregates Inbox messages only.
- Added Ctrl/Command multi-selection, select-all toggling, and native context menus for single and multiple messages. Single-message actions include mark as read, reply, reply all, forward, and delete. Multi-message actions include mark as read, individual forwarding, original EML attachment forwarding, and delete.
- Sent messages are stored in the corresponding account's Sent folder. The global delivery-status entry now contains only queued, sending, and failed messages.
- Split NetEase presets into 163, 126, and Yeah, each with its corresponding IMAP, POP3, and SMTP servers.
- Added default mail-handler status and configuration under Settings > Mailbox Management, including complete Windows `mailto:` registration.

### Fixes and improvements

- Fixed mailbox folder selections failing to save and the `Unknown named parameter 'accountId'` error when updating existing folders.
- Optional folders can now be deselected. Saving removes the target account's local folder record and cache without deleting the remote folder. INBOX, Sent, and Junk remain mandatory in both the UI and backend.
- Added progress feedback for bulk mark-as-read operations and refreshed folder, account, and All Accounts unread counters after completion.
- A plain click now exits multi-selection before opening a message. Changing accounts, folders, filters, or searches clears the current selection.
- Fixed context-menu events not reaching the actual message-summary DOM node.
- Fixed signatures disappearing after saving and navigating between settings sections.
- Updated deletion behavior: regular folders move messages to local Deleted, while Sent, Junk, and local Deleted use fixed permanent-deletion rules with confirmation where required.
- Improved bulk forwarding by using cached raw messages first and fetching EML data from IMAP only when necessary.

### Compatibility and limitations

- This release changes folder synchronization and deletion behavior. Inbox, Sent, and Junk are now mandatory synchronized folders, and legacy global or per-account remote-delete settings no longer control deletion. Deleting from regular folders moves messages to local Deleted; deletion from Sent, Junk, and local Deleted follows the new fixed rules. Existing folder selections and deletion behavior may change after upgrading.
- Deselecting an optional folder removes its local cache but does not delete the remote folder or messages. Re-enabling it requires synchronization again.
- POP3 cannot append sent messages to a remote Sent folder. If an IMAP server does not expose a usable Sent folder, sending can complete but the app reports a remote-append warning.
- Windows may still require confirmation in Default Apps before OneMail Next becomes the active `mailto:` handler.
