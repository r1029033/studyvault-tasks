import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../src/main/database.js';
import { deliverEvent, formatTaskEvent, retryAllEvents } from '../src/main/event-service.js';

const dirs = [];
const temp = (prefix) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); dirs.push(dir); return dir; };
afterEach(() => dirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

function addEvent(db, vault, id = 'evt-1') {
  const payload = formatTaskEvent({ id, eventType: 'task.created', occurredAt: '2026-09-26T10:15:00.000Z', timezoneOffset: '+02:00', sourceApp: 'StudyVault Tasks', taskId: 'task-1', status: 'Active', title: 'Write report', description: 'Include repository links', category: 'Design', dueAt: null });
  db.prepare(`INSERT INTO log_events (id,event_type,occurred_at,timezone_offset,source_app,entity_id,markdown_payload,destination_path,delivery_state,last_error) VALUES (?,?,?,?,?,?,?,?,?,NULL)`).run(id, 'task.created', '2026-09-26T10:15:00.000Z', '+02:00', 'StudyVault Tasks', 'task-1', payload, vault, 'Pending');
}

describe('task event delivery', () => {
  it('formats required fields', () => {
    const text = formatTaskEvent({ id: 'evt-1', eventType: 'task.created', occurredAt: '2026-09-26T10:15:00.000Z', timezoneOffset: '+02:00', sourceApp: 'StudyVault Tasks', taskId: 'task-1', status: 'Active', title: 'Write report', description: 'Include repository links', category: 'Design', dueAt: null });
    expect(text).toContain('event_id: evt-1');
    expect(text).toContain('event_type: task.created');
    expect(text).toContain('title: Write report');
  });

  it('appends once and treats an existing event id as delivered', () => {
    const root = temp('studyvault-events-'); const db = openDatabase(path.join(root, 'db.sqlite')); const vault = path.join(root, 'vault');
    addEvent(db, vault); expect(deliverEvent(db, 'evt-1').state).toBe('Written');
    db.prepare("UPDATE log_events SET delivery_state='Failed'").run();
    expect(deliverEvent(db, 'evt-1').duplicate).toBe(true);
    const file = path.join(vault, 'StudyVault Logs', 'Tasks', '2026-09', '2026-09-26.md');
    expect(fs.readFileSync(file, 'utf8').match(/event_id: evt-1/g)).toHaveLength(1); db.close();
  });

  it('keeps failures for retry', () => {
    const root = temp('studyvault-fail-'); const db = openDatabase(path.join(root, 'db.sqlite')); const bad = path.join(root, 'blocked'); fs.writeFileSync(bad, 'file');
    addEvent(db, bad); expect(() => deliverEvent(db, 'evt-1')).toThrow();
    expect(db.prepare('SELECT delivery_state FROM log_events WHERE id=?').get('evt-1').delivery_state).toBe('Failed');
    const vault = path.join(root, 'vault'); db.prepare('UPDATE log_events SET destination_path=? WHERE id=?').run(vault, 'evt-1');
    expect(retryAllEvents(db)).toEqual({ written: 1, failed: 0 }); db.close();
  });
});
