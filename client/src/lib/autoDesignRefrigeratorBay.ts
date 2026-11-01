import { framelessAboveFridgeHeight } from "./aefAboveFridge";
import { catalogSizeFromNumbers, pickClosestCatalogSize } from "./closestCatalogSize";
import { refrigeratorEndPanelInstalledDepth } from "./refrigeratorEndPanelCut";
import {
  cabinetWall,
  clampFillerExtensionIn,
  dim,
  refrigeratorBayRunMetrics,
  refrigeratorEndPanelThickness,
  refrigeratorSurroundElevation,
  wallPlacementAt,
  wallPlacementAtUnbounded,
  wallRunFrame,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "./design";

export type AutoDesignRefrigeratorBayResult =
  | {
      ok: true;
      additions: [PlacedCabinet, PlacedCabinet, PlacedCabinet];
      /** Full physical enclosure span: left panel, 1/2-in clearance, fridge, 1/2-in clearance, right panel. */
      reservation: { wall: string; start: number; end: number };
      /** Material-list sentences for a substituted or pulled-forward cabinet above. */
      notes: string[];
      /**
       * The refrigerator itself, clamped to sit inside its two end panels (front, top). Callers must replace the
       * placed refrigerator with this one; it is the input unchanged when it already fit.
       */
      refrigerator: PlacedCabinet;
      /** Sentence for the material list when the refrigerator was clamped; null when it already fit. */
      refrigeratorClampNote: string | null;
      /** Things that could not be made to fit inside the panels. Shown to the user instead of letting them stick out. */
      warnings: string[];
    }
  | { ok: false; message: string };

type Input = {
  refrigerator: PlacedCabinet;
  room: RoomData;
  caps: readonly DesignCabinet[];
  endPanels: readonly DesignCabinet[];
  styleId: number | null;
  makeUid: () => string;
  /** Selected 30/36/42-inch upper height. The cabinet above tops out on this run's line (54 + height). Defaults to 30. */
  wallCabinetHeightIn?: number;
  /**
   * Frameless lines pair a 40 / 40.25 inch wall with the 22 5/8 inch refrigerator
   * box. A framed line that merely sells a 40 inch wall must not take that path.
   * Omitted means "decide from the height", which preserves existing callers.
   */
  framelessLine?: boolean;
};

/** Tolerance when comparing a part's face to its end panels' faces. */
export const PANEL_FIT_EPSILON_IN = 0.05;

/** A refrigerator with end panels always gets the full-depth refrigerator box above it. */
export const REFRIGERATOR_CAP_DEPTH_IN = 24;
/** Standard upper-cabinet bottom datum. A bay's cabinet above tops out at this plus the selected upper height. */
const UPPER_RUN_BOTTOM_IN = 54;
/** A bridge taller than this is not the automatic over-fridge fallback. */
export const OVER_FRIDGE_FALLBACK_MAX_HEIGHT_IN = 30;
/**
 * The enclosure may end this far past a wall and still be slid flush.
 * A quarter inch is one Designer eighth-grid step past a 150 inch wall when
 * the 36 inch refrigerator, its 1/2 inch clearances, and 3/4 inch panels are
 * centered at 131. A larger slide is still refused.
 */
export const AUTO_DESIGN_REFRIGERATOR_WALL_END_SHIFT_IN = 0.25;

export function overFridgeSubstitutionNote(masterCode: string, heightIn: number): string {
  const rounded = Math.round(heightIn * 1000) / 1000;
  const height = Number.isInteger(rounded) ? String(rounded) : String(rounded);
  return `Over-fridge 36x24 not in line; used ${masterCode} (${height}" H)`;
}

export type RefrigeratorCapPick = {
  cabinet: DesignCabinet;
  substitutionNote: string | null;
};

function capSize(candidate: DesignCabinet) {
  return catalogSizeFromNumbers(dim(candidate.width, 0), dim(candidate.height, 0), dim(candidate.depth, 0));
}

/**
 * The cabinet above a refrigerator is the 36-inch-wide, 24-inch-deep
 * refrigerator wall box. Among those boxes, take the height whose top lands
 * closest to the neighboring upper line (shorter wins a tie). A frameless
 * 40 inch run still wants its exact 22 5/8 inch box.
 *
 * When that preferred box is not in the line, use the tallest bridge under
 * 30 inches: 36 inch width and 24 inch depth first, then the closest depth.
 * Nothing under 30 inches keeps the previous refusal.
 */
export function pickAutoDesignRefrigeratorCap(
  caps: readonly DesignCabinet[],
  refrigeratorTop: number,
  wallCabinetHeightIn: number,
  ceilingIn: number,
  framelessLine = true,
): RefrigeratorCapPick | null {
  const target = UPPER_RUN_BOTTOM_IN + wallCabinetHeightIn;
  const mountBottom = refrigeratorSurroundElevation(null, refrigeratorTop, 0).mountBottom;
  const fitsCeiling = (candidate: DesignCabinet) => mountBottom + dim(candidate.height, 0) <= ceilingIn + 0.01;
  // A frameless 40 1/4" run pairs with the 22 5/8" × 24" refrigerator wall.
  // A framed 42" request, and a framed line whose 42" class is sold as 40",
  // are not this height. A missing exact box falls through to the under-30 bridge.
  const framelessCapHeight = framelessLine ? framelessAboveFridgeHeight(wallCabinetHeightIn) : null;
  if (framelessCapHeight != null) {
    const match = caps
      .filter((candidate) => (
        Math.abs(dim(candidate.width, 0) - 36) <= 0.01
        && Math.abs(dim(candidate.depth, 0) - REFRIGERATOR_CAP_DEPTH_IN) <= 0.01
        && Math.abs(dim(candidate.height, 0) - framelessCapHeight) <= 0.05
        && fitsCeiling(candidate)
      ))
      .sort((a, b) => a.masterCode.localeCompare(b.masterCode));
    if (match[0]) return { cabinet: match[0], substitutionNote: null };
  } else {
    const eligible = caps
      .filter((candidate) => (
        Math.abs(dim(candidate.width, 0) - 36) <= 0.01
        && Math.abs(dim(candidate.depth, 0) - REFRIGERATOR_CAP_DEPTH_IN) <= 0.01
        && dim(candidate.height, 0) > 0
        && fitsCeiling(candidate)
      ))
      .map((candidate) => ({ candidate, top: mountBottom + dim(candidate.height, 0) }));
    eligible.sort((a, b) => (
      Math.abs(a.top - target) - Math.abs(b.top - target)
      || dim(a.candidate.height, 0) - dim(b.candidate.height, 0)
      || a.candidate.masterCode.localeCompare(b.candidate.masterCode)
    ));
    if (eligible[0]) return { cabinet: eligible[0].candidate, substitutionNote: null };
  }
  return fallbackOverFridgeCap(caps, fitsCeiling);
}

/**
 * Tallest under-30 bridge when the 36 × 24 deep preferred box is absent.
 * 36 inch width and 24 inch depth win, then the closest depth, then the
 * tallest box in that group.
 */
function fallbackOverFridgeCap(
  caps: readonly DesignCabinet[],
  fitsCeiling: (candidate: DesignCabinet) => boolean,
): RefrigeratorCapPick | null {
  const underThirty = caps.filter((candidate) => {
    const size = capSize(candidate);
    return size != null && size.height < OVER_FRIDGE_FALLBACK_MAX_HEIGHT_IN && fitsCeiling(candidate);
  });
  const preferredShape = pickClosestCatalogSize({
    candidates: underThirty,
    wanted: { width: 36, depth: REFRIGERATOR_CAP_DEPTH_IN },
    read: capSize,
    require: ["width", "depth"],
    toleranceIn: 0.5,
    rank: [{ axis: "height", by: "larger" }],
  });
  const closestDepth = preferredShape ?? pickClosestCatalogSize({
    candidates: underThirty,
    wanted: { width: 36, depth: REFRIGERATOR_CAP_DEPTH_IN },
    read: capSize,
    rank: [
      { axis: "width", by: "closest" },
      { axis: "depth", by: "closest" },
      { axis: "height", by: "larger" },
    ],
  });
  if (!closestDepth) return null;
  return {
    cabinet: closestDepth.item,
    substitutionNote: overFridgeSubstitutionNote(closestDepth.item.masterCode, closestDepth.size.height),
  };
}

/**
 * Source catalogs use both orientations for refrigerator-panel dimensions:
 * REPV rows keep the thin face in `width` and installed depth in `depth`, while
 * sheet-panel rows such as S2496 keep the 24-in installed depth in `width` and
 * the 3/4-in face in `depth`. Auto-Design must retain the real selected SKU in
 * either representation rather than declaring its panel unavailable.
 */
function refrigeratorPanelDimensions(candidate: DesignCabinet): { thickness: number; installedDepth: number; stockDepth: number } | null {
  const sourceWidth = Math.max(0, dim(candidate.width, 0));
  const sourceDepth = Math.max(0, dim(candidate.depth, 0));
  const widthIsThinFace = sourceWidth > 0 && sourceWidth <= 3;
  const depthIsThinFace = sourceDepth > 0 && sourceDepth <= 3;

  if (widthIsThinFace && sourceDepth > 3) {
    return {
      thickness: refrigeratorEndPanelThickness(candidate.width, 0.75),
      stockDepth: sourceDepth,
      installedDepth: clampFillerExtensionIn(sourceDepth, "tall"),
    };
  }
  if (depthIsThinFace && sourceWidth > 3) {
    return {
      thickness: refrigeratorEndPanelThickness(candidate.depth, 0.75),
      stockDepth: sourceWidth,
      installedDepth: clampFillerExtensionIn(sourceWidth, "tall"),
    };
  }
  return null;
}

/**
 * Auto-Design always creates a complete refrigerator bay before surrounding
 * straight runs are tiled: a 36-in appliance, both source-priced end panels,
 * and one matching 36-in source-priced refrigerator cabinet above. A filler is
 * never a refrigerator-bay member.
 */
export function buildMandatoryAutoDesignRefrigeratorBay({
  refrigerator,
  room,
  caps,
  endPanels,
  styleId,
  makeUid,
  wallCabinetHeightIn = 30,
  framelessLine = true,
}: Input): AutoDesignRefrigeratorBayResult {
  if (Math.abs(refrigerator.width - 36) > 0.01) {
    return { ok: false, message: "Auto-Design refrigerator bays require the 36-inch refrigerator and matching 36-inch cabinet above." };
  }

  const ceilingIn = Math.max(0, Number(room.ceilingHeight) || 96);
  const capPick = pickAutoDesignRefrigeratorCap(caps, refrigerator.height ?? 70, wallCabinetHeightIn, ceilingIn, framelessLine);
  if (!capPick) {
    return { ok: false, message: "No source-priced 36-inch-wide, 24-inch-deep refrigerator cabinet above is available for the selected cabinet line, and the line has no bridge under 30 inches to use instead." };
  }
  const cap = capPick.cabinet;
  const panelEntry = endPanels
    .map((candidate) => ({ candidate, dimensions: refrigeratorPanelDimensions(candidate) }))
    .find((entry): entry is { candidate: DesignCabinet; dimensions: { thickness: number; installedDepth: number; stockDepth: number } } => entry.dimensions !== null);
  if (!panelEntry) {
    return { ok: false, message: "No source-priced refrigerator end panel is available for the selected cabinet line." };
  }
  const { candidate: panel, dimensions: panelDimensions } = panelEntry;

  const bay = refrigeratorBayRunMetrics(refrigerator, room);
  const panelThickness = panelDimensions.thickness;
  // The filler-depth cap still applies when the refrigerator is at least as
  // deep as the stock sheet. A shallower refrigerator is shown cut to the
  // appliance, and the stock depth is kept for the master BOM note.
  const panelCut = refrigeratorEndPanelInstalledDepth(panelDimensions.stockDepth, Number(refrigerator.depth) || 0);
  const panelDepth = panelCut.cutDown ? panelCut.installedDepth : panelDimensions.installedDepth;
  const capDepth = Math.max(0, dim(cap.depth, 0)) || 24;
  const capHeight = Math.max(0, dim(cap.height, 0)) || 24;
  const panelHeight = refrigeratorSurroundElevation(room, refrigerator.height ?? 70, capHeight).top;
  const capSpot = wallPlacementAt(bay.refrigeratorStart, 36, capDepth, bay.side, room);
  // A substituted box shallower than the finished enclosure is pulled forward
  // so its face meets the panel/refrigerator face. The preferred 24 inch box
  // stays on the wall, which is the placement existing kitchens already use.
  const enclosureFace = Math.min(panelDepth, Math.max(0, Number(refrigerator.depth) || panelDepth));
  const pullForward = capPick.substitutionNote != null && capDepth + 0.05 < enclosureFace;
  const flushSpot = pullForward ? pullWallCabinetFaceTo(capSpot, capDepth, enclosureFace, bay.side) : capSpot;
  const notes = [
    ...(capPick.substitutionNote ? [capPick.substitutionNote] : []),
    ...(pullForward ? [`Over-fridge ${cap.masterCode} pulled forward flush with the refrigerator face`] : []),
  ];
  // The refrigerator must stay inside its surrounding panels (Tom, Oct 31): panels are capped at 24 in. deep, so a
  // deeper refrigerator used to stick out past their faces and made the panel read as doubled. Seat it at the panel
  // depth instead (same wall position, same width) and top it at the panel height. Anything that still cannot fit
  // (a cabinet above deeper than the panels) is reported as a warning, never left sticking out silently.
  const warnings: string[] = [];
  let placedRefrigerator = refrigerator;
  let clampNote: string | null = null;
  const fridgeDepth = Number(refrigerator.depth) || 0;
  const fridgeHeight = Number(refrigerator.height) || 0;
  if (fridgeDepth > panelDepth + PANEL_FIT_EPSILON_IN) {
    const reseat = wallPlacementAt(bay.refrigeratorStart, refrigerator.width, panelDepth, bay.side, room);
    placedRefrigerator = { ...placedRefrigerator, ...reseat, depth: panelDepth, rotation: reseat.rotation };
    clampNote = `Refrigerator set to ${panelDepth}" deep so it stays inside its end panels (was ${fridgeDepth}")`;
  }
  if (fridgeHeight > panelHeight + PANEL_FIT_EPSILON_IN) {
    placedRefrigerator = { ...placedRefrigerator, height: panelHeight };
    clampNote = [clampNote, `Refrigerator set to ${panelHeight}" high so it stays inside its end panels (was ${fridgeHeight}")`].filter(Boolean).join("; ");
  }
  if (capDepth > panelDepth + PANEL_FIT_EPSILON_IN) {
    warnings.push(`${cap.masterCode} above the refrigerator is ${capDepth}" deep but the end panels are ${panelDepth}" deep, so it sticks out ${Math.round((capDepth - panelDepth) * 100) / 100}" past them. Pick a shallower cabinet above or a deeper panel.`);
  }
  const leftPanelSpot = wallPlacementAtUnbounded(bay.openingStart - panelThickness, panelThickness, panelDepth, bay.side, room);
  const rightPanelSpot = wallPlacementAtUnbounded(bay.openingEnd, panelThickness, panelDepth, bay.side, room);
  const shared = { refrigeratorAssemblyId: refrigerator.uid, styleId };

  const bridge: PlacedCabinet = {
    uid: makeUid(),
    cabinetId: cap.id,
    masterCode: cap.masterCode,
    description: cap.description,
    category: cap.category,
    subCategory: cap.subCategory,
    placement: "wall",
    ...flushSpot,
    width: 36,
    depth: capDepth,
    height: capHeight,
    rotation: flushSpot.rotation,
    wallId: flushSpot.wallId,
    wallOffset: flushSpot.wallOffset,
    ...(pullForward ? { depthPositionAdjusted: true } : {}),
    ...(notes.length ? { fieldModificationNote: notes.join("; ") } : {}),
    numberOfDoors: cap.numberOfDoors,
    numberOfDrawers: cap.numberOfDrawers,
    catalogImageUrl: cap.catalogImageUrl ?? null,
    refrigeratorAssemblyRole: "bridge",
    mountBottom: refrigeratorSurroundElevation(room, refrigerator.height ?? 70, capHeight).mountBottom,
    ...shared,
  };

  const makePanel = (side: "left-panel" | "right-panel", spot: ReturnType<typeof wallPlacementAtUnbounded>): PlacedCabinet => ({
    uid: makeUid(),
    cabinetId: panel.id,
    masterCode: panel.masterCode,
    description: panel.description,
    category: "Panel",
    subCategory: "Refrigerator End Panel",
    placement: "tall",
    ...spot,
    width: panelThickness,
    depth: panelDepth,
    nominalDepth: panelDepth,
    ...(panelCut.cutDown ? { refrigeratorPanelStockDepth: panelCut.stockDepth } : {}),
    height: panelHeight,
    rotation: spot.rotation,
    wallId: spot.wallId,
    wallOffset: spot.wallOffset,
    numberOfDoors: 0,
    numberOfDrawers: 0,
    catalogImageUrl: panel.catalogImageUrl ?? null,
    customProfile: "refrigerator-end-panel",
    refrigeratorAssemblyRole: side,
    mountBottom: 0,
    ...shared,
  });

  return {
    ok: true,
    additions: [bridge, makePanel("left-panel", leftPanelSpot), makePanel("right-panel", rightPanelSpot)],
    reservation: {
      wall: bay.side,
      start: bay.openingStart - panelThickness,
      end: bay.openingEnd + panelThickness,
    },
    notes,
    refrigerator: placedRefrigerator,
    refrigeratorClampNote: clampNote,
    warnings,
  };
}

export type MeasuredRefrigeratorBay = {
  existing: PlacedCabinet[];
  additions: PlacedCabinet[];
  shiftIn: number;
  omittedCornerPanel: "left-panel" | "right-panel" | null;
  reservation: { wall: string; start: number; end: number };
  /** Told to the user when the refrigerator stays in the corner. */
  note: string | null;
};

function measuredAlong(item: PlacedCabinet, side: WallSide, room: RoomData): { start: number; end: number } {
  const start = item.wallId === side && Number.isFinite(Number(item.wallOffset))
    ? Number(item.wallOffset)
    : wallRunOffset(item, side, room);
  return { start, end: start + wallRunSpan(item, side, room) };
}

function isBayPanel(item: PlacedCabinet): boolean {
  return item.refrigeratorAssemblyRole === "left-panel" || item.refrigeratorAssemblyRole === "right-panel";
}

function isBayFiller(item: PlacedCabinet): boolean {
  return item.refrigeratorAssemblyRole === "bridge-left-filler" || item.refrigeratorAssemblyRole === "bridge-right-filler";
}

/**
 * Keep a measured refrigerator that sits in a corner. The ordinary fitter
 * slides the whole bay about 1¼ inches so both ¾ inch panels land on the same
 * wall, and Auto-Design then refuses any slide larger than ¼ inch. That
 * refusal is not a catalog gap: the adjoining wall already closes the corner
 * side. Drop only the panel (and filler) that would leave the wall, leave the
 * refrigerator where it was measured, and keep the open-side panel at the
 * depth already field-cut flush to the refrigerator.
 *
 * Returns null when the slide is not explained by a corner-side panel, so the
 * caller can still refuse a bay that overlaps another cabinet.
 */
export function acceptMeasuredCornerRefrigeratorBay(input: {
  refrigerator: PlacedCabinet;
  room: RoomData;
  additions: readonly PlacedCabinet[];
  fitted: { existing: PlacedCabinet[]; additions: PlacedCabinet[]; shiftIn: number };
  reservation: { wall: string; start: number; end: number };
}): MeasuredRefrigeratorBay | null {
  const shiftLimit = AUTO_DESIGN_REFRIGERATOR_WALL_END_SHIFT_IN + 1e-6;
  if (Math.abs(input.fitted.shiftIn) <= shiftLimit) {
    return {
      existing: input.fitted.existing,
      additions: input.fitted.additions,
      shiftIn: input.fitted.shiftIn,
      omittedCornerPanel: null,
      reservation: {
        wall: input.reservation.wall,
        start: input.reservation.start + input.fitted.shiftIn,
        end: input.reservation.end + input.fitted.shiftIn,
      },
      note: null,
    };
  }

  const side = cabinetWall(input.refrigerator, input.room);
  const frame = wallRunFrame(side, input.room);
  if (!frame) return null;
  const fridgeSpan = measuredAlong(input.refrigerator, side, input.room);
  if (fridgeSpan.start < -0.02 || fridgeSpan.end > frame.length + 0.02) return null;

  const offRun = (item: PlacedCabinet) => {
    const span = measuredAlong(item, side, input.room);
    return span.start < -0.02 || span.end > frame.length + 0.02;
  };
  const hanging = input.additions.filter(offRun);
  if (hanging.length === 0 || hanging.some((item) => !isBayPanel(item) && !isBayFiller(item))) return null;
  const omitted = hanging.find(isBayPanel);
  const keptPanels = input.additions.filter((item) => isBayPanel(item) && !offRun(item));
  if (!omitted || keptPanels.length === 0) return null;
  if (omitted.refrigeratorAssemblyRole !== "left-panel" && omitted.refrigeratorAssemblyRole !== "right-panel") return null;

  const dropped = new Set(hanging.map((item) => item.uid));
  const additions = input.additions.filter((item) => !dropped.has(item.uid));
  let start = fridgeSpan.start;
  let end = fridgeSpan.end;
  for (const item of additions) {
    const span = measuredAlong(item, side, input.room);
    start = Math.min(start, Math.max(0, span.start));
    end = Math.max(end, Math.min(frame.length, span.end));
  }
  const openPanel = keptPanels[0]!;
  const cut = openPanel.refrigeratorPanelStockDepth != null
    ? ` The open-side ${openPanel.masterCode} panel is field-cut flush to the refrigerator depth.`
    : "";
  return {
    existing: input.fitted.existing.map((item) => item.uid === input.refrigerator.uid ? input.refrigerator : item),
    additions,
    shiftIn: 0,
    omittedCornerPanel: omitted.refrigeratorAssemblyRole,
    reservation: { wall: side, start, end },
    note: `The refrigerator stays in the corner. The corner-side end panel is omitted because the adjoining wall closes that side.${cut}`,
  };
}

/** Move a wall cabinet's front to `faceDepth` without changing its box depth. */
function pullWallCabinetFaceTo(
  spot: { x: number; y: number; rotation: number; wallId?: string; wallOffset?: number },
  cabinetDepth: number,
  faceDepth: number,
  side: WallSide,
): { x: number; y: number; rotation: number; wallId?: string; wallOffset?: number } {
  const inset = Math.max(0, faceDepth - cabinetDepth);
  if (side === "top") return { ...spot, y: spot.y + inset };
  if (side === "bottom") return { ...spot, y: spot.y - inset };
  if (side === "left") return { ...spot, x: spot.x + inset };
  return { ...spot, x: Math.max(0, spot.x - inset) };
}
