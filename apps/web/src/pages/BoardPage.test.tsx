import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { groupByStatus, moveFromDragEnd } from '../lib/boardMove';
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

  it('keeps the title link and priority picker keyboard-operable on a card', async () => {
    const { user } = renderApp('/team/DEV/board');
    const link = await screen.findByRole('link', { name: 'Export to CSV' });
    const card = link.closest('article')!;
    within(card).getByRole('button', { name: 'Priority: Low' }).focus();
    await user.keyboard(' ');
    expect(await screen.findByRole('option', { name: 'High' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    link.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('textbox', { name: 'Issue title' })).toHaveValue('Export to CSV');
  });

  it('maps a column drop to a status and sortOrder patch', () => {
    const a = { id: 'a', status: 'todo', sortOrder: 1000 } as never;
    const cols = groupByStatus([a, { id: 'b', status: 'done', sortOrder: 1000 } as never]);
    expect(moveFromDragEnd(cols, 'a', 'column:done')).toEqual({ status: 'done', sortOrder: 2000 });
    expect(moveFromDragEnd(cols, 'a', 'b')).toEqual({ status: 'done', sortOrder: 0 });
    expect(moveFromDragEnd(cols, 'a', 'a')).toBeNull();
  });
});
