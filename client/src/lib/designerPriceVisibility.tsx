// ─── Designer price visibility (demo distributor designer only) ──────────────
// The Demo Distributor Designer (/distributor-preview/design) is a sample a
// distributor shows to prospects, so it must never publish a price. App.tsx
// mounts <DesignTool hidePrices /> only on that route; DesignTool puts the flag
// in this context so every price-rendering child (palette cards, review lists,
// summary panels, dialogs, PDFs) can skip its price without prop threading.
// Default is "show prices", so every other route behaves exactly as before.

import { createContext, useContext, type ReactNode } from "react";

const DesignerPriceVisibilityContext = createContext<boolean>(false);

export function DesignerPriceVisibilityProvider({ hidePrices, children }: { hidePrices: boolean; children: ReactNode }) {
  return <DesignerPriceVisibilityContext.Provider value={hidePrices}>{children}</DesignerPriceVisibilityContext.Provider>;
}

/** True only inside the demo distributor designer: render no price, total or price-derived number. */
export function useDesignerPricesHidden(): boolean {
  return useContext(DesignerPriceVisibilityContext);
}

/** Plain-English stand-in for a hidden price, where a layout needs some text. */
export const HIDDEN_PRICE_LABEL = "Price from your dealer";

// ─── Designer open state (for the shell around the designer) ────────────────
// The demo shell hides its Save design / Get my price buttons until the
// customer is past the email form. DesignTool reports that here; outside a
// reporter (every other route) this is a no-op.

const DesignerOpenReporterContext = createContext<((open: boolean) => void) | null>(null);

export function DesignerOpenReporterProvider({ onOpenChange, children }: { onOpenChange: (open: boolean) => void; children: ReactNode }) {
  return <DesignerOpenReporterContext.Provider value={onOpenChange}>{children}</DesignerOpenReporterContext.Provider>;
}

export function useDesignerOpenReporter(): ((open: boolean) => void) | null {
  return useContext(DesignerOpenReporterContext);
}

// ─── Price text scrubbing (free-text notes and toasts) ──────────────────────
// Auto Design notes, placement notices and toasts are built as sentences that
// sometimes carry an amount ("…PL-1234, $412.00, the lowest-priced…"). In the
// demo designer those sentences are kept but their dollar amounts are removed.

const MONEY = String.raw`\$\s?\d[\d,]*(?:\.\d+)?`;
const MONEY_PARENTHETICAL = new RegExp(String.raw`\s*\(\s*${MONEY}[^()]*\)`, "g");
const MONEY_TOKEN = new RegExp(String.raw`(?:\s*[·,]\s*|\s+(?:at|for)\s+|\s*)${MONEY}(?:\s*(?:\+\s*${MONEY}))*(?:\s+(?:List|each|ea)\b)?`, "g");

/** Removes dollar amounts from a sentence and tidies the punctuation left behind. */
export function stripPriceText(text: string): string {
  if (!text.includes("$")) return text;
  return text
    .replace(MONEY_PARENTHETICAL, "")
    .replace(MONEY_TOKEN, "")
    .replace(/\s+([.,;:)])/g, "$1")
    .replace(/,\s*,/g, ",")
    .replace(/ {2,}/g, " ")
    .trim();
}

const TOAST_METHODS = ["success", "info", "warning", "error", "message", "loading"] as const;

function scrubToastArgs(args: unknown[]): unknown[] {
  const next = [...args];
  if (typeof next[0] === "string") next[0] = stripPriceText(next[0]);
  const options = next[1];
  if (options && typeof options === "object" && typeof (options as { description?: unknown }).description === "string") {
    next[1] = { ...(options as object), description: stripPriceText((options as { description: string }).description) };
  }
  return next;
}

/**
 * Wraps a sonner-style `toast` so that, while `isHidden()` is true, string
 * messages and descriptions lose their dollar amounts. Otherwise it passes
 * everything through untouched.
 */
export function createPriceSafeToast<T extends (...args: never[]) => unknown>(toastFn: T, isHidden: () => boolean): T {
  const call = (fn: (...args: unknown[]) => unknown) => (...args: unknown[]) =>
    fn(...(isHidden() ? scrubToastArgs(args) : args));
  const wrapped = call(toastFn as unknown as (...args: unknown[]) => unknown) as unknown as T & Record<string, unknown>;
  for (const key of Object.keys(toastFn) as (keyof T & string)[]) {
    const value = (toastFn as unknown as Record<string, unknown>)[key];
    (wrapped as Record<string, unknown>)[key] = typeof value === "function" && (TOAST_METHODS as readonly string[]).includes(key)
      ? call(value as (...args: unknown[]) => unknown)
      : value;
  }
  return wrapped;
}
