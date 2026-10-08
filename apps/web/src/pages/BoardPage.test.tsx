import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/render';
import { mock } from '../test/server';

const column = (name: string) => screen.getByRole('region', { name });

describe('BoardPage', () => {
  it('renders the columns in board order with their cards', async () => {
    renderApp('/team/DEV/board');
    await screen.findByRole('link', { name: 'Crash on upload' });
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual([
      'Backlog',
      'Todo',
      'In Progress',
      'In Review',
      'Done',
    ]);
    expect(within(column('In Progress')).getByRole('link', { name: 'Crash on upload' })).toBeInTheDocument();
    expect(within(column('Done')).getByLabelText('1 issues')).toBeInTheDocument();
  });

  it('hides columns outside the Active tab', async () => {
    const { user } = renderApp('/team/DEV/board');
    await screen.findByRole('link', { name: 'Crash on upload' });
    await user.click(screen.getByRole('tab', { name: 'Active' }));
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual([
      'Todo',
      'In Progress',
      'In Review',
    ]);
  });

  it('opens the new issue dialog with the column status preselected', async () => {
    const { user } = renderApp('/team/DEV/board');
    await screen.findByRole('link', { name: 'Crash on upload' });
    await user.click(screen.getByRole('button', { name: 'Add issue to In Review' }));
    const dialog = screen.getByRole('dialog', { name: 'New issue' });
    expect(within(dialog).getByRole('button', { name: 'Status: In Review' })).toBeInTheDocument();
  });

  it('edits the priority from a card', async () => {
    const { user } = renderApp('/team/DEV/board');
    const card = (await screen.findByRole('link', { name: 'Export to CSV' })).closest('article')!;
    await user.click(within(card).getByRole('button', { name: 'Priority: Low' }));
    await user.click(screen.getByRole('option', { name: 'High' }));
    await waitFor(() =>
      expect(mock.requests.find((r) => r.method === 'PATCH')).toMatchObject({ body: { priority: 'high' } }),
    );
  });

  it('switches to the list view keeping the query string', async () => {
    renderApp('/team/DEV/board?status=todo');
    expect(await screen.findByRole('link', { name: 'List' })).toHaveAttribute('href', '/team/DEV/issues?status=todo');
  });
});
