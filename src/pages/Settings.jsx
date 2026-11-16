import {HStack} from '@astryxdesign/core/HStack';
import {VStack} from '@astryxdesign/core/VStack';
import {Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Link} from '@astryxdesign/core/Link';
import {Selector} from '@astryxdesign/core/Selector';
import {Switch} from '@astryxdesign/core/Switch';
import {List, ListItem} from '@astryxdesign/core/List';
import {Divider} from '@astryxdesign/core/Divider';
import {brand} from '../core/ledger';
import {resetLedger, setPreference, useLedger, useLedgerStatus} from '../store/ledgerStore';
import {useApp} from '../appContext';
import {CURRENCY_OPTIONS, THEME_OPTIONS, activeThemeSlug} from '../options';
import {Page, PanelCard, PanelRow} from '../components/layout';
import {VaultControls} from '../components/VaultControls';

function formatBytes(bytes) {
  return bytes >= 1073741824 ? `${(bytes / 1073741824).toFixed(1)} GB` : `${(bytes / 1048576).toFixed(1)} MB`;
}

function DataPanel() {
  const ledger = useLedger();
  const {storageUsage, hasPreDemoSnapshot} = useLedgerStatus();
  const {toast, confirm, demo} = useApp();

  function confirmReset() {
    confirm({
      title: `Delete all ${brand.name} data on this device?`,
      description: 'Royalties, expenses, titles, and settings are all removed. Export a vault first if you might want them back.',
      actionLabel: 'Delete everything',
      onConfirm: () => {
        resetLedger();
        toast('Data cleared');
      },
    });
  }

  const demoNote = ledger.isDemo
    ? 'Demo data is loaded. Remove it to get back to an empty workspace.'
    : hasPreDemoSnapshot
      ? 'A snapshot of your data from before the last demo load is still available.'
      : 'Demo data is sample numbers only. Remove it anytime before importing your reports.';

  return (
    <PanelCard title="Data">
      <Text color="secondary">
        Everything is stored on this device, in the browser's database (IndexedDB). Use a vault file to move it to another
        device.
        {storageUsage?.quota > 0 && ` Using ${formatBytes(storageUsage.usage)} of ${formatBytes(storageUsage.quota)} available to this app.`}
      </Text>
      <VaultControls />
      <Divider />
      <VStack gap={2}>
        <Text type="supporting">{demoNote}</Text>
        <HStack gap={2} wrap="wrap">
          <Button label={ledger.isDemo ? 'Remove demo data' : 'Clear sales data'} onClick={demo.clear} />
          {!ledger.isDemo && <Button label="Load demo data" variant="ghost" onClick={demo.start} />}
          <Button label="Reset all data" variant="destructive" onClick={confirmReset} />
        </HStack>
      </VStack>
    </PanelCard>
  );
}

export default function Settings() {
  const ledger = useLedger();
  return (
    <Page title="Settings" subtitle="Display preferences, your data, and about.">
      <PanelRow>
        <PanelCard title="Preferences">
          <Selector
            label="Theme"
            description={THEME_OPTIONS.find(option => option.value === activeThemeSlug(ledger.theme))?.description}
            options={THEME_OPTIONS}
            value={activeThemeSlug(ledger.theme)}
            onChange={value => setPreference('theme', value)}
            width="100%"
          />
          <Selector
            label="Display currency"
            options={CURRENCY_OPTIONS}
            value={ledger.currency || 'USD'}
            onChange={value => setPreference('currency', value)}
            width="100%"
          />
          <Switch label="Show KENP / page-read metrics" value={Boolean(ledger.showKenp)} onChange={value => setPreference('showKenp', value)} />
          <Switch
            label="Compact layout"
            description="Tighter spacing on every page."
            value={Boolean(ledger.compactMode)}
            onChange={value => setPreference('compactMode', value)}
          />
        </PanelCard>
        <DataPanel />
      </PanelRow>

      <PanelCard title="About">
        <Text>
          <strong>{brand.name}</strong>: local-first author P&L for wide publishing.
        </Text>
        <List listStyle="disc" density="compact">
          <ListItem label="Now" description="CSV and Excel import, multi-platform P&L, expenses, installable app." />
          <ListItem label="Next" description="iOS/macOS app, optional encrypted sync, Amazon Ads ROI matching." />
          <ListItem label="Not planned" description="Asking for KDP passwords or fragile account scraping." />
        </List>
        <Text color="secondary">
          {brand.name} is free and built by one person. If it saves you time, you can{' '}
          <Link href="https://buymeacoffee.com/relvingonzalez" isExternalLink>
            buy me a coffee
          </Link>
          . Entirely optional.
        </Text>
      </PanelCard>
    </Page>
  );
}
