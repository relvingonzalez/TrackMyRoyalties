import {Center} from '@astryxdesign/core/Center';
import {Grid} from '@astryxdesign/core/Grid';
import {HStack} from '@astryxdesign/core/HStack';
import {VStack} from '@astryxdesign/core/VStack';
import {Card} from '@astryxdesign/core/Card';
import {Heading, Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Link} from '@astryxdesign/core/Link';
import {PLATFORMS, brand} from '../core/ledger';
import {setPreference} from '../store/ledgerStore';
import {useApp} from '../appContext';
import {PlatformMark} from '../components/platformBranding';

const PAIN_POINTS = [
  ['A subscription tax on success', `Competitors charge $10–$249/mo and raise the tier as you earn more. ${brand.name} is free, with every feature included.`],
  ['Income isn’t profit', 'Sales dashboards ignore covers, editors, AMS, Meta, BookBub, and ISBNs. Track expenses and ads to see your real net.'],
  ['No passwords, ever', 'Amazon has no public KDP API, and scrapers break. Upload the reports you already download; no store logins are stored.'],
  ['Dashboard fatigue', '~15 minutes a day across stores is nearly 100 hours a year. One view for every platform, or one at a time.'],
  ['Private by default', 'Your data stays in this browser on this device. Export it anytime.'],
  ['Tax-season ready', 'Year totals, monthly breakdowns, and CSV/JSON exports for your accountant.'],
];

/** First-visit landing: what this is, with a demo or an empty start. */
export default function Welcome() {
  const {demo} = useApp();
  const startEmpty = () => setPreference('firstVisit', false);
  return (
    <Center padding={6}>
      <VStack gap={10} maxWidth={1040}>
        <VStack gap={4}>
          <Text type="label" color="accent">
            Built for wide authors · Private · Free
          </Text>
          <Heading level={1} type="display-2">
            All your royalties. True profit. One place.
          </Heading>
          <Text type="large" color="secondary">
            Stop hopping between KDP, Kobo, D2D, Apple, IngramSpark, and B&N. See income, expenses, and ad spend together,
            without another monthly subscription that scales with your success.
          </Text>
          <HStack gap={3} wrap="wrap">
            <Button label="Explore with demo data" variant="primary" size="lg" onClick={demo.start} />
            <Button label="Start empty" size="lg" onClick={startEmpty} />
          </HStack>
          <Text type="supporting">Free, every feature · No account · Your data stays on this device</Text>
        </VStack>

        <VStack gap={4}>
          <Heading level={2}>What authors actually complain about</Heading>
          <Grid columns={{minWidth: 280, repeat: 'fit'}} gap={4}>
            {PAIN_POINTS.map(([title, body]) => (
              <Card key={title}>
                <VStack gap={2}>
                  <Heading level={4} accessibilityLevel={3}>
                    {title}
                  </Heading>
                  <Text color="secondary">{body}</Text>
                </VStack>
              </Card>
            ))}
          </Grid>
        </VStack>

        <VStack gap={4}>
          <Heading level={2}>Platforms</Heading>
          <HStack gap={4} wrap="wrap">
            {PLATFORMS.map(platform => (
              <HStack key={platform.id} gap={2} vAlign="center">
                <PlatformMark platform={platform} size={24} />
                <Text>{platform.name}</Text>
              </HStack>
            ))}
          </HStack>
        </VStack>

        <Text type="supporting">
          Free and built by one person. If it saves you time, you can{' '}
          <Link href="https://buymeacoffee.com/relvingonzalez" isExternalLink>
            buy me a coffee
          </Link>
          .
        </Text>
      </VStack>
    </Center>
  );
}
