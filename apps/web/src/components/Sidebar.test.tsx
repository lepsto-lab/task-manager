import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/render';

describe('Sidebar', () => {
  it('shows the first team expanded and the inbox unread count', async () => {
    renderApp('/nowhere');
    expect(await screen.findByRole('button', { name: 'Engineering' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Issues' })).toHaveAttribute('href', '/team/DEV/issues');
    expect(screen.getByRole('link', { name: 'Cycles' })).toHaveAttribute('href', '/team/DEV/cycles');
    expect(await screen.findByLabelText('2 unread')).toBeInTheDocument();
  });

  it('expands another team', async () => {
    const { user } = renderApp('/nowhere');
    await user.click(await screen.findByRole('button', { name: 'Design' }));
    const hrefs = screen.getAllByRole('link', { name: 'Issues' }).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/team/DEV/issues', '/team/DES/issues']);
  });

  it('expands the team of a team route', async () => {
    renderApp('/team/DES/issues');
    expect(await screen.findByRole('button', { name: 'Design' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Engineering' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('expands the team for a bare team route', async () => {
    renderApp('/team/DES');
    expect(await screen.findByRole('button', { name: 'Design' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Engineering' })).toHaveAttribute('aria-expanded', 'false');
  });

  it("expands the issue key's team on an issue route", async () => {
    renderApp('/issue/DES-1');
    expect(await screen.findByRole('button', { name: 'Design' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Engineering' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('preselects the active team in the New issue dialog', async () => {
    const { user } = renderApp('/team/DES/issues');
    await user.click(await screen.findByRole('button', { name: 'New issue' }));
    const dialog = screen.getByRole('dialog', { name: 'New issue' });
    expect(within(dialog).getByRole('combobox', { name: 'Team' })).toHaveValue('t-des');
  });

  it("switches the current user, persists the choice and shows that user's inbox", async () => {
    const { user } = renderApp('/nowhere');
    await screen.findByLabelText('2 unread');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Current user' }), 'Max Kim');
    await waitFor(() => expect(screen.queryByLabelText('2 unread')).not.toBeInTheDocument());
    expect(localStorage.getItem('tm.currentUserId')).toBe('u-max');
  });

  it('restores the stored current user', async () => {
    localStorage.setItem('tm.currentUserId', 'u-max');
    renderApp('/nowhere');
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Current user' })).toHaveValue('u-max'));
  });

  it('renders a not found page for unknown routes', async () => {
    renderApp('/nowhere');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
  });
});
