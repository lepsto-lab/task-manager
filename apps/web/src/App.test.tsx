import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderApp } from './test/render';
import { server } from './test/server';

describe('App routing', () => {
  it('redirects / to the first team (Engineering) issue list', async () => {
    renderApp('/');
    expect(await screen.findByRole('tab', { name: 'All issues' })).toBeInTheDocument();
    expect(screen.getAllByText('Engineering').length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: 'Design' })).not.toBeInTheDocument();
  });

  it('shows an error with Retry when the teams request fails on /', async () => {
    server.use(http.get('*/api/teams', () => HttpResponse.json({ error: { code: 'internal', message: 'boom' } }, { status: 500 })));
    renderApp('/');
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    expect(screen.queryByText('No teams yet')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
