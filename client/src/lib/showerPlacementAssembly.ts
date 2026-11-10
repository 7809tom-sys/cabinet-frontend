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
