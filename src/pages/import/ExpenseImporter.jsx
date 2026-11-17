import {useState} from 'react';
import {HStack} from '@astryxdesign/core/HStack';
import {VStack} from '@astryxdesign/core/VStack';
import {Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Banner} from '@astryxdesign/core/Banner';
import {FileInput} from '@astryxdesign/core/FileInput';
import {Selector} from '@astryxdesign/core/Selector';
import {TextInput} from '@astryxdesign/core/TextInput';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {MetadataList, MetadataListItem} from '@astryxdesign/core/MetadataList';
import {Table, pixel, proportional} from '@astryxdesign/core/Table';
import {IconButton} from '@astryxdesign/core/IconButton';
import {Icon} from '@astryxdesign/core/Icon';
import {TrashIcon} from '@heroicons/react/24/outline';
import {findImportBatchByHash, formatInt} from '../../core/ledger';
import {importExpensesFile} from '../../core/importers';
import {SPREADSHEET_ACCEPT, tryReadReportFile} from '../../core/files';
import {importExpenseRows, useLedger} from '../../store/ledgerStore';
import {useApp} from '../../appContext';
import {CATEGORY_OPTIONS, GENERAL_PLATFORM, GENERAL_PLATFORM_OPTIONS, plural} from '../../options';
import {PanelCard} from '../../components/layout';
import {guessExpenseCategory} from './importHelpers';

const thisYear = new Date().getFullYear();
/** Ref callback: scroll the section into view once, when it mounts. */
function scrollToSection(node) {
  node?.scrollIntoView({behavior: 'smooth', block: 'start'});
}

const YEAR_OPTIONS = Array.from({length: 9}, (_, index) => String(thisYear - index)).map(year => ({value: year, label: year}));

/** Import a list of items + costs (receipts export, spreadsheet, card statement), editing rows first. */
export function ExpenseImporter({scrollIntoView}) {
  const ledger = useLedger();
  const {money, toast, confirm, navigate} = useApp();
  const [file, setFile] = useState(null); // {name, hash}
  const [rows, setRows] = useState([]); // editable: {key, note, amount, date, categoryId, platformId}
  const [fallbackYear, setFallbackYear] = useState(String(thisYear));
  const [isReading, setIsReading] = useState(false);

  async function chooseFile(selected) {
    if (!selected) return;
    setIsReading(true);
    const {report, error} = await tryReadReportFile(selected);
    setIsReading(false);
    const parsed = report && importExpensesFile(report.text);
    if (!parsed?.ok) {
      toast(error || parsed.error, 'error');
      return;
    }
    setFile({name: report.name, hash: report.hash});
    setRows(
      parsed.rows.map((row, index) => ({
        key: String(index),
        note: row.item,
        amount: row.cost,
        date: row.date || null,
        categoryId: guessExpenseCategory(row.categoryRaw),
        platformId: GENERAL_PLATFORM,
      })),
    );
  }

  const editRow = (key, changes) => setRows(current => current.map(row => (row.key === key ? {...row, ...changes} : row)));
  const removeRow = key => setRows(current => current.filter(row => row.key !== key));
  const cancel = () => {
    setFile(null);
    setRows([]);
  };

  const validRows = rows.filter(row => Number.isFinite(row.amount) && row.amount > 0);
  const total = validRows.reduce((sum, row) => sum + row.amount, 0);
  const hasUndatedRows = rows.some(row => !row.date);
  const previousImport = file && findImportBatchByHash(ledger, file.hash, 'expense');

  function runImport() {
    const expenses = validRows.map(row => ({
      note: row.note.trim() || 'Expense',
      amount: row.amount,
      date: row.date || `${fallbackYear}-01-01`,
      categoryId: row.categoryId,
      platformId: row.platformId === GENERAL_PLATFORM ? null : row.platformId,
    }));
    const result = importExpenseRows(expenses, {fileName: file.name, fileHash: file.hash});
    toast(`Imported ${plural(result.count, 'expense')} totaling ${money(result.total)}.`);
    cancel();
    navigate('expenses');
  }

  function confirmImport() {
    if (!previousImport) {
      runImport();
      return;
    }
    confirm({
      title: 'Import this file again?',
      description: `It was already imported on ${previousImport.importedAt.slice(0, 10)} (${plural(previousImport.rowCount, 'expense')}). Importing again adds duplicates.`,
      actionLabel: 'Import anyway',
      actionVariant: 'primary',
      onConfirm: runImport,
    });
  }

  const columns = [
    {
      key: 'note',
      header: 'Item',
      width: proportional(1, {minWidth: 160}),
      renderCell: row => <TextInput label="Item" isLabelHidden size="sm" value={row.note} onChange={note => editRow(row.key, {note})} />,
    },
    {
      key: 'amount',
      header: 'Cost',
      width: pixel(110),
      renderCell: row => <NumberInput label="Cost" isLabelHidden size="sm" value={row.amount} onChange={amount => editRow(row.key, {amount})} />,
    },
    {
      key: 'date',
      header: 'Date',
      width: pixel(130),
      renderCell: row => row.date || <Text type="supporting">Year above</Text>,
    },
    {
      key: 'categoryId',
      header: 'Category',
      width: pixel(220),
      renderCell: row => (
        <Selector label="Category" isLabelHidden size="sm" options={CATEGORY_OPTIONS} value={row.categoryId} onChange={categoryId => editRow(row.key, {categoryId})} width="100%" />
      ),
    },
    {
      key: 'platformId',
      header: 'Platform',
      width: pixel(200),
      renderCell: row => (
        <Selector label="Platform" isLabelHidden size="sm" options={GENERAL_PLATFORM_OPTIONS} value={row.platformId} onChange={platformId => editRow(row.key, {platformId})} width="100%" />
      ),
    },
    {
      key: 'remove',
      header: '',
      width: pixel(60),
      align: 'end',
      renderCell: row => (
        <IconButton label={`Remove ${row.note || 'this row'}`} tooltip="Remove" icon={<Icon icon={TrashIcon} />} size="sm" variant="ghost" onClick={() => removeRow(row.key)} />
      ),
    },
  ];

  return (
    <div ref={scrollIntoView ? scrollToSection : undefined}>
      <PanelCard title="Import expenses" hint="Any item + cost list: receipts export, spreadsheet, card statement">
        <FileInput
          label="Expense file"
          description="Needs an item/description column and a cost/amount column. Date and category are optional."
          mode="dropzone"
          accept={SPREADSHEET_ACCEPT}
          value={null}
          onChange={chooseFile}
          isLoading={isReading}
        />
        {file && (
          <VStack gap={4}>
            <Text weight="semibold">Preview of {file.name}: edit anything before importing</Text>
            {hasUndatedRows && (
              <Selector
                label="Year for rows without a date"
                description="They'll be filed under January 1 of this year."
                options={YEAR_OPTIONS}
                value={fallbackYear}
                onChange={setFallbackYear}
                width={280}
              />
            )}
            <Table data={rows} columns={columns} idKey="key" density="compact" />
            <MetadataList orientation="horizontal">
              <MetadataListItem label="Rows">{formatInt(validRows.length)}</MetadataListItem>
              <MetadataListItem label="Total">{money(total)}</MetadataListItem>
            </MetadataList>
            {previousImport && (
              <Banner
                status="warning"
                title="This exact file was already imported"
                description={`On ${previousImport.importedAt.slice(0, 10)} (${plural(previousImport.rowCount, 'expense')}). Importing again adds duplicates.`}
                collapsible={false}
              />
            )}
            <HStack gap={2}>
              <Button label={`Import ${plural(validRows.length, 'expense')}`} variant="primary" onClick={confirmImport} isDisabled={validRows.length === 0} />
              <Button label="Cancel" variant="ghost" onClick={cancel} />
            </HStack>
          </VStack>
        )}
      </PanelCard>
    </div>
  );
}
