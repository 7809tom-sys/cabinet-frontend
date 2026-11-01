/**
 * Featured Door Style shipping origins.
 *
 * `doorStyles.listForAdmin` and `distributorPortal.featuredStyles` (cabinet-backend #66)
 * add distributorWarehouseZips, effectiveWarehouseZips, and warehouseZipsInherited.
 * When warehouseZipsInherited is true, the editor shows effectiveWarehouseZips as
 * read-only "Inherited from vendor" badges. Missing fields are computed from
 * distributorWarehouseZips, and a missing distributor list is [].
 * A save sends warehouseZips as [] or null unless the user set origins on the style.
 * Vendor coverage is never written back onto the style.
 */

export type StyleOwnedOriginSource = {
  warehouseZips?: readonly (string | null | undefined)[] | null;
  /** Legacy primary. A style with only this set still has its own origin. */
  warehouseZip?: string | null;
  /**
   * True when the style stores no origins. `warehouseZips` / `warehouseZip`
   * on that row must not be saved back as an override.
   */
  warehouseZipsInherited?: boolean | null;
};

export type DistributorWarehouseZipSource = {
  /** Vendor cabinet coverage. Missing until cabinet-backend #66; treat as []. */
  distributorWarehouseZips?: readonly (string | null | undefined)[] | null;
};

/** Fields added on doorStyles.listForAdmin and distributorPortal.featuredStyles. */
export type FeaturedStyleWarehouseFields = StyleOwnedOriginSource & DistributorWarehouseZipSource & {
  /** Own origins when the style has any; otherwise distributorWarehouseZips. */
  effectiveWarehouseZips?: readonly (string | null | undefined)[] | null;
};

export function normalizeShippingOriginZips(
  values: readonly (string | null | undefined)[] | null | undefined,
): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const zips: string[] = [];
  for (const value of values) {
    const zip = String(value ?? "").replace(/\D/g, "").slice(0, 5);
    if (!/^\d{5}$/.test(zip) || seen.has(zip)) continue;
    seen.add(zip);
    zips.push(zip);
  }
  return zips;
}

/** Vendor cabinet warehouse coverage attached to a featured-style response. */
export function distributorWarehouseZipsFromStyle(
  style: DistributorWarehouseZipSource | null | undefined,
): string[] {
  return normalizeShippingOriginZips(style?.distributorWarehouseZips);
}

/**
 * ZIPs stored on the style itself. Inherited vendor coverage is never included.
 * `warehouseZipsInherited: true` forces an empty own list so an echoed
 * effective list cannot be saved back as an override.
 */
export function ownShippingOriginZips(style: StyleOwnedOriginSource | null | undefined): string[] {
  if (!style || style.warehouseZipsInherited === true) return [];
  return normalizeShippingOriginZips([...(style.warehouseZips ?? []), style.warehouseZip ?? ""]);
}

export function inheritsVendorShippingOrigins(ownZips: readonly string[] | null | undefined): boolean {
  return normalizeShippingOriginZips(ownZips).length === 0;
}

/**
 * Read-time coverage for a featured style row.
 * Missing `effectiveWarehouseZips` is computed from `distributorWarehouseZips`,
 * and a missing distributor list is []. `warehouseZip` counts as an own origin
 * when `warehouseZipsInherited` is not true, so a legacy-only style is not inherited.
 */
export function inheritedVendorZipsForEditor(
  style: FeaturedStyleWarehouseFields | null | undefined,
  ownDraft: readonly (string | null | undefined)[] | null | undefined,
  fallbackVendorZips?: readonly (string | null | undefined)[] | null,
): string[] {
  if (normalizeShippingOriginZips(ownDraft).length > 0) return [];
  const distributorWarehouseZips = normalizeShippingOriginZips(
    style?.distributorWarehouseZips ?? fallbackVendorZips,
  );
  const storedOwn = normalizeShippingOriginZips([
    ...(style?.warehouseZips ?? []),
    style?.warehouseZip ?? "",
  ]);
  const warehouseZipsInherited = typeof style?.warehouseZipsInherited === "boolean"
    ? style.warehouseZipsInherited
    : storedOwn.length === 0;
  if (!warehouseZipsInherited) return distributorWarehouseZips;
  if (style?.effectiveWarehouseZips != null) return normalizeShippingOriginZips(style.effectiveWarehouseZips);
  return distributorWarehouseZips;
}

/** Visible label for read-only inherited badges, e.g. "Inherited from vendor: 32256, 30301". */
export function inheritedVendorZipSummary(
  vendorZips: readonly (string | null | undefined)[] | null | undefined,
): string | null {
  const zips = normalizeShippingOriginZips(vendorZips);
  if (zips.length === 0) return null;
  return `Inherited from vendor: ${zips.join(", ")}`;
}

/**
 * Style-save payload. Pass only the style-owned list.
 * Empty stays `null` (featured editors) and never substitutes vendor ZIPs.
 */
export function shippingOriginZipsForSave(
  ownZips: readonly (string | null | undefined)[] | null | undefined,
): string[] | null {
  const normalized = normalizeShippingOriginZips(ownZips);
  return normalized.length > 0 ? normalized : null;
}

/** Same rule for editors that clear an override by saving an empty list. */
export function shippingOriginZipsForSaveList(
  ownZips: readonly (string | null | undefined)[] | null | undefined,
): string[] {
  return shippingOriginZipsForSave(ownZips) ?? [];
}

export function addShippingOriginZip(
  ownZips: readonly string[],
  raw: string,
): { zips: string[]; status: "added" | "invalid" | "duplicate" } {
  const normalized = String(raw ?? "").replace(/\D/g, "").slice(0, 5);
  const current = normalizeShippingOriginZips(ownZips);
  if (!/^\d{5}$/.test(normalized)) return { zips: current, status: "invalid" };
  if (current.includes(normalized)) return { zips: current, status: "duplicate" };
  return { zips: [...current, normalized], status: "added" };
}

/**
 * Shipping-page rows. `originMode: "line"` inherits even when `originZips`
 * repeats the vendor coverage. A style-mode row keeps its own list.
 */
export function shippingRowInheritsVendorZips(style: {
  originMode?: "style" | "line" | string | null;
  originZips?: readonly string[] | null;
  warehouseZipsInherited?: boolean | null;
}): boolean {
  if (style.warehouseZipsInherited === true || style.originMode === "line") return true;
  if (style.originMode === "style") return false;
  return (style.originZips?.length ?? 0) === 0;
}

/** Editable origins for the shipping-page style editor. Line mode stays empty. */
export function editableStyleOriginZips(style: {
  originMode?: "style" | "line" | string | null;
  originZips?: readonly (string | null | undefined)[] | null;
  warehouseZipsInherited?: boolean | null;
}): string[] {
  if (style.warehouseZipsInherited === true || style.originMode === "line") return [];
  if (style.originMode === "style") return normalizeShippingOriginZips(style.originZips);
  return normalizeShippingOriginZips(style.originZips);
}
