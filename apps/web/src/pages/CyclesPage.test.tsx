import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/render';

describe('CyclesPage', () => {
  it("lists the team's cycles and opens one", async () => {
    const { user } = renderApp('/team/DEV/cycles');
    const link = await screen.findByRole('link', { name: /Cycle 14/ });
    expect(link).toHaveTextContent('Oct 6–19');
    await user.click(link);
    expect(await screen.findByRole('link', { name: 'Crash on upload' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Offline sync' })).not.toBeInTheDocument();
  });
});
