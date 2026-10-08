import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '../test/render';
import { mock } from '../test/server';

async function saveTodoView() {
  const utils = renderApp('/team/DEV/issues?status=todo');
  await screen.findByRole('link', { name: 'Export to CSV' });
  await utils.user.click(screen.getByRole('button', { name: /^Filter/ }));
  await utils.user.click(screen.getByRole('button', { name: 'Save as view' }));
  await utils.user.type(screen.getByRole('textbox', { name: 'View name' }), 'Todo only');
  await utils.user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'View name' })).toHaveValue('Todo only'));
  return utils;
}

describe('views', () => {
  it('shows an empty state without views', async () => {
    renderApp('/views');
    expect(await screen.findByText('No views yet')).toBeInTheDocument();
  });

  it('lands on the saved view showing its issues', async () => {
    await saveTodoView();
    expect(await screen.findByRole('link', { name: 'Export to CSV' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Crash on upload' })).not.toBeInTheDocument();
  });

  it('renames a view', async () => {
    const { user } = await saveTodoView();
    const name = screen.getByRole('textbox', { name: 'View name' });
    await user.clear(name);
    await user.type(name, 'Renamed{Enter}');
    await waitFor(() =>
      expect(mock.requests.find((r) => r.method === 'PATCH' && r.path === '/api/views/v-1')?.body).toEqual({ name: 'Renamed' }),
    );
  });

  it('deletes a view and returns to the list', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user } = await saveTodoView();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('No views yet')).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('lists saved views', async () => {
    const { user } = await saveTodoView();
    // The sidebar "Views" link renders before the breadcrumb link with the same name.
    await user.click(screen.getAllByRole('link', { name: 'Views' })[0]);
    expect(await screen.findByRole('link', { name: /Todo only/ })).toBeInTheDocument();
  });

  it('shows not found for an unknown view', async () => {
    renderApp('/views/v-404');
    expect(await screen.findByText('View not found')).toBeInTheDocument();
  });
});
