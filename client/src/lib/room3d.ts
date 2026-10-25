// ─── Geometry-based 3D room model ────────────────────────────────────────────
// Pure, WebGL-free module: turns a kitchen design (room footprint + placed
// cabinets + surface picks + finish) into a flat list of axis-aligned 3D boxes
// in a right-handed, inches-based world:
//   x → room width  (0 .. room.width)
//   y → height off the floor (0 = floor, up = +y)
//   z → room depth  (0 .. room.depth)
// The plan/canvas uses x (across) and y (down) for the FLOOR footprint, so a
// plan cabinet at (px, py) with (pw × pd) maps to world x=px, z=py, footprint
// pw × pd. This module is deterministic and unit-testable; the React component
// (Room3DView) consumes Box3D[] and builds three.js meshes from it.

import {
  STD,
  placedHeight,
  standardHeight,
  WALL_MOUNT_BOTTOM,
  roomCeiling,
  finishColors,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import { surfaceRole, type SurfaceRole } from "./pelican";

export type Box3DKind =
  | "floor"
  | "wall-structure"
  | "base-cabinet"
  | "wall-cabinet"
  | "tall-cabinet"
  | "appliance"
  | "countertop"
  | "backsplash"
  | "sink";

export type Box3D = {
  /** Stable id (cabinet uid or a synthetic key) — handy for React keys / tests. */
  id: string;
  kind: Box3DKind;
  /** Center position in world inches. */
  center: [number, number, number];
  /** Full size in world inches (x, y, z). */
  size: [number, number, number];
  /** Hex fill color. */
  color: string;
  /** Optional darker edge/line color for definition. */
  edge?: string;
  /** 0..1 opacity (walls are semi-transparent so you can see inside). */
  opacity?: number;
};

/** A minimal surface-pick shape (matches SelectedSurface). */
export type SurfacePickLike = {
  name?: string | null;
  category?: string | null;
  subCategory?: string | null;
};

export type SurfaceColors = {
  floor: string;
  counter: string;
  backsplash: string;
};

// Sensible neutral defaults when a design hasn't picked a Pelican surface yet.
export const DEFAULT_SURFACE_COLORS: SurfaceColors = {
  floor: "#b89778", // warm wood-toned floor
  counter: "#e9e7e2", // light quartz
  backsplash: "#d9d5cc", // soft stone tile
};

// A small deterministic palette keyed off a surface's name, so two different
// picks read as visibly different materials without needing real textures.
const SURFACE_SWATCHES: { match: RegExp; color: string }[] = [
  { match: /white|snow|arctic|alpine|pearl|frost|cotton|carrara|calacatta/i, color: "#eeece7" },
  { match: /grey|gray|slate|pewter|stone|ash|fog|nickel|concrete|cement/i, color: "#b7b8b6" },
  { match: /black|onyx|carbon|obsidian|jet|charcoal|midnight/i, color: "#3a3a3d" },
  { match: /navy|blue|ocean|cobalt|indigo|denim/i, color: "#4a5f78" },
  { match: /green|sage|forest|olive|emerald/i, color: "#6a7d6a" },
  { match: /walnut|espresso|mocha|coffee|java|chocolate|brown/i, color: "#6b4a32" },
  { match: /oak|honey|maple|natural|golden|amber|acorn|hickory|pecan|wheat/i, color: "#c08a4e" },
  { match: /beige|cream|almond|sand|tan|linen|greige|taupe/i, color: "#d8cbb2" },
  { match: /marble|quartz|granite|stone/i, color: "#e6e4df" },
];

function swatchFor(name: string | null | undefined, fallback: string): string {
  if (!name) return fallback;
  for (const s of SURFACE_SWATCHES) if (s.match.test(name)) return s.color;
  return fallback;
}

/**
 * Resolve the floor / countertop / backsplash colors from the selected Pelican
 * surface picks. Unmatched roles fall back to the neutral defaults.
 */
export function surfaceColorsFromPicks(picks: SurfacePickLike[] | null | undefined): SurfaceColors {
  const out: SurfaceColors = { ...DEFAULT_SURFACE_COLORS };
  if (!Array.isArray(picks)) return out;
  for (const p of picks) {
    const role: SurfaceRole = surfaceRole(p);
    if (role === "flooring") out.floor = swatchFor(p.name, out.floor);
    else if (role === "countertop") out.counter = swatchFor(p.name, out.counter);
    else if (role === "backsplash") out.backsplash = swatchFor(p.name, out.backsplash);
  }
  return out;
}

/** True when any selected surface resolves to a sink. */
export function hasSinkPick(picks: SurfacePickLike[] | null | undefined): boolean {
  if (!Array.isArray(picks)) return false;
  return picks.some((p) => surfaceRole(p) === "sink");
}

const WALL_THICKNESS = 4; // structural wall thickness (inches), drawn for depth

// Resolve a cabinet's footprint depth by placement bucket, honoring an explicit
// depth when present.
function footprintDepth(c: PlacedCabinet): number {
  if (typeof c.depth === "number" && c.depth > 0) return c.depth;
  if (c.placement === "wall") return STD.WALL_DEPTH;
  if (c.placement === "tall") return STD.TALL_DEPTH;
  return STD.BASE_DEPTH;
}

// The vertical bottom (inches off floor) for a placed cabinet.
function boxBottom(c: PlacedCabinet): number {
  if (c.placement === "wall") {
    return typeof c.mountBottom === "number" && c.mountBottom > 0
      ? c.mountBottom
      : WALL_MOUNT_BOTTOM;
  }
  return 0; // base / tall / appliance stand on the floor
}

function kindFor(c: PlacedCabinet): Box3DKind {
  if (c.placement === "wall") return "wall-cabinet";
  if (c.placement === "tall") return "tall-cabinet";
  if (c.placement === "appliance") return "appliance";
  return "base-cabinet";
}

/**
 * Build the full list of 3D boxes for a design. Order is floor → walls →
 * cabinets → countertops → backsplash → sink, which is also a reasonable draw
 * order. All math is in inches; the renderer scales to feet for the camera.
 */
export function buildRoomBoxes(params: {
  room: RoomData;
  placed: PlacedCabinet[];
  surfaces?: SurfacePickLike[] | null;
  /** Combined finish/door-style text used to color the cabinet boxes. */
  finishText?: string | null;
  secondFinishText?: string | null;
}): Box3D[] {
  const { room, placed, surfaces, finishText, secondFinishText } = params;
  const W = Math.max(1, room?.width ?? 144);
  const D = Math.max(1, room?.depth ?? 120);
  const ceiling = roomCeiling(room ?? undefined);
  const colors = surfaceColorsFromPicks(surfaces);
  const finish = finishColors(finishText, secondFinishText);
  const boxes: Box3D[] = [];

  // Floor slab (thin), colored by the flooring pick.
  boxes.push({
    id: "floor",
    kind: "floor",
    center: [W / 2, -0.5, D / 2],
    size: [W, 1, D],
    color: colors.floor,
    edge: "#00000022",
    opacity: 1,
  });

  // Four perimeter walls. Back (z=0) and left (x=0) walls are drawn solid-ish;
  // the near walls are kept faint so the camera can see inside the room.
  const wallColor = "#efece6";
  const wallEdge = "#d8d2c7";
  const mkWall = (id: string, center: [number, number, number], size: [number, number, number], opacity: number) => {
    boxes.push({ id, kind: "wall-structure", center, size, color: wallColor, edge: wallEdge, opacity });
  };
  // Back wall (far, z = 0)
  mkWall("wall-back", [W / 2, ceiling / 2, -WALL_THICKNESS / 2], [W, ceiling, WALL_THICKNESS], 1);
  // Left wall (x = 0)
  mkWall("wall-left", [-WALL_THICKNESS / 2, ceiling / 2, D / 2], [WALL_THICKNESS, ceiling, D], 1);
  // Right wall (x = W) — faint
  mkWall("wall-right", [W + WALL_THICKNESS / 2, ceiling / 2, D / 2], [WALL_THICKNESS, ceiling, D], 0.15);
  // Front wall (near, z = D) — faint
  mkWall("wall-front", [W / 2, ceiling / 2, D + WALL_THICKNESS / 2], [W, ceiling, WALL_THICKNESS], 0.15);

  // Cabinet + appliance boxes.
  const baseTops: { x0: number; x1: number; z0: number; z1: number }[] = [];
  for (const c of placed) {
    const w = Math.max(1, c.width || 0);
    const d = Math.max(1, footprintDepth(c));
    const h = Math.max(1, placedHeight(c) || standardHeight(c.placement));
    const bottom = boxBottom(c);
    // Plan (x, y) is the cabinet's top-left corner in the floor footprint.
    const cx = (c.x ?? 0) + w / 2;
    const cz = (c.y ?? 0) + d / 2;
    const kind = kindFor(c);
    const isAppliance = kind === "appliance";
    boxes.push({
      id: c.uid,
      kind,
      center: [cx, bottom + h / 2, cz],
      size: [w, h, d],
      color: isAppliance ? "#c9ccd1" : finish.face,
      edge: isAppliance ? "#9aa0a6" : finish.edge,
      opacity: 1,
    });
    // Track base runs so we can lay a countertop on top of them.
    if (kind === "base-cabinet") {
      baseTops.push({ x0: c.x ?? 0, x1: (c.x ?? 0) + w, z0: c.y ?? 0, z1: (c.y ?? 0) + d });
    }
  }

  // Countertops: a slab sitting on each base cabinet footprint at counter
  // height, colored by the countertop pick.
  for (let i = 0; i < baseTops.length; i++) {
    const b = baseTops[i];
    const w = b.x1 - b.x0;
    const d = b.z1 - b.z0;
    boxes.push({
      id: `counter-${i}`,
      kind: "countertop",
      center: [b.x0 + w / 2, STD.COUNTERTOP_HEIGHT + STD.COUNTERTOP_THICKNESS / 2, b.z0 + d / 2],
      size: [w, STD.COUNTERTOP_THICKNESS, d],
      color: colors.counter,
      edge: "#00000018",
      opacity: 1,
    });
  }

  // Backsplash: a thin strip on the back wall spanning any base run that touches
  // the back wall, from counter height up to the bottom of the wall cabinets.
  const backRun = baseTops.filter((b) => b.z0 <= STD.BASE_DEPTH + 1);
  if (backRun.length > 0) {
    const x0 = Math.min(...backRun.map((b) => b.x0));
    const x1 = Math.max(...backRun.map((b) => b.x1));
    const top = WALL_MOUNT_BOTTOM;
    const bottom = STD.COUNTERTOP_HEIGHT;
    const height = Math.max(1, top - bottom);
    boxes.push({
      id: "backsplash",
      kind: "backsplash",
      center: [(x0 + x1) / 2, bottom + height / 2, 1.5],
      size: [x1 - x0, height, 1],
      color: colors.backsplash,
      edge: "#00000012",
      opacity: 1,
    });
  }

  // Sink: a shallow basin recessed into the front-center of the longest base
  // run, only when a sink surface is selected.
  if (hasSinkPick(surfaces) && baseTops.length > 0) {
    const longest = baseTops.reduce((a, b) => (b.x1 - b.x0 > a.x1 - a.x0 ? b : a), baseTops[0]);
    const w = longest.x1 - longest.x0;
    const d = longest.z1 - longest.z0;
    const basinW = Math.min(30, Math.max(18, w * 0.5));
    const basinD = Math.min(18, Math.max(12, d * 0.6));
    boxes.push({
      id: "sink",
      kind: "sink",
      center: [
        longest.x0 + w / 2,
        STD.COUNTERTOP_HEIGHT - 2,
        longest.z0 + d / 2,
      ],
      size: [basinW, 6, basinD],
      color: "#8f9499",
      edge: "#5f646a",
      opacity: 1,
    });
  }

  return boxes;
}
