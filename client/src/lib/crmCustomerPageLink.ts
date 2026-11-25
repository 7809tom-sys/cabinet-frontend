/**
 * "Open customer page" on a Sales CRM card.
 *
 * The board card is a draggable <button>, so the link inside it cannot be a
 * real <a> (interactive content inside a button is invalid HTML and browsers
 * handle it inconsistently). These helpers give the scripted link the same
 * behaviour a real hyperlink has: a plain click opens the page in this tab,
 * Ctrl/Cmd/Shift-click or a middle click opens a new tab, and Enter or Space
 * works from the keyboard.
 *
 * The customer page lives on /affiliate (`?section=customers&customer=…`).
 * That page reads its section and customer from the URL only when it mounts,
 * so this is a full page navigation on purpose: an in-app (wouter) push from
 * the affiliate's own CRM section would keep the already-mounted dashboard
 * on the CRM section instead of opening the customer.
 */

export type CustomerPageLinkModifiers = {
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  button?: number;
};

/** True when the gesture asks for a new tab, the same way a browser link reads it. */
export function customerPageLinkWantsNewTab(event: CustomerPageLinkModifiers): boolean {
  return Boolean(event.ctrlKey || event.metaKey || event.shiftKey || event.button === 1);
}

/** True for the keys that activate a link-like control. */
export function isCustomerPageLinkActivationKey(key: string): boolean {
  return key === "Enter" || key === " " || key === "Spacebar";
}

export type CustomerPageNavigator = {
  assign: (href: string) => void;
  open: (href: string, target: string, features: string) => unknown;
};

const browserNavigator: CustomerPageNavigator = {
  assign: (href) => window.location.assign(href),
  open: (href, target, features) => window.open(href, target, features),
};

/** Opens the customer page. Returns false when there is no usable href. */
export function openCustomerPage(
  href: string | null | undefined,
  { newTab = false }: { newTab?: boolean } = {},
  nav: CustomerPageNavigator = browserNavigator,
): boolean {
  const target = (href ?? "").trim();
  if (!target) return false;
  if (newTab) nav.open(target, "_blank", "noopener,noreferrer");
  else nav.assign(target);
  return true;
}
