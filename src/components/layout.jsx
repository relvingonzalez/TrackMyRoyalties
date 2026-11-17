/** Page frame, panels, and KPI tiles shared by every page. */
import {Layout, LayoutContent} from '@astryxdesign/core/Layout';
import {HStack} from '@astryxdesign/core/HStack';
import {VStack} from '@astryxdesign/core/VStack';
import {Grid} from '@astryxdesign/core/Grid';
import {Card} from '@astryxdesign/core/Card';
import {Heading, Text} from '@astryxdesign/core/Text';
import {Icon} from '@astryxdesign/core/Icon';
import {ArrowDownIcon, ArrowUpIcon} from '@heroicons/react/24/outline';
import {useLedger} from '../store/ledgerStore';
import {FilterBar} from './FilterBar';

/**
 * Standard page: title row (with optional `aside` content and `actions` buttons), the
 * shared range/platform filters when `hasFilters` (range only when `hasPlatformFilter` is
 * false), then the page content.
 */
export function Page({title, subtitle, aside, actions, hasFilters, hasPlatformFilter = true, children}) {
  const {compactMode} = useLedger();
  const spacing = compactMode ? 4 : 6;
  return (
    <Layout
      height="fill"
      content={
        <LayoutContent padding={spacing}>
          <VStack gap={spacing}>
            <HStack hAlign="between" vAlign="center" wrap="wrap" gap={4}>
              <VStack gap={1}>
                <Heading level={1}>{title}</Heading>
                {subtitle && <Text color="secondary">{subtitle}</Text>}
              </VStack>
              {aside}
              {actions && (
                <HStack gap={2} wrap="wrap" vAlign="end">
                  {actions}
                </HStack>
              )}
            </HStack>
            {hasFilters && <FilterBar showPlatform={hasPlatformFilter} />}
            {children}
          </VStack>
        </LayoutContent>
      }
    />
  );
}

/** A card with an optional title row: title, a short `hint`, and header `actions`. */
export function PanelCard({title, hint, actions, children}) {
  return (
    <Card>
      <VStack gap={4}>
        {title && (
          <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
            <Heading level={4} accessibilityLevel={2}>
              {title}
            </Heading>
            <HStack gap={2} vAlign="center">
              {hint && <Text type="supporting">{hint}</Text>}
              {actions}
            </HStack>
          </HStack>
        )}
        {children}
      </VStack>
    </Card>
  );
}

/** Panels side by side on wide screens, stacked on phones. */
export function PanelRow({children}) {
  return (
    <Grid columns={{minWidth: 320, repeat: 'fit'}} gap={4}>
      {children}
    </Grid>
  );
}

export function KpiGrid({children}) {
  return (
    <Grid columns={{minWidth: 130, repeat: 'fit'}} gap={4}>
      {children}
    </Grid>
  );
}

/**
 * A headline number. `changePercent` vs the prior period shows a green/red arrow (pass
 * `lowerIsBetter` for costs); without it, `note` is shown instead.
 */
export function KpiCard({label, value, changePercent, lowerIsBetter, note}) {
  const hasChange = changePercent != null && Number.isFinite(changePercent);
  const isGood = lowerIsBetter ? changePercent < 0 : changePercent >= 0;
  return (
    <Card padding={3}>
      <VStack gap={2}>
        {/* One line, so six tiles fit in a row; truncates with a tooltip if it ever can't. */}
        <Text type="label" size="sm" color="secondary" maxLines={1}>
          {label}
        </Text>
        <Text as="div" weight="semibold" textWrap="nowrap">
          {/* Scales with the window so six tiles fit in a row and figures like $14,953.66 never
              run past the card's edge. */}
          <span style={{fontSize: 'clamp(1rem, 1.55vw, 1.5rem)'}}>{value}</span>
        </Text>
        {hasChange ? (
          <HStack gap={1} vAlign="center">
            <Icon icon={changePercent >= 0 ? ArrowUpIcon : ArrowDownIcon} size="xsm" color={isGood ? 'success' : 'error'} />
            <Text type="supporting">{Math.abs(changePercent).toFixed(0)}% vs prior period</Text>
          </HStack>
        ) : (
          note && <Text type="supporting">{note}</Text>
        )}
      </VStack>
    </Card>
  );
}

/** Text colored green for a gain, red for a loss. */
export function SignedAmount({value, children}) {
  return <span style={{color: `var(--color-text-${value >= 0 ? 'success' : 'error'})`}}>{children}</span>;
}
