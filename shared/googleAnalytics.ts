import { z } from "zod";

/** A public GA4 web-stream identifier, normalized before storage or browser use. */
export const GA4_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]{4,32}$/;

export function normalizeGa4MeasurementId(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase() ?? "";
  return GA4_MEASUREMENT_ID_PATTERN.test(normalized) ? normalized : null;
}

/**
 * Accept an explicit empty value as an administrator's request to disable GA4.
 * Measurement IDs are public identifiers, but they must still be normalized and
 * validated before storage so they cannot be used as arbitrary script URLs.
 */
export const googleAnalyticsMeasurementIdSchema = z
  .string()
  .trim()
  .transform((value, context) => {
    if (!value) return null;
    const normalized = normalizeGa4MeasurementId(value);
    if (normalized) return normalized;
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter a GA4 Measurement ID in the format G-XXXXXXXXXX, or leave the field empty to disable tracking.",
    });
    return z.NEVER;
  });

function normalizeHostname(hostname: string | null | undefined): string {
  return (hostname ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/:\d+$/, "")
    .replace(/\/$/, "");
}

/**
 * GA4 is deliberately absent from local development and temporary Manus hosts
 * so test/preview visits never enter the production shared property. Real
 * Cabinet Dealz hosts and real affiliate custom domains are included.
 */
export function shouldTrackGoogleAnalytics(input: {
  measurementId: string | null | undefined;
  hostname: string | null | undefined;
}): boolean {
  if (!normalizeGa4MeasurementId(input.measurementId)) return false;
  const hostname = normalizeHostname(input.hostname);
  if (!hostname || hostname === "localhost" || hostname === "::1" || hostname === "127.0.0.1") {
    return false;
  }
  if (hostname.endsWith(".manus.computer")) return false;
  // This is Cabinet Dealz's configured public deployment hostname. Other
  // Manus-space hosts are temporary previews and must not pollute GA4.
  if (hostname === "cabinetz-dq7pucbp.manus.space") return true;
  if (hostname.endsWith(".manus.space")) return false;
  return true;
}
