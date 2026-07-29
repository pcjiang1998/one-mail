# OneMail Next v26.729.2017

## 中文

### 新功能

- 新增系统 `mailto:` 协议支持。点击网页或其他应用中的邮件链接时，OneMail Next 会打开写信窗口并自动填入收件人、抄送、密送、主题和正文；发件邮箱仍可在发送前修改。
- “设置 > 邮箱管理”新增默认系统发信邮箱。升级后会自动选择邮箱列表中的第一个邮箱；所选邮箱被删除时会自动回退到当前第一个邮箱。
- 主界面左下角新增黄色信封未读提示，并汇总显示所有邮箱的未读邮件数量。
- 自定义代理新增 HTTP、HTTPS、SOCKS4、SOCKS4a、SOCKS5 和 SOCKS5h 协议支持，并支持 HTTP/HTTPS Basic 代理认证。

### 修复与改进

- 修复 Gmail 及其他邮箱在系统代理包含多个规则或 `DIRECT` 回退时，邮件连接可能错误停留在已断开的代理上的问题。系统代理现在会按顺序尝试可用规则。
- 修复 Gmail 或其他 SMTP 服务因网络中断、连接重置、DNS、TLS 或代理错误发送失败时，未处理的 Socket 异常可能导致应用退出的问题。发送失败会保留在发件箱并显示错误，不再使主进程崩溃。
- 完善 IMAP IDLE 运行时检测。服务器明确拒绝 IDLE 时立即切换到回退同步；连续三次 IDLE 连接失败后也会自动将该邮箱设为回退模式并恢复间隔同步。
- 将 IMAP 客户端标识从 `onemail` 更新为 `one-mail-next`，并统一应用于连接测试、同步和实时监听。
- 设置页面调整为“常规、邮箱管理、邮件操作、邮件同步、邮件签名、网络、翻译、导入导出、关于”，并将原“同步”更名为“邮件同步”。
- 代理连接失败或 TLS 升级失败时会及时释放底层 Socket，减少重试期间的连接残留。

### 兼容性与限制

- 系统是否允许 OneMail Next 成为默认邮件应用由 Windows、macOS 及当前系统策略决定；部分系统仍会要求用户在默认应用设置中确认。
- Microsoft OAuth 客户端 ID、权限范围和现有令牌均未改变，因此 Outlook 账号无需重新授权。此次调整仅更新本地 IMAP 客户端标识；Microsoft 授权页面显示的应用名称仍取决于远端 Entra/Azure 应用注册配置。
- 运行时确认不支持或无法稳定使用 IMAP IDLE 的邮箱会被持久切换为回退同步。原先强制选择实时模式的此类邮箱升级后可能改用间隔同步。
- SOCKS4 仅支持 IPv4 目标地址；代理目标使用域名时请配置 `socks4a://`。HTTP 和 HTTPS 代理需要支持 `CONNECT` 隧道，当前内置认证方式为 Basic。
- `mailto:` 链接中的正文按纯文本导入，现有邮箱签名会继续附加在正文之后。

## English

### New features

- Added system `mailto:` protocol handling. Email links from browsers and other applications now open a OneMail Next composer populated with To, Cc, Bcc, subject, and body fields. The sender can still be changed before sending.
- Added a default system sender under Settings > Mailbox Management. Existing installations migrate to the first mailbox, and deleting the selected mailbox automatically falls back to the new first mailbox.
- Added a yellow envelope indicator in the lower-left corner with the total unread count across all mailboxes.
- Extended custom proxy support to HTTP, HTTPS, SOCKS4, SOCKS4a, SOCKS5, and SOCKS5h, including HTTP/HTTPS Basic proxy authentication.

### Fixes and improvements

- Fixed Gmail and other mail connections getting stuck on a disconnected proxy when the system configuration contains multiple proxy rules or a `DIRECT` fallback. Available system proxy rules are now attempted in order.
- Fixed a process crash that could occur when Gmail or another SMTP service failed because of a network interruption, connection reset, DNS, TLS, or proxy error. Failed messages remain in the outbox with an error instead of terminating the main process.
- Improved runtime IMAP IDLE detection. An explicit server rejection switches the account to fallback sync immediately; three consecutive runtime IDLE connection failures also persist fallback mode and restore interval synchronization.
- Updated the IMAP client identity from `onemail` to `one-mail-next` across connection tests, synchronization, and real-time watchers.
- Reordered Settings to General, Mailbox Management, Mail Operations, Mail Sync, Signatures, Network, Translation, Import / Export, and About. The former Sync section is now named Mail Sync.
- Proxy and TLS failures now release their underlying sockets promptly, reducing stale connections during retries.

### Compatibility and limitations

- Whether OneMail Next can become the default email application is controlled by Windows, macOS, and local system policy. Some systems still require confirmation in Default Apps settings.
- Microsoft OAuth client IDs, scopes, and existing tokens are unchanged, so Outlook accounts do not require reauthorization. This release only changes the local IMAP client identity; the application name shown on Microsoft authorization pages remains controlled by the remote Entra/Azure app registration.
- Accounts that fail runtime IMAP IDLE checks or cannot use IDLE reliably are persistently switched to fallback synchronization. Accounts that previously forced real-time mode may use interval sync after upgrading.
- SOCKS4 supports IPv4 targets only; use `socks4a://` when the proxy must resolve a target hostname. HTTP and HTTPS proxies must support `CONNECT` tunneling, and the built-in authentication method is Basic.
- `mailto:` bodies are imported as plain text, and the configured account signature remains appended after the supplied body.
