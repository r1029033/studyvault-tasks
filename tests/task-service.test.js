import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../src/main/database.js';
import { createTaskService } from '../src/main/task-service.js';

const dirs = [];
function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studyvault-task-')); dirs.push(root);
  const db = openDatabase(path.join(root, 'db.sqlite'));
  db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run('vault_path', path.join(root, 'vault'));
  return { db, service: createTaskService(db, () => '2026-09-26T10:00:00.000Z') };
}
afterEach(() => dirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

describe('task service', () => {
  it('rejects blank titles', () => {
    const { db, service } = setup();
    expect(() => service.createTask({ title: '   ' })).toThrow('Task title is required');
    expect(db.prepare('SELECT count(*) count FROM tasks').get().count).toBe(0); db.close();
  });

  it('creates, edits, completes, reopens and deletes with events', () => {
    const { db, service } = setup();
    const created = service.createTask({ title: 'Write report', category: 'Design', dueAt: '2026-09-26T18:00:00.000Z' });
    service.updateTask(created.id, { title: 'Write final report', description: 'Add links', category: 'Design', dueAt: created.dueAt });
    service.completeTask(created.id); service.reopenTask(created.id); service.deleteTask(created.id);
    expect(db.prepare('SELECT count(*) count FROM tasks').get().count).toBe(0);
    expect(db.prepare('SELECT event_type FROM log_events ORDER BY rowid').all().map((r) => r.event_type)).toEqual(['task.created','task.edited','task.completed','task.reopened','task.deleted']);
    db.close();
  });

  it('lists due-today and overdue active tasks only', () => {
    const { db, service } = setup();
    service.createTask({ title: 'Overdue', dueAt: '2026-09-25T10:00:00.000Z' });
    service.createTask({ title: 'Today', dueAt: '2026-09-26T18:00:00.000Z' });
    service.createTask({ title: 'Future', dueAt: '2026-09-27T10:00:00.000Z' });
    const done = service.createTask({ title: 'Done overdue', dueAt: '2026-09-25T10:00:00.000Z' }); service.completeTask(done.id);
    expect(service.listTasks({ view: 'today', now: '2026-09-26T12:00:00+02:00' }).map((t) => t.title)).toEqual(['Overdue','Today']);
    db.close();
  });
});
