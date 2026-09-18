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

## Onboarding / 新手引导

An empty workspace opens a three-minute onboarding dialog on first visit. It offers two real paths: create a demo project (a normal, editable table with sample tasks), or describe a goal and let AI generate the work structure. Creating the demo project also schedules a short in-product tour.

Reopen it any time from the floating guide button in the bottom-right corner, or from **Help Center → Product guides → Onboarding tour → Reopen the tour**. That floating button steps aside while the AI assistant panel is open, so it never overlaps the chat send button.

首次进入空工作区会打开 3 分钟新手引导：可以创建 Demo 项目（一张包含示例任务、可直接编辑的真实数据表），也可以直接描述目标由 AI 生成工作结构；创建 Demo 后会继续一段产品内分步引导。

随时可以从右下角的悬浮引导按钮重新打开，也可以在 **帮助中心 → 产品使用指南 → 新手引导 → 重新打开引导** 中打开。AI 助手面板打开时悬浮引导按钮会自动避让，不会与对话发送按钮重叠。

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
- [v0.1.2-alpha release notes](releases/v0.1.2-alpha.md)
