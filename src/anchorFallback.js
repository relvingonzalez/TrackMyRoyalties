/**
 * Positions Astryx popups (dropdown lists, menus, date pickers, tooltips) next to the field
 * or button that opened them, in browsers without CSS anchor positioning: Safari before 26,
 * which is also the engine of the Mac desktop app on older macOS. There, Astryx's popups
 * open and close but aren't placed (they land in the window's top-left corner); Astryx's
 * browser-support guide recommends exactly this kind of JS fallback.
 *
 * Does nothing in browsers that support anchor positioning. Popups with no trigger (toasts)
 * are left alone.
 */
const GAP = 4; // between the trigger and its popup
const EDGE = 8; // minimum distance from the window's edges
const MIN_HEIGHT = 120; // shortest a scrollable popup gets before it's allowed to overflow

/** Properties set while a popup is open, removed again when it closes. */
const MANAGED = ['position', 'inset', 'top', 'left', 'margin', 'min-width', 'max-width', 'max-height', 'overflow-y'];

const tracked = new Map(); // popup element → animation frame id

export function installAnchorPositioningFallback() {
  if (typeof CSS === 'undefined' || CSS.supports('anchor-name', '--x')) return;
  // `toggle` doesn't bubble, but a capturing listener on the document still sees it.
  document.addEventListener(
    'toggle',
    event => {
      const popup = event.target;
      if (!(popup instanceof HTMLElement) || !popup.hasAttribute('popover')) return;
      if (event.newState === 'open') track(popup);
      else untrack(popup);
    },
    true,
  );
}

function idSelector(id) {
  return CSS.escape(id);
}

/** The element that opened `popup`, found through the ARIA links Astryx sets on triggers. */
function findTrigger(popup) {
  const ids = [popup, ...popup.querySelectorAll('[id]')].map(element => element.id).filter(Boolean);
  const outsidePopup = element => element && !popup.contains(element) && !element.closest('[popover]:popover-open');
  for (const attribute of ['aria-controls', 'aria-owns', 'aria-describedby']) {
    for (const id of ids) {
      const trigger = [...document.querySelectorAll(`[${attribute}~="${idSelector(id)}"]`)].find(outsidePopup);
      if (trigger) return trigger;
    }
  }
  if (popup.id) {
    const trigger = document.querySelector(`[popovertarget="${idSelector(popup.id)}"]`);
    if (outsidePopup(trigger)) return trigger;
  }
  const expanded = [...document.querySelectorAll('[aria-expanded="true"]')].find(outsidePopup);
  return expanded || null;
}

function place(popup, trigger) {
  const anchor = trigger.getBoundingClientRect();
  const style = popup.style;
  const set = (property, value) => style.setProperty(property, value, 'important');
  set('position', 'fixed');
  set('inset', 'auto');
  set('margin', '0');
  set('max-width', `${window.innerWidth - 2 * EDGE}px`);
  if (trigger.getAttribute('role') === 'combobox') set('min-width', `${anchor.width}px`);

  // Below the trigger, unless there's more room above.
  const roomBelow = window.innerHeight - anchor.bottom - GAP - EDGE;
  const roomAbove = anchor.top - GAP - EDGE;
  style.removeProperty('max-height');
  const naturalHeight = popup.offsetHeight;
  const below = naturalHeight <= roomBelow || roomBelow >= roomAbove;
  const room = below ? roomBelow : roomAbove;
  if (naturalHeight > room) {
    set('max-height', `${Math.max(room, MIN_HEIGHT)}px`);
    set('overflow-y', 'auto');
  }
  const height = popup.offsetHeight;
  const width = popup.offsetWidth;
  const top = below ? anchor.bottom + GAP : anchor.top - GAP - height;
  const left = Math.min(Math.max(EDGE, anchor.left), window.innerWidth - width - EDGE);
  set('top', `${Math.max(EDGE, top)}px`);
  set('left', `${Math.max(EDGE, left)}px`);
}

/** Keep the popup next to its trigger every frame while it's open: covers scrolling,
 * resizing, and the popup's own content changing size. */
function track(popup) {
  const trigger = findTrigger(popup);
  if (!trigger) return;
  untrack(popup);
  const follow = () => {
    if (!popup.isConnected || !popup.matches(':popover-open')) return untrack(popup);
    place(popup, trigger);
    tracked.set(popup, requestAnimationFrame(follow));
  };
  follow();
}

function untrack(popup) {
  if (!tracked.has(popup)) return;
  cancelAnimationFrame(tracked.get(popup));
  tracked.delete(popup);
  MANAGED.forEach(property => popup.style.removeProperty(property));
}
