import { FRAMELESS_ABOVE_FRIDGE_HEIGHT_IN, framelessAboveFridgeHeight, isFramelessFortyWallHeight } from "./aefAboveFridge";
import { framelessWallTopDatumIn } from "./framelessWallTopAlignment";
import { REFRIGERATOR_PANEL_LIMIT_EPSILON_IN } from "./refrigeratorPanelLimit";
import { REFRIGERATOR_BRIDGE_FACE_EPSILON_IN } from "./refrigeratorBridgeDepth";
import { catalogSizeFromNumbers, pickClosestCatalogSize } from "./closestCatalogSize";
import { refrigeratorEndPanelInstalledDepth } from "./refrigeratorEndPanelCut";
import {
  cabinetWall,
  cabinetFrontIn,
  clampFillerExtensionIn,
  dim,
  REFRIGERATOR_SIDE_CLEARANCE_IN,
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
      /** Builds a source-priced end panel for one side of the given opening (used to add a missing panel back). */
      panelFor: (side: "left-panel" | "right-panel", opening: { openingStart: number; openingEnd: number }) => PlacedCabinet;
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
/** Refrigerator widths Auto-Design can build a bay for. */
export const AUTO_DESIGN_REFRIGERATOR_WIDTHS_IN = [30, 33, 36, 42] as const;
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

/** One-eighth-inch label used by the bay's review notes. */
function inchLabel(value: number): string {
  const rounded = Math.round(value * 8) / 8;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
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
  /**
   * True only when the caller knows the selected line is frameless.
   * `autoDesignLayout` passes the answer from the wall catalog; the default is
   * false so a framed line never inherits the frameless 94-1/4" top line.
   */
  framelessLine = false,
  refrigeratorWidthIn = 36,
): RefrigeratorCapPick | null {
  // The box above matches the refrigerator width (30, 33, 36 or 42). When that width is not in
  // the line, the nearest narrower width that fits inside the panels is used instead, centered.
  // An over-wide box is never used: it would poke past the end panels.
  const openingIn = refrigeratorWidthIn + REFRIGERATOR_SIDE_CLEARANCE_IN * 2;
  const exactWidth = (candidate: DesignCabinet) => Math.abs(dim(candidate.width, 0) - refrigeratorWidthIn) <= 0.01;
  // The line the run's own uppers top out on: 54 + the selected upper height.
  const target = UPPER_RUN_BOTTOM_IN + wallCabinetHeightIn;
  const mountBottom = refrigeratorSurroundElevation(null, refrigeratorTop, 0).mountBottom;
  const fitsCeiling = (candidate: DesignCabinet) => mountBottom + dim(candidate.height, 0) <= ceilingIn + 0.01;
  // A frameless 40 1/4" run pairs with the 22 5/8" × 24" refrigerator wall.
  // A framed 42" request, and a framed line whose 42" class is sold as 40",
  // are not this height. A missing exact box falls through to the under-30 bridge.
  // Tom's decision (Nov 9 2026, issue #354 item 5): on the frameless line the box
  // above the refrigerator tops out on the one 94-1/4" line too. From the 72"
  // appliance datum that is the book's 22-5/8" box (72 + 22-5/8 = 94-5/8), so the
  // frameless line always takes that height whatever 30/36/42 class was asked for.
  // The cap's own bottom is floored at the 72" datum further down, so the top lands
  // on the line without the box ever floating.
  const framelessCapHeight = framelessLine
    ? (framelessAboveFridgeHeight(wallCabinetHeightIn) ?? FRAMELESS_ABOVE_FRIDGE_HEIGHT_IN)
    : null;
  if (framelessCapHeight != null) {
    const match = caps
      .filter((candidate) => (
        exactWidth(candidate)
        && Math.abs(dim(candidate.depth, 0) - REFRIGERATOR_CAP_DEPTH_IN) <= 0.01
        && Math.abs(dim(candidate.height, 0) - framelessCapHeight) <= 0.05
        && fitsCeiling(candidate)
      ))
      .sort((a, b) => a.masterCode.localeCompare(b.masterCode));
    if (match[0]) return { cabinet: match[0], substitutionNote: null };
  } else {
    // Owner rule order. First: a full-depth refrigerator box whose TOP lands on
    // the run's line, so it lines up with the other uppers and its face is already
    // at the panel plane. Second: any full-depth box, nearest top (the previous
    // behaviour, and the bay reports the compromise). Third, and only when the
    // line sells no full-depth box at this width: a shallower box, which the depth
    // rule then pulls forward to the panel.
    const surroundDatumIn = refrigeratorSurroundElevation(null, refrigeratorTop, 0).mountBottom;
    const runTop = UPPER_RUN_BOTTOM_IN + Math.max(0, Number(wallCabinetHeightIn) || 30);
    const placedAt = (candidate: DesignCabinet) => {
      const height = dim(candidate.height, 0);
      const linedUpBottom = runTop - height;
      return linedUpBottom >= surroundDatumIn - 0.01
        ? { linedUp: true, bottom: linedUpBottom, top: runTop }
        : { linedUp: false, bottom: surroundDatumIn, top: surroundDatumIn + height };
    };
    const sameWidth = caps.filter((candidate) => (
      exactWidth(candidate)
      && dim(candidate.height, 0) > 0
      && dim(candidate.depth, 0) > 0
      && dim(candidate.depth, 0) <= REFRIGERATOR_CAP_DEPTH_IN + 0.01
      && fitsCeiling(candidate)
    ));
    const fullDepth = sameWidth.filter((candidate) => dim(candidate.depth, 0) >= REFRIGERATOR_CAP_DEPTH_IN - 0.01);
    const rank = (list: readonly DesignCabinet[]) => list
      .map((candidate) => ({ candidate, ...placedAt(candidate) }))
      .sort((a, b) => (
        Number(b.linedUp) - Number(a.linedUp)
        || Math.abs(a.top - target) - Math.abs(b.top - target)
        || dim(b.candidate.height, 0) - dim(a.candidate.height, 0)
        || a.candidate.masterCode.localeCompare(b.candidate.masterCode)
      ));
    const chosen = rank(fullDepth)[0] ?? rank(sameWidth)[0];
    if (chosen) return { cabinet: chosen.candidate, substitutionNote: null };
  }
  const fitsOpening = (candidate: DesignCabinet) => dim(candidate.width, 0) > 0 && dim(candidate.width, 0) <= openingIn + 0.01;
  return fallbackOverFridgeCap(caps, fitsCeiling, refrigeratorWidthIn, fitsOpening);
}

/**
 * Bridge fallback when the line sells no full-length refrigerator box: the
 * deepest box it does sell at the refrigerator's width, then the tallest one
 * whose top can still land on the run's upper line.
 */
function fallbackOverFridgeCap(
  caps: readonly DesignCabinet[],
  fitsCeiling: (candidate: DesignCabinet) => boolean,
  refrigeratorWidthIn = 36,
  fitsOpening: (candidate: DesignCabinet) => boolean = () => true,
): RefrigeratorCapPick | null {
  const underThirty = caps.filter((candidate) => {
    const size = capSize(candidate);
    return size != null && size.height < OVER_FRIDGE_FALLBACK_MAX_HEIGHT_IN && fitsCeiling(candidate) && fitsOpening(candidate);
  });
  const preferredShape = pickClosestCatalogSize({
    candidates: underThirty,
    wanted: { width: refrigeratorWidthIn, depth: REFRIGERATOR_CAP_DEPTH_IN },
    read: capSize,
    require: ["width", "depth"],
    toleranceIn: 0.5,
    rank: [{ axis: "height", by: "larger" }],
  });
  const closestDepth = preferredShape ?? pickClosestCatalogSize({
    candidates: underThirty,
    wanted: { width: refrigeratorWidthIn, depth: REFRIGERATOR_CAP_DEPTH_IN },
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
  framelessLine = false,
}: Input): AutoDesignRefrigeratorBayResult {
  const fridgeWidthIn = Number(refrigerator.width) || 0;
  if (!AUTO_DESIGN_REFRIGERATOR_WIDTHS_IN.some((width) => Math.abs(fridgeWidthIn - width) <= 0.01)) {
    return { ok: false, message: "Auto-Design refrigerator bays take a 30, 33, 36 or 42-inch refrigerator with a matching cabinet above." };
  }

  const ceilingIn = Math.max(0, Number(room.ceilingHeight) || 96);
  const capPick = pickAutoDesignRefrigeratorCap(caps, refrigerator.height ?? 70, wallCabinetHeightIn, ceilingIn, framelessLine, fridgeWidthIn);
  if (!capPick) {
    return { ok: false, message: `No source-priced ${fridgeWidthIn}-inch-wide (or narrower, fitting inside the panels), 24-inch-deep refrigerator cabinet above is available for the selected cabinet line, and the line has no bridge under 30 inches to use instead.` };
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
  // The run's own upper height: the source-priced class the build actually uses
  // for its straight wall cabinets. The cabinet above the refrigerator lines up
  // with those, not with the appliance datum.
  const capHeightLineIn = Math.max(0, Number(wallCabinetHeightIn) || 30);
  // The frame the cap's TOP must reach. On the frameless line that is the single
  // 94-1/4" line (Tom, Nov 9 2026, issue #354 item 5); other lines keep 54 + height.
  const upperLineTopIn = framelessLine || isFramelessFortyWallHeight(wallCabinetHeightIn)
    ? framelessWallTopDatumIn()
    : UPPER_RUN_BOTTOM_IN + capHeightLineIn;
  // Height rule, separate from the depth rule: the cabinet above lines up with
  // the other uppers, so its TOP lands on the run's line (54 + the selected
  // upper height) and its bottom is that line less its own height. Hanging it
  // from the 72-inch appliance datum instead pushed an 18-inch bridge to 90 and
  // left it above the run it belongs to.
  const surroundDatumIn = refrigeratorSurroundElevation(room, refrigerator.height ?? 70, capHeight).mountBottom;
  const topAlignedBottomIn = upperLineTopIn - capHeight;
  // Lining up wins whenever the box still clears the appliance. A box that cannot
  // both reach the line and clear the appliance is lifted to the clearance datum
  // instead of intersecting the refrigerator; a sub-inch shortfall is catalog
  // noise and is not reported.
  const mountBottom = topAlignedBottomIn >= surroundDatumIn - 0.01 ? topAlignedBottomIn : surroundDatumIn;
  const heightRuleCompromised = mountBottom - topAlignedBottomIn > 1;
  // End panels finish on the same line as the cabinet above, so the enclosure
  // reads as one piece with the run. A panel never hangs below the appliance.
  const panelHeight = Math.max(
    refrigeratorSurroundElevation(room, refrigerator.height ?? 70, capHeight).top,
    mountBottom + capHeight,
  );
  const capWidth = Math.max(0, dim(cap.width, 0)) || fridgeWidthIn;
  // A deeper box would stick out past the panel face. Cut it back to the panel
  // before it is seated. Nothing is left overhanging.
  const capPastPanel = capDepth > panelDepth + REFRIGERATOR_PANEL_LIMIT_EPSILON_IN;
  const installedCapDepth = capPastPanel ? panelDepth : capDepth;
  // Centered on the refrigerator, so a narrower substitute sits inside the opening with equal gaps.
  const capSpot = wallPlacementAt(bay.refrigeratorCenter - capWidth / 2, capWidth, installedCapDepth, bay.side, room);
  // A substituted box shallower than the finished enclosure is pulled forward
  // so its face meets the panel face. The depth rule is not conditional on a
  // substitution: whenever a panel is used, the cabinet above sits flush with it.
  const enclosureFace = Math.min(panelDepth, Math.max(0, Number(refrigerator.depth) || panelDepth));
  const needsPullForward = installedCapDepth + REFRIGERATOR_BRIDGE_FACE_EPSILON_IN < enclosureFace;
  const flushSpot = needsPullForward ? pullWallCabinetFaceTo(capSpot, installedCapDepth, enclosureFace, bay.side) : capSpot;
  const pullForward = needsPullForward;
  const widthSubstituted = Math.abs(capWidth - fridgeWidthIn) > 0.01;
  const notes = [
    ...(capPick.substitutionNote ? [capPick.substitutionNote] : []),
    ...(widthSubstituted ? [`No ${fridgeWidthIn}" cabinet above this refrigerator in the line; used ${cap.masterCode} (${capWidth}" wide), centered, with a filler gap each side`] : []),
    ...(pullForward ? [`Over-fridge ${cap.masterCode} pulled forward flush with the refrigerator end panel`] : []),
    ...(heightRuleCompromised ? [`${cap.masterCode} above the refrigerator is too tall to top out on the ${inchLabel(upperLineTopIn)}" upper line, so it sits at the ${inchLabel(mountBottom)}" clearance instead`] : []),
    ...(capPastPanel ? [`${cap.masterCode} above the refrigerator set to ${panelDepth}" deep so it does not extend past the refrigerator end panel (was ${capDepth}")`] : []),
  ];
  // The refrigerator must stay inside its surrounding panels (Tom, Oct 31): panels are capped at 24 in. deep, so a
  // deeper refrigerator used to stick out past their faces and made the panel read as doubled. Seat it at the panel
  // depth instead (same wall position, same width) and top it at the panel height. A cabinet above that is deeper
  // than the panels is cut back to the panel face before it is placed.
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
    width: capWidth,
    depth: installedCapDepth,
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
    mountBottom,
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

  const panelFor = (side: "left-panel" | "right-panel", opening: { openingStart: number; openingEnd: number }) => makePanel(
    side,
    wallPlacementAtUnbounded(side === "left-panel" ? opening.openingStart - panelThickness : opening.openingEnd, panelThickness, panelDepth, bay.side, room),
  );
  return {
    ok: true,
    panelFor,
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
