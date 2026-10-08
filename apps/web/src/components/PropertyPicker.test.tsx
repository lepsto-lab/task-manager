import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PropertyPicker } from './PropertyPicker';

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
];

describe('PropertyPicker', () => {
  it('selects a single value and closes', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<PropertyPicker label="Letter" value="a" options={options} onChange={onChange} trigger="Pick" />);
    await user.click(screen.getByRole('button', { name: 'Letter' }));
    expect(screen.getByRole('option', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('option', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('does not fire when the current value is picked again', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<PropertyPicker label="Letter" value="a" options={options} onChange={onChange} trigger="Pick" />);
    await user.click(screen.getByRole('button', { name: 'Letter' }));
    await user.click(screen.getByRole('option', { name: 'Alpha' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('toggles values in multiple mode and stays open', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<PropertyPicker multiple label="Letters" value={['a']} options={options} onChange={onChange} trigger="Pick" />);
    await user.click(screen.getByRole('button', { name: 'Letters' }));
    await user.click(screen.getByRole('option', { name: 'Beta' }));
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b']);
    await user.click(screen.getByRole('option', { name: 'Alpha' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('closes on Escape and on outside click', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button type="button">outside</button>
        <PropertyPicker label="Letter" value="a" options={options} onChange={() => {}} trigger="Pick" />
      </div>,
    );
    await user.click(screen.getByRole('button', { name: 'Letter' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Letter' }));
    await user.click(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('filters options when searchable', async () => {
    const user = userEvent.setup();
    render(<PropertyPicker searchable label="Letter" value="a" options={options} onChange={() => {}} trigger="Pick" />);
    await user.click(screen.getByRole('button', { name: 'Letter' }));
    await user.type(screen.getByRole('textbox', { name: 'Filter letter' }), 'gam');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Gamma']);
    await user.clear(screen.getByRole('textbox', { name: 'Filter letter' }));
    await user.type(screen.getByRole('textbox', { name: 'Filter letter' }), 'zzz');
    expect(screen.getByText('No results')).toBeInTheDocument();
  });
});
