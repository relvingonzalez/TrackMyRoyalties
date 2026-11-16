import {Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Table, pixel, proportional} from '@astryxdesign/core/Table';
import {findPlatform, formatInt, importSummary} from '../../core/ledger';
import {clearPlatform, useLedger} from '../../store/ledgerStore';
import {useApp} from '../../appContext';
import {PanelCard} from '../../components/layout';
import {PlatformName} from '../../components/platformBranding';

function sourceFiles(fileNames) {
  if (fileNames.length === 0) return <Text type="supporting">Manual or older import</Text>;
  const extra = fileNames.length > 2 ? ` +${fileNames.length - 2} more` : '';
  return `${fileNames.slice(0, 2).join(', ')}${extra}`;
}

/** What's loaded per platform, with a Clear button to reload one fresh. */
export function ImportedDataTable() {
  const ledger = useLedger();
  const {money, toast, confirm} = useApp();
  const platforms = importSummary(ledger).map(summary => ({...summary, id: summary.platformId}));
  if (platforms.length === 0) return null;

  function confirmClear(platformId) {
    const name = findPlatform(platformId)?.name || platformId;
    confirm({
      title: `Remove all ${name} data?`,
      description: "Every royalty row imported for this store is removed. This can't be undone, so export a vault first if you're unsure.",
      actionLabel: `Clear ${name}`,
      onConfirm: () => {
        clearPlatform(platformId);
        toast(`Cleared ${name}. Import a new file to reload it.`);
      },
    });
  }

  const columns = [
    {key: 'platformId', header: 'Platform', width: pixel(180), renderCell: row => <PlatformName platformId={row.platformId} />},
    {key: 'rows', header: 'Rows', width: pixel(100), align: 'end', renderCell: row => formatInt(row.rows)},
    {key: 'royalty', header: 'Royalties', width: pixel(120), align: 'end', renderCell: row => money(row.royalty)},
    {key: 'fileNames', header: 'Source files', width: proportional(1, {minWidth: 160}), renderCell: row => sourceFiles(row.fileNames)},
    {key: 'lastImportedAt', header: 'Last import', width: pixel(130), renderCell: row => row.lastImportedAt?.slice(0, 10) || '—'},
    {
      key: 'actions',
      header: '',
      width: pixel(130),
      align: 'end',
      renderCell: row => <Button label="Clear" size="sm" variant="ghost" onClick={() => confirmClear(row.platformId)} />,
    },
  ];

  return (
    <PanelCard title="Your imports" hint="What's loaded for each store. Clear one to reload it fresh.">
      <Table data={platforms} columns={columns} idKey="id" density="compact" />
    </PanelCard>
  );
}
