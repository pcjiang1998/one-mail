# OneMail Next v26.728.2155

## 中文

### 新功能

- 缓存窗口现在允许设置为 `0`（不限制），并可手动清理 7、15、30、60、90、180 或 360 天前的本地邮件缓存。
- 新增全局及邮箱专属邮件签名，支持签名创建、编辑、删除，并在正文之后、回复或转发分隔符之前插入。
- 新增全局及邮箱专属代理设置，支持直连、系统代理和 `socks5://` 代理。
- 新增独立同步设置页，支持全局 IMAP IDLE、间隔、手动策略，以及 POP3/非 IDLE 邮箱使用的回退策略。
- 自定义邮箱支持 POP3 收信；账户创建后接收协议不可切换。
- 账户添加和编辑页会显示只读的 IMAP、POP3、SMTP、端口和安全配置，并可设置代理、签名及同步策略。
- 远端 WebDAV/S3 备份使用数据读取密钥进行 AES-256-GCM 加密保护。
- 账户及服务商界面补全英文适配。

### 兼容性与限制

- **旧版明文远端备份不兼容。** 本版本只读取带有 `ONEMAIL-REMOTE-BACKUP-V2` 标头的加密远端备份，并且必须使用上传时的数据读取密钥。请先在旧版本保留本地 SQL 备份，再使用本版本设置读取密钥并重新上传；应用不会自动迁移远端明文备份。
- 数据读取密钥至少为 8 个字符。密钥错误或丢失时，远端备份无法恢复。
- POP3 不支持 IMAP IDLE、远端文件夹、远端已读/回复标记或远端删除。本版本中的 POP3 已读、删除和恢复操作仅作用于本地缓存，发信仍使用 SMTP。
- POP3 同步依赖服务器 UIDL。被缓存窗口跳过的旧邮件会记录为已见，之后扩大缓存窗口不会自动重新下载这些邮件。
- 已创建账户不能在 IMAP 和 POP3 之间切换；如需切换，必须删除后重新添加账户。
- 新增数据库表和字段会自动迁移，但旧版 OneMail 不理解 POP3、签名、代理和新同步策略数据。升级前建议导出本地 SQL 备份。
- 系统代理依赖 Electron 返回的代理规则；需要交互认证或当前无法解析的 PAC/企业代理可能无法用于邮件连接。

## English

### New features

- The cache window now accepts `0` (unlimited), with manual cleanup for locally cached mail older than 7, 15, 30, 60, 90, 180, or 360 days.
- Added global and per-account signatures with create, edit, and delete support. Signatures are inserted after the message body and before reply or forward separators.
- Added global and per-account proxy settings for direct, system, and `socks5://` connections.
- Added a dedicated Sync page with global IMAP IDLE, interval, and manual policies plus fallback policies for POP3 and non-IDLE accounts.
- Custom accounts can receive mail over POP3. The incoming protocol is immutable after account creation.
- Account add and edit views show read-only IMAP, POP3, SMTP, port, and security settings and expose proxy, signature, and sync controls.
- Remote WebDAV/S3 backups are protected with data-read-key-based AES-256-GCM encryption.
- Completed English adaptation for account and provider interfaces.

### Compatibility and limitations

- **Legacy plaintext remote backups are incompatible.** This release only reads encrypted remote backups with the `ONEMAIL-REMOTE-BACKUP-V2` header, and restoration requires the data read key used during upload. Keep a local SQL backup from the previous release, then configure a read key and upload again with this release. The app does not migrate plaintext remote backups automatically.
- The data read key must contain at least 8 characters. A lost or incorrect key makes the remote backup unrecoverable.
- POP3 does not support IMAP IDLE, remote folders, remote read/reply flags, or remote deletion. POP3 read, delete, and restore actions in this release affect only the local cache; sending still uses SMTP.
- POP3 synchronization depends on server UIDL values. Old messages skipped by the cache window are marked as seen and are not downloaded automatically if the window is later expanded.
- Existing accounts cannot switch between IMAP and POP3. Remove and add the account again to change protocols.
- New database tables and columns are migrated automatically, but older OneMail releases do not understand POP3, signature, proxy, or new sync-policy data. Export a local SQL backup before upgrading.
- System proxy support depends on proxy rules resolved by Electron. Interactive-authentication proxies and PAC or enterprise proxies that cannot currently be resolved may not work for mail connections.
