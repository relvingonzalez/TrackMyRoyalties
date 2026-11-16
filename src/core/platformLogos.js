/**
 * Store logos, from classic/platform-icons.js (carried over from the original app). It
 * returns paths like "assets/platforms/kobo.png", relative to src/, so they're mapped to
 * the URLs Vite serves.
 */
import './classic/platform-icons.js';

const platformIcons = window.WideLedgerPlatformIcons;

const assetUrls = import.meta.glob('../assets/platforms/*', {eager: true, query: '?url', import: 'default'});

function assetUrl(repoPath) {
  return repoPath ? assetUrls[`../${repoPath}`] || null : null;
}

/** Square mark: {type: 'img', src, tight} or {type: 'svg', markup, tight}. */
export function getPlatformIcon(platformId) {
  const icon = platformIcons.iconMarkup(platformId);
  return icon.type === 'img' ? {...icon, src: assetUrl(icon.src)} : icon;
}

/** The wider wordmark when the store has one, otherwise the square mark. */
export function getPlatformLogo(platformId) {
  const wordmark = assetUrl(platformIcons.wordmarkSrc(platformId));
  return wordmark ? {type: 'img', src: wordmark, isWordmark: true} : getPlatformIcon(platformId);
}
