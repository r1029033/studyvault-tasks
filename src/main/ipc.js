import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { dialog, ipcMain } from 'electron';
import { createTaskService } from './task-service.js';
import { retryAllEvents } from './event-service.js';

const wrap = (handler) => async (_event, input) => {
  try { return { ok: true, data: await handler(input) }; }
  catch (error) { return { ok: false, error: error.message }; }
};

export function registerIpc(db) {
  const tasks = createTaskService(db);
  ipcMain.handle('tasks:list', wrap((filter) => tasks.listTasks(filter)));
  ipcMain.handle('tasks:create', wrap((input) => tasks.createTask(input)));
  ipcMain.handle('tasks:update', wrap(({ id, input }) => tasks.updateTask(id, input)));
  ipcMain.handle('tasks:complete', wrap((id) => tasks.completeTask(id)));
  ipcMain.handle('tasks:reopen', wrap((id) => tasks.reopenTask(id)));
  ipcMain.handle('tasks:delete', wrap((id) => tasks.deleteTask(id)));
  ipcMain.handle('settings:get', wrap(() => {
    const vaultPath = db.prepare("SELECT value FROM settings WHERE key='vault_path'").get()?.value || null;
    const failedEvents = db.prepare("SELECT count(*) count FROM log_events WHERE delivery_state='Failed'").get().count;
    return { vaultPath, failedEvents };
  }));
  ipcMain.handle('settings:choose-vault', wrap(async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (result.canceled) return null;
    const vaultPath = result.filePaths[0];
    const probe = path.join(vaultPath, `.studyvault-write-test-${randomUUID()}`);
    let handle;
    try { handle = fs.openSync(probe, 'wx'); } finally { if (handle !== undefined) fs.closeSync(handle); if (fs.existsSync(probe)) fs.unlinkSync(probe); }
    db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run('vault_path', vaultPath);
    return { vaultPath, failedEvents: 0 };
  }));
  ipcMain.handle('events:retry-all', wrap(() => retryAllEvents(db)));
}
