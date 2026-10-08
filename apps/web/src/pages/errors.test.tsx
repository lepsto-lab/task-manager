import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '../test/render';
import { server } from '../test/server';

const failure = (status: number) =>
  HttpResponse.json({ error: { code: status === 400 ? 'validation' : 'internal', message: 'nope' } }, { status });

describe('error handling', () => {
  it.each(['/team/DEV/issues', '/team/DEV/board', '/team/DEV/cycles'])(
    'shows a retryable error instead of "Team not found" when teams fail on %s',
    async (route) => {
      server.use(http.get('*/api/teams', () => failure(500)));
      renderApp(route);
      expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
      expect(screen.queryByText('Team not found')).not.toBeInTheDocument();
    },
  );

  it.each([
    ['/views/not-a-uuid', 'views', 'View not found'],
    ['/projects/not-a-uuid', 'projects', 'Project not found'],
    ['/cycles/not-a-uuid', 'cycles', 'Cycle not found'],
  ])('treats a malformed id as not found on %s', async (route, resource, title) => {
    server.use(http.get(`*/api/${resource}/:id`, () => failure(400)));
    renderApp(route);
    expect(await screen.findByText(title)).toBeInTheDocument();
  });

  it('does not crash on a malformed URL escape', async () => {
    // React Router itself logs the undecodable path; silence it for this case.
    const spies = [vi.spyOn(console, 'error'), vi.spyOn(console, 'warn')].map((s) => s.mockImplementation(() => {}));
    renderApp('/team/%E0%A4%A');
    expect(await screen.findByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    spies.forEach((s) => s.mockRestore());
  });
});
