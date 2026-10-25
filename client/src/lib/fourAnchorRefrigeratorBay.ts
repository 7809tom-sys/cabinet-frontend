import {
  dim,
  refrigeratorBayRunMetrics,
  refrigeratorEndPanelThickness,
  refrigeratorSurroundElevation,
  wallPlacementAt,
  wallPlacementAtUnbounded,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "./design";

export type FourAnchorRefrigeratorBayResult =
  | {
      ok: true;
      additions: [PlacedCabinet, PlacedCabinet, PlacedCabinet];
      /** Full physical enclosure span: left panel, 1/2-in clearance, fridge, 1/2-in clearance, right panel. */
      reservation: { wall: string; start: number; end: number };
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
};

/** A refrigerator with end panels always gets the full-depth refrigerator box above it. */
export const REFRIGERATOR_CAP_DEPTH_IN = 24;
/** Standard upper-cabinet bottom datum. A bay's cabinet above tops out at this plus the selected upper height. */
const UPPER_RUN_BOTTOM_IN = 54;

/**
 * The cabinet above a refrigerator is the 36-inch-wide, 24-inch-deep
 * refrigerator wall box, never an ordinary 12-inch-deep wall cabinet that sits
 * behind the panels' front edge. Among the true 24-inch boxes, take the height
 * whose top lands closest to the neighboring upper line (shorter wins a tie).
 */
export function pickFourAnchorRefrigeratorCap(
  caps: readonly DesignCabinet[],
  refrigeratorTop: number,
  wallCabinetHeightIn: number,
  ceilingIn: number,
): DesignCabinet | null {
  const target = UPPER_RUN_BOTTOM_IN + wallCabinetHeightIn;
  const mountBottom = refrigeratorSurroundElevation(null, refrigeratorTop, 0).mountBottom;
  const eligible = caps
    .filter((candidate) => (
      Math.abs(dim(candidate.width, 0) - 36) <= 0.01
      && Math.abs(dim(candidate.depth, 0) - REFRIGERATOR_CAP_DEPTH_IN) <= 0.01
      && dim(candidate.height, 0) > 0
      && mountBottom + dim(candidate.height, 0) <= ceilingIn + 0.01
    ))
    .map((candidate) => ({ candidate, top: mountBottom + dim(candidate.height, 0) }));
  eligible.sort((a, b) => (
    Math.abs(a.top - target) - Math.abs(b.top - target)
    || dim(a.candidate.height, 0) - dim(b.candidate.height, 0)
    || a.candidate.masterCode.localeCompare(b.candidate.masterCode)
  ));
  return eligible[0]?.candidate ?? null;
}

/**
 * Source catalogs use both orientations for refrigerator-panel dimensions:
 * REPV rows keep the thin face in `width` and installed depth in `depth`, while
 * sheet-panel rows such as S2496 keep the 24-in installed depth in `width` and
 * the 3/4-in face in `depth`. Four-anchor must retain the real selected SKU in
 * either representation rather than declaring its panel unavailable.
 */
function refrigeratorPanelDimensions(candidate: DesignCabinet): { thickness: number; installedDepth: number } | null {
  const sourceWidth = Math.max(0, dim(candidate.width, 0));
  const sourceDepth = Math.max(0, dim(candidate.depth, 0));
  const widthIsThinFace = sourceWidth > 0 && sourceWidth <= 3;
  const depthIsThinFace = sourceDepth > 0 && sourceDepth <= 3;

  if (widthIsThinFace && sourceDepth > 3) {
    return {
      thickness: refrigeratorEndPanelThickness(candidate.width, 0.75),
      installedDepth: sourceDepth,
    };
  }
  if (depthIsThinFace && sourceWidth > 3) {
    return {
      thickness: refrigeratorEndPanelThickness(candidate.depth, 0.75),
      installedDepth: sourceWidth,
    };
  }
  return null;
}

/**
 * Four-anchor always creates a complete refrigerator bay before surrounding
 * straight runs are tiled: a 36-in appliance, both source-priced end panels,
 * and one matching 36-in source-priced refrigerator cabinet above. A filler is
 * never a refrigerator-bay member.
 */
export function buildMandatoryFourAnchorRefrigeratorBay({
  refrigerator,
  room,
  caps,
  endPanels,
  styleId,
  makeUid,
  wallCabinetHeightIn = 30,
}: Input): FourAnchorRefrigeratorBayResult {
  if (Math.abs(refrigerator.width - 36) > 0.01) {
    return { ok: false, message: "Four-anchor refrigerator bays require the 36-inch refrigerator and matching 36-inch cabinet above." };
  }

  const ceilingIn = Math.max(0, Number(room.ceilingHeight) || 96);
  const cap = pickFourAnchorRefrigeratorCap(caps, refrigerator.height ?? 70, wallCabinetHeightIn, ceilingIn);
  if (!cap) {
    return { ok: false, message: "No source-priced 36-inch-wide, 24-inch-deep refrigerator cabinet above is available for the selected cabinet line. A refrigerator with panels needs the 24-inch-deep box, so Four-anchor did not substitute a 12-inch-deep wall cabinet." };
  }
  const panelEntry = endPanels
    .map((candidate) => ({ candidate, dimensions: refrigeratorPanelDimensions(candidate) }))
    .find((entry): entry is { candidate: DesignCabinet; dimensions: { thickness: number; installedDepth: number } } => entry.dimensions !== null);
  if (!panelEntry) {
    return { ok: false, message: "No source-priced refrigerator end panel is available for the selected cabinet line." };
  }
  const { candidate: panel, dimensions: panelDimensions } = panelEntry;

  const bay = refrigeratorBayRunMetrics(refrigerator, room);
  const panelThickness = panelDimensions.thickness;
  const panelDepth = panelDimensions.installedDepth;
  const capDepth = Math.max(0, dim(cap.depth, 0)) || 24;
  const capHeight = Math.max(0, dim(cap.height, 0)) || 24;
  const panelHeight = refrigeratorSurroundElevation(room, refrigerator.height ?? 70, capHeight).top;
  const capSpot = wallPlacementAt(bay.refrigeratorStart, 36, capDepth, bay.side, room);
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
    ...capSpot,
    width: 36,
    depth: capDepth,
    height: capHeight,
    rotation: capSpot.rotation,
    wallId: capSpot.wallId,
    wallOffset: capSpot.wallOffset,
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
  };
}
