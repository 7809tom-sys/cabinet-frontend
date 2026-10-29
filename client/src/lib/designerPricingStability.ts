import { useEffect, useState } from "react";

export const COUNTERTOP_TOAST_TIMEOUT_MS = 8_000;

export type PricePairIdentity = {
  cabinetId: number;
  styleId: number;
  masterCode?: string;
};

/** Same cabinets, styles, and distributor produce the same pricing query. */
export function stablePricePairKey(pairs: readonly PricePairIdentity[], distributorId: number | null | undefined): string {
  const rows = pairs
    .map((pair) => `${pair.cabinetId}:${pair.styleId}:${pair.masterCode ?? ""}`)
    .sort();
  return `${distributorId ?? ""}|${rows.join("|")}`;
}

export function countertopToastVisible(input: {
  pending: boolean;
  failed: boolean;
  timedOut: boolean;
}): boolean {
  if (input.failed || input.timedOut) return false;
  return input.pending;
}

/** Keeps the latest value, but waits before publishing a change. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
