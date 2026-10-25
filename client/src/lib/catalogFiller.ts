import type { DesignCabinet } from "@/lib/design";

export type CatalogFillerCandidate = Pick<
  DesignCabinet,
  "id" | "masterCode" | "description" | "category" | "subCategory" | "width" | "height" | "depth" | "catalogImageUrl"
>;

/** Cabinet layer whose adjacent run determines the filler stock ranking. */
export type CatalogFillerPlacement = "base" | "wall" | "tall";

export type CatalogFillerSuggestion = {
  candidate: CatalogFillerCandidate;
  gapWidth: number;
  catalogWidth: number;
  installedWidth: number;
  trimAmount: number;
  description: string;
};

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * A few source catalogs label a filler by its nominal installed family but print
 * a slightly smaller finished stock width. AltaEuro's OF overlay filler is a
 * documented 3-inch family with a 2-7/8-inch physical board. It is valid stock
 * for a sub-3-inch seam; arbitrary 2-7/8-inch trim is not.
 */
function isNominalThreeInchFillerStock(candidate: CatalogFillerCandidate): boolean {
  const width = numberValue(candidate.width);
  if (Math.abs(width - 3) <= 0.001) return true;
  const text = `${candidate.masterCode} ${candidate.description ?? ""}`.toLowerCase();
  return Math.abs(width - 2.875) <= 0.001
    && /^of\d+$/i.test(String(candidate.masterCode ?? ""))
    && /3[\s"-]*(?:inch\s*)?filler\s*overlay/.test(text);
}

/** Panels are finish/cover components—not cuttable cabinet-run fillers. */
export function isCatalogPanel(candidate: Pick<CatalogFillerCandidate, "masterCode" | "description" | "category" | "subCategory">): boolean {
  const code = String(candidate.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const text = `${candidate.masterCode} ${candidate.description ?? ""} ${candidate.category ?? ""} ${candidate.subCategory ?? ""}`.toLowerCase();
  // Source nomenclature is authoritative. REPV is a refrigerator end-panel
  // family; the other explicit families cover base, wall, tall, and decorative
  // end panels even if an imported accessory category was misclassified.
  if (/^(?:REP|REPV|BEP|WEP|TEP|DEP|IEP|PANEL)/.test(code)) return true;
  return /\b(?:panel|skin|veneer)\b/.test(text);
}

/**
 * Decorative legs are optional furniture accents, not cuttable run fillers.
 * Source descriptions are authoritative here because legacy imports have
 * occasionally put FLDL/CLDL/SCDL/SQDL into the generic Filler category. Reject the
 * known leg nomenclature and a source description that explicitly says
 * "decorative leg" before considering the imported category.
 */
export function isCatalogDecorativeLeg(candidate: Pick<CatalogFillerCandidate, "masterCode" | "description" | "category" | "subCategory">): boolean {
  const code = String(candidate.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const text = `${candidate.masterCode} ${candidate.description ?? ""} ${candidate.category ?? ""} ${candidate.subCategory ?? ""}`.toLowerCase();
  return /^(?:FLDL|CLDL|SCDL|SQDL)$/.test(code) || /\bdecorative\s+leg\b/.test(text);
}

export function isCatalogFiller(candidate: Pick<CatalogFillerCandidate, "masterCode" | "description" | "category" | "subCategory">): boolean {
  if (isCatalogPanel(candidate) || isCatalogDecorativeLeg(candidate)) return false;
  const text = `${candidate.masterCode} ${candidate.description ?? ""} ${candidate.category ?? ""} ${candidate.subCategory ?? ""}`.toLowerCase();
  // Only CabinetDealz filler stock may be field-cut. Dishwasher panels and
  // toe-kick/utility trim are not filler boards and must never be substituted
  // into a measured cabinet seam, even when an import classified them as
  // "Filler".
  if (/dishwasher|dishwasher[-\s]*(?:end\s*)?panel|toe[-\s]*kick|kick[-\s]*board/.test(text)) return false;
  return /\bfiller\b|\bscribe\b|^wf|^bf|^ff/.test(text);
}

/**
 * Picks the source-priced stock filler used to cover a measured gap. Physical
 * installation always keeps the exact `gapWidth`, but every cut of 3 inches or
 * less consumes one 3-inch catalog filler in the cart, estimate, invoice, and
 * materials list. Never create a generic short-filler SKU or infer its price.
 * Placement ranking favors a 24-in deep base/tall filler or a 12-in deep wall
 * filler, then the closest cuttable height.
 */
export function catalogFillerForGap(
  candidates: readonly CatalogFillerCandidate[],
  gapWidth: number,
  placement: CatalogFillerPlacement,
): CatalogFillerCandidate | null {
  if (!Number.isFinite(gapWidth) || gapWidth <= 0) return null;
  const desiredDepth = placement === "wall" ? 12 : 24;
  const desiredHeight = placement === "wall" ? 30 : placement === "tall" ? 96 : 34.5;
  const requiresThreeInchStock = gapWidth <= 3 + 0.001;

  return candidates
    .filter(isCatalogFiller)
    // AltaEuro's documented 2-7/8-inch "3-inch" overlay is nominal 3-inch stock, so it
    // also satisfies an exact 3-inch seam such as a blind-corner filler.
    .filter((candidate) => numberValue(candidate.width) + 0.001 >= gapWidth
      || (requiresThreeInchStock && isNominalThreeInchFillerStock(candidate)))
    // A 5/8-inch, 1-1/2-inch, or 3-inch installed seam is cut from and billed
    // as one real 3-inch stock filler. Do not silently substitute a smaller
    // accessory code or a wider filler when the line has no orderable 3-inch SKU.
    .filter((candidate) => !requiresThreeInchStock || isNominalThreeInchFillerStock(candidate))
    .sort((left, right) => {
      const widthDelta = numberValue(left.width) - numberValue(right.width);
      if (Math.abs(widthDelta) > 0.001) return widthDelta;
      const leftDepth = Math.abs(numberValue(left.depth, desiredDepth) - desiredDepth);
      const rightDepth = Math.abs(numberValue(right.depth, desiredDepth) - desiredDepth);
      if (Math.abs(leftDepth - rightDepth) > 0.001) return leftDepth - rightDepth;
      const leftHeight = Math.abs(numberValue(left.height, desiredHeight) - desiredHeight);
      const rightHeight = Math.abs(numberValue(right.height, desiredHeight) - desiredHeight);
      if (Math.abs(leftHeight - rightHeight) > 0.001) return leftHeight - rightHeight;
      return left.masterCode.localeCompare(right.masterCode);
    })[0] ?? null;
}

export function fittedCatalogFillerDescription(candidate: Pick<CatalogFillerCandidate, "description" | "masterCode">, gapWidth: number): string {
  const source = candidate.description ?? candidate.masterCode;
  // A few vendor imports call a cuttable stock board a "scribe molding". Its
  // purchase code and price remain authoritative, but once it is fitted beside
  // a cabinet the designer must describe the installed part by its job: filler.
  // That avoids presenting an ordinary cabinet filler as decorative molding.
  const installedName = /\bscribe\b/i.test(source) ? "Filler" : source;
  const rounded = Math.round(gapWidth * 100) / 100;
  return `${installedName} — cut to ${rounded}"`;
}

/**
 * Complete recommendation for a measured nonstandard gap. The approved catalog
 * item remains the billing identity; only its installed width is trimmed to the
 * exact opening. Null means no active filler can cover the measured gap.
 */
export function catalogFillerSuggestion(
  candidates: readonly CatalogFillerCandidate[],
  gapWidth: number,
  placement: CatalogFillerPlacement,
): CatalogFillerSuggestion | null {
  const candidate = catalogFillerForGap(candidates, gapWidth, placement);
  if (!candidate) return null;
  const catalogWidth = numberValue(candidate.width);
  const installedWidth = Math.round(gapWidth * 1000) / 1000;
  return {
    candidate,
    gapWidth: installedWidth,
    catalogWidth,
    installedWidth,
    trimAmount: Math.max(0, Math.round((catalogWidth - installedWidth) * 1000) / 1000),
    description: fittedCatalogFillerDescription(candidate, installedWidth),
  };
}

/**
 * Legacy saved designs may contain generic FILL-* records with cabinetId=0.
 * Resolve only those filler records to the same active catalog item a new gap
 * placement would use; regular cabinets retain their persisted catalog ID.
 */
export function catalogFillerPricingId(
  cabinet: { masterCode: string; description?: string | null; category?: string | null; subCategory?: string | null; width: number; id?: number | null; cabinetId?: number | null; placement?: string | null },
  candidates: readonly CatalogFillerCandidate[],
): number | null {
  const persistedId = numberValue(cabinet.cabinetId ?? cabinet.id);
  const isFiller = isCatalogFiller({
    masterCode: cabinet.masterCode,
    description: cabinet.description ?? cabinet.masterCode,
    category: cabinet.category ?? null,
    subCategory: cabinet.subCategory ?? null,
  });
  if (!isFiller) return persistedId > 0 ? persistedId : null;
  const placement: CatalogFillerPlacement = cabinet.placement === "wall"
    ? "wall"
    : cabinet.placement === "tall" ? "tall" : "base";
  const installedWidth = numberValue(cabinet.width);
  const requiredStock = catalogFillerForGap(candidates, installedWidth, placement);
  // Rebase prior generic or smaller-stock short fillers as well: a physical
  // cut at or below 3 inches is one 3-inch catalog filler in every commerce
  // surface, even when an old saved design retained a smaller filler ID.
  if (installedWidth <= 3 + 0.001 && requiredStock) return requiredStock.id;
  const activePersisted = candidates.find((candidate) => candidate.id === persistedId);
  if (activePersisted && isCatalogFiller(activePersisted) && numberValue(activePersisted.width) + 0.001 >= installedWidth) {
    return persistedId;
  }
  return requiredStock?.id ?? null;
}
