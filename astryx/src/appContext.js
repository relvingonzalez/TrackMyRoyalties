import {createContext, useContext} from 'react';

/**
 * UI services shared across pages, provided by App. (The ledger data itself comes from
 * store/ledgerStore.js.)
 *
 * - money(amount): formatted in the user's display currency
 * - toast(message, type?): brief notification; type 'error' stays until dismissed
 * - confirm({title, description, actionLabel, actionVariant?, onConfirm, onCancel?})
 * - navigate(page, {focus?}): page is a PAGES id from App; focus names a section to scroll to
 * - focus: the section the current navigation asked to scroll to, if any
 * - filters / setFilters: the date range + platform filter shared by the analytics pages
 * - demo.start() / demo.clear() / demo.restore(): demo-data actions, each confirming first when
 *   real data is at stake
 */
export const AppContext = createContext(null);

export function useApp() {
  return useContext(AppContext);
}
