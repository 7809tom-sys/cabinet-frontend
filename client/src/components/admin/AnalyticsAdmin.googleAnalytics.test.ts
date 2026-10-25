import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const analyticsAdminSource = readFileSync(new URL("./AnalyticsAdmin.tsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../../App.tsx", import.meta.url), "utf8");

describe("admin-managed Google Analytics", () => {
  it("offers a validated Measurement ID input and save/clear actions in the existing Analytics settings tab", () => {
    expect(analyticsAdminSource).toContain('trpc.siteSettings.getPublicSettings.useQuery()');
    expect(analyticsAdminSource).toContain('trpc.siteSettings.updateGoogleAnalytics.useMutation({');
    expect(analyticsAdminSource).toContain('id="google-analytics-measurement-id"');
    expect(analyticsAdminSource).toContain("GA4 Measurement ID");
    expect(analyticsAdminSource).toContain("Save Google Analytics");
    expect(analyticsAdminSource).toContain("Clear Measurement ID");
  });

  it("mounts one root tracker outside individual route layouts so affiliate routes and custom hosts are covered", () => {
    expect(appSource).toContain('import { GoogleAnalyticsTracker } from "@/components/GoogleAnalyticsTracker";');
    expect(appSource).toContain("<GoogleAnalyticsTracker />");
  });
});
