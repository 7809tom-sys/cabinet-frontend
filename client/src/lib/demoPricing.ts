// ─── Demo distributor: "Show prices to the public" setting ───────────────────
// Default OFF: the pitch is design first, price behind sign-in. The switch
// lives in the demo Back Office (Settings › Store settings) and is stored in
// this browser only (localStorage). `?pricing=on` / `?pricing=off` in the URL
// overrides it for a pitch. No backend: the production equivalent is the
// site-wide siteSettings.pricingVisibility ("public" | "logged_in" | "dealer"
// | "admin" | "hidden") managed in Admin › Pricing › Pricing Access.

import { useEffect, useState } from "react";
import { useSearch } from "wouter";

export const PUBLIC_PRICING_STORAGE_KEY = "demo-distributor-show-public-pricing";
const CHANGE_EVENT = "demo-distributor-pricing-change";

export function pricingOverrideFromSearch(search: string): boolean | null {
  const value = new URLSearchParams(search).get("pricing");
  if (value === "on") return true;
  if (value === "off") return false;
  return null;
}

export function readStoredPublicPricing(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(PUBLIC_PRICING_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setStoredPublicPricing(on: boolean): void {
  try {
    window.localStorage.setItem(PUBLIC_PRICING_STORAGE_KEY, on ? "1" : "0");
  } catch {
    /* storage unavailable: the setting just won't persist */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** The stored setting (ignores the URL override): what the Back Office switch shows. */
export function useStoredPublicPricing(): [boolean, (on: boolean) => void] {
  const [stored, setStored] = useState(false);
  useEffect(() => {
    const sync = () => setStored(readStoredPublicPricing());
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return [stored, setStoredPublicPricing];
}

/** Whether public visitors see prices right now: URL override, else the stored setting (default off). */
export function useDemoPublicPricing(): boolean {
  const search = useSearch();
  const [stored] = useStoredPublicPricing();
  return pricingOverrideFromSearch(search) ?? stored;
}
