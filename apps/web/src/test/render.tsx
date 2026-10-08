import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { AppProviders, AppRoutes } from '../App';

function setup(children: ReactNode, route: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } },
  });
  const user = userEvent.setup();
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <AppProviders>{children}</AppProviders>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...utils, user, queryClient };
}

/** Renders the whole app (sidebar + routed page) at the given route. */
export function renderApp(route = '/') {
  return setup(<AppRoutes />, route);
}

/** Renders a single element inside all app providers. */
export function renderWithProviders(ui: ReactElement, route = '/') {
  return setup(ui, route);
}
