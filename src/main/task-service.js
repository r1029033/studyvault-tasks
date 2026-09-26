import { randomUUID } from 'node:crypto';
import { deliverEvent, formatTaskEvent } from './event-service.js';

function offsetString() {
  const minutes = -new Date().getTimezoneOffset();
  const sign = minutes >= 0 ? '+' : '-';
  const value = Math.abs(minutes);
  return `${sign}${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

export function createTaskService(db, now = () => new Date().toISOString()) {
  const taskRow = (id) => db.prepare(`SELECT tasks.*, categories.name category FROM tasks JOIN categories ON categories.id=tasks.category_id WHERE tasks.id=?`).get(id);
  const vaultPath = () => db.prepare("SELECT value FROM settings WHERE key='vault_path'").get()?.value;
  const categoryId = (name = 'Uncategorized') => {
    const clean = name.trim() || 'Uncategorized';
    let row = db.prepare('SELECT id FROM categories WHERE name=?').get(clean);
    if (!row) {
      const id = `category-${randomUUID()}`;
      db.prepare('INSERT INTO categories (id,name,created_at) VALUES (?,?,?)').run(id, clean, now()); row = { id };
    }
    return row.id;
  };
  const addEvent = (type, task, status) => {
    const id = randomUUID(); const occurredAt = now(); const vault = vaultPath();
    if (!vault) throw new Error('Choose an Obsidian vault first');
    const markdown = formatTaskEvent({ id, eventType: type, occurredAt, timezoneOffset: offsetString(), sourceApp: 'StudyVault Tasks', taskId: task.id, status, title: task.title, description: task.description, category: task.category, dueAt: task.due_at });
    db.prepare(`INSERT INTO log_events (id,event_type,occurred_at,timezone_offset,source_app,entity_id,markdown_payload,destination_path,delivery_state,last_error) VALUES (?,?,?,?,?,?,?,?,?,NULL)`).run(id, type, occurredAt, offsetString(), 'StudyVault Tasks', task.id, markdown, vault, 'Pending');
    return id;
  };
  const deliver = (eventId) => { try { return deliverEvent(db, eventId).state; } catch { return 'Failed'; } };

  return {
    createTask(input) {
      const title = input.title?.trim(); if (!title) throw new Error('Task title is required');
      const id = randomUUID(); const stamp = now(); const catId = categoryId(input.category);
      const write = db.transaction(() => {
        db.prepare(`INSERT INTO tasks (id,title,description,due_at,category_id,status,created_at,updated_at,completed_at) VALUES (?,?,?,?,?,'Active',?,?,NULL)`).run(id, title, input.description?.trim() || null, input.dueAt || null, catId, stamp, stamp);
        return addEvent('task.created', taskRow(id), 'Active');
      });
      const eventId = write(); const deliveryState = deliver(eventId); return { ...this.getTask(id), deliveryState };
    },
    getTask(id) { return taskRow(id); },
    listTasks({ view = 'tasks', now: current = new Date().toISOString(), category = 'All' } = {}) {
      const params = []; let where = view === 'completed' ? "tasks.status='Completed'" : "tasks.status='Active'";
      if (view === 'today') { const d = new Date(current); d.setHours(24, 0, 0, 0); where += ' AND tasks.due_at IS NOT NULL AND tasks.due_at < ?'; params.push(d.toISOString()); }
      if (category !== 'All') { where += ' AND categories.name=?'; params.push(category); }
      return db.prepare(`SELECT tasks.*, categories.name category FROM tasks JOIN categories ON categories.id=tasks.category_id WHERE ${where} ORDER BY CASE WHEN due_at IS NULL THEN 1 ELSE 0 END, due_at, title COLLATE NOCASE`).all(...params);
    },
    updateTask(id, input) {
      const existing = taskRow(id); if (!existing) throw new Error('Task not found');
      const title = input.title?.trim(); if (!title) throw new Error('Task title is required');
      const write = db.transaction(() => {
        db.prepare('UPDATE tasks SET title=?,description=?,due_at=?,category_id=?,updated_at=? WHERE id=?').run(title, input.description?.trim() || null, input.dueAt || null, categoryId(input.category), now(), id);
        return addEvent('task.edited', taskRow(id), existing.status);
      });
      const eventId = write(); return { ...taskRow(id), deliveryState: deliver(eventId) };
    },
    completeTask(id) { return changeStatus(id, 'Completed', 'task.completed'); },
    reopenTask(id) { return changeStatus(id, 'Active', 'task.reopened'); },
    deleteTask(id) {
      const task = taskRow(id); if (!task) throw new Error('Task not found');
      const write = db.transaction(() => { const eventId = addEvent('task.deleted', task, 'Deleted'); db.prepare('DELETE FROM tasks WHERE id=?').run(id); return eventId; });
      return { id, deliveryState: deliver(write()) };
    },
  };

  function changeStatus(id, status, eventType) {
    const task = taskRow(id); if (!task) throw new Error('Task not found');
    if (task.status === status) return task;
    const write = db.transaction(() => {
      const stamp = now(); db.prepare('UPDATE tasks SET status=?,updated_at=?,completed_at=? WHERE id=?').run(status, stamp, status === 'Completed' ? stamp : null, id);
      return addEvent(eventType, taskRow(id), status);
    });
    const eventId = write(); return { ...taskRow(id), deliveryState: deliver(eventId) };
  }
}
