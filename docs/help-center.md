# QTableUI Help Center / 帮助中心

This document mirrors the release-safe help surfaced in `/help`. It only documents behavior that exists in the current QTableUI build.

本文档与 `/help` 中的开源帮助内容保持一致，只描述当前版本已经存在的能力。

## Shortcuts / 快捷键

- `Ctrl/⌘ + K`: toggle Global Search / 打开或关闭全局搜索。
- While Global Search is open / 搜索弹窗内：
  - `↑` / `↓`: move the selected result / 移动结果选择；
  - `Enter`: open the selected result / 打开当前结果；
  - `Esc`: close the dialog / 关闭搜索。

No other keyboard shortcut should be treated as supported unless it is implemented in the product code.

## Tables and views / 数据表与多视图

Open **Tables / 数据表** from the primary rail and choose a workspace table. Grid, Kanban, Gantt, Calendar and Gallery are views over the same server-backed table data; they are not separate local datasets.

Core writes are acknowledged by the backend. The UI must not present a write as successful when the server rejects it.

## Task Profile / 业务语义

Every SmartTable page exposes **业务语义** in the table header. Task Profile maps business semantics such as title, status, assignee, priority, dates, progress, parent task, dependencies and workload to explicit field IDs.

AI-style Task Profile suggestions only update a draft. They are not persisted until the user explicitly confirms the change.

See [`docs/task-profile-ui.md`](task-profile-ui.md).

## AI / AI 助手

The AI Center operates within the current user's visible data and permission scope. Business-changing AI flows follow **Preview → Confirm → Apply** and must not present suggestions as already-applied results.

AI providers are user-configured; core table functionality does not require an external AI provider.

Backend AI configuration and deployment guidance: <https://github.com/QingZoneX/QTable#ai-configuration>.

## Automation / 自动化

The Automation Center uses real server-backed rules and exposes rule validation, enable/disable state, test execution and execution history. A failed validation, write or run remains a failure state; the UI must not replace it with local-only success feedback.

Open the in-app center at `/automations` after authentication.

## Self-hosting / 自托管

The canonical one-command stack lives in the QTable backend repository and runs:

- QTable API;
- QTableUI;
- PostgreSQL;
- Redis.

See <https://github.com/QingZoneX/QTable#one-command-self-hosted-stack>.

## Feedback / 反馈

Use QTableUI GitHub Issues for frontend bugs and feature requests:

<https://github.com/QingZoneX/QTableUI/issues>

For bug reports, include:

- QTableUI version;
- browser and operating system;
- reproduction steps;
- expected result;
- actual result.

For feature requests, include the problem, desired experience and acceptable alternatives.

Do **not** include access tokens, API keys, passwords, private workspace/table/record content, or screenshots containing sensitive information.

## Security and contributing / 安全与贡献

- [Security policy](../SECURITY.md)
- [Contributing](../CONTRIBUTING.md)
- [Apache-2.0 License](../LICENSE)
- [v0.1.0-alpha release notes](releases/v0.1.0-alpha.md)
