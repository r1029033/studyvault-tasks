import { appendEvent } from './vault-writer.js';

const line = (value) => String(value ?? '').replace(/[\r\n]+/g, ' ').trim();

export function formatTaskEvent(event) {
  const date = event.occurredAt.slice(0, 10);
  const time = event.occurredAt.slice(11, 19);
  const fields = [
    '---', `event_id: ${line(event.id)}`, `date: ${date}`, `time: ${time}`,
    `timezone: ${line(event.timezoneOffset)}`, `event_type: ${line(event.eventType)}`,
    `status: ${line(event.status)}`, `source_app: ${line(event.sourceApp)}`,
    `task_id: ${line(event.taskId)}`, `title: ${line(event.title)}`,
    `category: ${line(event.category)}`, `due_at: ${line(event.dueAt || 'none')}`, '---', '',
    event.description?.trim() || 'No description.', '', '',
  ];
  return fields.join('\n');
}

export function deliverEvent(db, eventId) {
  const event = db.prepare('SELECT * FROM log_events WHERE id=?').get(eventId);
  if (!event) throw new Error('Event not found');
  try {
    const result = appendEvent(event.destination_path, event.occurred_at, event.id, event.markdown_payload);
    db.prepare("UPDATE log_events SET delivery_state='Written', last_error=NULL WHERE id=?").run(eventId);
    return { state: 'Written', duplicate: result.duplicate };
  } catch (error) {
    db.prepare("UPDATE log_events SET delivery_state='Failed', last_error=? WHERE id=?").run(error.message, eventId);
    throw error;
  }
}

export function retryAllEvents(db) {
  const rows = db.prepare("SELECT id FROM log_events WHERE delivery_state IN ('Pending','Failed') ORDER BY occurred_at").all();
  let written = 0; let failed = 0;
  for (const row of rows) {
    try { deliverEvent(db, row.id); written += 1; } catch { failed += 1; }
  }
  return { written, failed };
}
