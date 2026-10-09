import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/render';
import { AssigneePicker, CyclePicker, EstimatePicker, LabelsPicker, StatusPicker } from './pickers';

describe('pickers', () => {
  it('names the trigger after the current status', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(<StatusPicker value="todo" onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Status: Todo' }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Backlog',
      'Todo',
      'In Progress',
      'In Review',
      'Done',
    ]);
    await user.click(screen.getByRole('option', { name: 'Done' }));
    expect(onChange).toHaveBeenCalledWith('done');
  });

  it('maps "No assignee" to null', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(<AssigneePicker value="u-anna" onChange={onChange} />);
    await user.click(await screen.findByRole('button', { name: 'Assignee: Anna Romanova' }));
    await user.click(screen.getByRole('option', { name: 'No assignee' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('maps estimates to numbers', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(<EstimatePicker value={null} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Estimate: No estimate' }));
    await user.click(screen.getByRole('option', { name: '5 points' }));
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("lists the team's labels and cycles", async () => {
    const onLabels = vi.fn();
    const { user } = renderWithProviders(
      <>
        <LabelsPicker teamId="t-dev" value={['l-bug']} onChange={onLabels} />
        <CyclePicker teamId="t-dev" value="c-14" onChange={() => {}} />
      </>,
    );
    expect(await screen.findByRole('button', { name: 'Cycle: Cycle 14' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Labels' }));
    await user.click(await screen.findByRole('option', { name: 'Feature' }));
    expect(onLabels).toHaveBeenCalledWith(['l-bug', 'l-feat']);
  });
});
