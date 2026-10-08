import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/renderer/App.jsx';

const task = { id: '1', title: 'Write report', description: '', category: 'Design', due_at: '2026-09-25T10:00:00.000Z', status: 'Active' };
const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

beforeEach(() => {
  window.studyVault = {
    settings: { get: vi.fn().mockResolvedValue({ ok: true, data: { vaultPath: null, failedEvents: 0 } }), chooseVault: vi.fn() },
    tasks: { list: vi.fn().mockResolvedValue({ ok: true, data: [task] }), create: vi.fn(), update: vi.fn(), complete: vi.fn().mockResolvedValue({ ok: true }), reopen: vi.fn(), delete: vi.fn() },
    events: { retryAll: vi.fn() },
  };
});

describe('StudyVault Tasks interface', () => {
  it('requires a vault before creating tasks', async () => {
    render(<App />);
    expect(await screen.findByText(/choose an Obsidian vault/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New task' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Complete Write report' })).toBeDisabled();
  });

  it('shows tasks and completes one', async () => {
    window.studyVault.settings.get.mockResolvedValue({ ok: true, data: { vaultPath: 'C:/Vault', failedEvents: 0 } });
    render(<App />);
    expect(await screen.findByText('Write report')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Complete Write report' }));
    await waitFor(() => expect(window.studyVault.tasks.complete).toHaveBeenCalledWith('1'));
  });

  it('labels overdue tasks with text', async () => {
    window.studyVault.settings.get.mockResolvedValue({ ok: true, data: { vaultPath: 'C:/Vault', failedEvents: 0 } });
    render(<App />);
    expect(await screen.findByText(/Overdue/)).toBeInTheDocument();
  });

  it('shows a StudyBuddy and changes its tip', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0);
    render(<App />);

    expect(screen.getByRole('img', { name: /StudyBuddy/ })).toBeInTheDocument();
    expect(screen.getByText('Start with a two-minute task to build momentum.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'New tip' }));
    expect(screen.getByText('Turn a big assignment into the next smallest action.')).toBeInTheDocument();
    random.mockRestore();
  });

  it('shows readable text on the Save task button', async () => {
    window.studyVault.settings.get.mockResolvedValue({ ok: true, data: { vaultPath: 'C:/Vault', failedEvents: 0 } });
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: 'New task' }));
    const saveButton = screen.getByRole('button', { name: 'Save task' });

    expect(saveButton).toHaveClass('primary');
    expect(styles).toContain('.dialog .primary{background:#116b57;color:#fff;border:0}');
  });
});
