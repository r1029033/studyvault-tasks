# StudyVault Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the independently runnable StudyVault Tasks Electron application, rename the existing repository to `studyvault-tasks`, and verify task persistence plus append-only Obsidian logging.

**Architecture:** Electron Forge and Vite run a React renderer behind a narrow preload API. The Electron main process owns a shared SQLite database in `%LOCALAPPDATA%\StudyVault`, native folder selection, task services, and Markdown writes. Each task mutation and its log event are committed together before the application attempts the append-only vault write.

**Tech Stack:** Node.js 22, npm, Electron Forge Vite template, Electron, React, JavaScript/JSX, `better-sqlite3`, Vitest, React Testing Library, CSS.

**Spec:** `docs/superpowers/specs/2026-09-26-studyvault-design.md`

## Global Constraints

- Target Windows desktop and work without a network connection after dependencies are installed.
- Use two independent repositories named `studyvault-tasks` and `studyvault-focus`.
- Use JavaScript and JSX, not TypeScript.
- Store the shared database at `%LOCALAPPDATA%\StudyVault\studyvault.db`.
- Use the same idempotent `schema-v1.sql` in both repositories.
- Keep Node.js, SQLite, and filesystem access out of the renderer; expose explicit preload methods only.
- Save operational data and a Pending event in one transaction before attempting a vault append.
- Append records under `StudyVault Logs/Tasks/YYYY-MM/YYYY-MM-DD.md` without truncating earlier content.
- Disable record-producing task controls until a writable vault is configured.
- Keep code simple and comment decisions rather than obvious syntax.
- Do not add search, accounts, cloud sync, reminders, recurring tasks, subtasks, analytics, themes, or installers before required checks pass.

## Review Focus

- Blank or whitespace-only titles must be rejected without creating a task or event; Task 4 tests this.
- A missing or unwritable vault must preserve the task and mark its event Failed; Task 3 and Task 4 test this.
- Retrying an event whose ID is already in the destination file must mark it Written without appending a duplicate; Task 3 tests this.
- Tasks due today and unfinished overdue tasks must appear in Today across local date boundaries; Task 4 tests this with fixed timestamps.
- Two processes opening the same database must tolerate concurrent reads and short writes through WAL and `busy_timeout`; Task 2 tests two database handles.

---

## File Structure

```text
studyvault-tasks/
├── docs/superpowers/specs/2026-09-26-studyvault-design.md
├── docs/superpowers/plans/2026-09-26-studyvault-tasks.md
├── reference/
│   ├── studyvault-design-prototype.html
│   ├── studyvault-step-2-final-prd.md
│   └── 3IXD_Dev5_Assignment_1.pdf
├── src/
│   ├── index.html
│   ├── main.js
│   ├── preload.js
│   ├── renderer.jsx
│   ├── styles.css
│   ├── main/
│   │   ├── database.js
│   │   ├── event-service.js
│   │   ├── ipc.js
│   │   ├── paths.js
│   │   ├── task-service.js
│   │   └── vault-writer.js
│   └── renderer/
│       ├── App.jsx
│       ├── components/Sidebar.jsx
│       ├── components/TaskCard.jsx
│       ├── components/TaskDialog.jsx
│       ├── views/CompletedView.jsx
│       ├── views/SettingsView.jsx
│       ├── views/TasksView.jsx
│       └── views/TodayView.jsx
├── tests/
│   ├── setup.js
│   ├── database.test.js
│   ├── event-service.test.js
│   ├── task-service.test.js
│   └── task-ui.test.jsx
├── schema-v1.sql
├── forge.config.js
├── vite.main.config.mjs
├── vite.preload.config.mjs
├── vite.renderer.config.mjs
├── vitest.config.mjs
├── package.json
└── README.md
```

## Task 1: Rename the Repository and Establish a Tested Electron/React Shell

**Files:**
- Modify: `package.json`
- Modify: `forge.config.js`
- Modify: `vite.renderer.config.mjs`
- Create: `src/renderer.jsx`
- Create: `src/renderer/App.jsx`
- Create: `tests/setup.js`
- Create: `tests/task-ui.test.jsx`
- Create: `vitest.config.mjs`
- Copy: `reference/studyvault-design-prototype.html`
- Copy: `reference/studyvault-step-2-final-prd.md`
- Copy: `reference/3IXD_Dev5_Assignment_1.pdf`

**Interfaces:**
- Consumes: existing Git repository and approved design specification.
- Produces: `npm start`, `npm test`, and a React renderer rooted at `src/renderer.jsx`.

- [ ] **Step 1: Rename the GitHub repository and update the local project identity**

Run:

```bash
gh repo rename studyvault-tasks --yes
npm pkg set name=studyvault-tasks productName="StudyVault Tasks"
git remote -v
gh repo view --json nameWithOwner,url,isPrivate
```

Expected: `origin` points to `r1029033/studyvault-tasks`, and the repository remains private.

- [ ] **Step 2: Generate the Forge Vite shell in scratch space and copy its application files into this repository**

Run:

```bash
rm -rf "$TMPDIR/studyvault-tasks-scaffold"
NODE_INSTALLER=npm npx create-electron-app@latest "$TMPDIR/studyvault-tasks-scaffold" --template=vite
cp -R "$TMPDIR/studyvault-tasks-scaffold/src" .
cp "$TMPDIR/studyvault-tasks-scaffold/forge.config.js" .
cp "$TMPDIR/studyvault-tasks-scaffold/vite.main.config.mjs" .
cp "$TMPDIR/studyvault-tasks-scaffold/vite.preload.config.mjs" .
cp "$TMPDIR/studyvault-tasks-scaffold/vite.renderer.config.mjs" .
cp "$TMPDIR/studyvault-tasks-scaffold/package.json" package.json
cp "$TMPDIR/studyvault-tasks-scaffold/package-lock.json" package-lock.json
npm pkg set name=studyvault-tasks productName="StudyVault Tasks"
npm install
npm install react react-dom better-sqlite3
npm install --save-dev @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Expected: dependencies install successfully on Node `v22.23.2`.

- [ ] **Step 3: Write the failing React shell test**

Create `tests/task-ui.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../src/renderer/App.jsx';

describe('StudyVault Tasks shell', () => {
  it('shows the product name and primary task navigation', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Tasks' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New task' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Completed' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Configure Vitest and run the test to verify it fails**

Create `tests/setup.js`:

```js
import '@testing-library/jest-dom/vitest';
```

Create `vitest.config.mjs`:

```js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    clearMocks: true,
  },
});
```

Add scripts:

```bash
npm pkg set scripts.test="vitest run" scripts.test:watch="vitest"
npm test -- tests/task-ui.test.jsx
```

Expected: FAIL because `src/renderer/App.jsx` does not exist or does not render the required controls.

- [ ] **Step 5: Implement the minimal React shell**

Create `src/renderer/App.jsx`:

```jsx
export default function App() {
  return (
    <div className="app-shell">
      <aside>
        <strong>StudyVault Tasks</strong>
        <button type="button">Tasks</button>
        <button type="button">Today</button>
        <button type="button">Completed</button>
        <button type="button">Settings</button>
      </aside>
      <main>
        <h1>Tasks</h1>
        <button type="button">New task</button>
      </main>
    </div>
  );
}
```

Create `src/renderer.jsx`:

```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './renderer/App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

Update `src/index.html` so `<body>` contains `<div id="root"></div>` and loads `/src/renderer.jsx` as a module. Configure `vite.renderer.config.mjs` with `react()`.

- [ ] **Step 6: Run shell checks**

Run:

```bash
npm test -- tests/task-ui.test.jsx
npm run package
```

Expected: test PASS and Forge packages the shell without an import error.

- [ ] **Step 7: Copy reference artifacts and commit**

Copy the three supplied attachments into `reference/`, then run:

```bash
git add package.json package-lock.json forge.config.js vite.*.config.mjs vitest.config.mjs src tests reference docs
git commit -m "chore: scaffold StudyVault Tasks"
```

## Task 2: Shared SQLite Schema and Database Opening

**Files:**
- Create: `schema-v1.sql`
- Create: `src/main/paths.js`
- Create: `src/main/database.js`
- Create: `tests/database.test.js`

**Interfaces:**
- Consumes: `better-sqlite3`.
- Produces: `getDatabasePath(appDataPath) -> string`, `openDatabase(databasePath) -> Database`, `closeDatabase() -> void`.

- [ ] **Step 1: Write the failing schema and concurrency tests**

Create `tests/database.test.js`:

```js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../src/main/database.js';

const tempDirectories = [];

function newDatabasePath() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'studyvault-db-'));
  tempDirectories.push(directory);
  return path.join(directory, 'studyvault.db');
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('openDatabase', () => {
  it('creates every schema-v1 table and default category', () => {
    const db = openDatabase(newDatabasePath());
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name);

    expect(tables).toEqual(expect.arrayContaining([
      'schema_info', 'categories', 'tasks', 'sessions', 'session_pauses', 'settings', 'log_events',
    ]));
    expect(db.prepare('SELECT name FROM categories WHERE name = ?').get('Uncategorized')).toBeTruthy();
    db.close();
  });

  it('allows two WAL connections to read after a short write', () => {
    const databasePath = newDatabasePath();
    const first = openDatabase(databasePath);
    const second = openDatabase(databasePath);

    first.prepare('INSERT INTO categories (id, name, created_at) VALUES (?, ?, ?)')
      .run('cat-test', 'Testing', '2026-09-26T10:00:00.000Z');

    expect(second.prepare('SELECT name FROM categories WHERE id = ?').get('cat-test').name).toBe('Testing');
    expect(first.pragma('journal_mode', { simple: true }).toLowerCase()).toBe('wal');
    first.close();
    second.close();
  });
});
```

- [ ] **Step 2: Run the database test to verify it fails**

Run:

```bash
npm test -- tests/database.test.js
```

Expected: FAIL because `src/main/database.js` does not exist.

- [ ] **Step 3: Create the exact schema**

Create `schema-v1.sql` with `schema_info`, `categories`, `tasks`, `sessions`, `session_pauses`, `settings`, and `log_events`. Use text UUID primary keys, ISO-8601 timestamp text, integer duration seconds, foreign keys where deletion does not damage history, and indexes on task status/due date, session start time, and log-event state. Insert schema version `1` and the `Uncategorized` category with `INSERT OR IGNORE`.

The `tasks` table must include `id`, `title`, `description`, `due_at`, `category_id`, `status`, `created_at`, `updated_at`, and `completed_at`. The `sessions` table must include `id`, `type`, `planned_seconds`, `actual_seconds`, `started_at`, `finished_at`, `outcome`, `task_id`, and `context_snapshot`. The `session_pauses` table must include `id`, `session_id`, `paused_at`, and nullable `resumed_at`, with `ON DELETE CASCADE` from sessions. The `log_events` table must include `id`, `event_type`, `occurred_at`, `timezone_offset`, `source_app`, `entity_id`, `markdown_payload`, `destination_path`, `delivery_state`, and `last_error`.

Use these constraints in `schema-v1.sql`:

```sql
CREATE TABLE IF NOT EXISTS schema_info (
  version INTEGER PRIMARY KEY CHECK (version = 1)
);
INSERT OR IGNORE INTO schema_info (version) VALUES (1);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description TEXT,
  due_at TEXT,
  category_id TEXT NOT NULL REFERENCES categories(id),
  status TEXT NOT NULL CHECK (status IN ('Active', 'Completed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('Focus', 'Break')),
  planned_seconds INTEGER NOT NULL CHECK (planned_seconds > 0),
  actual_seconds INTEGER,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('Running', 'Paused', 'Completed', 'Cancelled')),
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  context_snapshot TEXT
);

CREATE TABLE IF NOT EXISTS session_pauses (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  paused_at TEXT NOT NULL,
  resumed_at TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS log_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  timezone_offset TEXT NOT NULL,
  source_app TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  markdown_payload TEXT NOT NULL,
  destination_path TEXT NOT NULL,
  delivery_state TEXT NOT NULL CHECK (delivery_state IN ('Pending', 'Written', 'Failed')),
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_tasks_status_due ON tasks(status, due_at);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_log_events_state ON log_events(delivery_state, occurred_at);

INSERT OR IGNORE INTO categories (id, name, created_at)
VALUES ('category-uncategorized', 'Uncategorized', '1970-01-01T00:00:00.000Z');
```

- [ ] **Step 4: Implement paths and database opening**

Create `src/main/paths.js`:

```js
import path from 'node:path';

export function getDatabasePath(localAppDataPath) {
  return path.join(localAppDataPath, 'StudyVault', 'studyvault.db');
}
```

Create `src/main/database.js`:

```js
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const schemaPath = path.resolve(process.cwd(), 'schema-v1.sql');

export function openDatabase(databasePath) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new Database(databasePath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 3000');
  db.exec(fs.readFileSync(schemaPath, 'utf8'));

  const version = db.prepare('SELECT version FROM schema_info LIMIT 1').get()?.version;
  if (version !== 1) {
    db.close();
    throw new Error(`Unsupported StudyVault schema version: ${version}`);
  }

  return db;
}
```

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm test -- tests/database.test.js
git add schema-v1.sql src/main/paths.js src/main/database.js tests/database.test.js
git commit -m "feat: add shared SQLite schema"
```

Expected: both database tests PASS.

## Task 3: Markdown Events, Append-Only Vault Writes, and Retry

**Files:**
- Create: `src/main/vault-writer.js`
- Create: `src/main/event-service.js`
- Create: `tests/event-service.test.js`

**Interfaces:**
- Consumes: an open `better-sqlite3` database and configured vault path.
- Produces: `formatTaskEvent(event) -> string`, `getTaskLogPath(vaultPath, occurredAt) -> string`, `deliverEvent(db, eventId) -> { state, duplicate }`, `retryAllEvents(db) -> { written, failed }`.

- [ ] **Step 1: Write failing formatter, append, failure, and duplicate tests**

Create tests that assert:

```js
const markdown = formatTaskEvent({
  id: 'evt-1',
  eventType: 'task.created',
  occurredAt: '2026-09-26T10:15:00.000Z',
  timezoneOffset: '+02:00',
  sourceApp: 'StudyVault Tasks',
  taskId: 'task-1',
  status: 'Active',
  title: 'Write report',
  description: 'Include repository links',
  category: 'Design',
  dueAt: '2026-09-28T18:00:00.000+02:00',
});

expect(markdown).toContain('event_id: evt-1');
expect(markdown).toContain('event_type: task.created');
expect(markdown).toContain('timezone: +02:00');
expect(markdown).toContain('title: Write report');
```

Also create a temporary vault, insert Pending events into `log_events`, and assert:

- two deliveries leave two entries in one daily file;
- delivery to an invalid vault path marks the event Failed and preserves its payload;
- retry after fixing the path marks the event Written;
- retry when the file already contains `event_id: evt-1` does not append another copy.

- [ ] **Step 2: Run the event tests to verify they fail**

Run:

```bash
npm test -- tests/event-service.test.js
```

Expected: FAIL because formatter and delivery functions do not exist.

- [ ] **Step 3: Implement deterministic Task Markdown formatting**

Implement `formatTaskEvent(event)` with one YAML-like Markdown block per event:

```md
---
event_id: evt-1
date: 2026-09-26
time: 12:15:00
timezone: +02:00
event_type: task.created
status: Active
source_app: StudyVault Tasks
task_id: task-1
title: Write report
category: Design
due_at: 2026-09-28T18:00:00.000+02:00
---

Include repository links
```

Escape line breaks in single-line fields, preserve the description as body text, and end every entry with two newlines.

- [ ] **Step 4: Implement duplicate-safe append and retry**

In `vault-writer.js`, derive:

```text
<vault>/StudyVault Logs/Tasks/2026-09/2026-09-26.md
```

Create missing directories, read an existing daily file if present, return `{ state: 'Written', duplicate: true }` when it already contains the event ID, otherwise append with `fs.appendFileSync`.

In `event-service.js`, load the event by ID, call the writer, then update `delivery_state` and `last_error`. `retryAllEvents` must process `Pending` and `Failed` rows oldest-first and return exact written/failed counts.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm test -- tests/event-service.test.js
git add src/main/vault-writer.js src/main/event-service.js tests/event-service.test.js
git commit -m "feat: add append-only task event logging"
```

Expected: formatter, append, failure, retry, and duplicate tests PASS.

## Task 4: Task Service and Today Filtering

**Files:**
- Create: `src/main/task-service.js`
- Create: `tests/task-service.test.js`

**Interfaces:**
- Consumes: database handle and `deliverEvent(db, eventId)`.
- Produces: `createTask(input)`, `listTasks(filter)`, `updateTask(id, input)`, `completeTask(id)`, `reopenTask(id)`, `deleteTask(id)`.

- [ ] **Step 1: Write failing service tests**

Cover these exact behaviors:

```js
expect(() => service.createTask({ title: '   ' })).toThrow('Task title is required');
```

Create a task and assert one `tasks` row plus one `task.created` event. Edit it and assert `task.edited`. Complete and reopen it and assert status/timestamps plus `task.completed` and `task.reopened`. Delete it and assert the task is absent while `task.deleted` remains.

For Today, fix `now` to `2026-09-26T12:00:00+02:00`; insert one overdue active task, one due-today active task, one future active task, and one overdue completed task. Assert `listTasks({ view: 'today', now })` returns only the first two.

Use an unwritable vault path for one create call and assert the task exists while its event is Failed.

- [ ] **Step 2: Run the service tests to verify they fail**

Run:

```bash
npm test -- tests/task-service.test.js
```

Expected: FAIL because `createTask` and related methods do not exist.

- [ ] **Step 3: Implement validation and transaction helpers**

Use `crypto.randomUUID()` for IDs. Normalize optional empty strings to `null`. Validate status transitions in service methods rather than trusting renderer input. Each mutation must use one `better-sqlite3` transaction to write both operational data and a Pending log event.

The method returns the saved task plus `deliveryState`. Call `deliverEvent` only after the transaction commits.

- [ ] **Step 4: Implement Today filtering in SQL**

Convert the supplied local `now` to local-day start and end ISO values. Query active tasks where `due_at < tomorrowStart`; this includes overdue and due-today tasks and excludes undated tasks. Order overdue and today work by `due_at`, then title.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm test -- tests/task-service.test.js
npm test
git add src/main/task-service.js tests/task-service.test.js
git commit -m "feat: implement task lifecycle"
```

Expected: all tests PASS.

## Task 5: Secure IPC, Vault Selection, and Electron Lifecycle

**Files:**
- Modify: `src/main.js`
- Modify: `src/preload.js`
- Create: `src/main/ipc.js`

**Interfaces:**
- Consumes: task service, event service, Electron `dialog`, and shared database path.
- Produces: `window.studyVault.tasks.*`, `window.studyVault.settings.*`, and `window.studyVault.events.retryAll()`.

- [ ] **Step 1: Define the preload API before handlers**

Expose only these methods:

```js
contextBridge.exposeInMainWorld('studyVault', {
  tasks: {
    list: (filter) => ipcRenderer.invoke('tasks:list', filter),
    create: (input) => ipcRenderer.invoke('tasks:create', input),
    update: (id, input) => ipcRenderer.invoke('tasks:update', { id, input }),
    complete: (id) => ipcRenderer.invoke('tasks:complete', id),
    reopen: (id) => ipcRenderer.invoke('tasks:reopen', id),
    delete: (id) => ipcRenderer.invoke('tasks:delete', id),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    chooseVault: () => ipcRenderer.invoke('settings:choose-vault'),
  },
  events: {
    retryAll: () => ipcRenderer.invoke('events:retry-all'),
  },
});
```

Do not expose `ipcRenderer` itself.

- [ ] **Step 2: Register validated IPC handlers**

Create one handler for each preload method. Convert thrown errors to `{ ok: false, error: error.message }`; successful calls return `{ ok: true, data }`. `settings:choose-vault` uses `dialog.showOpenDialog({ properties: ['openDirectory'] })`, verifies write access by creating and deleting a small `.studyvault-write-test` file, then stores `vault_path` in `settings`.

- [ ] **Step 3: Wire application startup**

In `src/main.js`, open the database after `app.whenReady()`, register IPC once, create a BrowserWindow with `contextIsolation: true`, `nodeIntegration: false`, and the preload script, and close the database in `before-quit`.

- [ ] **Step 4: Run security and package checks**

Run:

```bash
npm test
npm run package
```

Then start the app and verify DevTools renderer code reports `typeof require === 'undefined'` and `typeof window.studyVault.tasks.list === 'function'`.

- [ ] **Step 5: Commit**

```bash
git add src/main.js src/preload.js src/main/ipc.js
git commit -m "feat: expose secure task APIs"
```

## Task 6: Build the Tasks, Today, Completed, and Settings Interface

**Files:**
- Modify: `src/renderer/App.jsx`
- Create: `src/renderer/components/Sidebar.jsx`
- Create: `src/renderer/components/TaskCard.jsx`
- Create: `src/renderer/components/TaskDialog.jsx`
- Create: `src/renderer/views/TasksView.jsx`
- Create: `src/renderer/views/TodayView.jsx`
- Create: `src/renderer/views/CompletedView.jsx`
- Create: `src/renderer/views/SettingsView.jsx`
- Modify: `src/styles.css`
- Modify: `tests/task-ui.test.jsx`

**Interfaces:**
- Consumes: `window.studyVault` preload API.
- Produces: all required StudyVault Tasks user flows.

- [ ] **Step 1: Replace the shell test with failing user-flow tests**

Mock `window.studyVault` and test:

- initial load with no vault displays setup and disables New task;
- selecting a vault enables New task;
- creating a task submits title, description, due value, and category;
- completing an active task calls `tasks.complete`;
- Completed renders a Reopen button that calls `tasks.reopen`;
- delete opens confirmation before calling `tasks.delete`;
- a Failed delivery response shows a persistent vault warning while keeping the new task visible;
- Today renders overdue text containing `Overdue`, not color alone.

Use `userEvent` for all interactions.

- [ ] **Step 2: Run the UI tests to verify they fail**

Run:

```bash
npm test -- tests/task-ui.test.jsx
```

Expected: FAIL because the shell does not implement the flows.

- [ ] **Step 3: Implement view state and refresh behavior**

`App.jsx` owns only the current view, category filter, settings, task list, loading state, and error message. Load settings and the selected task view on mount. Refresh on `window.focus` and every 1000 milliseconds; clear the interval on unmount.

Keep task operations in small async callbacks that consume `{ ok, data, error }` and then refresh the current view.

- [ ] **Step 4: Implement accessible components**

Use real `<button>`, `<form>`, `<label>`, `<input>`, `<textarea>`, and `<select>` elements. Give icon-only controls descriptive `aria-label` values. Keep focus inside the task dialog while open by focusing the title input initially and returning focus to the opener after close.

The Task dialog uses HTML date and time inputs. Combine them into a local ISO string only when a date exists; a time without a date is rejected with `Choose a due date before a due time`.

- [ ] **Step 5: Apply the prototype visual system**

Port the supplied prototype tokens and layouts into `src/styles.css`: paper, panel, line, accent, accent-dark, danger, display font, UI font, sidebar, task card, dialog, settings cards, keyboard focus, and reduced-motion rule. Keep required actions visible without hover.

- [ ] **Step 6: Run tests and manually exercise the renderer**

Run:

```bash
npm test
npm start
```

Manually select a temporary vault, create, edit, complete, reopen, and delete one task. Restart the app and confirm the remaining task persists.

- [ ] **Step 7: Commit**

```bash
git add src/renderer src/styles.css tests/task-ui.test.jsx
git commit -m "feat: build task management interface"
```

## Task 7: README, Real Log Sample, and Clean-Clone Verification

**Files:**
- Modify: `README.md`
- Create after UI generation: `reference/generated-samples/StudyVault-Tasks-sample.md`

**Interfaces:**
- Consumes: complete Tasks application.
- Produces: reproducible setup instructions and verified assignment evidence.

- [ ] **Step 1: Write README instructions**

Document prerequisites, `npm install`, `npm start`, `npm test`, `npm run package`, dependencies, first-run vault selection, shared database location, vault folder structure, all task workflows, offline behavior, and the manual acceptance checklist. Explain that generated samples must come from UI actions rather than hand-authored examples.

- [ ] **Step 2: Run the complete automated suite and package check**

Run:

```bash
npm test
npm run package
```

Expected: zero failing tests and a successful package build.

- [ ] **Step 3: Generate a real task log through the UI**

Using a temporary vault selected in the running app, create, edit, complete, reopen, and delete a task. Copy the resulting daily Task Markdown file to `reference/generated-samples/StudyVault-Tasks-sample.md`. Verify the copied file includes all five event types and unique event IDs.

- [ ] **Step 4: Verify from a clean clone**

Run outside the repository:

```bash
rm -rf "$TMPDIR/studyvault-tasks-clean"
gh repo clone r1029033/studyvault-tasks "$TMPDIR/studyvault-tasks-clean"
cd "$TMPDIR/studyvault-tasks-clean"
npm install
npm test
npm run package
```

Expected: installation, tests, and packaging succeed without files from the original working tree.

- [ ] **Step 5: Commit and push**

```bash
git add README.md reference/generated-samples/StudyVault-Tasks-sample.md
git commit -m "docs: verify StudyVault Tasks delivery"
git push -u origin main
gh repo view r1029033/studyvault-tasks --json nameWithOwner,url,defaultBranchRef
```

Expected: GitHub reports `main` as the default branch and the pushed commits are visible.
