import { FURNITURE_CATALOG, furnitureFootprint, makeFurniture, type PlacedFurniture, type RoomData } from "./design";
import { verifiedPelicanBathroomFixtureProfile } from "./pelicanBathroomFixtureProfiles";
import { findShowerBays, type ShowerBay } from "./showerPlacement";
import type { ShowerWall } from "./showerBuilder";

/**
 * Places the shower the wizard assembles, in the order the wizard asks for it.
 *
 * The rules, in the owner's words:
 *  1. The surround goes on the chosen wall with its LONG side against that wall -
 *     the back panel spans the wall and the two end panels run into the room.
 *  2. The pan goes INSIDE the surround, sized and snapped to it, and warns when the
 *     sizes do not match.
 *  3. Heads and faucets go on the chosen wall at standard heights (valve ~48",
 *     head ~80"), adjustable by the user.
 *  4. Niches and soap trays go on the chosen wall at a height the user picks.
 *  5. The glass door goes on the OPEN side, between the side panels, on the pan's
 *     front edge.
 *
 * Everything is a normal `PlacedFurniture`, so it appears in Floor Plan and 3D, obeys
 * the no-overlap rule, and reaches the cart through the same placed-fixture path as
 * every other bathroom fixture.
 */

/** A shower part that has been placed, with the geometry the next step needs. */
export type PlacedShowerPart = {
  furniture: PlacedFurniture;
  /** The alcove this part was built into. */
  bay: ShowerBay;
};

/** The opening the surround defines, once it is placed. */
export type ShowerOpening = {
  bay: ShowerBay;
  /** Interior span between the two end panels, inches. */
  insideWidthIn: number;
  /** Interior depth from the back wall to the front edge of the side panels. */
  insideDepthIn: number;
  /** Published panel height, inches. A wall fitting must fit under this. */
  panelHeightIn: number;
  /** Plan point of the back-left inside corner, for placing the parts that follow. */
  origin: { x: number; y: number };
};

const INCH = 1 / 12;

function definitionFor(pelicanCode: string) {
  const profile = verifiedPelicanBathroomFixtureProfile(pelicanCode);
  if (!profile) return null;
  const definition = FURNITURE_CATALOG.find((entry) => entry.id === profile.id);
  return definition ? { profile, definition } : null;
}

/**
 * Pick the bay for a chosen wall.
 *
 * The wizard asks for "the back wall, left wall or right wall". `findShowerBays`
 * walks the room clockwise from the top-left corner, so a rectangular room yields
 * top, right, bottom, left — indexing that list with `1` gives the RIGHT wall, not
 * the left one. Matching on the wall's own id keeps "Left wall" on the left wall
 * instead of putting the shower behind it.
 *
 * A room without a bay on the chosen side (a three-walled alcove has only three)
 * falls back to any bay, because refusing to place a shower the shopper just chose
 * is worse than seating it on the nearest wall that can hold one.
 */
export function bayForWall(room: RoomData, wall: ShowerWall): ShowerBay | null {
  const bays = findShowerBays(room);
  if (bays.length === 0) return null;
  const wanted = BAY_ID_FOR_WALL[wall];
  const match = bays.find((bay) => bay.id === wanted);
  if (match) return match;
  // Custom polygons name their walls themselves, so fall back in the same
  // top/right/bottom/left order the rectangle uses.
  const index = wall === "top" ? 0 : wall === "left" ? bays.length - 1 : 1;
  return bays[index] ?? bays[0] ?? null;
}

/** The rectangle room's own wall id for each wizard wall. */
const BAY_ID_FOR_WALL: Record<ShowerWall, string> = {
  top: "top",
  left: "left",
  right: "right",
};

/**
 * Lay a surround into its bay.
 *
 * The back panel spans the wall and the two end panels run into the room, so the
 * surround is centred across the bay with its long side flat against the wall.
 */
export function placeShowerSurround(pelicanCode: string, bay: ShowerBay): PlacedFurniture | null {
  const entry = definitionFor(pelicanCode);
  if (!entry || entry.profile.kind !== "shower-surround") return null;
  const { definition } = entry;
  const footprint = footprintInBay(definition, bay);

  // Centre the surround across the bay and put its back on the wall.
  const along = bay.spanIn / 2;
  const centre = {
    x: bay.start.x + bay.tangent.x * along + bay.inward.x * (footprint.across / 2),
    y: bay.start.y + bay.tangent.y * along + bay.inward.y * (footprint.across / 2),
  };
  const placed = makeFurniture(definition.id, 0, 0);
  return {
    ...placed,
    pelicanCode: entry.profile.pelicanCode,
    pelicanProductId: undefined,
    x: centre.x - footprint.w / 2,
    y: centre.y - footprint.d / 2,
    rotation: bay.rotation,
  };
}

/**
 * The bay a placed surround was seated in.
 *
 * The surround stores its rotation, and the room's bays each carry one, so the bay
 * that matches that rotation is the one it was built into.
 */
function findBayForPlaced(item: PlacedFurniture, room?: RoomData): ShowerBay | null {
  if (!room) return null;
  const bays = findShowerBays(room);
  if (bays.length === 0) return null;
  return bays.find((bay) => bay.rotation === (((item.rotation % 360) + 360) % 360)) ?? bays[0] ?? null;
}

/** Footprint of a definition once a bay has quarter-turned it. */
function footprintInBay(definition: { w: number; d: number }, bay: ShowerBay) {
  const quarter = ((bay.rotation % 360) + 360) % 360;
  const turned = quarter === 90 || quarter === 270
    ? { w: definition.d, d: definition.w }
    : { w: definition.w, d: definition.d };
  const alongX = Math.abs(bay.tangent.x) > Math.abs(bay.tangent.y);
  return {
    w: turned.w,
    d: turned.d,
    // Extent measured along the wall, and the depth measured away from it.
    along: alongX ? turned.w : turned.d,
    across: alongX ? turned.d : turned.w,
  };
}

/**
 * The interior opening a placed surround defines.
 *
 * A surround's published size IS its interior alcove: the back panel spans
 * `widthIn` and the side panels run `depthIn`. That is what the pan has to fit.
 */
export function openingForSurround(surround: PlacedFurniture, openingRoom: RoomData): ShowerOpening | null {
  const entry = definitionFor(surround.pelicanCode ?? "");
  if (!entry || entry.profile.kind !== "shower-surround") return null;
  const bay = findBayForPlaced(surround, openingRoom);
  if (!bay) return null;
  return {
    bay,
    insideWidthIn: entry.profile.widthIn,
    insideDepthIn: entry.profile.depthIn,
    panelHeightIn: entry.profile.heightIn,
    origin: { x: surround.x, y: surround.y },
  };
}

/**
 * Does a pan fit the opening the surround defines?
 *
 * The pan has to span the opening end to end. A pan narrower than the opening
 * leaves a gap; a wider one overruns the end panels. Either is a warning, never a
 * silent acceptance.
 */
export function panFitsOpening(
  panWidthIn: number,
  panDepthIn: number,
  opening: ShowerOpening,
): { ok: boolean; message: string | null } {
  const tolerance = 0.5;
  const spanGap = opening.insideWidthIn - panWidthIn;
  if (Math.abs(spanGap) > tolerance) {
    return {
      ok: false,
      message: spanGap > 0
        ? `The panels are ${round(opening.insideWidthIn)}″ wide but this pan is ${round(panWidthIn)}″, leaving a ${round(spanGap)}″ gap at the ends. Choose a pan that spans the opening, or resize the panels.`
        : `The panels are ${round(opening.insideWidthIn)}″ wide but this pan is ${round(panWidthIn)}″, so it overruns the end panels by ${round(-spanGap)}″.`,
    };
  }
  if (panDepthIn > opening.insideDepthIn + tolerance) {
    return {
      ok: false,
      message: `This pan is ${round(panDepthIn)}″ deep but the panels are only ${round(opening.insideDepthIn)}″ deep, so it will stick out past the front edge.`,
    };
  }
  return { ok: true, message: null };
}

/**
 * Lay a pan inside the surround's opening: centred across it, back against the wall.
 */
export function placeShowerPanInsideOpening(pelicanCode: string, opening: ShowerOpening): PlacedFurniture | null {
  const entry = definitionFor(pelicanCode);
  if (!entry || entry.profile.kind !== "shower-pan") return null;
  const bay = opening.bay;
  const footprint = footprintInBay(entry.definition, bay);
  const along = bay.spanIn / 2;
  const centre = {
    x: bay.start.x + bay.tangent.x * along + bay.inward.x * (footprint.across / 2),
    y: bay.start.y + bay.tangent.y * along + bay.inward.y * (footprint.across / 2),
  };
  const placed = makeFurniture(entry.definition.id, 0, 0);
  return {
    ...placed,
    pelicanCode: entry.profile.pelicanCode,
    x: centre.x - footprint.w / 2,
    y: centre.y - footprint.d / 2,
    rotation: bay.rotation,
  };
}

/** Standard mounting heights, inches above the pan floor. */
export const SHOWER_HEIGHTS = {
  valveIn: 48,
  headIn: 80,
  nicheDefaultIn: 44,
  doorCurbIn: 0,
} as const;

export type ShowerMountHeights = {
  /** Valve centre above the pan floor. */
  valveIn: number;
  /** Shower head centre above the pan floor. */
  headIn: number;
  /** Niche/soap tray centre above the pan floor. */
  nicheIn: number;
};

export const DEFAULT_SHOWER_MOUNT_HEIGHTS: ShowerMountHeights = {
  valveIn: SHOWER_HEIGHTS.valveIn,
  headIn: SHOWER_HEIGHTS.headIn,
  nicheIn: SHOWER_HEIGHTS.nicheDefaultIn,
};

/**
 * Mount a wall fitting on the chosen wall at a chosen height.
 *
 * The fitting sits against the wall it belongs to, which is why each step carries its
 * own wall: a head on the left wall is mounted along that wall, not the surround's.
 */
/**
 * Which of the surround's three panels a wall fitting goes on.
 *
 * The shopper chooses this in the wizard, and it is saved with the design. "back"
 * is the wet wall the valve normally goes on; "left" and "right" are the two side
 * panels. The choice is the part's own — a niche can sit on a different panel from
 * the valve.
 */
export type ShowerPanelSide = "back" | "left" | "right";

export const SHOWER_PANEL_SIDES: readonly ShowerPanelSide[] = ["back", "left", "right"] as const;

export const SHOWER_PANEL_LABELS: Record<ShowerPanelSide, string> = {
  back: "Back panel",
  left: "Left side panel",
  right: "Right side panel",
};

/**
 * Mount a wall fitting on the INSIDE face of one of the surround's panels.
 *
 * This is the fix for the valve, head and niche landing on the room wall OUTSIDE
 * the enclosure. The old code did `bayForWall(room, wall)`, which seats the part
 * against a bay of the *room*: a 60" room wall is not the shower's back panel, and
 * for a surround standing in a corner the part ended up on the room wall beside
 * the shower. Nothing tied the part to where the surround actually is.
 *
 * The panel geometry comes from the surround's own `ShowerOpening` — the bay it
 * was seated in, its rotation and its interior width/depth — so:
 *
 *   - the BACK panel is the wall face the surround's back is flat against,
 *   - the LEFT and RIGHT panels are the two end panels, and
 *   - every mount sits `profile.depthIn / 2` inside the enclosure, on the inside
 *     face, centred along that panel.
 *
 * Because the position is derived from the opening rather than from a fresh room
 * lookup, the fitting inherits the surround's rotation exactly: moving the shower
 * moves the surround, and re-placing the fittings from the moved opening puts them
 * back on its panels.
 */
/**
 * The placement rotation that makes a fitting's opening face a point.
 *
 * A fitting is authored opening toward local -Z and recessed into +Z. The scene
 * turns a placement by `rotation` degrees in plan space (see
 * `bathroomFurnitureTransform`), so this returns the quarter turn whose -Z axis
 * points from the fitting toward `target`.
 *
 * Deriving it this way — instead of assuming which way each panel turns — is what
 * keeps the left panel from opening out through its own wall.
 */
export function rotationFacingShower(
  from: { x: number; y: number },
  target: { x: number; y: number },
): 0 | 90 | 180 | 270 {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  // Plan +Y is "into the room" from the back wall, and the scene's Y rotation maps
  // local -Z to (-sin r, -cos r) in plan space for rotation r degrees.
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 90 : 270;
  return dy >= 0 ? 180 : 0;
}

export function placeWallFittingOnPanel(
  pelicanCode: string,
  side: ShowerPanelSide,
  opening: ShowerOpening,
  heightIn: number,
): PlacedFurniture | null {
  const entry = definitionFor(pelicanCode);
  if (!entry) return null;
  const bay = opening.bay;
  const footprint = footprintInBay(entry.definition, bay);

  // Work in the BAY's frame: `tangent` runs along the back panel, `inward` points
  // into the room from it.
  const halfWidth = opening.insideWidthIn / 2;
  const halfDepth = opening.insideDepthIn / 2;

  // The middle of the shower floor: half the opening inward from the back panel.
  const showerCentre = {
    x: bay.start.x + bay.tangent.x * (bay.spanIn / 2) + bay.inward.x * halfDepth,
    y: bay.start.y + bay.tangent.y * (bay.spanIn / 2) + bay.inward.y * halfDepth,
  };

  // Start at the middle of the back panel, on its inside face.
  const backCentre = {
    x: bay.start.x + bay.tangent.x * (bay.spanIn / 2) + bay.inward.x * (footprint.across / 2),
    y: bay.start.y + bay.tangent.y * (bay.spanIn / 2) + bay.inward.y * (footprint.across / 2),
  };

  let centre = backCentre;
  if (side === "back") {
    // Centred across the back panel, half the fitting's depth inside the enclosure
    // so its face sits ON the panel's inside face.
    centre = backCentre;
  } else {
    // A side panel runs along `inward` from the back panel. The fitting sits half
    // its depth in from that end panel, and half the opening back from the front,
    // so it is centred on the panel and inside the enclosure.
    // "Inside the enclosure" means moving INWARD from the chosen side panel:
    // rightwards from the left panel, leftwards from the right one. Getting this
    // sign backwards put the fitting outside the surround, through the wall.
    const sign = side === "left" ? 1 : -1;
    const alongPanel = halfDepth;         // centred front-to-back on the side panel
    const inFromSide = footprint.across / 2;
    centre = {
      x: bay.start.x
        + bay.tangent.x * (bay.spanIn / 2 + sign * (halfWidth - inFromSide))
        + bay.inward.x * alongPanel,
      y: bay.start.y
        + bay.tangent.y * (bay.spanIn / 2 + sign * (halfWidth - inFromSide))
        + bay.inward.y * alongPanel,
    };
  }

  // A NICHE must fit inside the panel it is mounted on: its top is
  // `mountHeightIn + height`, and that may never pass the panel's top edge, or it
  // sticks up above the shower walls (Tom's report).
  //
  // The clamp applies only to those recessed parts. A valve/head system is drawn
  // from its own internal geometry (valve at 48", head at 80") and its profile
  // `heightIn` is the full wet-wall stack, so clamping it would drag the whole
  // fitting down to the floor.
  const needsPanelClamp = entry.profile.kind === "shower-niche" || entry.profile.kind === "soap-tray";
  const mounted = needsPanelClamp
    ? clampWallFittingMountHeight(clampHeight(heightIn), entry.profile.heightIn, surroundPanelHeightIn(opening), 0)
    : clampHeight(heightIn);

  const placed = makeFurniture(entry.definition.id, 0, 0);
  return {
    ...placed,
    pelicanCode: entry.profile.pelicanCode,
    x: centre.x - footprint.w / 2,
    y: centre.y - footprint.d / 2,
    // A fitting is authored opening toward local -Z, with its recess running into
    // +Z. Its placement rotation must therefore turn that -Z axis to point from
    // the fitting toward the inside of the shower.
    //
    // This is DERIVED from the geometry rather than reasoned about as a sign: the
    // left panel used to take the same +90 turn as the right, which pointed its
    // recess through the wall onto the exterior face and left the niche sticking
    // out of the outside of the shower.
    rotation: rotationFacingShower(centre, showerCentre),
    mountHeightIn: mounted,
  };
}

/**
 * The highest a wall fitting may be mounted so it still fits inside its panel.
 *
 * Tom's rule: a niche must never stick up above the shower walls. The top of the
 * part is `mountHeightIn + height`, and the surround panel's top is the published
 * panel height, so the mount is capped at `panelHeight - height`. A niche taller
 * than the panel cannot fit at all: it is capped at the panel height (top flush
 * with the panel) and its bottom is kept at or above the pan, so it is still
 * visible inside the enclosure rather than buried in the floor.
 */
/** The panel height of the surround an opening belongs to. */
export function surroundPanelHeightIn(opening: ShowerOpening): number {
  return Math.max(0, opening.panelHeightIn ?? 0);
}

export function clampWallFittingMountHeight(
  requestedHeightIn: number,
  partHeightIn: number,
  panelHeightIn: number,
  panLevelIn = 0,
): number {
  const requested = Number.isFinite(requestedHeightIn) ? requestedHeightIn : 0;
  const part = Math.max(0, Number.isFinite(partHeightIn) ? partHeightIn : 0);
  const panel = Math.max(0, Number.isFinite(panelHeightIn) ? panelHeightIn : 0);
  const pan = Math.max(0, Number.isFinite(panLevelIn) ? panLevelIn : 0);
  // The lowest a part may sit is the pan level, so it is never below the shower floor.
  const lowest = pan;
  if (part >= panel) {
    // Taller than the panel: the top goes flush with the panel, and the bottom
    // stays at the pan, which is the only placement that keeps it inside the walls.
    return Math.max(lowest, panel - part);
  }
  const highest = panel - part;
  return Math.min(Math.max(requested, lowest), highest);
}

export function placeWallFitting(
  pelicanCode: string,
  wall: ShowerWall,
  room: RoomData,
  heightIn: number,
): PlacedFurniture | null {
  const entry = definitionFor(pelicanCode);
  if (!entry) return null;
  const bay = bayForWall(room, wall);
  if (!bay) return null;
  const footprint = footprintInBay(entry.definition, bay);
  // Centred across the wall it is mounted on, hard against that wall.
  const along = bay.spanIn / 2;
  const centre = {
    x: bay.start.x + bay.tangent.x * along + bay.inward.x * (footprint.across / 2),
    y: bay.start.y + bay.tangent.y * along + bay.inward.y * (footprint.across / 2),
  };
  const placed = makeFurniture(entry.definition.id, 0, 0);
  return {
    ...placed,
    pelicanCode: entry.profile.pelicanCode,
    x: centre.x - footprint.w / 2,
    y: centre.y - footprint.d / 2,
    rotation: bay.rotation,
    mountHeightIn: clampHeight(heightIn),
  };
}

/**
 * Hang the glass door on the shower's OPEN side, between the side panels, on the
 * pan's front edge. It is centred on the opening and stands on the curb line.
 */
export function placeShowerDoor(pelicanCode: string, opening: ShowerOpening): PlacedFurniture | null {
  const entry = definitionFor(pelicanCode);
  if (!entry) return null;
  const bay = opening.bay;
  const footprint = footprintInBay(entry.definition, bay);
  // The door sits at the FRONT of the opening: half the opening depth in from the wall,
  // then its own depth forward onto the pan's curb.
  const along = bay.spanIn / 2;
  const across = opening.insideDepthIn - footprint.across / 2;
  const centre = {
    x: bay.start.x + bay.tangent.x * along + bay.inward.x * across,
    y: bay.start.y + bay.tangent.y * along + bay.inward.y * across,
  };
  const placed = makeFurniture(entry.definition.id, 0, 0);
  return {
    ...placed,
    pelicanCode: entry.profile.pelicanCode,
    x: centre.x - footprint.w / 2,
    y: centre.y - footprint.d / 2,
    rotation: bay.rotation,
  };
}

function clampHeight(heightIn: number): number {
  if (!Number.isFinite(heightIn)) return SHOWER_HEIGHTS.valveIn;
  return Math.max(0, Math.min(120, Math.round(heightIn * 100) / 100));
}

function round(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** The standard heights a fitting may use, exposed so the UI can clamp its input. */
export function clampShowerHeight(heightIn: number): number {
  return clampHeight(heightIn);
}
