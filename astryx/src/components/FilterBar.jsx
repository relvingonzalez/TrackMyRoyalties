import {Suspense, lazy} from 'react';
import {HStack} from '@astryxdesign/core/HStack';
import {Selector} from '@astryxdesign/core/Selector';
import {useApp} from '../appContext';
import {PLATFORM_FILTER_OPTIONS, RANGE_OPTIONS} from '../options';

// The date picker pulls in a large share of Astryx (calendar, bottom sheet, gestures), so
// it loads only when "Custom…" is picked.
const CustomRangeInputs = lazy(() => import('./CustomRangeInputs'));

/** Date range (+ platform, unless showPlatform is false) shared by the analytics pages. */
export function FilterBar({showPlatform = true}) {
  const {filters, setFilters} = useApp();
  const setFilter = (key, value) => setFilters(current => ({...current, [key]: value}));
  return (
    <HStack gap={3} wrap="wrap" vAlign="end">
      <Selector label="Range" options={RANGE_OPTIONS} value={filters.range} onChange={value => setFilter('range', value)} width={180} />
      {filters.range === 'custom' && (
        <Suspense>
          <CustomRangeInputs from={filters.from} to={filters.to} onChange={setFilter} />
        </Suspense>
      )}
      {showPlatform && (
        <Selector
          label="Platform"
          options={PLATFORM_FILTER_OPTIONS}
          value={filters.platformId}
          onChange={value => setFilter('platformId', value)}
          width={200}
        />
      )}
    </HStack>
  );
}
