import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/render';
import { mock } from '../test/server';

describe('ProjectsPage', () => {
  it('lists projects with progress and opens a project', async () => {
    const { user } = renderApp('/projects');
    const link = await screen.findByRole('link', { name: /Mobile app 2.0/ });
    expect(screen.getByLabelText('0 of 1 done')).toBeInTheDocument();
    await user.click(link);
    expect(await screen.findByRole('link', { name: 'Crash on upload' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Offline sync' })).not.toBeInTheDocument();
    expect(mock.requests.some((r) => r.path === '/api/issues?projectId=p-mobile')).toBe(true);
  });

  it('creates a project', async () => {
    const { user } = renderApp('/projects');
    await screen.findByRole('link', { name: /Mobile app 2.0/ });
    await user.type(screen.getByRole('textbox', { name: 'New project name' }), 'Brand refresh');
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByRole('link', { name: /Brand refresh/ })).toBeInTheDocument();
    await waitFor(() =>
      expect(mock.requests.find((r) => r.path === '/api/projects')?.body).toEqual({ teamId: 't-dev', name: 'Brand refresh' }),
    );
  });
});
