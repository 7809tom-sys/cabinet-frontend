import {
  normalizeGa4MeasurementId,
  shouldTrackGoogleAnalytics,
} from "@shared/googleAnalytics";

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: Gtag;
  }
}

function ensureGtag(): Gtag {
  window.dataLayer = window.dataLayer ?? [];
  if (!window.gtag) {
    window.gtag = (...args: unknown[]) => {
      window.dataLayer?.push(args);
    };
  }
  return window.gtag;
}

/**
 * Load and configure one GA4 tag for the current live host. The configuration
 * deliberately suppresses GA4's automatic page view because this SPA emits an
 * explicit page view for every route change below.
 */
export function configureGoogleAnalytics(
  measurementId: string | null | undefined,
  hostname: string | null | undefined,
): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const normalizedMeasurementId = normalizeGa4MeasurementId(measurementId);
  if (!normalizedMeasurementId || !shouldTrackGoogleAnalytics({ measurementId: normalizedMeasurementId, hostname })) {
    return false;
  }

  const selector = `script[data-cabinet-dealz-ga4="${normalizedMeasurementId}"]`;
  let script = document.querySelector<HTMLScriptElement>(selector);
  const isFirstConfiguration = !script?.dataset.configured;
  if (!script) {
    script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${normalizedMeasurementId}`;
    script.setAttribute("data-cabinet-dealz-ga4", normalizedMeasurementId);
    document.head.appendChild(script);
  }

  const gtag = ensureGtag();
  if (isFirstConfiguration) {
    gtag("js", new Date());
    gtag("config", normalizedMeasurementId, { send_page_view: false });
    script.dataset.configured = "true";
  }
  return true;
}

export type GoogleAnalyticsPageView = {
  measurementId: string | null | undefined;
  hostname: string | null | undefined;
  pathname: string;
  search?: string;
  origin: string;
  title: string;
};

/** Send one accurately attributed page view after a Wouter SPA route change. */
export function sendGoogleAnalyticsPageView(input: GoogleAnalyticsPageView): boolean {
  const normalizedMeasurementId = normalizeGa4MeasurementId(input.measurementId);
  const search = input.search ?? "";
  if (!normalizedMeasurementId || !configureGoogleAnalytics(normalizedMeasurementId, input.hostname)) return false;

  ensureGtag()("event", "page_view", {
    page_location: `${input.origin}${input.pathname}${search}`,
    page_path: `${input.pathname}${search}`,
    page_title: input.title,
    site_hostname: input.hostname?.trim().toLowerCase() ?? "",
  });
  return true;
}
