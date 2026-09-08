/**
 * Focus management for app sheets (`[data-slot="sheet"]`).
 *
 * Sheets are plain views rendered by the page model, so the framework does not
 * know when one opens. This module watches the document instead: when a sheet
 * appears it moves focus inside (the first autofocused control, else the first
 * focusable one), keeps focus inside while it is open, and hands focus back to
 * the element that opened it once it closes.
 */

const SHEET = '[data-slot="sheet"]';
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const panelOf = (sheet: Element): Element => sheet.lastElementChild ?? sheet;

const focusables = (sheet: Element): Array<HTMLElement> =>
  [...panelOf(sheet).querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => element.getClientRects().length > 0,
  );

export const installSheetFocus = (root: Document = document): (() => void) => {
  let opener: HTMLElement | null = null;
  let current: Element | null = null;

  const focusInto = (sheet: Element) => {
    const preferred = panelOf(sheet).querySelector<HTMLElement>("[autofocus]");
    const target = preferred ?? focusables(sheet)[0] ?? null;
    target?.focus({ preventScroll: true });
  };

  const sync = () => {
    const sheets = root.querySelectorAll(SHEET);
    const top = sheets.length > 0 ? sheets[sheets.length - 1]! : null;
    if (top === current) return;
    if (top !== null && current === null) {
      opener = root.activeElement instanceof HTMLElement ? root.activeElement : null;
    }
    current = top;
    if (top !== null) {
      focusInto(top);
    } else if (opener !== null) {
      if (opener.isConnected) opener.focus({ preventScroll: true });
      opener = null;
    }
  };

  const onFocusIn = (event: FocusEvent) => {
    if (current === null) return;
    const target = event.target;
    if (target instanceof Node && current.contains(target)) return;
    focusInto(current);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (current === null || event.key !== "Tab") return;
    const items = focusables(current);
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = root.activeElement;
    if (event.shiftKey && (active === first || !current.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const observer = new MutationObserver(sync);
  observer.observe(root.body, { childList: true, subtree: true });
  root.addEventListener("focusin", onFocusIn);
  root.addEventListener("keydown", onKeyDown);
  sync();
  return () => {
    observer.disconnect();
    root.removeEventListener("focusin", onFocusIn);
    root.removeEventListener("keydown", onKeyDown);
  };
};
