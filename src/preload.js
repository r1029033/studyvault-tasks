import { contextBridge, ipcRenderer } from 'electron';

// The renderer gets only the small API it needs, not raw Node.js access.
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
  events: { retryAll: () => ipcRenderer.invoke('events:retry-all') },
});
