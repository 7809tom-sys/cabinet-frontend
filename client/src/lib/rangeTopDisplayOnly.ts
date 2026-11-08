/**
 * Owner rule (Tom, CabinetDealz): the eight range tops in the Pelican catalog
 * stay available in the 3D Designer so a kitchen can be drawn and rendered with
 * the right cooking surface, but they are NEVER sold. They must not become a
 * cart, quote, or order line — whether they arrive by manual placement on a
 * sink base, by Auto Design, or through the Surfaces & Fixtures picker.
 *
 * This module is the ONE place that decides "is this a range top, and is it
 * therefore display-only?" — the same shape as the default-faucet rule in
 * lib/autoDesignFaucet.ts / faucetCartQuantities, where a fixture the Designer
 * filled in is drawn but seeded at zero so it can never be billed.
 *
 * Everything downstream reads this file:
 *   - buildDesignCabinetCartLines / buildDesignPreviewPricingLines skip a
 *     range-top placement (lib/designCartLines.ts)
 *   - buildSurfaceCartLines skips a range-top surface pick (lib/surfaceCartLines.ts)
 *   - buildMaterialsListRows and the Designer build sheet skip it, so the
 *     quote-style material list stays free of it too
 *   - the Designer's range-top product cards show a "display only, not sold"
 *     label instead of a price
 *
 * Identity is taken from the catalog, never from a display name:
 *   - the source category `Range Tops` (pelican_products.category)
 *   - the Stone Creek range-top item-code prefix `SC-RT-`
 *   - the eight stable catalog row ids
 *   - the legacy sink-base range-top modes and the synthetic
 *     `CATALOG-APPLIANCE-<type|id>` identity the Designer mints for them
 *
 * The cabinet under the range top (the sink/range base) keeps its own identity
 * and stays billable, and the countertop, its cutout, and the rendering are
 * untouched.
 */

/** Source catalog category for every sold-as-display-only cooking surface. */
export const RANGE_TOP_CATALOG_CATEGORY = "Range Tops";

/** Shared item-code prefix of the eight Stone Creek range tops. */
export const RANGE_TOP_ITEM_CODE_PREFIX = "SC-RT-";

/**
 * Stable catalog row ids of the eight range tops. The category and item-code
 * prefix above already identify them; these ids are the third, most literal
 * check so a renamed row cannot slip through.
 *
 *   id     code                name                          sub-category
 *   30001  SC-RT-GAS-30        Gas Range Top 30"             Gas
 *   30002  SC-RT-GAS-36        Gas Range Top 36"             Gas
 *   30003  SC-RT-ELEC-30       Electric Range Top 30"        Electric
 *   30004  SC-RT-ELEC-36       Electric Range Top 36"        Electric
 *   30005  SC-RT-SMOOTH-30     Smooth Top (Ceramic) 30"      Smooth Top
 *   30006  SC-RT-SMOOTH-36     Smooth Top (Ceramic) 36"      Smooth Top
 *   30007  SC-RT-INDUCTION-30  Induction Range Top 30"       Smooth Top
 *   30008  SC-RT-INDUCTION-36  Induction Range Top 36"       Smooth Top
 */
export const RANGE_TOP_PRODUCT_IDS: readonly number[] = Object.freeze([
  30001, 30002, 30003, 30004, 30005, 30006, 30007, 30008,
]);

/** The only price text the Designer may show for a range top. */
export const RANGE_TOP_DISPLAY_ONLY_PRICE_LABEL = "display only, not sold";

/** Sink-base range-top modes. `sink` is a real fixture and stays billable. */
export const RANGE_TOP_SINK_BASE_MODES = [
  "gas",
  "electric",
  "induction",
  "smooth-top",
] as const;

/** The Designer's synthetic appliance identity for a range top with no catalog row. */
const SYNTHETIC_APPLIANCE_CODE = /^CATALOG-APPLIANCE-(.+)$/i;

function text(value: string | null | undefined): string {
  return (value ?? "").trim();
}

/** True for the source catalog category `Range Tops`, case and padding aside. */
export function isRangeTopCatalogCategory(
  category: string | null | undefined,
): boolean {
  return (
    text(category).toLowerCase() === RANGE_TOP_CATALOG_CATEGORY.toLowerCase()
  );
}

/** True for an item code issued to a range top (`SC-RT-…`). */
export function isRangeTopItemCode(code: string | null | undefined): boolean {
  return text(code)
    .toUpperCase()
    .startsWith(RANGE_TOP_ITEM_CODE_PREFIX.toUpperCase());
}

/** True for one of the eight stable range-top catalog row ids. */
export function isRangeTopProductId(id: number | null | undefined): boolean {
  return typeof id === "number" && RANGE_TOP_PRODUCT_IDS.includes(id);
}

/**
 * A synthetic `CATALOG-APPLIANCE-…` code is minted by the range-top flow only:
 * the layout-visual types (gas/electric/induction/smooth-top) and the catalog
 * row id (`CATALOG-APPLIANCE-30001` … `-30008`). No other Designer path writes
 * that prefix.
 */
function isSyntheticRangeTopApplianceCode(
  code: string | null | undefined,
): boolean {
  const match = SYNTHETIC_APPLIANCE_CODE.exec(text(code));
  if (!match) return false;
  const suffix = match[1]!.trim().toLowerCase();
  if ((RANGE_TOP_SINK_BASE_MODES as readonly string[]).includes(suffix))
    return true;
  const productId = Number(suffix);
  return Number.isFinite(productId) && isRangeTopProductId(productId);
}

/**
 * A placed appliance (or legacy sink-base record) whose cooking surface is one
 * of the eight range tops. Display-only: it is drawn, never billed.
 */
export function isRangeTopPlacement(
  placement:
    | {
        placement?: string | null;
        applianceRole?:
          | "base-height"
          | "countertop-opening"
          | "freestanding"
          | null;
        applianceCatalogCode?: string | null;
        applianceProductId?: number | null;
        sinkTopType?:
          | "sink"
          | "gas"
          | "electric"
          | "induction"
          | "smooth-top"
          | null;
        category?: string | null;
        subCategory?: string | null;
        masterCode?: string | null;
        description?: string | null;
      }
    | null
    | undefined,
): boolean {
  if (!placement) return false;
  if (isRangeTopCatalogCategory(placement.category)) return true;
  if (
    isRangeTopItemCode(placement.applianceCatalogCode) ||
    isRangeTopItemCode(placement.masterCode)
  )
    return true;
  if (isRangeTopProductId(placement.applianceProductId)) return true;
  if (isSyntheticRangeTopApplianceCode(placement.applianceCatalogCode))
    return true;
  // `applianceRole: "countertop-opening"` also covers the over-range microwave,
  // which is a different product, so only the range-top modes convert it here.
  const mode = placement.sinkTopType ?? null;
  if (!mode || !(RANGE_TOP_SINK_BASE_MODES as readonly string[]).includes(mode))
    return false;
  // A legacy sink base still carrying a range-top mode has not been converted to
  // a first-class appliance yet. Only the appliance record is display-only; the
  // base box is a separate placement with its own master code and category, so
  // its billable cabinet line survives.
  return placement.placement === "appliance";
}

/**
 * True when a placed item may appear on a cart, quote, or order line.
 *
 * The cabinet (and any other real cabinet part) under the range top answers
 * true; only the display-only range top itself answers false.
 */
export function isSoldDesignPlacement(
  placement: Parameters<typeof isRangeTopPlacement>[0],
): boolean {
  return !isRangeTopPlacement(placement);
}

/** A Surfaces & Fixtures pick that is one of the eight display-only range tops. */
export function isRangeTopSurfacePick(
  pick:
    | {
        category?: string | null;
        pelicanCode?: string | null;
        id?: number | null;
      }
    | null
    | undefined,
): boolean {
  if (!pick) return false;
  if (isRangeTopCatalogCategory(pick.category)) return true;
  if (isRangeTopItemCode(pick.pelicanCode)) return true;
  return isRangeTopProductId(pick.id ?? null);
}

/**
 * The label to show wherever a range top's price would otherwise appear.
 * Returns null for every other product so callers can keep their own price.
 */
export function rangeTopPriceLabel(
  product:
    | {
        category?: string | null;
        pelicanCode?: string | null;
        id?: number | null;
      }
    | null
    | undefined,
): string | null {
  return isRangeTopSurfacePick(product)
    ? RANGE_TOP_DISPLAY_ONLY_PRICE_LABEL
    : null;
}

/** A `PEL-<catalog id>` cart code, the identity every Pelican surface line uses. */
function pelicanSurfaceCodeId(code: string | null | undefined): number | null {
  const match = /^PEL-(\d+)$/.exec(text(code));
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) ? id : null;
}

/**
 * A cart line that represents a display-only range top.
 *
 * This is the cart's own last guard: the Designer builders already omit these
 * lines, so this catches a stale persisted cart row or a direct hand-off. A
 * range-top cart line always carries the `PEL-<id>` surface code (with the
 * negative style id that keeps Pelican rows unique) and the source product id.
 */
export function isRangeTopCartLine(
  line:
    | {
        masterCode?: string | null;
        category?: string | null;
        pelicanProductId?: number | null;
        styleId?: number | null;
      }
    | null
    | undefined,
): boolean {
  if (!line) return false;
  if (isRangeTopProductId(line.pelicanProductId ?? null)) return true;
  if (isRangeTopCatalogCategory(line.category)) return true;
  if (isRangeTopItemCode(line.masterCode)) return true;
  if (isRangeTopProductId(pelicanSurfaceCodeId(line.masterCode))) return true;
  const styleId = line.styleId ?? null;
  return (
    typeof styleId === "number" && styleId < 0 && isRangeTopProductId(-styleId)
  );
}
