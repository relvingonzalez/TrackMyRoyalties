/**
 * Charts: recharts styled with Astryx design tokens, following Astryx's official
 * `dashboard` template. Bucketing matches the classic app's js/charts.js so both UIs plot
 * the same points.
 */
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {Card} from '@astryxdesign/core/Card';
import {HStack} from '@astryxdesign/core/HStack';
import {VStack} from '@astryxdesign/core/VStack';
import {Icon} from '@astryxdesign/core/Icon';
import {Text} from '@astryxdesign/core/Text';
import {StopIcon} from '@heroicons/react/24/solid';

const AXIS_TICK = {fontSize: 'var(--font-size-sm, 12px)', fill: 'var(--color-text-secondary, #4E606F)'};
const GRID_COLOR = 'var(--color-border, rgba(5, 54, 89, 0.1))';
const HOVER_FILL = 'var(--color-background-muted, rgba(0, 0, 0, 0.04))';

export const CHART_COLORS = {
  royalty: 'var(--color-data-categorical-blue, #0171E3)',
  income: 'var(--color-data-categorical-green, #0B991F)',
  expense: 'var(--color-data-categorical-red, #D3253A)',
  annotation: 'var(--color-data-categorical-orange, #EB6E00)',
};

export const FORMAT_COLORS = {
  ebook: 'var(--color-data-categorical-blue, #0171E3)',
  paperback: 'var(--color-data-categorical-teal, #0E8A8A)',
  hardcover: 'var(--color-data-categorical-purple, #6B1EFD)',
  audiobook: 'var(--color-data-categorical-green, #0B991F)',
  ku: 'var(--color-data-categorical-orange, #EB6E00)',
  unknown: 'var(--color-data-neutral, #8494A3)',
};

const CATEGORY_COLORS = [
  'var(--color-data-categorical-orange, #EB6E00)',
  'var(--color-data-categorical-red, #D3253A)',
  'var(--color-data-categorical-blue, #0171E3)',
  'var(--color-data-categorical-purple, #6B1EFD)',
  'var(--color-data-categorical-green, #0B991F)',
  'var(--color-data-categorical-teal, #0E8A8A)',
  'var(--color-data-categorical-pink, #D6249F)',
  'var(--color-data-neutral, #8494A3)',
];

/** Axis labels drop the cents: "$1,200" rather than "$1,200.00". */
const wholeMoney = money => value => money(value).replace(/\.00$/, '');

export function LegendItem({color, label, detail}) {
  return (
    <VStack gap={0}>
      <HStack gap={2} vAlign="center">
        <Icon icon={StopIcon} size="xsm" style={{color}} />
        <Text type="supporting" color="primary">
          {label}
        </Text>
      </HStack>
      {detail && <Text type="supporting">{detail}</Text>}
    </VStack>
  );
}

function ChartTooltip({active, payload, label, money}) {
  if (!active || !payload?.length) return null;
  return (
    <Card padding={3} elevation="med">
      <VStack gap={1}>
        {label != null && <Text type="supporting">{label}</Text>}
        {payload.map(entry => (
          <HStack key={entry.name} gap={2} vAlign="center">
            <Icon icon={StopIcon} size="xsm" style={{color: entry.payload?.fill || entry.color}} />
            <Text type="supporting" color="primary">
              {entry.name}: {money(entry.value)}
            </Text>
          </HStack>
        ))}
      </VStack>
    </Card>
  );
}

// ---------- Royalties over time ----------

/** Start time of a daily (YYYY-MM-DD), weekly (YYYY-Wnn), or monthly (YYYY-MM) bucket key. */
function bucketStartTime(key) {
  const week = /^(\d{4})-W(\d{2})$/.exec(key);
  if (week) return new Date(`${week[1]}-01-01T00:00:00`).getTime() + (Number(week[2]) - 1) * 7 * 86400000;
  if (/^\d{4}-\d{2}$/.test(key)) return new Date(`${key}-01T00:00:00`).getTime();
  return new Date(`${key}T00:00:00`).getTime();
}

function weekKey(isoDate) {
  const date = new Date(`${isoDate}T12:00:00`);
  const januaryFirst = new Date(date.getFullYear(), 0, 1);
  const week = Math.ceil(((date - januaryFirst) / 86400000 + januaryFirst.getDay() + 1) / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * Group daily totals for plotting: by day up to a month of data, by week up to 60 days,
 * by month beyond. Returns {points: [{date, royalty}], unitLabel}.
 */
export function groupDailyRoyalties(daily) {
  if (daily.length <= 31) return {points: daily, unitLabel: 'By day'};
  const byMonth = daily.length > 60;
  const totals = {};
  daily.forEach(day => {
    const key = byMonth ? day.date.slice(0, 7) : weekKey(day.date);
    totals[key] = (totals[key] || 0) + day.royalty;
  });
  const points = Object.keys(totals)
    .sort()
    .map(key => ({date: key, royalty: totals[key]}));
  return {points, unitLabel: byMonth ? 'By month' : 'By week'};
}

/** The plotted bucket closest to a date, so an annotation lands on the right point. */
function nearestBucket(points, isoDate) {
  const target = bucketStartTime(isoDate);
  let nearest = points[0].date;
  points.forEach(point => {
    if (Math.abs(bucketStartTime(point.date) - target) < Math.abs(bucketStartTime(nearest) - target)) nearest = point.date;
  });
  return nearest;
}

export function RoyaltiesChart({points, annotations, money}) {
  const data = points.map(point => ({date: point.date, royalty: +point.royalty.toFixed(2)}));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{top: 16, right: 12, left: 0, bottom: 0}}>
        <CartesianGrid horizontal vertical={false} stroke={GRID_COLOR} />
        <XAxis dataKey="date" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={64} tickFormatter={wholeMoney(money)} />
        <Tooltip content={<ChartTooltip money={money} />} cursor={{stroke: GRID_COLOR}} />
        <Area
          type="monotone"
          dataKey="royalty"
          name="Royalties"
          stroke={CHART_COLORS.royalty}
          fill={CHART_COLORS.royalty}
          fillOpacity={0.12}
          strokeWidth={2}
          dot={data.length <= 40}
        />
        {data.length > 0 &&
          annotations.map(annotation => {
            const x = nearestBucket(data, annotation.date);
            // Label on whichever side of the line has room, so a recent annotation isn't
            // clipped by the chart's right edge.
            const isInLateHalf = data.findIndex(point => point.date === x) > data.length / 2;
            return (
              <ReferenceLine
                key={annotation.id}
                x={x}
                stroke={CHART_COLORS.annotation}
                strokeDasharray="4 3"
                label={{
                  value: annotation.label,
                  position: isInLateHalf ? 'insideTopRight' : 'insideTopLeft',
                  fill: CHART_COLORS.annotation,
                  fontSize: 11,
                }}
              />
            );
          })}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ---------- Share of total (platform mix, format mix) ----------

/** slices: [{name, value, color}] */
export function DonutChart({slices, money}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={slices}
          dataKey="value"
          nameKey="name"
          innerRadius="62%"
          outerRadius="92%"
          paddingAngle={1}
          stroke="var(--color-background-card, #fff)"
          isAnimationActive={false}>
          {slices.map(slice => (
            <Cell key={slice.name} fill={slice.color} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip money={money} />} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ---------- Income vs expenses ----------

export function IncomeVsExpensesChart({daily, money}) {
  const totals = {};
  daily.forEach(day => {
    const month = day.date.slice(0, 7);
    totals[month] = totals[month] || {month, income: 0, expenses: 0};
    totals[month].income += day.royalty;
    totals[month].expenses += day.expense;
  });
  const data = Object.keys(totals)
    .sort()
    .map(month => ({month, income: +totals[month].income.toFixed(2), expenses: +totals[month].expenses.toFixed(2)}));
  return (
    <VStack gap={3}>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{top: 8, right: 12, left: 0, bottom: 0}}>
          <CartesianGrid horizontal vertical={false} stroke={GRID_COLOR} />
          <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={16} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={64} tickFormatter={wholeMoney(money)} />
          <Tooltip content={<ChartTooltip money={money} />} cursor={{fill: HOVER_FILL}} />
          <Bar dataKey="income" name="Income" fill={CHART_COLORS.income} radius={[4, 4, 0, 0]} />
          <Bar dataKey="expenses" name="Expenses" fill={CHART_COLORS.expense} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <HStack gap={6} vAlign="center">
        <LegendItem color={CHART_COLORS.income} label="Income" />
        <LegendItem color={CHART_COLORS.expense} label="Expenses" />
      </HStack>
    </VStack>
  );
}

// ---------- Expenses by category ----------

/** Top 8 categories as horizontal bars. byCategory: {categoryId: amount} */
export function ExpensesByCategoryChart({byCategory, categories, money}) {
  const data = Object.entries(byCategory)
    .map(([categoryId, amount]) => ({
      name: categories.find(category => category.id === categoryId)?.name || categoryId,
      amount: +amount.toFixed(2),
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{top: 0, right: 12, left: 0, bottom: 0}}>
        <CartesianGrid horizontal={false} vertical stroke={GRID_COLOR} />
        <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={wholeMoney(money)} />
        <YAxis type="category" dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} width={150} />
        <Tooltip content={<ChartTooltip money={money} />} cursor={{fill: HOVER_FILL}} />
        <Bar dataKey="amount" name="Spend" radius={[0, 4, 4, 0]}>
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
