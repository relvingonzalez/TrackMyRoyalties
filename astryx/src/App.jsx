import {Suspense, lazy, useState} from 'react';
import {AppShell} from '@astryxdesign/core/AppShell';
import {SideNav, SideNavHeading, SideNavItem, SideNavSection} from '@astryxdesign/core/SideNav';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {AlertDialog} from '@astryxdesign/core/AlertDialog';
import {VStack} from '@astryxdesign/core/VStack';
import {Text} from '@astryxdesign/core/Text';
import {Link} from '@astryxdesign/core/Link';
import {Icon} from '@astryxdesign/core/Icon';
import {useToast} from '@astryxdesign/core/Toast';
import {
  ArrowUpTrayIcon,
  BookOpenIcon,
  BuildingStorefrontIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  HomeIcon,
  ReceiptPercentIcon,
  HeartIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import {
  ArrowUpTrayIcon as ArrowUpTraySolidIcon,
  BookOpenIcon as BookOpenSolidIcon,
  BuildingStorefrontIcon as BuildingStorefrontSolidIcon,
  Cog6ToothIcon as Cog6ToothSolidIcon,
  DocumentTextIcon as DocumentTextSolidIcon,
  HomeIcon as HomeSolidIcon,
  ReceiptPercentIcon as ReceiptPercentSolidIcon,
} from '@heroicons/react/24/solid';
import {brand, formatMoney} from './core/ledger';
import {clearCatalog, loadDemo, restorePreDemo, useLedger, useLedgerStatus} from './store/ledgerStore';
import {AppContext} from './appContext';
import {ErrorBoundary} from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import Welcome from './pages/Welcome';

const PAGES = [
  {id: 'dashboard', label: 'Dashboard', icon: HomeIcon, selectedIcon: HomeSolidIcon, component: Dashboard},
  {id: 'platforms', label: 'Platforms', icon: BuildingStorefrontIcon, selectedIcon: BuildingStorefrontSolidIcon, component: lazy(() => import('./pages/Platforms'))},
  {id: 'books', label: 'Titles', icon: BookOpenIcon, selectedIcon: BookOpenSolidIcon, component: lazy(() => import('./pages/Books'))},
  {id: 'expenses', label: 'Expenses', icon: ReceiptPercentIcon, selectedIcon: ReceiptPercentSolidIcon, component: lazy(() => import('./pages/Expenses'))},
  {id: 'import', label: 'Import', icon: ArrowUpTrayIcon, selectedIcon: ArrowUpTraySolidIcon, component: lazy(() => import('./pages/import/ImportPage'))},
  {id: 'tax', label: 'Tax & export', icon: DocumentTextIcon, selectedIcon: DocumentTextSolidIcon, component: lazy(() => import('./pages/Tax'))},
  {id: 'settings', label: 'Settings', icon: Cog6ToothIcon, selectedIcon: Cog6ToothSolidIcon, component: lazy(() => import('./pages/Settings'))},
];

const DEFAULT_FILTERS = {range: '30d', platformId: 'all', from: '', to: ''};

const SUPPORT_URL = 'https://buymeacoffee.com/relvingonzalez';

function BrandMark() {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-grid',
        placeItems: 'center',
        width: 28,
        height: 28,
        borderRadius: 'var(--radius-element, 8px)',
        background: 'var(--color-accent, #0064E0)',
        color: 'var(--color-on-accent, #fff)',
        fontWeight: 700,
      }}>
      {brand.name[0]}
    </span>
  );
}

function SaveErrorBanner({error}) {
  return (
    <Banner
      status="error"
      container="section"
      title="Your latest change couldn't be saved"
      description={
        error?.name === 'QuotaExceededError'
          ? "This device's browser storage is full. Export a vault backup now from Settings."
          : 'Export a vault backup from Settings to be safe.'
      }
      collapsible={false}
      isDismissable
    />
  );
}

export default function App() {
  const ledger = useLedger();
  const {saveError, hasPreDemoSnapshot, setAsideCount} = useLedgerStatus();
  const showToast = useToast();
  const [pageId, setPageId] = useState('dashboard');
  const [focus, setFocus] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [confirmation, setConfirmation] = useState(null);
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);

  const hasRealData = !ledger.isDemo && (ledger.royalties.length > 0 || ledger.expenses.length > 0 || ledger.books.length > 0);

  function toast(message, type = 'info') {
    showToast({body: message, type});
  }

  function navigate(nextPageId, {focus: nextFocus = null} = {}) {
    setPageId(nextPageId);
    setFocus(nextFocus);
  }

  function startDemo() {
    const load = () => {
      loadDemo();
      toast(hasRealData ? 'Demo loaded. Use the banner to restore your data or remove the demo.' : 'Demo loaded. Remove it from the banner when you’re done.');
    };
    if (!hasRealData) {
      load();
      return;
    }
    setConfirmation({
      title: 'Load demo data?',
      description: 'Your current royalties and expenses are saved as a snapshot so you can restore them.',
      actionLabel: 'Load demo',
      actionVariant: 'primary',
      onConfirm: load,
    });
  }

  function clearSalesData() {
    setConfirmation({
      title: ledger.isDemo ? 'Remove demo data?' : 'Clear all sales data?',
      description: ledger.isDemo
        ? 'Removes the demo royalties, expenses, and titles. Your settings stay.'
        : "Removes every royalty, expense, and title on this device. Settings stay. This can't be undone unless you exported a vault.",
      actionLabel: ledger.isDemo ? 'Remove demo data' : 'Clear sales data',
      onConfirm: () => {
        clearCatalog();
        toast('Cleared. Ready for your real data.');
      },
    });
  }

  function restoreDataFromBeforeDemo() {
    setConfirmation({
      title: 'Restore your previous data?',
      description: 'The demo numbers are discarded and the data you had before loading the demo comes back.',
      actionLabel: 'Restore',
      actionVariant: 'primary',
      onConfirm: () => {
        if (restorePreDemo()) toast('Your previous data is restored.');
      },
    });
  }

  function closeConfirmation(isConfirmed) {
    if (isConfirmed) confirmation.onConfirm();
    else confirmation.onCancel?.();
    setConfirmation(null);
  }

  const appServices = {
    money: amount => formatMoney(amount, ledger.currency),
    toast,
    confirm: setConfirmation,
    navigate,
    focus,
    filters,
    setFilters,
    demo: {start: startDemo, clear: clearSalesData, restore: restoreDataFromBeforeDemo},
  };

  const page = PAGES.find(candidate => candidate.id === pageId);
  const PageComponent = page.component;
  const isFirstVisit = ledger.firstVisit && ledger.royalties.length === 0;

  const sideNav = (
    <SideNav
      header={<SideNavHeading heading={brand.name} icon={<BrandMark />} />}
      // Text doesn't fit the collapsed icon rail, so collapsed, the footer text is hidden and
      // the support link moves to the icon row beside the collapse button.
      footer={
        !isNavCollapsed && (
          <VStack gap={1} padding={3}>
            <Text type="supporting">Data stays on this device</Text>
            <Link href={SUPPORT_URL} isExternalLink>
              Buy me a coffee
            </Link>
          </VStack>
        )
      }
      footerIcons={
        isNavCollapsed && (
          <Link href={SUPPORT_URL} target="_blank" label="Buy me a coffee" tooltip="Buy me a coffee">
            <Icon icon={HeartIcon} size="sm" />
          </Link>
        )
      }
      collapsible={{isCollapsed: isNavCollapsed, onCollapsedChange: setIsNavCollapsed}}
      // Lets styles.css widen the expanded sidebar (Astryx exposes no width setting).
      data-expanded={!isNavCollapsed}>
      <SideNavSection>
        {PAGES.map(item => (
          <SideNavItem
            key={item.id}
            label={item.label}
            icon={item.icon}
            selectedIcon={item.selectedIcon}
            isSelected={item.id === pageId}
            onClick={() => navigate(item.id)}
          />
        ))}
      </SideNavSection>
      {!ledger.isDemo && (
        <SideNavSection>
          <SideNavItem label="Load demo data" icon={SparklesIcon} onClick={startDemo} />
        </SideNavSection>
      )}
    </SideNav>
  );

  const banners = (saveError || setAsideCount > 0 || ledger.isDemo) && (
    <VStack gap={0}>
      {saveError && <SaveErrorBanner error={saveError} />}
      {setAsideCount > 0 && (
        <Banner
          status="warning"
          container="section"
          title={`${setAsideCount} row${setAsideCount === 1 ? '' : 's'} without a valid date were set aside`}
          description="They can't be placed on any chart or total, so they're kept separately (and in vault backups) instead of being shown."
          collapsible={false}
          isDismissable
        />
      )}
      {ledger.isDemo && (
        <Banner
          status="warning"
          container="section"
          title="Demo data is active"
          description="Sample author numbers, not your royalties."
          collapsible={false}
          endContent={
            <>
              {hasPreDemoSnapshot && <Button label="Restore my previous data" size="sm" onClick={restoreDataFromBeforeDemo} />}
              <Button label="Remove demo data" size="sm" variant="primary" onClick={clearSalesData} />
            </>
          }
        />
      )}
    </VStack>
  );

  return (
    <AppContext value={appServices}>
      {isFirstVisit ? (
        <Welcome />
      ) : (
        <AppShell sideNav={sideNav} banner={banners} height="fill">
          <ErrorBoundary resetKey={pageId}>
            <Suspense>
              <PageComponent />
            </Suspense>
          </ErrorBoundary>
        </AppShell>
      )}
      {confirmation && (
        <AlertDialog
          isOpen
          onOpenChange={isOpen => !isOpen && closeConfirmation(false)}
          title={confirmation.title}
          description={confirmation.description}
          actionLabel={confirmation.actionLabel}
          actionVariant={confirmation.actionVariant}
          onAction={() => closeConfirmation(true)}
        />
      )}
    </AppContext>
  );
}
