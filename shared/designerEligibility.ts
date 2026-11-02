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
  return `${cabinet.subCategory ?? ""} ${cabinet.description ?? ""} ${cabinet.masterCode ?? ""}`.toLowerCase();
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
  const placement = text(cabinet.placementType);
  const category = text(cabinet.category);
  const subCategory = text(cabinet.subCategory);
  const description = text(cabinet.description);
  const code = text(cabinet.masterCode);
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
  if ((cabinet.masterCode ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase() === "TEP3096") return false;
  const hay = haystack(cabinet);
  if (/\bf(?:ill)?[-_]?\d|\bfiller\b/.test(hay)) return true;
  if (isFloatingShelfItem(cabinet) || isWallOpenShelfCabinet(cabinet)) return true;
  if (isDesignerLooseTrim(cabinet)) return false;
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
export function cabinetCanBeRenderedOrPlacedIn3d(cabinet: DesignerCabinetShape): boolean {
  if (cabinet.isNotCabinet) return false;
  if (!positiveDesignerMeasure(cabinet.width) || !positiveDesignerMeasure(cabinet.height) || !positiveDesignerMeasure(cabinet.depth)) {
    return false;
  }
  if (!isDesignerAccessoryItem(cabinet)) return true;
  return isDesignerPlaceableAccessory(cabinet);
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
  if (cabinet.isNotCabinet) {
    return { eligible: false, reason: "marked as not a cabinet" };
  }
  if (!positiveDesignerMeasure(cabinet.width) || !positiveDesignerMeasure(cabinet.height) || !positiveDesignerMeasure(cabinet.depth)) {
    return { eligible: false, reason: "missing width, height, or depth" };
  }
  if (!cabinetCanBeRenderedOrPlacedIn3d(cabinet)) {
    return { eligible: false, reason: "Designer cannot render or place this item" };
  }
  return { eligible: true, reason: "published price and the Designer can render or place it" };
}
