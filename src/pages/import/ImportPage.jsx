import {Text} from '@astryxdesign/core/Text';
import {useApp} from '../../appContext';
import {Page, PanelCard, PanelRow} from '../../components/layout';
import {VaultControls} from '../../components/VaultControls';
import {RoyaltyImporter} from './RoyaltyImporter';
import {ExportGuides} from './ExportGuides';
import {ImportedDataTable} from './ImportedDataTable';
import {ExpenseImporter} from './ExpenseImporter';
import {ManualRoyaltyEntry} from './ManualRoyaltyEntry';

export default function ImportPage() {
  const {focus} = useApp();
  return (
    <Page title="Import & transfer" subtitle="Upload store reports, or move everything between devices with a vault file. No account needed.">
      <PanelRow>
        <RoyaltyImporter />
        <ExportGuides />
      </PanelRow>
      <ImportedDataTable />
      <ExpenseImporter scrollIntoView={focus === 'expense-import'} />
      <ManualRoyaltyEntry />
      <PanelCard title="Vault (full backup)" hint="One file for a new laptop or browser">
        <Text color="secondary">
          Exports royalties, expenses, titles, and platform links. Save it to iCloud, Dropbox, or a USB drive, then restore it
          on the other device.
        </Text>
        <VaultControls />
      </PanelCard>
    </Page>
  );
}
