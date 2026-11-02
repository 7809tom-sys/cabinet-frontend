/**
 * Whether a catalog cabinet can be offered in the 3D Designer.
 *
 * The Designer does not load a separate 3D model file per product. It builds a
 * box from width, height, and depth, then draws doors and drawers from the
 * catalog record. `design.placeableCabinets` is the product list. It keeps
 * real cabinet boxes on the Base, Wall, and Tall tabs. Trim, hardware, and
 * other bill-of-materials lines go to Accessories, and only some of those
 * (panels, fillers, floating shelves, appliance garages, knee drawers) can
 * actually be dropped on the plan. This module uses those same rules.
 *
 * A stored `designerEligible` flag is true only when both of these hold:
 * 1. The cabinet has a positive supplier price (list price or your cost) on a
 *    published, available supplier row — the same price the Designer already
 *    requires before it will offer the item.
 * 2. The Designer can render or place the cabinet, per `cabinetCanBeRenderedOrPlacedIn3d`.
 *
 * Everything else stays false. Pelican surfaces (flooring, counters, sinks)
 * are not cabinet rows and are not decided here.
 */

export type DesignerCabinetShape = {
  masterCode?: string | null;
  description?: string | null;
  category?: string | null;
  subCategory?: string | null;
  placementType?: string | null;
  isNotCabinet?: boolean | null;
  width?: string | number | null;
  height?: string | number | null;
  depth?: string | number | null;
};

function text(value: string | null | undefined): string {
  return (value ?? "").toLowerCase();
}

function haystack(cabinet: DesignerCabinetShape): string {
  return `${cabinet.category ?? ""} ${cabinet.subCategory ?? ""} ${cabinet.description ?? ""} ${cabinet.masterCode ?? ""}`.toLowerCase();
}

/** Drop a parenthetical alternate code such as `(O339024)` before family checks. */
export function designerCatalogCode(masterCode: string | null | undefined): string {
  return (masterCode ?? "").replace(/\([^)]*\)/g, "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

function measureOf(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * A tall oven, pantry, or utility box, including a rollout-shelf kit and a
 * master code that keeps an alternate code in parentheses.
 */
export function isDesignerUtilityOrOvenBox(cabinet: DesignerCabinetShape): boolean {
  const code = designerCatalogCode(cabinet.masterCode);
  const height = measureOf(cabinet.height) ?? 0;
  const depth = measureOf(cabinet.depth) ?? 0;
  const described = `${cabinet.subCategory ?? ""} ${cabinet.description ?? ""}`.toLowerCase();
  if (height >= 60 && depth >= 12 && /^U\d{6,}(?:\d*RS)?$/.test(code)) return true;
  if (/^UOC\d/.test(code) || /^O3\d{4,}/.test(code) || /^TO[DS]/.test(code)) return true;
  return height >= 60 && depth >= 12 && /\b(?:oven pantry|oven cabinet|oven tower|universal oven|utility cabinet|tall pantry|pantry cabinet)\b/.test(described);
}

/** A loose interior tray, not the tall cabinet that already contains roll-outs. */
export function isDesignerRolloutTray(cabinet: DesignerCabinetShape): boolean {
  if (isDesignerUtilityOrOvenBox(cabinet)) return false;
  const code = designerCatalogCode(cabinet.masterCode);
  const described = `${cabinet.subCategory ?? ""} ${cabinet.description ?? ""}`.toLowerCase();
  if (/^UNIVROT\d+/.test(code) || /^RS\d{2}(?:TYPEA)?$/.test(code)) return true;
  const height = measureOf(cabinet.height);
  return /\b(?:roll[- ]?out|pull[- ]?out|pullout)\b/.test(described)
    && /\b(?:tray|shelf)\b/.test(described)
    && (height == null || height < 12);
}

export function rolloutNominalWidth(cabinet: Pick<DesignerCabinetShape, "masterCode" | "width">): number | null {
  const code = designerCatalogCode(cabinet.masterCode);
  const fromCode = /^(?:UNIVROT|RS)(\d{2})/.exec(code);
  if (fromCode) return Number(fromCode[1]);
  const width = measureOf(cabinet.width);
  return width != null && width > 0 ? width : null;
}

export function isDesignerFiller(cabinet: DesignerCabinetShape): boolean {
  const compact = designerCatalogCode(cabinet.masterCode);
  const described = `${cabinet.subCategory ?? ""} ${cabinet.description ?? ""}`.toLowerCase();
  return /\bfiller\b/.test(described)
    || /^(?:BF|BFF|WF|WFF|TF|TFF|FF|OF|AF)\d/.test(compact)
    || /^F(?:ILL)?\d/.test(compact);
}

export function isDesignerFlutedFiller(cabinet: DesignerCabinetShape): boolean {
  return isDesignerFiller(cabinet) && /flut/i.test(`${cabinet.masterCode ?? ""} ${cabinet.subCategory ?? ""} ${cabinet.description ?? ""}`);
}

export function isDesignerValance(cabinet: DesignerCabinetShape): boolean {
  const code = designerCatalogCode(cabinet.masterCode);
  const described = `${cabinet.subCategory ?? ""} ${cabinet.description ?? ""}`.toLowerCase();
  if (!(/\bvalance\b/.test(described) || /^VA\d+$/.test(code) || /^AV\d+$/.test(code))) return false;
  const height = measureOf(cabinet.height);
  const depth = measureOf(cabinet.depth);
  if (depth != null && depth > 3) return false;
  if (height != null && height > 12) return false;
  return true;
}

export function isDesignerPanel(cabinet: DesignerCabinetShape): boolean {
  if (isDesignerFiller(cabinet) || isDesignerValance(cabinet)) return false;
  return /\bpanel\b|\bskin\b|plywood/.test(haystack(cabinet));
}

export function isDesignerToeKick(cabinet: DesignerCabinetShape): boolean {
  const code = designerCatalogCode(cabinet.masterCode);
  return /\btoe ?kick\b/.test(haystack(cabinet)) || /^TK/.test(code);
}

export type DesignerMoldingKind = "crown" | "rope" | "dentil" | "scribe" | "lightRail" | "batten" | "shoe" | "cove" | "base" | "other";

export function designerMoldingKind(cabinet: DesignerCabinetShape): DesignerMoldingKind | null {
  if (isDesignerFiller(cabinet) || isDesignerValance(cabinet) || isDesignerToeKick(cabinet) || isDesignerPanel(cabinet) || isDesignerRolloutTray(cabinet) || isDesignerUtilityOrOvenBox(cabinet)) return null;
  const described = `${cabinet.subCategory ?? ""} ${cabinet.description ?? ""}`.toLowerCase();
  const code = designerCatalogCode(cabinet.masterCode);
  if (/\bdentil\b|\bdental\b/.test(described) || code.startsWith("DMT")) return "dentil";
  if (/\brope\b/.test(described) || code === "ROPE") return "rope";
  if (/\bscribe\b/.test(described) || code.startsWith("SCR") || /^SM\d/.test(code)) return "scribe";
  if (/light rail/.test(described) || code.startsWith("LRM") || code.startsWith("ALRM")) return "lightRail";
  if (/\bbatten\b/.test(described) || code.startsWith("BAM")) return "batten";
  if (/\bshoe\b/.test(described) || code.startsWith("SHM")) return "shoe";
  if (/\bcove\b/.test(described) || code === "COV") return "cove";
  if (/\bcrown\b/.test(described) || /^(?:CM|ACM|LCM|BCM|RCM|OCM)\d/.test(code)) return "crown";
  if (/molding|moulding/.test(described)) return "other";
  return null;
}

export function isDesignerOrderOnly(cabinet: DesignerCabinetShape): boolean {
  if (isDesignerRolloutTray(cabinet) || isDesignerFiller(cabinet) || isDesignerValance(cabinet) || isDesignerPanel(cabinet) || isDesignerToeKick(cabinet) || designerMoldingKind(cabinet) || isDesignerUtilityOrOvenBox(cabinet)) return false;
  return /spray\s*paint|touch-?up|\bsample\b|swatch|drawer slide|\bhinge\b|\bknob\b|\bpull\b|\bhardware\b|display door|merchandis|kiosk|glass door|door only|trash can|waste bin|chrome tray|shelf insert/.test(haystack(cabinet));
}

export type DesignerOfferMode = "place" | "attach" | "order";

export type DesignerPaletteAction =
  | { type: "place" }
  | { type: "attach-rollout"; width: number }
  | { type: "enable-trim"; kind: "crown" | "rope" | "dentil" | "scribe" | "valance" | "toeKick" | "lightRail" | "batten" }
  | { type: "order" };

/** How a catalog click should enter the design. Every real item has a path. */
export function designerPaletteAction(cabinet: DesignerCabinetShape): DesignerPaletteAction {
  if (isDesignerRolloutTray(cabinet)) {
    const width = rolloutNominalWidth(cabinet);
    return width ? { type: "attach-rollout", width } : { type: "order" };
  }
  const molding = designerMoldingKind(cabinet);
  if (molding === "crown" || molding === "rope" || molding === "dentil" || molding === "scribe" || molding === "lightRail" || molding === "batten") {
    return { type: "enable-trim", kind: molding };
  }
  if (isDesignerValance(cabinet)) return { type: "enable-trim", kind: "valance" };
  if (isDesignerToeKick(cabinet)) return { type: "enable-trim", kind: "toeKick" };
  if (isDesignerOrderOnly(cabinet)) return { type: "order" };
  return { type: "place" };
}

export function designerOfferMode(cabinet: DesignerCabinetShape): DesignerOfferMode {
  const action = designerPaletteAction(cabinet);
  if (action.type === "attach-rollout") return "attach";
  if (action.type === "order") return "order";
  return "place";
}

export function positiveDesignerMeasure(value: string | number | null | undefined): boolean {
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return false;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0;
}

function kitchenCrestOpenEndShelf(cabinet: DesignerCabinetShape): boolean {
  const code = `${cabinet.masterCode ?? ""}`.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const hay = `${cabinet.subCategory ?? ""} ${cabinet.description ?? ""}`.toLowerCase();
  return /^OE6(?:30|36|42)$/.test(code) && /\bopen\s+(?:end\s+)?shelf\b/.test(hay);
}

function isWallOpenShelfCabinet(cabinet: DesignerCabinetShape): boolean {
  const code = `${cabinet.masterCode ?? ""}`.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const hay = `${cabinet.subCategory ?? ""} ${cabinet.description ?? ""}`.toLowerCase();
  return /^W(?:E)?OS\d{4}$/.test(code)
    || kitchenCrestOpenEndShelf(cabinet)
    || /\bwall\s+(?:end\s+)?open\s+shelf\b|\bwall\s+end\s+shelf\b|\bopen\s+end\s+shelf\s+wall\b/.test(hay);
}

function isFloatingShelfItem(cabinet: DesignerCabinetShape): boolean {
  const code = `${cabinet.masterCode ?? ""}`.trim().toUpperCase();
  const hay = `${cabinet.subCategory ?? ""} ${cabinet.description ?? ""}`.toLowerCase();
  return /^FS[-_ ]?\d+(?:\.\d+)?$/.test(code)
    || /\bfloating\s+shelf\b/.test(hay)
    || (/\bopen\s+shelf\b/.test(hay) && !isWallOpenShelfCabinet(cabinet));
}

function isKneeDrawerItem(cabinet: DesignerCabinetShape): boolean {
  const code = (cabinet.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const hay = `${cabinet.category ?? ""} ${cabinet.subCategory ?? ""} ${cabinet.description ?? ""}`.toLowerCase();
  return /\bknee\s*drawer\b|\bknee\b/.test(hay) || /^(?:VKD|DKD|KD)\d/.test(code);
}

function isPanelItem(cabinet: DesignerCabinetShape): boolean {
  return /\bpanel\b|\bskin\b|end panel|dishwasher panel|refrigerator panel|decorative panel/.test(haystack(cabinet));
}

/** Loose by-the-foot trim and hardware. These stay bill-of-materials lines. */
export function isDesignerLooseTrim(cabinet: DesignerCabinetShape): boolean {
  return /crown|light rail|\btoe ?kick\b|\bscribe\b|\bbatten\b|\bfiller\b|roll[- ]?out|pull[- ]?out tray|\bhinge\b|\bknob\b|\bpull\b|\bhardware\b|molding|moulding|\btrim\b/.test(haystack(cabinet));
}

/**
 * Same accessory split as `design.placeableCabinets`: these items are not
 * dragged on as ordinary base, wall, or tall boxes.
 */
export function isDesignerAccessoryItem(cabinet: DesignerCabinetShape): boolean {
  if (isDesignerUtilityOrOvenBox(cabinet)) return false;
  const placement = text(cabinet.placementType);
  const category = text(cabinet.category);
  const subCategory = text(cabinet.subCategory);
  const description = text(cabinet.description);
  const code = text(cabinet.masterCode);
  if (isDesignerFiller(cabinet) || isDesignerValance(cabinet) || isDesignerPanel(cabinet) || isDesignerToeKick(cabinet) || designerMoldingKind(cabinet) || isDesignerRolloutTray(cabinet) || isDesignerOrderOnly(cabinet)) return true;
  if (placement.includes("accessory") || placement.includes("trim")) return true;
  if (category === "accessory") return true;
  if (category.includes("trim") || category.includes("molding")) return true;
  if (category.includes("filler") || category.includes("panel")) return true;
  if (category === "misc") return true;
  if (subCategory.includes("moulding") || subCategory.includes("molding") || subCategory.includes("crown")) return true;
  if (subCategory.includes("filler") || subCategory.includes("panel") || subCategory.includes("leg") || subCategory.includes("scribe")) return true;
  if (subCategory.includes("rail") || subCategory.includes("rope") || subCategory.includes("cove") || subCategory.includes("skin")) return true;
  if (/^pgwdc/.test(code)) return true;
  if (/glass door.*(?:fits|for)\s+(?:only\s+)?wdc|glass door sold separately/.test(description)) return true;
  return /\b(molding|moulding|scribe|light rail|crown|cove|rope|filler|end panel|skin panel|decorative leg|decorative panel|island panel|bead board|fluted filler|base filler|angle molding|inside corner molding|refrigerator end panel|shoe moulding|shoe molding|flat base molding|square decorative leg|outside corner molding|touch.?up|sample door|spray paint)\b/.test(description);
}

/** Physical accessory the Designer can drop on the plan. Mirrors `isPlaceableAccessory`. */
export function isDesignerPlaceableAccessory(cabinet: DesignerCabinetShape): boolean {
  if (isDesignerFiller(cabinet) || isDesignerValance(cabinet) || isDesignerPanel(cabinet) || isDesignerToeKick(cabinet) || designerMoldingKind(cabinet)) return true;
  const hay = haystack(cabinet);
  if (isFloatingShelfItem(cabinet) || isWallOpenShelfCabinet(cabinet)) return true;
  if (isDesignerLooseTrim(cabinet) || isDesignerRolloutTray(cabinet) || isDesignerOrderOnly(cabinet)) return false;
  if (isPanelItem(cabinet)) return true;
  if (/appliance garage|\bag-?\d/.test(hay)) return true;
  if (isKneeDrawerItem(cabinet)) return true;
  return false;
}

/**
 * True when the Designer can draw this cabinet as a 3D box or place it on the
 * plan. Missing width, height, or depth is false: the Designer has no box to
 * build. Bill-of-materials-only accessories are false.
 */
/**
 * Every identified catalog item belongs in the 3D Designer. Placeable pieces
 * render, interior trays attach to a matching cabinet, and the rest are
 * ordered from the designer onto the quote. A blank row with no code and no
 * description is the only exclusion.
 */
export function cabinetCanBeRenderedOrPlacedIn3d(cabinet: DesignerCabinetShape): boolean {
  return Boolean((cabinet.masterCode ?? "").trim() || (cabinet.description ?? "").trim());
}

export type DesignerEligibilityDecision = {
  eligible: boolean;
  /** Plain reason, suitable for an admin note or a test. */
  reason: string;
};

/**
 * Backfill decision for one cabinet. `hasPublishedPrice` must already reflect
 * a published, available supplier row with a positive list price or your cost.
 */
export function designerEligibilityDecision(
  cabinet: DesignerCabinetShape,
  hasPublishedPrice: boolean,
): DesignerEligibilityDecision {
  if (!hasPublishedPrice) {
    return { eligible: false, reason: "no published supplier price" };
  }
  if (!cabinetCanBeRenderedOrPlacedIn3d(cabinet)) {
    return { eligible: false, reason: "no catalog identity" };
  }
  const mode = designerOfferMode(cabinet);
  if (mode === "attach") return { eligible: true, reason: "attaches inside a compatible cabinet from the same line" };
  if (mode === "order") return { eligible: true, reason: "ordered from the designer onto the quote" };
  return { eligible: true, reason: "published price and the Designer can render or place it" };
}
