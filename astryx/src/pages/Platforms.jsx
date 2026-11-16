import {Grid} from '@astryxdesign/core/Grid';
import {HStack} from '@astryxdesign/core/HStack';
import {VStack} from '@astryxdesign/core/VStack';
import {ClickableCard} from '@astryxdesign/core/ClickableCard';
import {MetadataList, MetadataListItem} from '@astryxdesign/core/MetadataList';
import {Heading, Text} from '@astryxdesign/core/Text';
import {Badge} from '@astryxdesign/core/Badge';
import {PLATFORMS, aggregate, formatInt} from '../core/ledger';
import {useLedger} from '../store/ledgerStore';
import {useApp} from '../appContext';
import {Page, SignedAmount} from '../components/layout';
import {PlatformMark} from '../components/platformBranding';

const NO_SALES = {royalty: 0, units: 0, spend: 0, net: 0};

function PlatformCard({platform, stats, connection, isInUse, isSelected, onOpen}) {
  const {money} = useApp();
  return (
    <ClickableCard label={`${platform.name}: open its dashboard`} onClick={onOpen} elevation={isSelected ? 'med' : 'none'}>
      <VStack gap={4}>
        <HStack gap={3} vAlign="center">
          <PlatformMark platform={platform} size={36} />
          <VStack gap={0.5}>
            <Heading level={4} accessibilityLevel={2}>
              {platform.name}
            </Heading>
            <Text type="supporting">{isInUse ? 'In use' : 'Available'}</Text>
          </VStack>
        </HStack>
        <MetadataList columns={2}>
          <MetadataListItem label="Royalties">{money(stats.royalty)}</MetadataListItem>
          <MetadataListItem label="Units">{formatInt(stats.units)}</MetadataListItem>
          <MetadataListItem label="Spend">{money(stats.spend)}</MetadataListItem>
          <MetadataListItem label="Net">
            <SignedAmount value={stats.net}>{money(stats.net)}</SignedAmount>
          </MetadataListItem>
        </MetadataList>
        <HStack>
          {connection?.connected ? (
            <Badge variant="success" label={`Connected · last import ${connection.lastImport}`} />
          ) : (
            <Badge label="Not connected · import a report" />
          )}
        </HStack>
      </VStack>
    </ClickableCard>
  );
}

export default function Platforms() {
  const ledger = useLedger();
  const {money, filters, setFilters, navigate} = useApp();
  // Every platform's numbers, whichever single platform the filter is set to.
  const totals = aggregate(ledger, {...filters, platformId: 'all'});
  const platformsInUse = new Set(ledger.royalties.map(row => row.platformId));

  function openPlatformDashboard(platformId) {
    setFilters(current => ({...current, platformId}));
    navigate('dashboard');
  }

  return (
    // Every store's card is always shown, so only the date range filter applies here.
    <Page
      title="Platforms"
      subtitle="Connect by uploading reports, never passwords. Open a store to see its own dashboard."
      hasFilters
      hasPlatformFilter={false}>
      <Grid columns={{minWidth: 260, repeat: 'fill'}} gap={4}>
        {PLATFORMS.map(platform => (
          <PlatformCard
            key={platform.id}
            platform={platform}
            stats={totals.byPlatform[platform.id] || NO_SALES}
            connection={ledger.connectedPlatforms[platform.id]}
            isInUse={platformsInUse.has(platform.id)}
            isSelected={filters.platformId === platform.id}
            onOpen={() => openPlatformDashboard(platform.id)}
          />
        ))}
      </Grid>
      {totals.generalSpend > 0 && (
        <Text type="supporting">
          Plus {money(totals.generalSpend)} in general expenses not tied to one platform (editing, ISBNs, tools…). Set a
          platform on an expense to count it against that store.
        </Text>
      )}
    </Page>
  );
}
