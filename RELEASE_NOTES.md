# OneMail Next v26.729.0938

## 中文

### 新功能

- 设置首页新增“邮箱管理”，支持多选删除邮箱配置，以及单个邮箱或所选邮箱组的拖拽排序；排序结果会持久保存，新邮箱默认追加到列表末尾。
- 新增邮件正文一键翻译。邮件详情使用原文与译文双栏显示，回复和转发始终使用未翻译原文。
- 翻译过程仅发送可见文本节点，并将译文回填到原有 HTML 结构；CSS、标签、属性、脚本和模板内容不会发送到翻译服务。
- 新增 18 个翻译服务商：阿里云、百度、百度领域、CNKI、火山引擎、火山网页、彩云小译、DeepL、DeepLX、DeepL Custom、Gemini、Google、Claude、OpenAI、Microsoft、小牛翻译、腾讯云和腾讯交互翻译，并保留 LibreTranslate。
- 翻译服务配置会按服务商分别持久保存。组合凭据支持使用 `#` 或 `@` 分隔，并通过数据库密钥派生密钥进行 AES-256-GCM 加密。
- OpenAI 兼容服务可明确选择 Responses API 或 Chat Completions API，并支持自定义 Endpoint 和模型。
- 常规设置新增多套浅色与深色主题；Database 路径及“打开所在文件夹”入口移至常规设置。
- 关于页面新增当前版本、更新状态、立即检查和下载后重启安装，并支持手动、每天或每周检查更新。

### 修复与改进

- 新安装默认启用远端删除同步，默认签名为“无”，默认网络为直连；全局同步默认为 IMAP IDLE，回退间隔为 5 分钟，邮箱专属设置默认跟随全局。
- 修复新建邮箱、修改邮箱及设置页面中 Radio 和 Checkbox 已选中状态不显示的问题。
- 主界面移除重复的主题按钮、Database 快捷入口、版本号和更新状态，相关功能统一收纳到设置页面。
- 更新检查频率会在主进程中真实调度；手动模式不会执行后台定时检查。
- 邮箱批量删除和排序使用数据库事务，并校验完整排序结果，避免部分写入或重复顺序。

### 兼容性与限制

- **旧版主题偏好可能不兼容。** 主题系统已从简单的浅色/深色模式扩展为多套颜色主题。部分旧版深色偏好升级后可能恢复默认主题，请在“设置 > 常规”中重新选择。
- **旧版明文远端备份不兼容。** 应用只读取带有 `ONEMAIL-REMOTE-BACKUP-V2` 标头的加密远端备份，并且恢复时必须使用上传时的数据读取密钥。升级前请保留本地 SQL 备份。
- POP3 不支持 IMAP IDLE、远端文件夹、远端已读/回复标记或远端删除；相关操作仅作用于本地缓存。
- 翻译会将邮件的可见正文发送到当前选择的第三方服务。请根据邮件敏感程度和服务商隐私政策决定是否使用。
- CNKI 翻译当前仅支持翻译为中文。Google、火山网页、DeepLX 和腾讯交互翻译等免密钥网页接口可能受服务商限流、网络环境或协议变更影响。
- 新数据库字段会自动迁移，但旧版 OneMail 不理解邮箱顺序、翻译设置、颜色主题和新更新策略。降级前建议导出本地 SQL 备份。

## English

### New features

- Added Mailbox Management as the first Settings page, with multi-select account removal and drag-and-drop ordering for either one account or the current selection. Ordering is persisted, and new accounts are appended.
- Added one-click message translation with side-by-side original and translated content. Replies and forwards always use the untranslated source message.
- Translation sends visible text nodes only and writes translated text back into the original HTML structure. CSS, tags, attributes, scripts, and template content are never sent to providers.
- Added 18 translation providers: Aliyun, Baidu, Baidu Field, CNKI, Volcengine, Volcengine Web, Caiyun, DeepL, DeepLX, DeepL Custom, Gemini, Google, Claude, OpenAI, Microsoft, NiuTrans, Tencent Cloud, and Tencent Transmart. LibreTranslate remains available.
- Provider configurations are persisted independently. Combined credentials accept `#` or `@` separators and are protected with AES-256-GCM using a key derived from the database key.
- OpenAI-compatible services can explicitly use the Responses API or Chat Completions API with custom endpoints and models.
- Added common light and dark color themes. The database path and folder action now live under General settings.
- About settings now show the current version and update status, with immediate checks, restart-to-install, and manual, daily, or weekly schedules.

### Fixes and improvements

- New installations default to remote delete synchronization, no signature, direct networking, global IMAP IDLE with a five-minute fallback, and per-account settings inherited from global values.
- Fixed missing selected states for radio buttons and checkboxes in account creation, account editing, and Settings.
- Removed duplicate theme, database, version, and update controls from the main window and consolidated them under Settings.
- Update schedules are enforced by the main process. Manual mode disables background update checks.
- Account batch removal and ordering use database transactions and validate the complete order to prevent partial writes or duplicate positions.

### Compatibility and limitations

- **Legacy theme preferences may be incompatible.** The theme system now supports multiple color themes instead of a simple light/dark pair. Some existing dark-theme preferences may fall back to the default theme; select a theme again under Settings > General.
- **Legacy plaintext remote backups are incompatible.** Only encrypted backups with the `ONEMAIL-REMOTE-BACKUP-V2` header are accepted, and restoration requires the data read key used during upload. Keep a local SQL backup before upgrading.
- POP3 does not support IMAP IDLE, remote folders, remote read/reply flags, or remote deletion. Related operations affect the local cache only.
- Translation sends the visible message body to the selected third-party service. Review message sensitivity and the provider's privacy policy before use.
- CNKI currently translates into Chinese only. Credential-free web endpoints such as Google, Volcengine Web, DeepLX, and Tencent Transmart may be affected by provider rate limits, network conditions, or protocol changes.
- Database migrations are automatic, but older OneMail versions do not understand account ordering, translation settings, color themes, or the new update schedule. Export a local SQL backup before downgrading.
