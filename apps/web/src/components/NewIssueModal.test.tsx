import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/render';
import { mock, server } from '../test/server';

async function openModal() {
  const utils = renderApp('/nowhere');
  await utils.user.click(await screen.findByRole('button', { name: 'New issue' }));
  const dialog = screen.getByRole('dialog', { name: 'New issue' });
  return { ...utils, dialog };
}

describe('NewIssueModal', () => {
  it('creates an issue from the sidebar button', async () => {
    const { user, dialog } = await openModal();
    const create = within(dialog).getByRole('button', { name: 'Create issue' });
    expect(create).toBeDisabled();
    await user.type(within(dialog).getByRole('textbox', { name: 'Issue title' }), 'Write tests');
    await user.click(within(dialog).getByRole('button', { name: 'Priority: No priority' }));
    await user.click(screen.getByRole('option', { name: 'High' }));
    await user.click(create);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Created DEV-6')).toBeInTheDocument();
    const request = mock.requests.find((r) => r.method === 'POST' && r.path === '/api/issues');
    expect(request?.body).toEqual({
      teamId: 't-dev',
      title: 'Write tests',
      status: 'todo',
      priority: 'high',
      assigneeId: null,
      labelIds: [],
      projectId: null,
      cycleId: null,
      parentId: null,
    });
    expect(request?.userId).toBe('u-anna');
  });

  it('closes on Escape without creating anything', async () => {
    const { user, dialog } = await openModal();
    await user.type(within(dialog).getByRole('textbox', { name: 'Issue title' }), 'Draft');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mock.requests.some((r) => r.method === 'POST')).toBe(false);
  });

  it('keeps the dialog open and shows the server error', async () => {
    server.use(
      http.post('*/api/issues', () =>
        HttpResponse.json({ error: { code: 'bad_request', message: 'Unknown team' } }, { status: 400 }),
      ),
    );
    const { user, dialog } = await openModal();
    await user.type(within(dialog).getByRole('textbox', { name: 'Issue title' }), 'Broken');
    await user.click(within(dialog).getByRole('button', { name: 'Create issue' }));
    expect(await within(dialog).findByText('Unknown team')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'New issue' })).toBeInTheDocument();
  });
});
