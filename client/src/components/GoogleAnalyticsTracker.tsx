import { useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { sendGoogleAnalyticsPageView } from "@/lib/googleAnalytics";

/**
 * Shared application-root GA4 tracker. Rendering it outside route layouts makes
 * the configured tag apply equally to Cabinet Dealz and affiliate storefronts.
 */
export function GoogleAnalyticsTracker() {
  const [location] = useLocation();
  const { data: settings } = trpc.siteSettings.getPublicSettings.useQuery(undefined, {
    staleTime: 60_000,
    retry: false,
  });
  const measurementId = settings?.googleAnalyticsMeasurementId;

  useEffect(() => {
    if (!measurementId || typeof window === "undefined") return;
    const [pathname, query = ""] = location.split("?");
    sendGoogleAnalyticsPageView({
      measurementId,
      hostname: window.location.hostname,
      pathname: pathname || "/",
      search: query ? `?${query}` : "",
      origin: window.location.origin,
      title: document.title,
    });
  }, [location, measurementId]);

  return null;
}
