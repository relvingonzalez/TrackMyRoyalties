/** Option lists for Selectors, and small text helpers. */
import {EXPENSE_CATEGORIES, PLATFORMS, currencySymbol, formatLabel} from './core/ledger';
import {defaultThemeSlug, themes} from './astryx-themes';

export const RANGE_OPTIONS = [
  {value: '7d', label: 'Last 7 days'},
  {value: '30d', label: 'Last 30 days'},
  {value: '90d', label: 'Last 90 days'},
  {value: 'ytd', label: 'Year to date'},
  {value: '12m', label: 'Last 12 months'},
  {value: 'all', label: 'All time'},
  {value: 'custom', label: 'Custom…'},
];

export const PLATFORM_OPTIONS = PLATFORMS.map(platform => ({value: platform.id, label: platform.name}));

export const PLATFORM_FILTER_OPTIONS = [{value: 'all', label: 'All platforms'}, ...PLATFORM_OPTIONS];

export const CATEGORY_OPTIONS = EXPENSE_CATEGORIES.map(category => ({value: category.id, label: category.name}));

export const BOOK_FORMAT_OPTIONS = ['ebook', 'paperback', 'hardcover', 'audiobook'].map(format => ({
  value: format,
  label: formatLabel(format),
}));

export const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'].map(code => ({
  value: code,
  label: `${code} (${currencySymbol(code)})`,
}));

/** Astryx themes registered in astryx-themes.js (`npx astryx theme add <slug>`). */
export const THEME_OPTIONS = [
  {value: 'writers-desk', label: "Writer's Desk", description: 'Ink on paper, with book-style headings. Light or dark, following your device.'},
  {value: 'neutral', label: 'Neutral', description: 'Quiet warm grays. Light or dark, following your device.'},
  {value: 'y2k', label: 'Y2K', description: 'Hot pink, lime, and Poppins. Light or dark, following your device.'},
  {value: 'gothic', label: 'Gothic', description: 'Deep blue-grays with a display serif. Always dark.'},
];

/** The theme in use: the saved choice if it's still installed, otherwise the app default. */
export function activeThemeSlug(savedTheme) {
  return themes[savedTheme] ? savedTheme : defaultThemeSlug;
}

/** Themes designed for dark mode only. */
export const DARK_ONLY_THEMES = new Set(['gothic']);

/** Value used in platform Selectors for "not tied to one platform" (Selector values are strings). */
export const GENERAL_PLATFORM = 'general';

export const GENERAL_PLATFORM_OPTIONS = [{value: GENERAL_PLATFORM, label: 'General', description: 'Not tied to one platform'}, ...PLATFORM_OPTIONS];

/**
 * Today (or a given Date) as YYYY-MM-DD in the user's local time zone. (toISOString alone
 * gives the UTC date, which is already tomorrow on an American evening.)
 */
export function toIsoDate(date = new Date()) {
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localTime.toISOString().slice(0, 10);
}

/** plural(3, 'row') → "3 rows" */
export function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}
