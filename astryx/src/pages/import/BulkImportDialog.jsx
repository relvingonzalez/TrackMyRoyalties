import {useState} from 'react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {Card} from '@astryxdesign/core/Card';
import {Selector} from '@astryxdesign/core/Selector';
import {CheckboxInput} from '@astryxdesign/core/CheckboxInput';
import {Banner} from '@astryxdesign/core/Banner';
import {findImportBatchByHash} from '../../core/ledger';
import {importRoyaltyRows, useLedger} from '../../store/ledgerStore';
import {useApp} from '../../appContext';
import {PLATFORM_OPTIONS, plural} from '../../options';
import {FormDialog} from '../../dialogs/FormDialog';
import {filtersShowingImport} from './importHelpers';

function FileRow({report, choice, onChange}) {
  const ledger = useLedger();
  const {money} = useApp();
  if (!report.ok) {
    return (
      <Banner status="error" title={report.name} description={report.error || "Couldn't read this file."} collapsible={false} />
    );
  }
  const total = report.rows.reduce((sum, row) => sum + (row.royalty || 0), 0);
  const existingCount = ledger.royalties.filter(row => row.platformId === choice.platformId).length;
  const previousImport = findImportBatchByHash(ledger, report.hash, 'royalty');
  return (
    <Card variant="muted" padding={3}>
      <VStack gap={2}>
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
          <VStack gap={0.5}>
            <Text weight="medium">
              {report.name}
              {report.sheetName && ` (${report.sheetName})`}
            </Text>
            <Text type="supporting">
              {plural(report.rows.length, 'row')} · {money(total)}
            </Text>
          </VStack>
          <Selector
            label={`Platform for ${report.name}`}
            isLabelHidden
            options={PLATFORM_OPTIONS}
            value={choice.platformId}
            onChange={platformId => onChange({...choice, platformId})}
            width={200}
          />
        </HStack>
        {previousImport && (
          <Text type="supporting">
            Already imported on {previousImport.importedAt.slice(0, 10)}. Importing again duplicates its rows unless you replace.
          </Text>
        )}
        {existingCount > 0 && (
          <CheckboxInput
            size="sm"
            label={`Replace ${plural(existingCount, 'existing row')} for this platform`}
            value={choice.replace}
            onChange={replace => onChange({...choice, replace})}
          />
        )}
      </VStack>
    </Card>
  );
}

/** Confirm (and correct) the detected platform for each of several files, then import them all. */
export function BulkImportDialog({reports, onClose}) {
  const {toast, filters, setFilters, navigate} = useApp();
  const [choices, setChoices] = useState(() => reports.map(report => ({platformId: report.platformId, replace: false})));
  const importable = reports.filter(report => report.ok);

  function importAll() {
    const importedRows = [];
    reports.forEach((report, index) => {
      if (!report.ok) return;
      const {platformId, replace} = choices[index];
      importRoyaltyRows(report.rows, platformId, {fileName: report.name, fileHash: report.hash, sheetName: report.sheetName, replace});
      importedRows.push(...report.rows);
    });
    const shown = filtersShowingImport(filters, importedRows);
    setFilters(shown.filters);
    toast(`Imported ${plural(importable.length, 'file')}, ${plural(importedRows.length, 'row')} in total.${shown.note}`);
    onClose();
    navigate('dashboard');
  }

  return (
    <FormDialog
      title={`Import ${plural(reports.length, 'file')}`}
      onClose={onClose}
      onSave={importAll}
      canSave={importable.length > 0}
      saveLabel={`Import ${plural(importable.length, 'file')}`}
      width={640}>
      <Text color="secondary">Each file's platform was guessed from its columns. Check them before importing, especially any set to Other.</Text>
      {reports.map((report, index) => (
        <FileRow
          key={`${report.name}-${index}`}
          report={report}
          choice={choices[index]}
          onChange={choice => setChoices(current => current.map((existing, i) => (i === index ? choice : existing)))}
        />
      ))}
    </FormDialog>
  );
}
