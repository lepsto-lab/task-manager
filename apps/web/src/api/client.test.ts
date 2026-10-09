import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { server } from '../test/server';
import { ApiError, api, setApiUser, toQuery } from './client';

afterEach(() => setApiUser(null));

describe('toQuery', () => {
  it('repeats array values and skips empty ones', () => {
    expect(toQuery({ teamId: 't1', status: ['todo', 'done'], mine: false, cycleId: undefined })).toBe(
      '?teamId=t1&status=todo&status=done',
    );
    expect(toQuery({ mine: true })).toBe('?mine=true');
    expect(toQuery({})).toBe('');
  });
});

describe('api client', () => {
  it('sends the current user header', async () => {
    let header: string | null = null;
    server.use(
      http.get('*/api/inbox', ({ request }) => {
        header = request.headers.get('x-user-id');
        return HttpResponse.json({ items: [], unreadCount: 0 });
      }),
    );
    setApiUser('u-anna');
    await api.inbox();
    expect(header).toBe('u-anna');
  });

  it('turns error bodies into ApiError', async () => {
    server.use(
      http.get('*/api/issues/:key', () =>
        HttpResponse.json({ error: { code: 'not_found', message: 'Issue not found' } }, { status: 404 }),
      ),
    );
    const error = await api.issue('DEV-999').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: 'not_found', message: 'Issue not found' });
  });
});
