import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../src/renderer/App.jsx';

describe('StudyVault Tasks shell', () => {
  it('shows the product name and primary task navigation', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Tasks' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New task' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Completed' })).toBeInTheDocument();
  });
});
