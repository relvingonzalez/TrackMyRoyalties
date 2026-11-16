import {VStack} from '@astryxdesign/core/VStack';
import {Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Banner} from '@astryxdesign/core/Banner';
import {Collapsible} from '@astryxdesign/core/Collapsible';
import {Divider} from '@astryxdesign/core/Divider';
import {Icon} from '@astryxdesign/core/Icon';
import {ArrowTopRightOnSquareIcon} from '@heroicons/react/24/outline';
import {EXPORT_GUIDES} from '../../core/importers';
import {getPlatformLogo} from '../../core/platformLogos';
import {PanelCard} from '../../components/layout';
import {openExternalUrl} from './importHelpers';

/** Static first-party copy from js/import.js, which uses <strong>/<em> for emphasis. */
function GuideText({html, type}) {
  return (
    <Text type={type}>
      <span dangerouslySetInnerHTML={{__html: html}} />
    </Text>
  );
}

function Guide({guide}) {
  const logo = getPlatformLogo(guide.id);
  return (
    <VStack gap={3} paddingBlockEnd={2}>
      {logo.isWordmark && <img src={logo.src} alt={guide.title} style={{height: 28, width: 'auto', alignSelf: 'start'}} />}
      {guide.confidence === 'likely' && (
        <Banner
          status="warning"
          title="This store changed its dashboard recently"
          description="The steps are the right general path, but a button label may have shifted. See the note below if something doesn't match."
          collapsible={false}
        />
      )}
      {guide.steps?.length > 0 && (
        <ol style={{margin: 0, paddingInlineStart: '1.25rem', display: 'grid', gap: 4}}>
          {guide.steps.map(step => (
            <li key={step}>
              <GuideText html={step} />
            </li>
          ))}
        </ol>
      )}
      {guide.note && <GuideText html={guide.note} type="supporting" />}
      {guide.caveat && <GuideText html={`<strong>Heads up:</strong> ${guide.caveat}`} type="supporting" />}
      {guide.url && (
        <Button
          label={guide.urlVerified === false ? 'Go to report (unverified link)' : 'Go to report'}
          size="sm"
          icon={<Icon icon={ArrowTopRightOnSquareIcon} />}
          onClick={() => openExternalUrl(guide.url)}
        />
      )}
    </VStack>
  );
}

export function ExportGuides() {
  return (
    <PanelCard title="How to export from each store">
      <VStack gap={2}>
        {EXPORT_GUIDES.map((guide, index) => (
          <VStack key={guide.id} gap={2}>
            {index > 0 && <Divider />}
            <Collapsible trigger={<Text weight="medium">{guide.title}</Text>} defaultIsOpen={false}>
              <Guide guide={guide} />
            </Collapsible>
          </VStack>
        ))}
      </VStack>
    </PanelCard>
  );
}
