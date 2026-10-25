import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { normalizeGa4MeasurementId } from "@shared/googleAnalytics";
import { toast } from "sonner";

const ANALYTICS_WEBSITE_ID = import.meta.env.VITE_ANALYTICS_WEBSITE_ID || "";
const ANALYTICS_ENDPOINT = import.meta.env.VITE_ANALYTICS_ENDPOINT || "";

export function AnalyticsAdmin() {
  const utils = trpc.useUtils();
  const { data: siteSettings, isLoading: isSettingsLoading } = trpc.siteSettings.getPublicSettings.useQuery();
  const [measurementIdInput, setMeasurementIdInput] = useState("");

  useEffect(() => {
    setMeasurementIdInput(siteSettings?.googleAnalyticsMeasurementId ?? "");
  }, [siteSettings?.googleAnalyticsMeasurementId]);

  const normalizedMeasurementId = useMemo(
    () => normalizeGa4MeasurementId(measurementIdInput),
    [measurementIdInput],
  );
  const isClearRequest = measurementIdInput.trim() === "";
  const isValidInput = isClearRequest || Boolean(normalizedMeasurementId);
  const isDirty = (normalizedMeasurementId ?? "") !== (siteSettings?.googleAnalyticsMeasurementId ?? "");
  const updateGoogleAnalytics = trpc.siteSettings.updateGoogleAnalytics.useMutation({
    onSuccess: async () => {
      await utils.siteSettings.getPublicSettings.invalidate();
      toast.success("Google Analytics setting saved");
    },
    onError: (error) => toast.error(error.message),
  });

  const saveGoogleAnalytics = () => {
    if (!isValidInput) {
      toast.error("Enter a GA4 Measurement ID in the format G-XXXXXXXXXX.");
      return;
    }
    updateGoogleAnalytics.mutate({ googleAnalyticsMeasurementId: normalizedMeasurementId ?? "" });
  };

  // Umami share URL pattern: {endpoint}/share/{websiteId}/{name}
  // If no share URL is configured, show the embedded iframe with the dashboard
  const dashboardUrl = ANALYTICS_ENDPOINT
    ? `${ANALYTICS_ENDPOINT}/websites/${ANALYTICS_WEBSITE_ID}`
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Site Analytics</h2>
          <p className="text-muted-foreground">
            View traffic, page views, and visitor data for your site.
          </p>
        </div>
        {dashboardUrl && (
          <Button variant="outline" asChild>
            <a href={dashboardUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" /> Open Full Dashboard
            </a>
          </Button>
        )}
      </div>

      <Card data-testid="google-analytics-settings">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Google Analytics 4
          </CardTitle>
          <CardDescription>
            Save one shared GA4 Measurement ID to track Cabinet Dealz and every live affiliate storefront.
            The tag is not loaded on local development or temporary Manus preview hosts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-md space-y-2">
            <Label htmlFor="google-analytics-measurement-id">GA4 Measurement ID</Label>
            <Input
              id="google-analytics-measurement-id"
              value={measurementIdInput}
              onChange={(event) => setMeasurementIdInput(event.target.value.toUpperCase())}
              placeholder="G-XXXXXXXXXX"
              autoComplete="off"
              aria-describedby="google-analytics-measurement-id-help"
              disabled={isSettingsLoading || updateGoogleAnalytics.isPending}
            />
            <p id="google-analytics-measurement-id-help" className="text-xs text-muted-foreground">
              Find this in Google Analytics: Admin → Data streams → your Web stream. Leave it empty and save to disable GA4.
            </p>
            {!isValidInput && (
              <p className="text-xs text-destructive" role="alert">
                Use the GA4 format G-XXXXXXXXXX.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={saveGoogleAnalytics}
              disabled={!isDirty || !isValidInput || isSettingsLoading || updateGoogleAnalytics.isPending}
            >
              {updateGoogleAnalytics.isPending ? "Saving…" : "Save Google Analytics"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMeasurementIdInput("")}
              disabled={!siteSettings?.googleAnalyticsMeasurementId || updateGoogleAnalytics.isPending}
            >
              Clear Measurement ID
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {siteSettings?.googleAnalyticsMeasurementId
              ? `Active shared web stream: ${siteSettings.googleAnalyticsMeasurementId}`
              : "No GA4 Measurement ID is saved; Google Analytics is off."}
          </p>
        </CardContent>
      </Card>

      {ANALYTICS_ENDPOINT && ANALYTICS_WEBSITE_ID ? (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <iframe
              src={`${ANALYTICS_ENDPOINT}/share/${ANALYTICS_WEBSITE_ID}/Cabinet%20Dealz`}
              className="w-full border-0"
              style={{ height: "calc(100vh - 200px)", minHeight: "600px" }}
              title="Site Analytics"
              loading="lazy"
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <BarChart3 className="mx-auto h-16 w-16 mb-4 opacity-40" />
            <p className="text-lg font-medium">Analytics Not Configured</p>
            <p className="text-sm mt-2">
              Set VITE_ANALYTICS_ENDPOINT and VITE_ANALYTICS_WEBSITE_ID environment variables to enable the analytics dashboard.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              <span className="font-medium">Umami Analytics</span> is installed and tracking page views, referrers, devices, and countries automatically.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Privacy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              No cookies, GDPR compliant. Visitor data is anonymized and never shared with third parties.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Data Retention</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Analytics data is retained indefinitely. Historical trends are available for all time periods.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
