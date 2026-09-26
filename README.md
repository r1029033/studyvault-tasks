# StudyVault Tasks

A small offline Windows desktop app for school tasks. It shares its SQLite database with StudyVault Focus and writes append-only Markdown events to a user-selected Obsidian vault.

## Requirements

- Node.js 22
- npm 10
- Windows 11

## Install and run

```bash
npm install
npm start
```

Run automated checks:

```bash
npm test
npm run package
```

## First run

1. Open **Settings** or use the setup message.
2. Select a writable Obsidian vault.
3. Create, edit, complete, reopen, and delete tasks.

Data is stored at `%LOCALAPPDATA%\StudyVault\studyvault.db`. Logs are appended under:

```text
<Your Vault>/StudyVault Logs/Tasks/YYYY-MM/YYYY-MM-DD.md
```

If a Markdown write fails, the task is still saved. Open Settings and choose **Retry All** after fixing the vault path or permissions.

## Main dependencies

- Electron Forge and Vite: desktop shell and development build
- React: user interface
- better-sqlite3: local shared database
- Vitest and Testing Library: automated tests

## Manual acceptance checklist

- [ ] Select a vault and restart the app.
- [ ] Create a task with a title, description, category, and due date.
- [ ] Edit the task.
- [ ] Complete and reopen the task.
- [ ] Delete the task after confirmation.
- [ ] Confirm Today includes overdue and due-today active tasks.
- [ ] Confirm all five event types appear in the Task daily log.
- [ ] Disconnect the network and repeat the task workflow.
- [ ] Run `npm install`, `npm test`, and `npm run package` from a clean clone.

Generated samples in `reference/generated-samples/` must be copied from files produced by the running app, not written by hand.
