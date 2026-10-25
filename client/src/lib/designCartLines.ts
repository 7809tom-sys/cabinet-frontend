import type { CartItem } from "@/contexts/CartContext";
import { customSizeFee, effectiveStyleId, isFillerItem, isGlassPolicyNomenclature, type PlacedCabinet } from "@/lib/design";
import { isClosetPart } from "@/lib/closet";
import { calculateCartSubtotal } from "@/lib/cartTotals";
import { combinedFillerNote, fillerCutSourceFor, isCombinedSmallFiller } from "@/lib/fillerBilling";

type BuildDesignCabinetCartLinesArgs = {
  placed: PlacedCabinet[];
  styleId: number | null;
  /** Use when a saved plan needs a pricing-only style normalization. */
  pricingStyleIdFor?: (cabinet: PlacedCabinet) => number | null;
  distributorId: number | null;
  tier: CartItem["tier"];
  styleNameById: Map<number, string>;
  unitPriceFor: (cabinet: PlacedCabinet) => number | null;
  glassDoorAddonFor?: (cabinet: PlacedCabinet, resolvedStyleId: number) => {
    masterCode: string;
    name: string;
    unitPrice: number | null;
    catalogImageUrl?: string | null;
  } | null;
  /** Optional resolver returning the active line's equivalent code for a cabinet (two-way alias). */
  lineCodeFor?: (cabinet: PlacedCabinet) => string | null;
};

export type DesignPreviewPricingLine = CartItem & {
  /** Exact saved-plan cabinet UIDs represented by this 3D preview line. */
  placementUids?: string[];
};

/**
 * Apply only design-authored adjustments to an already-resolved authoritative
 * tier price. This never reads or changes a catalog amount. Keeping the helper
 * shared prevents the 3D estimate and locked cart handoff from disagreeing.
 */
export function adjustedDesignUnitPrice(
  cabinet: PlacedCabinet,
  basePrice: number | null,
): number | null {
  if (basePrice == null) return null;
  return basePrice * (1 + (cabinet.discountPct ?? 0) / 100) + customSizeFee(cabinet);
}

function glassPolicyCartSuffix(cabinet: Pick<PlacedCabinet, "masterCode" | "glassDoor" | "glassIncluded">): string {
  const isGlassItem = cabinet.glassDoor === true || isGlassPolicyNomenclature(cabinet.masterCode);
  return isGlassItem && cabinet.glassIncluded !== true ? " — glass purchased separately" : "";
}

function fillerCartDimensions(cabinet: PlacedCabinet): Pick<CartItem, "fillerStockWidthIn" | "fillerInstalledCutWidthIn"> {
  if (!isFillerItem(cabinet)) return {};
  const stock = Number(cabinet.nominalWidth ?? cabinet.width);
  const installed = Number(cabinet.fillerTotalWidth ?? cabinet.width);
  if (!Number.isFinite(stock) || stock <= 0 || !Number.isFinite(installed) || installed <= 0) return {};
  return { fillerStockWidthIn: stock, fillerInstalledCutWidthIn: installed };
}

function fillerCartIdentity(cabinet: PlacedCabinet): string {
  const dimensions = fillerCartDimensions(cabinet);
  return dimensions.fillerStockWidthIn != null && dimensions.fillerInstalledCutWidthIn != null
    ? `${dimensions.fillerStockWidthIn}:${dimensions.fillerInstalledCutWidthIn}`
    : "";
}

/** Preserve an imported SCR SKU while naming the installed physical role clearly. */
export function installedFillerCartName(cabinet: Pick<PlacedCabinet, "masterCode" | "description" | "category" | "subCategory" | "width">): string {
  const description = cabinet.description?.trim() || cabinet.masterCode;
  if (!isFillerItem(cabinet) || !/\bscribe\b/i.test(description)) return description;
  const cut = description.match(/(?:[AB]\s+front\s+)?filler\s+cut\s+to\s+.+$/i)?.[0]
    ?? description.match(/cut\s+to\s+.+$/i)?.[0];
  return cut ? `Filler — ${cut}` : "Filler";
}

/**
 * Turns every sellable cabinet placed in a regular design into its exact Cart
 * line. A current verified price is locked when available. If a catalog refresh
 * is temporarily missing a price, retain an explicit pending-price line instead
 * of silently removing a physical cabinet from the design's Cart composition.
 */
export function buildDesignCabinetCartLines({
  placed,
  styleId,
  pricingStyleIdFor,
  distributorId,
  tier,
  styleNameById,
  unitPriceFor,
  glassDoorAddonFor,
  lineCodeFor,
}: BuildDesignCabinetCartLinesArgs): CartItem[] {
  if (!styleId) return [];
  const lines = new Map<string, CartItem>();
  for (const cabinet of placed) {
    // Launch appliances are visual-only design context. They remain in the 2D
    // plan and 3D selling view but are intentionally excluded from all cabinet
    // cart/quote/invoice/checkout commerce until appliance sales are enabled.
    const firstClassCooktop = cabinet.placement === "appliance" && cabinet.applianceRole === "countertop-opening" && Boolean(cabinet.applianceCatalogCode);
    if (
      (cabinet.placement === "appliance" && !firstClassCooktop) ||
      isClosetPart(cabinet.masterCode) ||
      cabinet.cabinetId == null ||
      cabinet.fillerBillingRole === "secondary" ||
      isCombinedSmallFiller(cabinet, placed)
    ) continue;
    const resolvedUnitPrice = adjustedDesignUnitPrice(cabinet, firstClassCooktop ? (cabinet.applianceCatalogPrice ?? null) : unitPriceFor(cabinet));
    const unitPrice = resolvedUnitPrice != null && Number.isFinite(resolvedUnitPrice) && resolvedUnitPrice > 0
      ? resolvedUnitPrice
      : null;
    const resolvedStyleId = pricingStyleIdFor?.(cabinet) ?? effectiveStyleId(cabinet, styleId) ?? styleId;
    // A linked glassDoorAddonCode is a separately priced replacement door. Keep
    // the cabinet itself on its canonical SKU; only full-cabinet GD swaps use an
    // appended-code identity.
    // Part 2: the active line may sell this cabinet under an equivalent code
    // (ERB36 placed on a BER line is sold as BER36). The cart carries the
    // code the line actually prices so the order matches the distributor.
    const baseCode = firstClassCooktop ? cabinet.applianceCatalogCode! : (lineCodeFor?.(cabinet) ?? cabinet.masterCode);
    const masterCode = cabinet.glassDoor && !cabinet.glassDoorAddonCode
      ? `${baseCode}GD`
      : baseCode;
    // Different discounts or custom-size fees must remain separate locked
    // lines; combining them would assign one cabinet's adjusted price to both.
    const key = `${masterCode}::${resolvedStyleId}::${unitPrice == null ? "pending" : unitPrice.toFixed(4)}::${fillerCartIdentity(cabinet)}`;
    const cutNotes = placed
      .filter((candidate) => fillerCutSourceFor(candidate, placed)?.uid === cabinet.uid)
      .map((candidate) => combinedFillerNote(candidate, placed))
      .filter((note): note is string => Boolean(note));
    const cutNote = cutNotes.join("; ");
    const existing = lines.get(key);
    if (existing) {
      existing.qty += 1;
      if (cutNote) existing.qtyNote = [existing.qtyNote, cutNote].filter(Boolean).join("; ");
    } else {
      lines.set(key, {
        masterCode,
        name: `${firstClassCooktop ? (cabinet.applianceCatalogName ?? cabinet.description) : installedFillerCartName(cabinet)}${glassPolicyCartSuffix(cabinet)}`,
        styleId: resolvedStyleId,
        styleLabel: styleNameById.get(resolvedStyleId) ?? "",
        distributorId,
        tier,
        unitPrice,
        // A price can only be locked when the Designer actually received a
        // numeric source-backed value. A pending line remains visible in Cart
        // and may refresh there, but it can never become a zero-dollar order.
        ...(unitPrice != null ? { priceLocked: true } : {}),
        qty: 1,
        ...(cutNote ? { qtyNote: cutNote } : {}),
        catalogImageUrl: cabinet.catalogImageUrl ?? null,
        ...fillerCartDimensions(cabinet),
      });
    }

    if (cabinet.glassDoor && cabinet.glassDoorAddonCode) {
      const addon = glassDoorAddonFor?.(cabinet, resolvedStyleId) ?? null;
      if (addon?.unitPrice != null) {
        const addonKey = `${addon.masterCode}::${resolvedStyleId}::${addon.unitPrice.toFixed(4)}`;
        const existingAddon = lines.get(addonKey);
        if (existingAddon) existingAddon.qty += 1;
        else lines.set(addonKey, {
          masterCode: addon.masterCode,
          name: `${addon.name}${cabinet.glassIncluded === true ? "" : " — glass purchased separately"}`,
          styleId: resolvedStyleId,
          styleLabel: styleNameById.get(resolvedStyleId) ?? "",
          distributorId,
          tier,
          unitPrice: addon.unitPrice,
          priceLocked: true,
          qty: 1,
          catalogImageUrl: addon.catalogImageUrl ?? null,
        });
      }
    }
  }
  return Array.from(lines.values());
}

/**
 * Redistributes a verified package total across its already-price-locked design
 * lines. This is used only for a bundle loaded with a persisted package price;
 * it never updates catalog data. Keeping the total on actual cabinet lines lets
 * the established cart-to-checkout price lock preserve it end to end.
 */
export function lockDesignCartLinesToPackageTotal<T extends CartItem>(lines: T[], packageTotal: number): T[] {
  if (!Number.isFinite(packageTotal) || packageTotal < 0) return lines;
  const eligible = lines.filter((line) => line.unitPrice != null && line.qty > 0);
  const currentTotal = calculateCartSubtotal(eligible);
  if (eligible.length === 0 || currentTotal <= 0) return lines;

  const targetCents = Math.round(packageTotal * 100);
  let remainingCents = targetCents;
  const locked = new Map<T, T>();

  for (let index = 0; index < eligible.length; index += 1) {
    const line = eligible[index];
    const lineCurrentTotal = (line.unitPrice ?? 0) * line.qty;
    const lineCents = index === eligible.length - 1
      ? remainingCents
      : Math.round(targetCents * (lineCurrentTotal / currentTotal));
    // Unit prices may carry fractional cents for a multi-quantity line so the
    // persisted line totals add to the exact verified package total.
    locked.set(line, {
      ...line,
      unitPrice: lineCents / (line.qty * 100),
      priceLocked: true,
    } as T);
    remainingCents -= lineCents;
  }

  return lines.map((line) => locked.get(line) ?? line);
}

/** A bundle price remains valid only while its priced cabinet composition matches the saved snapshot. */
export function bundleCabinetPricingSignature(placed: PlacedCabinet[], styleId: number | null): string {
  return placed
    .filter((cabinet) => cabinet.placement !== "appliance" && !isClosetPart(cabinet.masterCode) && cabinet.cabinetId != null && cabinet.fillerBillingRole !== "secondary")
    .map((cabinet) => [
      cabinet.uid,
      cabinet.masterCode,
      effectiveStyleId(cabinet, styleId) ?? styleId ?? 0,
      cabinet.glassDoor ? "glass" : "standard",
      cabinet.discountPct ?? 0,
      cabinet.width,
      cabinet.height,
      cabinet.depth,
    ].join(":"))
    .sort()
    .join("|");
}

/**
 * Pricing rows for the interactive 3D quote. These intentionally mirror every
 * placed cabinet in the saved 2D plan: priced cabinets contribute to the
 * subtotal, while unpriced cabinets remain visible as unavailable lines.
 * Trim, surfaces, fixtures, and launch-stage visual appliances remain outside
 * this cabinet-design subtotal.
 */
export function buildDesignPreviewPricingLines({
  placed,
  styleId,
  pricingStyleIdFor,
  distributorId,
  tier,
  styleNameById,
  unitPriceFor,
  glassDoorAddonFor,
}: BuildDesignCabinetCartLinesArgs): DesignPreviewPricingLine[] {
  if (!styleId) return [];
  const lines = new Map<string, DesignPreviewPricingLine>();
  for (const cabinet of placed) {
    const firstClassCooktop = cabinet.placement === "appliance" && cabinet.applianceRole === "countertop-opening" && Boolean(cabinet.applianceCatalogCode);
    if (
      (cabinet.placement === "appliance" && !firstClassCooktop) ||
      isClosetPart(cabinet.masterCode) ||
      (cabinet.cabinetId == null && !firstClassCooktop) ||
      cabinet.fillerBillingRole === "secondary" ||
      isCombinedSmallFiller(cabinet, placed)
    ) continue;
    const basePrice = firstClassCooktop ? (cabinet.applianceCatalogPrice ?? null) : unitPriceFor(cabinet);
    // A missing catalog price must never erase a cabinet from the 3D order
    // overlay. Retain it as an explicit unavailable line; do not infer or invent a
    // replacement amount from another distributor, tier, or style.
    const adjustedUnitPrice = adjustedDesignUnitPrice(cabinet, basePrice);
    const resolvedStyleId = pricingStyleIdFor?.(cabinet) ?? effectiveStyleId(cabinet, styleId) ?? styleId;
    const masterCode = firstClassCooktop ? cabinet.applianceCatalogCode! : cabinet.glassDoor && !cabinet.glassDoorAddonCode
      ? `${cabinet.masterCode}GD`
      : cabinet.masterCode;
    // Different discounts or custom fees must remain distinct priced lines.
    const key = `${masterCode}::${resolvedStyleId}::${adjustedUnitPrice == null ? "pending" : adjustedUnitPrice.toFixed(4)}::${fillerCartIdentity(cabinet)}`;
    const cutNotes = placed
      .filter((candidate) => fillerCutSourceFor(candidate, placed)?.uid === cabinet.uid)
      .map((candidate) => combinedFillerNote(candidate, placed))
      .filter((note): note is string => Boolean(note));
    const cutNote = cutNotes.join("; ");
    const existing = lines.get(key);
    if (existing) {
      existing.qty += 1;
      existing.placementUids = [...(existing.placementUids ?? []), cabinet.uid];
      if (cutNote) existing.qtyNote = [existing.qtyNote, cutNote].filter(Boolean).join("; ");
    } else {
      lines.set(key, {
        masterCode,
        name: `${firstClassCooktop ? (cabinet.applianceCatalogName ?? cabinet.description) : installedFillerCartName(cabinet)}${glassPolicyCartSuffix(cabinet)}`,
        styleId: resolvedStyleId,
        styleLabel: styleNameById.get(resolvedStyleId) ?? "",
        distributorId,
        tier,
        unitPrice: adjustedUnitPrice,
        qty: 1,
        ...(cutNote ? { qtyNote: cutNote } : {}),
        catalogImageUrl: cabinet.catalogImageUrl ?? null,
        ...fillerCartDimensions(cabinet),
        placementUids: [cabinet.uid],
      });
    }

    if (cabinet.glassDoor && cabinet.glassDoorAddonCode) {
      const addon = glassDoorAddonFor?.(cabinet, resolvedStyleId) ?? {
        masterCode: cabinet.glassDoorAddonCode,
        name: `Glass Door (${cabinet.glassDoorAddonCode})`,
        unitPrice: null,
        catalogImageUrl: null,
      };
      const addonKey = `${addon.masterCode}::${resolvedStyleId}::${addon.unitPrice == null ? "pending" : addon.unitPrice.toFixed(4)}`;
      const existingAddon = lines.get(addonKey);
      if (existingAddon) {
        existingAddon.qty += 1;
        existingAddon.placementUids = [...(existingAddon.placementUids ?? []), cabinet.uid];
      } else {
        lines.set(addonKey, {
          masterCode: addon.masterCode,
          name: `${addon.name}${cabinet.glassIncluded === true ? "" : " — glass purchased separately"}`,
          styleId: resolvedStyleId,
          styleLabel: styleNameById.get(resolvedStyleId) ?? "",
          distributorId,
          tier,
          unitPrice: addon.unitPrice,
          qty: 1,
          catalogImageUrl: addon.catalogImageUrl ?? null,
          placementUids: [cabinet.uid],
        });
      }
    }
  }
  return Array.from(lines.values());
}

/**
 * Build the exact 3D order drawer from the price-locked lines that are sent to
 * cart/checkout, while preserving unavailable placed cabinets and their selection
 * UIDs. Priced cabinet preview lines contribute identity only; their amount is
 * always taken from the cart handoff so every visible total has one basis.
 */
export function completeDesignPricingLines(
  cartableLines: readonly CartItem[],
  cabinetPreviewLines: readonly DesignPreviewPricingLine[],
): DesignPreviewPricingLine[] {
  const matchedCabinetLines = new Set<number>();
  const pricedLines = cartableLines.map((line) => {
    const matchIndex = cabinetPreviewLines.findIndex((candidate, index) =>
      !matchedCabinetLines.has(index) &&
      candidate.masterCode === line.masterCode &&
      candidate.styleId === line.styleId &&
      (
        (candidate.unitPrice == null && line.unitPrice == null)
        || (candidate.unitPrice != null && line.unitPrice != null
          && Math.abs(Number(candidate.unitPrice) - Number(line.unitPrice)) < 0.0001)
      ) &&
      candidate.qty === line.qty &&
      candidate.fillerStockWidthIn === line.fillerStockWidthIn &&
      candidate.fillerInstalledCutWidthIn === line.fillerInstalledCutWidthIn
    );
    if (matchIndex >= 0) matchedCabinetLines.add(matchIndex);
    const match = matchIndex >= 0 ? cabinetPreviewLines[matchIndex] : null;
    return { ...line, placementUids: match?.placementUids };
  });
  const pendingCabinets = cabinetPreviewLines.filter((line, index) => (
    line.unitPrice == null && !matchedCabinetLines.has(index)
  ));
  return [...pricedLines, ...pendingCabinets];
}

/**
 * Merge commerce lines only when their product, style, distributor, tier, and
 * already-locked unit price are identical. A discounted or custom-sized cabinet
 * must never be collapsed onto the regular unit price of the same master code.
 */
export function mergeDesignCartLines(lines: readonly CartItem[]): CartItem[] {
  const merged = new Map<string, CartItem>();
  for (const line of lines) {
    const key = [
      line.masterCode,
      line.styleId,
      line.distributorId ?? "none",
      line.tier,
      line.unitPrice ?? "pending",
      line.productKind ?? "cabinet",
      line.vendorProductId ?? "",
      line.fillerStockWidthIn ?? "",
      line.fillerInstalledCutWidthIn ?? "",
    ].join("::");
    const existing = merged.get(key);
    if (existing) existing.qty += line.qty;
    else merged.set(key, { ...line });
  }
  return Array.from(merged.values());
}

export { calculateCartSubtotal };
