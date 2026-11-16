import {Suspense, lazy, useState} from 'react';
import {HStack} from '@astryxdesign/core/HStack';
import {VStack} from '@astryxdesign/core/VStack';
import {Card} from '@astryxdesign/core/Card';
import {Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Icon} from '@astryxdesign/core/Icon';
import {Table, pixel, proportional} from '@astryxdesign/core/Table';
import {List, ListItem} from '@astryxdesign/core/List';
import {Token} from '@astryxdesign/core/Token';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Divider} from '@astryxdesign/core/Divider';
import {ChartBarIcon, PlusIcon} from '@heroicons/react/24/outline';
import {aggregate, findPlatform, formatInt, formatLabel, normalizeFormat, rangeBounds} from '../core/ledger';
import {removeAnnotation, useLedger} from '../store/ledgerStore';
import {useApp} from '../appContext';
import {RANGE_OPTIONS, toIsoDate} from '../options';
import {KpiCard, KpiGrid, Page, PanelCard, PanelRow} from '../components/layout';
import {PlatformLogo} from '../components/platformBranding';
import {
  DonutChart,
  FORMAT_COLORS,
  IncomeVsExpensesChart,
  LegendItem,
  RoyaltiesChart,
  groupDailyRoyalties,
} from '../components/charts';

// The dialog's date picker is a large share of Astryx, so it loads on first use.
const AnnotationDialog = lazy(() => import('../dialogs/AnnotationDialog'));

/** The same-length window just before the selected range, for "vs prior period". */
function previousPeriodFilters(filters) {
  const {start, end} = rangeBounds(filters.range, filters.from, filters.to);
  const days = Math.max(1, Math.round((end - start) / 86400000));
  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - days);
  return {range: 'custom', platformId: filters.platformId, from: toIsoDate(previousStart), to: toIsoDate(previousEnd)};
}

function percentChange(current, previous) {
  return previous ? ((current - previous) / Math.abs(previous)) * 100 : null;
}

/** Royalties by format, folding junk format values from old imports (e.g. "70%") into Unknown. */
function royaltiesByFormat(byFormat) {
  const totals = {};
  Object.entries(byFormat).forEach(([rawFormat, values]) => {
    const format = normalizeFormat(rawFormat);
    totals[format] = totals[format] || {id: format, royalty: 0, units: 0};
    totals[format].royalty += values.royalty || 0;
    totals[format].units += values.units || 0;
  });
  return Object.values(totals)
    .filter(format => format.royalty > 0 || format.units > 0)
    .sort((a, b) => b.royalty - a.royalty);
}

/** A few plain-language observations about the selected range. */
function buildInsights(ledger, totals, filters, money) {
  if (!totals.royaltyCount) {
    return ['No royalty rows in this range. Widen the date range, import a report, or load demo data.'];
  }
  const insights = [];
  const platformsByRoyalty = Object.entries(totals.byPlatform).sort((a, b) => b[1].royalty - a[1].royalty);

  if (platformsByRoyalty.length && totals.income) {
    const [topPlatformId, topPlatform] = platformsByRoyalty[0];
    const share = ((topPlatform.royalty / totals.income) * 100).toFixed(0);
    insights.push(
      <>
        <strong>{findPlatform(topPlatformId)?.name || topPlatformId}</strong> is {share}% of royalties in this range.
        Filter to it to dig in.
      </>,
    );
  }

  if (totals.spend === 0) {
    insights.push('No expenses logged yet. Authors who only track income often overestimate profit: add covers, editing, and ad spend.');
  } else if (totals.net < 0) {
    insights.push(
      <>
        You're at a <strong>loss of {money(Math.abs(totals.net))}</strong> after expenses. Check ad ROI on the Expenses page.
      </>,
    );
  } else if (totals.income) {
    insights.push(
      <>
        Net margin is about <strong>{((totals.net / totals.income) * 100).toFixed(0)}%</strong> after expenses and ads.
      </>,
    );
  }

  if (totals.kuIncome > 0 && ledger.showKenp) {
    insights.push(
      <>
        Kindle Unlimited is roughly <strong>{((totals.kuIncome / totals.income) * 100).toFixed(0)}%</strong> of royalties (
        {formatInt(totals.kenp)} KENP).
      </>,
    );
  }

  const ebook = totals.byFormat.ebook?.royalty || 0;
  const paperback = totals.byFormat.paperback?.royalty || 0;
  if (ebook + paperback > 0) {
    insights.push(
      <>
        Format dollars: <strong>{money(ebook)} ebook</strong> vs <strong>{money(paperback)} paperback</strong> in this range.
      </>,
    );
  }

  if (filters.platformId === 'all' && platformsByRoyalty.length > 3) {
    insights.push(
      <>
        You're wide across <strong>{platformsByRoyalty.length} stores</strong>. If you sell through both D2D and directly,
        filter by platform to avoid double-counting.
      </>,
    );
  }
  return insights.slice(0, 5);
}

function KpiRow({ledger, totals, previous, money}) {
  return (
    <KpiGrid>
      <KpiCard label="Gross royalties" value={money(totals.income)} changePercent={percentChange(totals.income, previous.income)} note="Selected range" />
      <KpiCard
        label="Expenses & ads"
        value={money(totals.spend)}
        changePercent={percentChange(totals.spend, previous.spend)}
        lowerIsBetter
        note="Selected range"
      />
      <KpiCard label="Net profit" value={money(totals.net)} changePercent={percentChange(totals.net, previous.net)} note="Selected range" />
      <KpiCard label="Units sold" value={formatInt(totals.units)} changePercent={percentChange(totals.units, previous.units)} note="Selected range" />
      {ledger.showKenp && (
        <>
          <KpiCard label="KENP pages" value={formatInt(totals.kenp)} changePercent={percentChange(totals.kenp, previous.kenp)} note="Selected range" />
          <KpiCard label="KU royalties" value={money(totals.kuIncome)} note="Selected range" />
        </>
      )}
    </KpiGrid>
  );
}

function RoyaltiesPanel({totals, annotations, money}) {
  const [isAnnotating, setIsAnnotating] = useState(false);
  const {points, unitLabel} = groupDailyRoyalties(totals.daily);
  const sortedAnnotations = [...annotations].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <PanelCard
      title="Royalties over time"
      hint={unitLabel}
      actions={<Button label="Annotate" size="sm" variant="ghost" icon={<Icon icon={PlusIcon} />} onClick={() => setIsAnnotating(true)} />}>
      {points.length ? (
        <RoyaltiesChart points={points} annotations={annotations} money={money} />
      ) : (
        <Text type="supporting">No royalties in this range.</Text>
      )}
      {sortedAnnotations.length > 0 && (
        <HStack gap={2} wrap="wrap">
          {sortedAnnotations.map(annotation => (
            <Token
              key={annotation.id}
              size="sm"
              color="orange"
              label={`${annotation.date} · ${annotation.label}`}
              onRemove={() => removeAnnotation(annotation.id)}
            />
          ))}
        </HStack>
      )}
      {isAnnotating && (
        <Suspense>
          <AnnotationDialog onClose={() => setIsAnnotating(false)} />
        </Suspense>
      )}
    </PanelCard>
  );
}

function PlatformMixPanel({totals, money}) {
  const slices = Object.entries(totals.byPlatform)
    .map(([platformId, values]) => {
      const platform = findPlatform(platformId);
      return {name: platform?.short || platformId, color: platform?.color || '#718096', value: +values.royalty.toFixed(2)};
    })
    .filter(slice => slice.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  return (
    <PanelCard title="By platform" hint="Share of royalties">
      {slices.length ? (
        <>
          <DonutChart slices={slices} money={money} />
          <HStack gap={4} wrap="wrap">
            {slices.map(slice => (
              <LegendItem
                key={slice.name}
                color={slice.color}
                label={slice.name}
                detail={`${money(slice.value)} · ${Math.round((slice.value / total) * 100)}%`}
              />
            ))}
          </HStack>
        </>
      ) : (
        <Text type="supporting">No royalties in this range.</Text>
      )}
    </PanelCard>
  );
}

function FormatMixPanel({totals, money}) {
  const formats = royaltiesByFormat(totals.byFormat);
  const total = formats.reduce((sum, format) => sum + format.royalty, 0);
  const allUnknown = formats.length > 0 && formats.every(format => format.id === 'unknown');
  const columns = [
    {
      key: 'id',
      header: 'Format',
      width: proportional(1, {minWidth: 140}),
      renderCell: format => <LegendItem color={FORMAT_COLORS[format.id] || FORMAT_COLORS.unknown} label={formatLabel(format.id)} />,
    },
    {key: 'units', header: 'Units', width: pixel(80), align: 'end', renderCell: format => formatInt(format.units)},
    {
      key: 'share',
      header: 'Share',
      width: pixel(70),
      align: 'end',
      renderCell: format => `${total > 0 ? Math.round((format.royalty / total) * 100) : 0}%`,
    },
    {key: 'royalty', header: 'Royalties', width: pixel(110), align: 'end', renderCell: format => money(format.royalty)},
  ];
  return (
    <PanelCard title="By format" hint={formats.length > 0 && `All formats: ${money(total)}`}>
      {formats.length ? (
        <>
          <DonutChart
            slices={formats.map(format => ({
              name: formatLabel(format.id),
              value: +format.royalty.toFixed(2),
              color: FORMAT_COLORS[format.id] || FORMAT_COLORS.unknown,
            }))}
            money={money}
          />
          <Table data={formats} columns={columns} idKey="id" density="compact" />
          {allUnknown && (
            <Text type="supporting">
              Formats show as Unknown because the report had royalty <em>rates</em> (70%, 35%…) instead of ebook/paperback.
              Set each title's format on the Titles page, or clear those rows and re-import.
            </Text>
          )}
        </>
      ) : (
        <Text type="supporting">No format tags yet.</Text>
      )}
    </PanelCard>
  );
}

function TopTitlesPanel({totals, money}) {
  const titles = Object.values(totals.byBook)
    .sort((a, b) => b.royalty - a.royalty)
    .slice(0, 8)
    .map(title => ({...title, id: title.bookId}));
  const columns = [
    {
      key: 'title',
      header: 'Title',
      width: proportional(1, {minWidth: 160}),
      renderCell: title => (
        <VStack gap={0.5}>
          <Text>{title.title}</Text>
          <Text type="supporting">{[title.series, title.penName, title.format].filter(Boolean).join(' · ') || '—'}</Text>
        </VStack>
      ),
    },
    {key: 'units', header: 'Units', width: pixel(80), align: 'end', renderCell: title => formatInt(title.units)},
    {key: 'royalty', header: 'Royalties', width: pixel(120), align: 'end', renderCell: title => money(title.royalty)},
  ];
  return (
    <PanelCard title="Top titles" hint="Selected range">
      {titles.length ? (
        <Table data={titles} columns={columns} idKey="id" density="compact" hasHover />
      ) : (
        <Text type="supporting">No royalties in this range.</Text>
      )}
    </PanelCard>
  );
}

export default function Dashboard() {
  const ledger = useLedger();
  const {money, filters, navigate, demo} = useApp();
  const platform = filters.platformId === 'all' ? null : findPlatform(filters.platformId);
  const rangeLabel = RANGE_OPTIONS.find(option => option.value === filters.range)?.label;
  const hasData = ledger.royalties.length > 0 || ledger.expenses.length > 0;

  if (!hasData) {
    return (
      <Page title="Overview" subtitle="Income, spend, and net across your catalog">
        <Card>
          <EmptyState
            icon={<Icon icon={ChartBarIcon} size="lg" />}
            title="No royalties yet"
            description="Import a report from any store, or load the demo catalog to explore."
            headingLevel={2}
            actions={
              <>
                <Button label="Import a report" variant="primary" onClick={() => navigate('import')} />
                <Button label="Try demo data" onClick={demo.start} />
              </>
            }
          />
        </Card>
      </Page>
    );
  }

  const totals = aggregate(ledger, filters);
  const previous = aggregate(ledger, previousPeriodFilters(filters));

  return (
    <Page
      title="Overview"
      subtitle={`${platform?.name || 'All platforms'} · ${rangeLabel}`}
      aside={platform && <PlatformLogo platform={platform} />}
      hasFilters>
      <KpiRow ledger={ledger} totals={totals} previous={previous} money={money} />
      <PanelRow>
        <RoyaltiesPanel totals={totals} annotations={ledger.chartAnnotations || []} money={money} />
        <PlatformMixPanel totals={totals} money={money} />
      </PanelRow>
      <PanelRow>
        <FormatMixPanel totals={totals} money={money} />
        <PanelCard title="Income vs expenses" hint="True P&L by month">
          <IncomeVsExpensesChart daily={totals.daily} money={money} />
        </PanelCard>
      </PanelRow>
      <Divider />
      <PanelRow>
        <TopTitlesPanel totals={totals} money={money} />
        <PanelCard title="Insights" hint="From your data">
          <List listStyle="disc" density="compact">
            {buildInsights(ledger, totals, filters, money).map((insight, index) => (
              <ListItem key={index} label={<Text>{insight}</Text>} />
            ))}
          </List>
        </PanelCard>
      </PanelRow>
      <PanelCard title="Sales vs paid (quick guide)">
        <List density="compact" hasDividers>
          <ListItem label="Orders / sales activity" description="When someone bought (or a free promo). Royalties may still be estimates." />
          <ListItem label="Prior months' royalties" description="Closer to what the store actually pays out." />
          <ListItem label="Bank deposit" description="Cash received. Lags, and reflects tax withholding." />
        </List>
      </PanelCard>
    </Page>
  );
}
