import { screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/render';
import { mock, server } from '../test/server';

const groupNames = () => screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'));
const group = (name: string) => screen.getByRole('region', { name });
const rowOf = async (title: string) => (await screen.findByRole('link', { name: title })).closest('li')!;

describe('IssueListPage', () => {
  it('groups issues by status in list order with Done collapsed', async () => {
    const { user } = renderApp('/team/DEV/issues');
    await screen.findByRole('link', { name: 'Crash on upload' });
    expect(groupNames()).toEqual(['In Progress', 'In Review', 'Todo', 'Backlog', 'Done']);
    expect(within(group('Done')).queryByRole('link', { name: 'Faster search' })).not.toBeInTheDocument();
    await user.click(within(group('Done')).getByRole('button', { name: /Done/ }));
    expect(within(group('Done')).getByRole('link', { name: 'Faster search' })).toBeInTheDocument();
  });

  it('limits the groups on the Active tab', async () => {
    const { user } = renderApp('/team/DEV/issues');
    await screen.findByRole('link', { name: 'Crash on upload' });
    await user.click(screen.getByRole('tab', { name: 'Active' }));
    expect(groupNames()).toEqual(['In Progress', 'In Review', 'Todo']);
    expect(screen.getByRole('tab', { name: 'Active' })).toHaveAttribute('aria-selected', 'true');
  });

  it('changes the status from the row and sends a PATCH', async () => {
    const { user } = renderApp('/team/DEV/issues');
    const row = await rowOf('Export to CSV');
    await user.click(within(row).getByRole('button', { name: 'Status: Todo' }));
    await user.click(screen.getByRole('option', { name: 'In Progress' }));
    await waitFor(() =>
      expect(within(group('In Progress')).getByRole('link', { name: 'Export to CSV' })).toBeInTheDocument(),
    );
    expect(mock.requests.find((r) => r.method === 'PATCH')).toMatchObject({
      path: '/api/issues/i-3',
      body: { status: 'in_progress' },
      userId: 'u-anna',
    });
  });

  it('applies edits optimistically and rolls back with a toast when saving fails', async () => {
    server.use(
      http.patch('*/api/issues/:id', async () => {
        await delay(50);
        return HttpResponse.json({ error: { code: 'internal', message: 'Boom' } }, { status: 500 });
      }),
    );
    const { user } = renderApp('/team/DEV/issues');
    const row = await rowOf('Export to CSV');
    await user.click(within(row).getByRole('button', { name: 'Priority: Low' }));
    await user.click(screen.getByRole('option', { name: 'Urgent' }));
    expect(await within(row).findByRole('button', { name: 'Priority: Urgent' })).toBeInTheDocument();
    expect(await screen.findByText("Couldn't save: Boom")).toBeInTheDocument();
    expect(await within(row).findByRole('button', { name: 'Priority: Low' })).toBeInTheDocument();
  });

  it('filters through the Filter menu', async () => {
    const { user } = renderApp('/team/DEV/issues');
    await screen.findByRole('link', { name: 'Crash on upload' });
    await user.click(screen.getByRole('button', { name: /^Filter/ }));
    await user.click(screen.getByRole('checkbox', { name: 'Todo' }));
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Crash on upload' })).not.toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Export to CSV' })).toBeInTheDocument();
    expect(mock.requests.some((r) => r.path === '/api/issues?teamId=t-dev&status=todo')).toBe(true);
  });

  it('saves the current filters as a view', async () => {
    const { user } = renderApp('/team/DEV/issues?status=todo');
    await screen.findByRole('link', { name: 'Export to CSV' });
    await user.click(screen.getByRole('button', { name: /^Filter/ }));
    await user.click(screen.getByRole('button', { name: 'Save as view' }));
    await user.type(screen.getByRole('textbox', { name: 'View name' }), 'My todo');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(mock.requests.find((r) => r.method === 'POST' && r.path === '/api/views')?.body).toEqual({
        name: 'My todo',
        filters: { status: ['todo'], teamId: 't-dev' },
      }),
    );
  });

  it('remembers the compact density', async () => {
    const { user } = renderApp('/team/DEV/issues');
    await screen.findByRole('link', { name: 'Crash on upload' });
    await user.click(screen.getByRole('button', { name: 'Display' }));
    await user.click(screen.getByRole('option', { name: 'Compact' }));
    expect(localStorage.getItem('tm.density')).toBe('compact');
  });

  it('shows an empty state that opens the new issue dialog', async () => {
    server.use(http.get('*/api/issues', () => HttpResponse.json([])));
    const { user } = renderApp('/team/DEV/issues');
    expect(await screen.findByText('No issues')).toBeInTheDocument();
    await user.click(within(screen.getByRole('main')).getByRole('button', { name: 'New issue' }));
    expect(screen.getByRole('dialog', { name: 'New issue' })).toBeInTheDocument();
  });

  it('shows not found for an unknown team', async () => {
    renderApp('/team/NOPE/issues');
    expect(await screen.findByText('Team not found')).toBeInTheDocument();
  });
});
