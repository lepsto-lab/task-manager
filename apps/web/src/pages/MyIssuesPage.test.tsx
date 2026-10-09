import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/render';
import { mock } from '../test/server';

describe('MyIssuesPage', () => {
  it("shows the current user's issues and follows user switches", async () => {
    const { user } = renderApp('/my-issues');
    expect(await screen.findByRole('link', { name: 'Crash on upload' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Offline sync' })).not.toBeInTheDocument();
    expect(mock.requests.find((r) => r.path === '/api/issues?mine=true')?.userId).toBe('u-anna');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Current user' }), 'Max Kim');
    expect(await screen.findByRole('link', { name: 'Offline sync' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Crash on upload' })).not.toBeInTheDocument());
  });
});
