import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/renderer/App.jsx';

const task = { id: '1', title: 'Write report', description: '', category: 'Design', due_at: '2026-09-25T10:00:00.000Z', status: 'Active' };

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
});
