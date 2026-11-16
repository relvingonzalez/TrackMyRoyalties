import {Suspense, lazy, useState} from 'react';
import {HStack} from '@astryxdesign/core/HStack';
import {VStack} from '@astryxdesign/core/VStack';
import {Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {IconButton} from '@astryxdesign/core/IconButton';
import {Link} from '@astryxdesign/core/Link';
import {Selector} from '@astryxdesign/core/Selector';
import {Token} from '@astryxdesign/core/Token';
import {Table, pixel, proportional} from '@astryxdesign/core/Table';
import {Icon} from '@astryxdesign/core/Icon';
import {ArrowsPointingInIcon, PlusIcon} from '@heroicons/react/24/outline';
import {aggregate, formatInt, formatLabel, normalizeFormat} from '../core/ledger';
import {setBookFormat, useLedger} from '../store/ledgerStore';
import {useApp} from '../appContext';
import {BOOK_FORMAT_OPTIONS, plural} from '../options';
import {Page, PanelCard, PanelRow} from '../components/layout';

const BookDialog = lazy(() => import('../dialogs/BookDialog'));
const MergeBookDialog = lazy(() => import('../dialogs/MergeBookDialog'));

// Titles created from Kindle Unlimited page-read rows carry the 'ku' format, so it's offered too.
const FORMAT_OPTIONS_WITH_UNKNOWN = [...BOOK_FORMAT_OPTIONS, ...['ku', 'unknown'].map(format => ({value: format, label: formatLabel(format)}))];

/** One row per title with sales in range, plus catalog titles that had none. */
function titleRows(ledger, filters) {
  const sales = Object.values(aggregate(ledger, filters).byBook).sort((a, b) => b.royalty - a.royalty);
  const titlesWithSales = new Set(sales.map(title => title.bookId));
  const unsold = ledger.books
    .filter(book => !titlesWithSales.has(book.id))
    .map(book => ({bookId: book.id, title: book.title, series: book.series, penName: book.penName, format: book.format, royalty: 0, units: 0, kenp: 0}));
  return [...sales, ...unsold].map(title => ({
    ...title,
    id: title.bookId,
    book: ledger.books.find(book => book.id === title.bookId) || null, // null: imported rows with no catalog entry
  }));
}

/**
 * Series read-through: each later book's units as a share of book 1's — roughly what share
 * of readers kept going. Always all-time (a partial window makes the ratio meaningless).
 * Format editions of the same title count as one book. Ordered by "Book # in series";
 * unnumbered titles go last, alphabetically.
 */
function seriesReadThrough(ledger) {
  const unitsByBook = {};
  ledger.royalties.forEach(row => {
    if (row.bookId) unitsByBook[row.bookId] = (unitsByBook[row.bookId] || 0) + (row.units || 0);
  });

  const titlesBySeries = {};
  ledger.books.forEach(book => {
    const series = (book.series || '').trim();
    if (!series) return;
    const titles = (titlesBySeries[series] = titlesBySeries[series] || {});
    const key = book.title.trim().toLowerCase();
    titles[key] = titles[key] || {title: book.title, seriesNumber: null, units: 0};
    titles[key].units += unitsByBook[book.id] || 0;
    titles[key].seriesNumber ??= book.seriesNumber ?? null;
  });

  const bySeriesOrder = (a, b) => {
    if (a.seriesNumber != null && b.seriesNumber != null) return a.seriesNumber - b.seriesNumber;
    if (a.seriesNumber != null) return -1;
    if (b.seriesNumber != null) return 1;
    return a.title.localeCompare(b.title);
  };

  return Object.entries(titlesBySeries)
    .filter(([, titles]) => Object.keys(titles).length > 1)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([series, titles]) => {
      const ordered = Object.values(titles).sort(bySeriesOrder);
      const firstBookUnits = ordered[0].units;
      return {
        series,
        books: ordered.map((title, index) => ({
          id: `${series}-${index}`,
          name: `${title.seriesNumber != null ? `Book ${title.seriesNumber}` : `#${index + 1}`} · ${title.title}`,
          units: title.units,
          isFirst: index === 0,
          percentOfFirst: index > 0 && firstBookUnits > 0 ? (title.units / firstBookUnits) * 100 : null,
        })),
      };
    });
}

function ReadThroughPercent({book}) {
  if (book.isFirst) return <Text type="supporting">baseline</Text>;
  if (book.percentOfFirst == null) return <Text type="supporting">—</Text>;
  const tone = book.percentOfFirst >= 50 ? 'success' : book.percentOfFirst >= 25 ? 'warning' : 'error';
  return (
    <Text weight="semibold">
      <span style={{color: `var(--color-text-${tone})`}}>{book.percentOfFirst.toFixed(0)}%</span>
    </Text>
  );
}

const READ_THROUGH_COLUMNS = [
  {key: 'name', header: 'Title', width: proportional(1, {minWidth: 160})},
  {key: 'units', header: 'Units', width: pixel(90), align: 'end', renderCell: book => formatInt(book.units)},
  {key: 'percentOfFirst', header: 'Of book 1', width: pixel(100), align: 'end', renderCell: book => <ReadThroughPercent book={book} />},
];

export default function Books() {
  const ledger = useLedger();
  const {money, toast, filters} = useApp();
  const [editingBookId, setEditingBookId] = useState(undefined); // undefined: closed, null: new title
  const [merge, setMerge] = useState(null); // {bookId, candidates}

  const rows = titleRows(ledger, filters);
  const readThrough = seriesReadThrough(ledger);

  function changeFormat(book, format) {
    const retagged = setBookFormat(book.id, format);
    toast(`"${book.title}" set to ${formatLabel(format)}. Updated ${plural(retagged, 'sale row')}.`);
  }

  function startMerge(book) {
    const format = normalizeFormat(book.format);
    const candidates = ledger.books.filter(other => other.id !== book.id && normalizeFormat(other.format) === format);
    if (candidates.length === 0) {
      toast('No other title with the same format to merge into yet.');
      return;
    }
    setMerge({bookId: book.id, candidates});
  }

  const columns = [
    {
      key: 'title',
      header: 'Title',
      width: proportional(2, {minWidth: 160}),
      renderCell: row => (
        <VStack gap={1}>
          {row.book ? (
            <Link
              href="#"
              onClick={event => {
                event.preventDefault();
                setEditingBookId(row.id);
              }}>
              {row.title}
            </Link>
          ) : (
            <Text>{row.title}</Text>
          )}
          {row.book?.tags?.length > 0 && (
            <HStack gap={1} wrap="wrap">
              {row.book.tags.map(tag => (
                <Token key={tag} size="sm" label={tag} />
              ))}
            </HStack>
          )}
        </VStack>
      ),
    },
    {key: 'series', header: 'Series', width: proportional(1, {minWidth: 130}), renderCell: row => row.series || '—'},
    {key: 'penName', header: 'Pen name', width: proportional(1, {minWidth: 100}), renderCell: row => row.penName || '—'},
    {
      key: 'format',
      header: 'Format',
      width: pixel(180),
      renderCell: row =>
        row.book ? (
          <Selector
            label={`Format of ${row.title}`}
            isLabelHidden
            size="sm"
            options={FORMAT_OPTIONS_WITH_UNKNOWN}
            value={normalizeFormat(row.format)}
            onChange={format => changeFormat(row.book, format)}
            width="100%"
          />
        ) : (
          <VStack gap={0}>
            <Text>{formatLabel(row.format)}</Text>
            <Text type="supporting">Import-only, not in catalog</Text>
          </VStack>
        ),
    },
    {key: 'units', header: 'Units', width: pixel(80), align: 'end', renderCell: row => formatInt(row.units)},
    {key: 'royalty', header: 'Royalties', width: pixel(110), align: 'end', renderCell: row => money(row.royalty)},
    {key: 'kenp', header: 'KENP', width: pixel(110), align: 'end', renderCell: row => (ledger.showKenp ? formatInt(row.kenp) : '—')},
    {
      key: 'actions',
      header: '',
      width: pixel(60),
      align: 'end',
      renderCell: row =>
        row.book && (
          <IconButton
            label={`Merge "${row.title}" into another title`}
            tooltip="Merge into…"
            icon={<Icon icon={ArrowsPointingInIcon} />}
            size="sm"
            variant="ghost"
            onClick={() => startMerge(row.book)}
          />
        ),
    },
  ];

  return (
    <Page
      title="Titles"
      subtitle="Every title, with its series, pen name, and format."
      actions={<Button label="Add title" icon={<Icon icon={PlusIcon} />} onClick={() => setEditingBookId(null)} />}
      hasFilters>
      <PanelCard>
        {rows.length ? (
          <Table data={rows} columns={columns} idKey="id" density="compact" hasHover />
        ) : (
          <Text type="supporting">No titles yet. They're added automatically when you import a report.</Text>
        )}
      </PanelCard>

      {readThrough.length > 0 && (
        <PanelCard title="Series read-through" hint={'Book 2+ units as a % of book 1, all time. Set "Book # in series" on a title to order it.'}>
          <PanelRow>
            {readThrough.map(({series, books}) => (
              <VStack key={series} gap={2}>
                <Text weight="semibold">{series}</Text>
                <Table data={books} columns={READ_THROUGH_COLUMNS} idKey="id" density="compact" />
              </VStack>
            ))}
          </PanelRow>
        </PanelCard>
      )}

      <Suspense>
        {editingBookId !== undefined && <BookDialog bookId={editingBookId} onClose={() => setEditingBookId(undefined)} />}
        {merge && <MergeBookDialog bookId={merge.bookId} candidates={merge.candidates} onClose={() => setMerge(null)} />}
      </Suspense>
    </Page>
  );
}
