import {
  cabinetWall,
  rotatedSize,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "@/lib/design";
import type { PhotorealSceneInput } from "@/components/design/PhotorealPreview";

const WALL_LABEL: Record<WallSide, string> = {
  top: "Back wall",
  bottom: "Front wall",
  left: "Left wall",
  right: "Right wall",
};

/** Round inches to feet with one decimal, e.g. 96 -> "8ft". */
function feet(inches: number): string {
  const ft = inches / 12;
  const rounded = Math.round(ft * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}ft` : `${rounded}ft`;
}

/** True when a placed item is a real appliance/fixture rather than a cabinet. */
function isAppliance(p: PlacedCabinet): boolean {
  return p.placement === "appliance";
}

/** Human phrase describing which cabinet types sit on a wall. */
function describeRun(items: PlacedCabinet[]): string {
  const has = (pl: PlacedCabinet["placement"]) => items.some((p) => p.placement === pl);
  const parts: string[] = [];
  if (has("base")) parts.push("base cabinets");
  if (has("wall")) parts.push("wall cabinets");
  if (has("tall")) parts.push("a tall pantry/oven column");
  const kinds = parts.length > 0 ? parts.join(" and ") : "cabinetry";

  // Notable appliances/fixtures on this wall.
  const feature = wallFeatures(items);
  const featureClause = feature.length > 0 ? ` with ${feature.join(", ")}` : "";

  return `${kinds}${featureClause}`;
}

/** Appliance/fixture phrases detected on a set of items (deduped, ordered). */
function wallFeatures(items: PlacedCabinet[]): string[] {
  const codes = new Set(items.map((p) => p.masterCode.toUpperCase()));
  const feature: string[] = [];
  const any = (frag: string) => Array.from(codes).some((c) => c.includes(frag));
  if (any("SINK") || any("SB-") || items.some((p) => p.masterCode.toUpperCase().startsWith("SB")))
    feature.push("a sink");
  if (any("RANGE") || any("STOVE")) feature.push("a range");
  if (any("COOKTOP")) feature.push("a cooktop");
  if (any("FRIDGE")) feature.push("a refrigerator");
  if (any("DW-") || any("DISHWASH")) feature.push("a dishwasher");
  if (any("HOOD")) feature.push("a range hood");
  if (any("MICRO")) feature.push("a microwave");
  if (any("WINE")) feature.push("a built-in wine cooler");
  return feature;
}

/**
 * Derive the overall cabinetry footprint from which walls carry runs (plus the
 * island flag). This is what keeps the render from drifting into a generic
 * L-shaped-kitchen-with-island.
 */
function deriveLayoutType(
  wallsWithCabinets: WallSide[],
  hasIsland: boolean
): PhotorealSceneInput["layoutType"] {
  const n = wallsWithCabinets.length;
  if (n <= 1) return hasIsland ? "peninsula" : "one-wall";
  if (n === 2) {
    const [a, b] = wallsWithCabinets;
    const opposite =
      (a === "top" && b === "bottom") ||
      (a === "bottom" && b === "top") ||
      (a === "left" && b === "right") ||
      (a === "right" && b === "left");
    return opposite ? "galley" : "L-shaped";
  }
  if (n === 3) return "U-shaped";
  return "multi-wall";
}

/**
 * Turns the live kitchen design into the input the `design.photorealPreview`
 * mutation expects. Returns null when there is nothing to render (no cabinets
 * placed), so the caller can short-circuit. Pure + deterministic for testing.
 */
export function buildPhotorealScene(args: {
  room: RoomData;
  placed: PlacedCabinet[];
  island?: { width: number; depth: number } | null;
  finishName?: string | null;
  doorStyle?: string | null;
  countertop?: string | null;
  hardware?: string | null;
  flooring?: string | null;
  backsplash?: string | null;
  sink?: string | null;
  faucet?: string | null;
}): PhotorealSceneInput | null {
  const cabinets = args.placed.filter((p) => !isAppliance(p));
  if (cabinets.length === 0) return null;

  const clampFt = (inches: number) => Math.max(1, Math.min(60, Math.round((inches / 12) * 10) / 10));
  const hasIsland = !!args.island;

  // Group everything (cabinets + appliances) by the wall it sits on so the
  // render matches the layout the user built.
  const byWall = new Map<WallSide, PlacedCabinet[]>();
  for (const p of args.placed) {
    const side = cabinetWall(p, args.room);
    const arr = byWall.get(side) ?? [];
    arr.push(p);
    byWall.set(side, arr);
  }

  const order: WallSide[] = ["top", "bottom", "left", "right"];
  const wallSummaries: string[] = [];
  const cabinetWalls: string[] = [];
  const wallsWithCabinets: WallSide[] = [];
  for (const side of order) {
    const items = byWall.get(side);
    if (!items || items.length === 0) continue;
    // Only summarize walls that actually carry cabinetry.
    const cabsOnWall = items.filter((p) => !isAppliance(p));
    if (cabsOnWall.length === 0) continue;
    wallsWithCabinets.push(side);
    cabinetWalls.push(WALL_LABEL[side]);
    const runIn = cabsOnWall.reduce((s, p) => s + rotatedSize(p).w, 0);
    wallSummaries.push(`${WALL_LABEL[side]}: ${feet(runIn)} run of ${describeRun(items)}`);
  }

  // Aggregate the appliances/fixtures actually present across ALL walls so the
  // render doesn't invent extras (e.g. a dishwasher that was never placed).
  const appliances = wallFeatures(args.placed);

  const layoutType = deriveLayoutType(wallsWithCabinets, hasIsland);

  const ceilingFt =
    typeof args.room.ceilingHeight === "number"
      ? Math.max(6, Math.min(20, Math.round((args.room.ceilingHeight / 12) * 10) / 10))
      : undefined;

  return {
    roomWidthFt: clampFt(args.room.width),
    roomDepthFt: clampFt(args.room.depth),
    ceilingFt,
    finishName: args.finishName?.trim() || undefined,
    doorStyle: args.doorStyle?.trim() || undefined,
    countertop: args.countertop?.trim() || undefined,
    hardware: args.hardware?.trim() || undefined,
    flooring: args.flooring?.trim() || undefined,
    backsplash: args.backsplash?.trim() || undefined,
    sink: args.sink?.trim() || undefined,
    faucet: args.faucet?.trim() || undefined,
    wallSummaries: wallSummaries.length > 0 ? wallSummaries.slice(0, 8) : undefined,
    cabinetWalls: cabinetWalls.length > 0 ? cabinetWalls : undefined,
    appliances: appliances.length > 0 ? appliances : undefined,
    layoutType,
    hasIsland,
  };
}
