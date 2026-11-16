import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Theme} from '@astryxdesign/core/theme';
import './styles.css';
import {themes} from './astryx-themes';
import {loadLedger, useLedger} from './store/ledgerStore';
import {DARK_ONLY_THEMES, activeThemeSlug} from './options';
import {ErrorBoundary} from './components/ErrorBoundary';
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
} catch (error) {
  console.error('Could not load saved data:', error);
  root.textContent = `Couldn't open your saved data (${error.message}). Try reloading, or open the classic app at ../../`;
}
