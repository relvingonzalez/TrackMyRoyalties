import {DateInput} from '@astryxdesign/core/DateInput';

/** From/To dates for the "Custom…" range. onChange(key, value) with key 'from' | 'to'. */
export default function CustomRangeInputs({from, to, onChange}) {
  return (
    <>
      <DateInput label="From" value={from || undefined} onChange={value => onChange('from', value || '')} format="date" />
      <DateInput label="To" value={to || undefined} onChange={value => onChange('to', value || '')} format="date" />
    </>
  );
}
