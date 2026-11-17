import {useState} from 'react';
import {HStack} from '@astryxdesign/core/HStack';
import {VStack} from '@astryxdesign/core/VStack';
import {Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Banner} from '@astryxdesign/core/Banner';
import {FileInput} from '@astryxdesign/core/FileInput';
import {Selector} from '@astryxdesign/core/Selector';
import {CheckboxInput} from '@astryxdesign/core/CheckboxInput';
import {RadioList, RadioListItem} from '@astryxdesign/core/RadioList';
import {MetadataList, MetadataListItem} from '@astryxdesign/core/MetadataList';
import {Collapsible} from '@astryxdesign/core/Collapsible';
import {List, ListItem} from '@astryxdesign/core/List';
import {Table, pixel, proportional} from '@astryxdesign/core/Table';
import {findImportBatchByHash, findPlatform, formatInt, formatLabel} from '../../core/ledger';
import {importRoyaltyCSV, previewImport} from '../../core/importers';
import {SPREADSHEET_ACCEPT, tryReadReportFile} from '../../core/files';
import {importRoyaltyRows, useLedger} from '../../store/ledgerStore';
import {useApp} from '../../appContext';
import {PLATFORM_OPTIONS, plural} from '../../options';
import {PanelCard} from '../../components/layout';
import {BulkImportDialog} from './BulkImportDialog';
import {filtersShowingImport} from './importHelpers';

/** Read one file and guess its platform from its column headers, for multi-file imports. */
async function readAndDetect(file) {
  const {report, error} = await tryReadReportFile(file);
  if (error) return {name: file.name, ok: false, error, rows: []};
  const parsed = importRoyaltyCSV(report.text, null); // null: detect the platform
  return {...report, ok: parsed.ok, error: parsed.error, platformId: parsed.platformId || 'other', rows: parsed.rows || []};
}

function PreviewStats({items}) {
  return (
    <MetadataList orientation="horizontal">
      {items.map(([label, value]) => (
        <MetadataListItem key={label} label={label}>
          {value}
        </MetadataListItem>
      ))}
    </MetadataList>
  );
}

function dateRange(min, max) {
  return min && max ? `${min} → ${max}` : '—';
}

/** Why KDP totals often differ from the KDP dashboard, which is usually the report, not a bug. */
function KdpTotalsHelp() {
  return (
    <Collapsible trigger={<Text weight="medium">If these totals don't match KDP</Text>} defaultIsOpen={false}>
      <List listStyle="disc" density="compact">
        <ListItem label="Orders (Lifetime)" description="Order history. Can include free promos, pre-orders, and estimated royalties, so it won't match the dashboard's estimated royalties tile." />
        <ListItem label="Prior Months' Royalties" description="Closer to what Amazon actually pays (finalized)." />
        <ListItem label="Payments / bank deposit" description="Cash received. Lags sales, and reflects withholding." />
        <ListItem label="Several Excel sheets" description="Different views of the same sales. Import one detail sheet, never the sum of every tab." />
        <ListItem label="Currencies" description="Marketplace amounts are stored as-is, not converted." />
      </List>
    </Collapsible>
  );
}

function KdpWorkbookPanel({plan, mode, onModeChange}) {
  const {money} = useApp();
  const sheets = plan.bySheet.map(sheet => ({...sheet, id: sheet.name}));
  const columns = [
    {key: 'name', header: 'Sheet', width: proportional(1, {minWidth: 140})},
    {
      key: 'format',
      header: 'Tagged as',
      width: proportional(2, {minWidth: 220}),
      renderCell: sheet => (sheet.included ? formatLabel(sheet.format) : <Text type="supporting">{sheet.note || 'Not imported'}</Text>),
    },
    {key: 'rowCount', header: 'Rows', width: pixel(80), align: 'end', renderCell: sheet => (sheet.included ? formatInt(sheet.rowCount) : '')},
    {key: 'royalty', header: 'Royalty', width: pixel(110), align: 'end', renderCell: sheet => (sheet.included ? money(sheet.royalty) : '')},
  ];
  return (
    <Banner
      status="info"
      title="This looks like a KDP Orders (Lifetime) report"
      description="It has one sheet per format plus summary sheets. The per-format sheets have no Format column, so each row is tagged from its sheet's name."
      collapsible={false}>
      <VStack gap={3}>
        <RadioList label="How to import it" value={mode} onChange={onModeChange}>
          <RadioListItem value="combine" label="Combine the per-format sheets (recommended)" />
          <RadioListItem value="single" label="Pick one sheet myself" />
        </RadioList>
        <Table data={sheets} columns={columns} idKey="id" density="compact" />
        {plan.excluded.length > 0 && (
          <Text type="supporting">
            Not imported: {plan.excluded.map(sheet => sheet.name).join(', ')}. These repeat the numbers above and would
            double-count.
          </Text>
        )}
      </VStack>
    </Banner>
  );
}

function SingleSheetPreview({preview, platformId}) {
  const {money} = useApp();
  if (!preview.ok) {
    return (
      <Banner status="error" title="Couldn't read this sheet" description={`${preview.error} Try another sheet, or check that it has a date and a royalty or units column.`} collapsible={false}>
        {preview.mapping?.headers && <Text type="supporting">Columns seen: {preview.mapping.headers.slice(0, 15).join(', ')}</Text>}
      </Banner>
    );
  }
  const {stats, mapping = {}} = preview;
  const sampleColumns = [
    {key: 'date', header: 'Date', width: pixel(110)},
    {
      key: 'title',
      header: 'Title',
      width: proportional(1, {minWidth: 160}),
      renderCell: row => `${(row.title || '').slice(0, 48)}${row.format ? ` (${formatLabel(row.format)})` : ''}`,
    },
    {key: 'units', header: 'Units', width: pixel(70), align: 'end', renderCell: row => formatInt(row.units)},
    {key: 'royalty', header: 'Royalty', width: pixel(100), align: 'end', renderCell: row => money(row.royalty)},
    {key: 'type', header: 'Type', width: pixel(70)},
  ];
  return (
    <VStack gap={3}>
      <PreviewStats
        items={[
          ['Rows', formatInt(stats.rowCount)],
          ['Royalty total', money(stats.royalty)],
          ['Units', formatInt(stats.units)],
          ['KENP', formatInt(stats.kenp)],
          ['Titles', formatInt(stats.titles)],
          ['Date range', dateRange(stats.dateMin, stats.dateMax)],
          ['KU rows', formatInt(stats.kuRows)],
          ['$0 unit rows', formatInt(stats.freeUnitRows)],
          ['Format unclear', formatInt(stats.formatUnknownRows)],
        ]}
      />
      <Text type="supporting">
        Columns used: date {mapping.date || '?'} · title {mapping.title || '?'} · royalty {mapping.royalty || '?'} · units{' '}
        {mapping.units || '?'} · format {mapping.format || mapping.royaltyType || '?'} · KENP {mapping.kenp || '—'}
      </Text>
      {stats.formatUnknownRows > 0 && (
        <Banner
          status="warning"
          title={`${stats.formatUnknownRows} of ${stats.rowCount} rows don't say ebook, paperback, hardcover, or audiobook`}
          description="They'll import as Unknown. You can fix a whole title at once afterwards on the Titles page. Some reports simply have no format column."
          collapsible={false}
        />
      )}
      {platformId === 'kdp' && <KdpTotalsHelp />}
      <Table data={preview.sample.map((row, index) => ({...row, id: String(index)}))} columns={sampleColumns} idKey="id" density="compact" />
    </VStack>
  );
}

export function RoyaltyImporter() {
  const ledger = useLedger();
  const {money, toast, confirm, filters, setFilters, navigate} = useApp();
  const [report, setReport] = useState(null); // the file being previewed (see readReportFile)
  const [bulkReports, setBulkReports] = useState(null); // several files at once
  const [platformId, setPlatformId] = useState('kdp');
  const [kdpMode, setKdpMode] = useState('combine');
  const [sheetName, setSheetName] = useState(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [isReading, setIsReading] = useState(false);

  async function chooseFiles(selection) {
    const files = [selection].flat().filter(Boolean);
    if (files.length === 0) return;
    setIsReading(true);
    if (files.length > 1) {
      setBulkReports(await Promise.all(files.map(readAndDetect)));
      setIsReading(false);
      return;
    }
    const {report: nextReport, error} = await tryReadReportFile(files[0]);
    setIsReading(false);
    if (error) {
      toast(error, 'error');
      return;
    }
    setReport(nextReport);
    setSheetName(nextReport.sheetName);
    setKdpMode('combine');
    setReplaceExisting(false);
    if (nextReport.kdpSmart) setPlatformId('kdp'); // a suggestion; picking another platform sticks
  }

  // Everything below is derived from the chosen file and options.
  const kdpPlan = report?.kdpSmart;
  const isCombiningKdp = Boolean(kdpPlan) && kdpMode === 'combine';
  const targetPlatformId = isCombiningKdp ? 'kdp' : platformId;
  const sheetText = report?.sheets ? report.sheets.find(sheet => sheet.name === sheetName)?.csv : report?.text;
  const preview = report && !isCombiningKdp ? previewImport(sheetText, platformId) : null;
  const canImport = isCombiningKdp || Boolean(preview?.ok);
  const existingRows = ledger.royalties.filter(row => row.platformId === targetPlatformId);
  const existingTotal = existingRows.reduce((sum, row) => sum + (row.royalty || 0), 0);
  const willReplace = replaceExisting && existingRows.length > 0;
  const previousImport = report && findImportBatchByHash(ledger, report.hash, 'royalty');
  const platformName = findPlatform(targetPlatformId)?.name || targetPlatformId;

  function rowsToImport() {
    if (isCombiningKdp) return {rows: kdpPlan.rows, sheetLabel: `${kdpPlan.totals.sheetCount} sheets (combined)`};
    const parsed = importRoyaltyCSV(sheetText, platformId);
    return {rows: parsed.ok ? parsed.rows : null, error: parsed.error, sheetLabel: sheetName};
  }

  function confirmImport() {
    const {rows, error, sheetLabel} = rowsToImport();
    if (!rows) {
      toast(error, 'error');
      return;
    }
    const total = rows.reduce((sum, row) => sum + (row.royalty || 0), 0);
    const duplicateNote = previousImport
      ? ` This exact file was already imported on ${previousImport.importedAt.slice(0, 10)}, so its rows will be duplicated${willReplace ? '' : ' unless you replace existing data'}.`
      : '';
    confirm({
      title: willReplace ? `Replace your ${platformName} data?` : `Import ${plural(rows.length, 'row')}?`,
      description: willReplace
        ? `The ${plural(existingRows.length, 'existing row')} are removed and replaced with these ${rows.length} rows totaling ${money(total)}.${duplicateNote}`
        : `${plural(rows.length, 'row')} totaling ${money(total)}. If that doesn't match your store, cancel and try another sheet or report.${duplicateNote}`,
      actionLabel: willReplace ? 'Replace' : 'Import',
      actionVariant: willReplace ? 'destructive' : 'primary',
      onConfirm: () => {
        importRoyaltyRows(rows, targetPlatformId, {fileName: report.name, fileHash: report.hash, sheetName: sheetLabel, replace: willReplace});
        const shown = filtersShowingImport(filters, rows);
        setFilters(shown.filters);
        toast(`Imported ${plural(rows.length, 'row')} totaling ${money(total)}.${shown.note}`);
        setReport(null);
        navigate('dashboard');
      },
    });
  }

  return (
    <PanelCard title="Import a royalty report" hint="CSV or Excel, from any store">
      <FileInput
        label="Report files"
        description="KDP Orders (Lifetime), Kobo, D2D, Apple, B&N, Google, IngramSpark… Choose several at once and each one's store is detected from its columns."
        mode="dropzone"
        isMultiple
        accept={SPREADSHEET_ACCEPT}
        value={null}
        onChange={chooseFiles}
        isLoading={isReading}
      />

      {report && (
        <VStack gap={4}>
          <Text weight="semibold">Preview of {report.name}: compare with your store before importing</Text>
          {kdpPlan && <KdpWorkbookPanel plan={kdpPlan} mode={kdpMode} onModeChange={setKdpMode} />}
          <HStack gap={3} wrap="wrap" vAlign="end">
            <Selector
              label="Import as platform"
              options={PLATFORM_OPTIONS}
              value={targetPlatformId}
              onChange={setPlatformId}
              isDisabled={isCombiningKdp}
              disabledMessage="Combined KDP workbooks always import as Amazon KDP."
              width={220}
            />
            {!isCombiningKdp && report.sheets?.length > 1 && (
              <Selector
                label="Excel sheet"
                options={report.sheets.map(sheet => ({value: sheet.name, label: `${sheet.name} (~${sheet.rowCount} rows)`}))}
                value={sheetName}
                onChange={setSheetName}
                width={280}
              />
            )}
          </HStack>

          {isCombiningKdp ? (
            <VStack gap={3}>
              <PreviewStats
                items={[
                  ['Sheets combined', formatInt(kdpPlan.totals.sheetCount)],
                  ['Rows', formatInt(kdpPlan.totals.rowCount)],
                  ['Royalty total', money(kdpPlan.totals.royalty)],
                  ['Units', formatInt(kdpPlan.totals.units)],
                  ['KENP', formatInt(kdpPlan.totals.kenp)],
                  ['Date range', dateRange(kdpPlan.totals.dateMin, kdpPlan.totals.dateMax)],
                ]}
              />
              <KdpTotalsHelp />
            </VStack>
          ) : (
            <SingleSheetPreview preview={preview} platformId={platformId} />
          )}

          {existingRows.length > 0 && (
            <CheckboxInput
              label={`Replace my existing ${platformName} data`}
              description={`You already have ${plural(existingRows.length, 'row')} (${money(existingTotal)}). Use this when re-uploading a corrected or updated report.`}
              value={replaceExisting}
              onChange={setReplaceExisting}
            />
          )}
          {previousImport && (
            <Banner
              status="warning"
              title="This exact file was already imported"
              description={`On ${previousImport.importedAt.slice(0, 10)} (${plural(previousImport.rowCount, 'row')}). Importing it again duplicates those rows unless you replace existing data.`}
              collapsible={false}
            />
          )}
          <HStack gap={2}>
            <Button label="Import these rows" variant="primary" onClick={confirmImport} isDisabled={!canImport} />
            <Button label="Cancel" variant="ghost" onClick={() => setReport(null)} />
          </HStack>
        </VStack>
      )}

      {bulkReports && <BulkImportDialog reports={bulkReports} onClose={() => setBulkReports(null)} />}
    </PanelCard>
  );
}
