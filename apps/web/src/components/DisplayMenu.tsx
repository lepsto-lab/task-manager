import type { Density } from '../lib/useDensity';
import { DisplayIcon } from './icons';
import { PropertyPicker } from './PropertyPicker';

export function DisplayMenu({ value, onChange }: { value: Density; onChange: (density: Density) => void }) {
  return (
    <PropertyPicker
      label="Display"
      align="end"
      value={value}
      options={[
        { value: 'comfortable', label: 'Comfortable' },
        { value: 'compact', label: 'Compact' },
      ]}
      onChange={onChange}
      triggerClassName="btn"
      trigger={
        <>
          <DisplayIcon />
          Display
        </>
      }
    />
  );
}
