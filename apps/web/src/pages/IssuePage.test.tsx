import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '../test/render';
import { mock } from '../test/server';

const lastPatch = () => mock.requests.filter((r) => r.method === 'PATCH').at(-1);

describe('IssuePage', () => {
  it('shows the issue, its properties and activity', async () => {
    renderApp('/issue/DEV-1');
    expect(await screen.findByRole('textbox', { name: 'Issue title' })).toHaveValue('Crash on upload');
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue('Uploads over 25 MB crash the app.');
    const props = screen.getByRole('complementary', { name: 'Issue properties' });
    expect(within(props).getByRole('button', { name: 'Status: In Progress' })).toBeInTheDocument();
    expect(within(props).getByRole('button', { name: 'Priority: Urgent' })).toBeInTheDocument();
    expect(await within(props).findByRole('button', { name: 'Project: Mobile app 2.0' })).toBeInTheDocument();
    expect(await within(props).findByRole('button', { name: 'Cycle: Cycle 14' })).toBeInTheDocument();
    expect(screen.getByText('created the issue · Oct 7', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('moved to In Progress', { exact: false })).toBeInTheDocument();
  });

  it('saves the title on blur', async () => {
    const { user } = renderApp('/issue/DEV-1');
    const title = await screen.findByRole('textbox', { name: 'Issue title' });
    await user.clear(title);
    await user.type(title, 'Crash on big upload');
    await user.tab();
    await waitFor(() => expect(lastPatch()?.body).toEqual({ title: 'Crash on big upload' }));
  });

  it('does not save a blank title', async () => {
    const { user } = renderApp('/issue/DEV-1');
    const title = await screen.findByRole('textbox', { name: 'Issue title' });
    await user.clear(title);
    await user.tab();
    expect(title).toHaveValue('Crash on upload');
    expect(lastPatch()).toBeUndefined();
  });

  it('saves the description on blur', async () => {
    const { user } = renderApp('/issue/DEV-1');
    const description = await screen.findByRole('textbox', { name: 'Description' });
    await user.type(description, ' Steps below.');
    await user.tab();
    await waitFor(() =>
      expect(lastPatch()?.body).toEqual({ description: 'Uploads over 25 MB crash the app. Steps below.' }),
    );
  });

  it('changes a property from the panel', async () => {
    const { user } = renderApp('/issue/DEV-1');
    const props = await screen.findByRole('complementary', { name: 'Issue properties' });
    await user.click(within(props).getByRole('button', { name: 'Estimate: No estimate' }));
    await user.click(screen.getByRole('option', { name: '3 points' }));
    await waitFor(() => expect(lastPatch()?.body).toEqual({ estimate: 3 }));
  });

  it('posts a comment', async () => {
    const { user } = renderApp('/issue/DEV-1');
    await user.type(await screen.findByRole('textbox', { name: 'Comment' }), 'Looks good');
    await user.click(screen.getByRole('button', { name: 'Comment' }));
    expect(await screen.findByText('Looks good')).toBeInTheDocument();
    expect(mock.requests.find((r) => r.path === '/api/issues/i-1/comments')?.body).toEqual({ body: 'Looks good' });
    expect(screen.getByRole('textbox', { name: 'Comment' })).toHaveValue('');
  });

  it('creates a sub-issue with the parent context', async () => {
    const { user } = renderApp('/issue/DEV-1');
    await user.click(await screen.findByRole('button', { name: 'Add sub-issue' }));
    const dialog = screen.getByRole('dialog', { name: 'New issue' });
    expect(within(dialog).getByRole('combobox', { name: 'Team' })).toBeDisabled();
    await user.type(within(dialog).getByRole('textbox', { name: 'Issue title' }), 'Child');
    await user.click(within(dialog).getByRole('button', { name: 'Create issue' }));
    await waitFor(() =>
      expect(mock.requests.find((r) => r.method === 'POST' && r.path === '/api/issues')?.body).toMatchObject({
        parentId: 'i-1',
        projectId: 'p-mobile',
        cycleId: 'c-14',
        teamId: 't-dev',
      }),
    );
  });

  it('deletes after confirmation and returns to the team list', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user } = renderApp('/issue/DEV-1');
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('tab', { name: 'All issues' })).toBeInTheDocument();
    expect(mock.requests.some((r) => r.method === 'DELETE' && r.path === '/api/issues/i-1')).toBe(true);
    vi.restoreAllMocks();
  });

  it.each(['/issue/DEV-999', '/issue/garbage'])('shows "Issue not found" for %s', async (route) => {
    renderApp(route);
    expect(await screen.findByText('Issue not found')).toBeInTheDocument();
  });
});
