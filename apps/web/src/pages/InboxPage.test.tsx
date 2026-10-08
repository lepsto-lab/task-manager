import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/render';
import { mock } from '../test/server';

describe('InboxPage', () => {
  it('lists notifications with unread markers', async () => {
    renderApp('/inbox');
    expect(await screen.findByRole('button', { name: /Crash on upload/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Faster search/ })).toBeInTheDocument();
    expect(screen.getAllByLabelText('Unread')).toHaveLength(2);
    expect(screen.getByText('Max Kim moved to In Progress')).toBeInTheDocument();
  });

  it('marks an item read and opens the issue', async () => {
    const { user } = renderApp('/inbox');
    await user.click(await screen.findByRole('button', { name: /Crash on upload/ }));
    expect(await screen.findByRole('textbox', { name: 'Issue title' })).toHaveValue('Crash on upload');
    expect(mock.requests.find((r) => r.path === '/api/inbox/read')?.body).toEqual({ activityIds: ['a-status-1'] });
  });

  it('marks everything as read', async () => {
    const { user } = renderApp('/inbox');
    await screen.findByLabelText('2 unread');
    await user.click(screen.getByRole('button', { name: 'Mark all as read' }));
    await waitFor(() => expect(screen.queryAllByLabelText('Unread')).toHaveLength(0));
    await waitFor(() => expect(screen.queryByLabelText('2 unread')).not.toBeInTheDocument());
    expect(mock.requests.find((r) => r.path === '/api/inbox/read')?.body).toEqual({ all: true });
  });

  it('shows an empty state when there is nothing new', async () => {
    localStorage.setItem('tm.currentUserId', 'u-max');
    renderApp('/inbox');
    expect(await screen.findByText("You're all caught up")).toBeInTheDocument();
  });
});
