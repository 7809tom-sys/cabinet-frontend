/**
 * Feature keys shared with the Approve Vendors / vendor-types work.
 * That PR owns the central map. This file is the local placeholder that
 * already uses the same key name, so the two can merge without a rename.
 */
export const VENDOR_FEATURE_SAMPLES = "samples" as const;

export function isCabinetVendorScope(scope: string | null | undefined): boolean {
  return typeof scope === "string" && /^dist:[1-9]\d{0,9}$/.test(scope);
}

/**
 * When `enabledFeatures` is omitted, cabinet vendors are treated as having
 * the samples key so this portal works before the central map lands.
 * When the map is present, membership of the same key is required.
 * Pelican and any non-cabinet scope never receive samples.
 */
export function vendorFeatureEnabled(
  feature: string,
  input: { scope: string | null | undefined; enabledFeatures?: readonly string[] | null },
): boolean {
  if (feature === VENDOR_FEATURE_SAMPLES && !isCabinetVendorScope(input.scope)) return false;
  if (input.enabledFeatures == null) {
    return feature === VENDOR_FEATURE_SAMPLES && isCabinetVendorScope(input.scope);
  }
  return input.enabledFeatures.includes(feature);
}
