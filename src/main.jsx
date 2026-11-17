import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Theme} from '@astryxdesign/core/theme';
import './styles.css';
import {themes} from './astryx-themes';
import {loadLedger, useLedger} from './store/ledgerStore';
import {DARK_ONLY_THEMES, activeThemeSlug} from './options';
import {ErrorBoundary} from './components/ErrorBoundary';
import {installAnchorPositioningFallback} from './anchorFallback';
import App from './App';

/** Applies the theme chosen in Settings. Light or dark follows the OS, except for dark-only themes. */
function ThemedApp() {
  const {theme} = useLedger();
  const slug = activeThemeSlug(theme);
  return (
    <Theme theme={themes[slug]} mode={DARK_ONLY_THEMES.has(slug) ? 'dark' : 'system'}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </Theme>
  );
}

/**
 * Offline support (production builds only; see src/service-worker.js). Not in the desktop
 * app, which already runs from files on disk. A failure here (private browsing, blocked
 * storage) only means no offline copy; it never affects the app.
 */
function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || location.hostname === '127.0.0.1') return;
  // updateViaCache 'none': always check the network for a new sw.js, never the HTTP cache,
  // so a new deploy is picked up on the next visit whatever cache headers the server sends.
  navigator.serviceWorker
    .register('./sw.js', {updateViaCache: 'none'})
    .catch(error => console.warn('Offline support unavailable:', error));
}

installAnchorPositioningFallback();

const root = document.getElementById('root');

// Load saved data before the first render, so no component ever sees a "not loaded yet"
// state. index.html shows "Loading…" until then.
try {
  await loadLedger();
  createRoot(root).render(
    <StrictMode>
      <ThemedApp />
    </StrictMode>,
  );
  registerServiceWorker();
} catch (error) {
  console.error('Could not load saved data:', error);
  root.textContent = `Couldn't open your saved data (${error.message}). Try reloading the page.`;
}
