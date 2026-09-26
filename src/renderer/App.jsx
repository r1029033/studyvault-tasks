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
