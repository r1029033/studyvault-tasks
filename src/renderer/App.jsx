import { useCallback, useEffect, useState } from 'react';
import studyBuddyImage from '../assets/studybuddy.png';

const titles = { tasks: 'Tasks', today: 'Today', completed: 'Completed', settings: 'Settings' };
const initialForm = { title: '', description: '', dueDate: '', dueTime: '', category: 'Uncategorized' };
const pad = (value) => String(value).padStart(2, '0');
const localDateValue = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const studyTips = [
  'Start with a two-minute task to build momentum.',
  'Turn a big assignment into the next smallest action.',
  'Study for 25 minutes, then take a five-minute break.',
  'Put your most important task at the top of the list.',
  'Close extra tabs before a focused study session.',
  'Review new material once today and once tomorrow.',
  'Give every task a clear verb: write, read, solve, or review.',
  'Estimate how long a task will take before you begin.',
  'Group similar small tasks and finish them together.',
  'End your session by choosing tomorrow\'s first task.',
];

function randomTip(exclude = '') {
  const choices = studyTips.filter((tip) => tip !== exclude);
  return choices[Math.floor(Math.random() * choices.length)];
}

export default function App() {
  const [view, setView] = useState('tasks');
  const [settings, setSettings] = useState({ vaultPath: null, failedEvents: 0 });
  const [tasks, setTasks] = useState([]);
  const [category, setCategory] = useState('All');
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [studyTip, setStudyTip] = useState(() => randomTip());

  const refresh = useCallback(async () => {
    const settingsResult = await window.studyVault.settings.get();
    if (settingsResult.ok) setSettings(settingsResult.data);
    const taskResult = await window.studyVault.tasks.list({ view, category });
    if (taskResult.ok) setTasks(taskResult.data);
    else setError(taskResult.error);
  }, [view, category]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 1000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [refresh]);

  async function chooseVault() {
    const result = await window.studyVault.settings.chooseVault();
    if (result.ok && result.data) { setSettings(result.data); setError(''); }
    else if (!result.ok) setError(result.error);
  }

  async function saveTask(event) {
    event.preventDefault();
    if (!form.title.trim()) return setError('Task title is required');
    if (form.dueTime && !form.dueDate) return setError('Choose a due date before a due time');
    const dueAt = form.dueDate ? new Date(`${form.dueDate}T${form.dueTime || '23:59'}`).toISOString() : null;
    const input = { title: form.title, description: form.description, category: form.category, dueAt };
    const result = editing ? await window.studyVault.tasks.update(editing.id, input) : await window.studyVault.tasks.create(input);
    if (!result.ok) return setError(result.error);
    if (result.data?.deliveryState === 'Failed') setError('Task saved, but the Obsidian log failed. Use Retry All in Settings.');
    else setError('');
    setForm(null); setEditing(null); await refresh();
  }

  async function changeTask(method, task) {
    const result = await window.studyVault.tasks[method](task.id);
    if (!result.ok) return setError(result.error);
    if (result.data?.deliveryState === 'Failed') setError('Task saved, but the Obsidian log failed. Use Retry All in Settings.');
    else setError('');
    await refresh();
  }
  async function complete(task) { await changeTask('complete', task); }
  async function reopen(task) { await changeTask('reopen', task); }
  async function remove(task) { if (confirm(`Delete “${task.title}”?`)) await changeTask('delete', task); }
  function edit(task) {
    const due = task.due_at ? new Date(task.due_at) : null;
    setEditing(task); setForm({ title: task.title, description: task.description || '', dueDate: due ? localDateValue(due) : '', dueTime: due ? `${pad(due.getHours())}:${pad(due.getMinutes())}` : '', category: task.category });
  }
  function overdue(task) { return task.due_at && new Date(task.due_at) < new Date() && task.status === 'Active'; }
  const categories = [...new Set([...tasks.map((task) => task.category), ...(category === 'All' ? [] : [category])])].sort();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div><span className="eyebrow">StudyVault</span><h2>Tasks</h2></div>
        <nav>{['tasks','today','completed','settings'].map((name) => <button className={view === name ? 'active' : ''} key={name} onClick={() => setView(name)}>{titles[name]}</button>)}</nav>
        <section className="study-buddy" aria-labelledby="study-buddy-title">
          <div className="buddy-tip" aria-live="polite">
            <span className="eyebrow" id="study-buddy-title">StudyBuddy says</span>
            <p>{studyTip}</p>
          </div>
          <img src={studyBuddyImage} alt="StudyBuddy, a bunny reading a notebook" />
          <button type="button" onClick={() => setStudyTip(randomTip(studyTip))}>New tip</button>
        </section>
        <p className="vault-state">{settings.vaultPath ? '● Vault connected' : '○ Vault not selected'}</p>
      </aside>
      <main>
        <header><div><span className="eyebrow">Schoolwork</span><h1>{titles[view]}</h1></div>{view !== 'completed' && view !== 'settings' && <button className="primary" disabled={!settings.vaultPath} onClick={() => { setEditing(null); setForm(initialForm); }}>New task</button>}</header>
        {error && <p className="error" role="alert">{error}</p>}
        {!settings.vaultPath && view !== 'settings' && <section className="notice"><h3>Choose an Obsidian vault</h3><p>Tasks stay disabled until StudyVault can create append-only activity records.</p><button className="primary" onClick={chooseVault}>Choose vault</button></section>}
        {view === 'settings' ? <Settings settings={settings} chooseVault={chooseVault} retry={async () => { const result = await window.studyVault.events.retryAll(); if (!result.ok) setError(result.error); else setError(`Retry finished: ${result.data.written} written, ${result.data.failed} failed.`); await refresh(); }} /> : (
          <><label className="filter">Category<select aria-label="Category filter" value={category} onChange={(event) => setCategory(event.target.value)}><option>All</option>{categories.map((name) => <option key={name}>{name}</option>)}</select></label><section className="task-list">{tasks.length === 0 ? <p className="empty">Nothing here yet.</p> : tasks.map((task) => (
            <article className="task-card" key={task.id}>
              <button disabled={!settings.vaultPath} className="check" aria-label={`${task.status === 'Completed' ? 'Reopen' : 'Complete'} ${task.title}`} onClick={() => task.status === 'Completed' ? reopen(task) : complete(task)}>{task.status === 'Completed' ? '↻' : '✓'}</button>
              <div><h3>{task.title}</h3><p><span className="tag">{task.category}</span>{task.due_at && <span className={overdue(task) ? 'overdue' : ''}>{overdue(task) ? '⚠ Overdue · ' : 'Due · '}{new Date(task.due_at).toLocaleString()}</span>}</p>{task.description && <small>{task.description}</small>}</div>
              <div className="actions"><button disabled={!settings.vaultPath} onClick={() => edit(task)}>Edit</button><button disabled={!settings.vaultPath} onClick={() => remove(task)}>Delete</button></div>
            </article>
          ))}</section></>
        )}
      </main>
      {form && <div className="overlay"><form className="dialog" onSubmit={saveTask}><h2>{editing ? 'Edit task' : 'New task'}</h2><label>Title<input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label><label>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><div className="row"><label>Due date<input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label><label>Due time<input type="time" value={form.dueTime} onChange={(e) => setForm({ ...form, dueTime: e.target.value })} /></label></div><label>Category<input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label><div className="dialog-actions"><button type="button" onClick={() => setForm(null)}>Cancel</button><button className="primary" type="submit">Save task</button></div></form></div>}
    </div>
  );
}

function Settings({ settings, chooseVault, retry }) {
  return <div className="settings-grid"><section className="settings-card"><h3>Obsidian vault</h3><p>{settings.vaultPath || 'No vault selected'}</p><button onClick={chooseVault}>Change vault</button></section><section className="settings-card"><h3>Event delivery</h3><p>Failed events: {settings.failedEvents}</p><button onClick={retry}>Retry All</button></section></div>;
}
