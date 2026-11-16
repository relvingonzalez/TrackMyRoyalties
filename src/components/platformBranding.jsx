/** Store logos and names. */
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {findPlatform} from '../core/ledger';
import {getPlatformIcon, getPlatformLogo} from '../core/platformLogos';

/** Inline SVG logo. The markup is static first-party SVG from js/platform-icons.js. */
function SvgLogo({markup, label, color, size, padding = 0}) {
  return (
    <span
      role="img"
      aria-label={label}
      style={{display: 'inline-flex', width: size, height: size, flexShrink: 0, color, padding}}
      dangerouslySetInnerHTML={{__html: markup}}
    />
  );
}

/** Square store mark, e.g. on platform cards. */
export function PlatformMark({platform, size = 32}) {
  const icon = getPlatformIcon(platform.id);
  if (icon.type === 'img') {
    return <img src={icon.src} alt={platform.name} width={size} height={size} style={{objectFit: 'contain', borderRadius: 6}} />;
  }
  return <SvgLogo markup={icon.markup} label={platform.name} color={platform.color} size={size} padding={icon.tight ? 0 : 2} />;
}

/** Larger logo (wordmark when there is one), e.g. in a page header. */
export function PlatformLogo({platform}) {
  const logo = getPlatformLogo(platform.id);
  if (logo.type === 'img') {
    return <img src={logo.src} alt={platform.name} style={{height: logo.isWordmark ? 32 : 40, width: 'auto'}} />;
  }
  return <SvgLogo markup={logo.markup} label={platform.name} color={platform.color} size={40} />;
}

/** Colored dot + store name, for table cells. */
export function PlatformName({platformId}) {
  const platform = findPlatform(platformId);
  return (
    <HStack gap={2} vAlign="center">
      <span aria-hidden style={{width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: platform?.color || '#888'}} />
      <Text>{platform?.name || platformId}</Text>
    </HStack>
  );
}
