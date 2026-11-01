import { AUTO_DESIGN_WALL_LABELS, wallLabelToEngineWallId, type AutoBuildCatalogCandidate, type AutoDesignLayoutType, type AutoDesignOriginCorner, type AutoDesignRunDirection, type WallLabel } from "./autoDesignAutoBuild";
import { kitchenRuleNumber } from "./kitchenRuleParameters";
import { isBaseEndCornerCabinet, isBlindCorner, isCornerCabinet, isPlainBaseCode, type RoomData } from "./design";

/** A real room vertex that the admin may explicitly populate after all anchors are seated. */
export type AutoDesignCornerSlot = {
  id: string;
  label: string;
  firstWall: WallLabel;
  secondWall: WallLabel;
};

/** An explicit source-priced selection: null is incomplete and cannot confirm a required corner. */
export type AutoDesignCornerChoice = {
  cabinetId: number | null;
  /** Required only when the chosen SKU is a configured base blind corner. */
  blindPullIn?: number;
};

/** The catalog fields needed for an accurate base-corner choice. */
export type AutoBuildCornerCandidate = AutoBuildCatalogCandidate & {
  id: number;
  width?: string | null;
  height?: string | null;
  depth?: string | null;
  cornerType?: string | null;
  pullMin?: number | null;
  pullMax?: number | null;
};

export type AutoDesignCornerMeasurement = {
  wallIds: readonly string[];
  room: RoomData;
  originCorner: AutoDesignOriginCorner;
  runDirection: AutoDesignRunDirection;
};

/**
 * Corner cabinets belong only where two kitchen runs meet.
 *
 * A U-shape cabinets Wall 1, Wall 2, and Wall 3. When the room also has a real
 * Wall 4 (a closed four-wall plan), that wall is part of the same kitchen: it
 * gets a continuous run and a corner cabinet at each end where it meets Wall 1
 * and Wall 3. An open three-wall U has no Wall 4, so it still has only the two
 * corners its walls actually share. Wall 5 and Wall 6 stay out of a U.
 *
 * An L-shape has the single back-to-side corner. A galley is two opposite
 * straight runs and a one-wall kitchen is one straight run. Neither has a
 * corner, even when the measured walls happen to share a room vertex.
 */
export function autoDesignCornerSlots(layoutType: AutoDesignLayoutType, measured?: AutoDesignCornerMeasurement): AutoDesignCornerSlot[] {
  const slots: AutoDesignCornerSlot[] = [];
  const add = (firstWall: WallLabel, secondWall: WallLabel) => {
    const ordered = AUTO_DESIGN_WALL_LABELS.indexOf(firstWall) <= AUTO_DESIGN_WALL_LABELS.indexOf(secondWall)
      ? [firstWall, secondWall] as const
      : [secondWall, firstWall] as const;
    const id = `${ordered[0]}-${ordered[1]}`.toLowerCase().replaceAll(" ", "-");
    if (!slots.some((slot) => slot.id === id)) {
      slots.push({ id, label: `Corner between ${ordered[0]} and ${ordered[1]}`, firstWall: ordered[0], secondWall: ordered[1] });
    }
  };
  // Galley and one-wall never grow a corner slot. The generic branch below
  // used to add one for any two selected walls that share a vertex, which
  // seated a blind corner between Wall 1 and Wall 2 on a galley.
  if (layoutType === "galley" || layoutType === "single-wall") return slots;
  if (layoutType === "l-shape") {
    if (!measured || wallsShareVertex("Wall 1", "Wall 2", measured)) add("Wall 1", "Wall 2");
    return slots;
  }
  if (layoutType === "u-shape") {
    const pairs = measured ? uShapeCornerPairs(measured) : [["Wall 1", "Wall 2"], ["Wall 2", "Wall 3"]] as const;
    // An open U is capped at its two real corners. A closed room's Wall 4 adds
    // two more real corners; a saved cap of 2 must not drop them.
    const closedFourthWall = measured != null && uShapeHasWall4(measured);
    const limit = closedFourthWall ? pairs.length : Math.max(0, kitchenRuleNumber("u_shape_corner_count"));
    for (const [firstWall, secondWall] of pairs.slice(0, limit)) add(firstWall, secondWall);
    return slots;
  }
  if (!measured) return slots;
  const occupied = AUTO_DESIGN_WALL_LABELS.filter((label) => {
    const ref = wallLabelToEngineWallId(label, measured.room, measured.originCorner, measured.runDirection);
    return ref != null && measured.wallIds.includes(ref.engineWallId);
  });
  for (let first = 0; first < occupied.length; first++) {
    for (let second = first + 1; second < occupied.length; second++) {
      if (wallsShareVertex(occupied[first]!, occupied[second]!, measured)) add(occupied[first]!, occupied[second]!);
    }
  }
  return slots;
}

/** The message shown when a real L or U corner was left without a corner cabinet. */
export function autoDesignMissingCornerMessage(slot: AutoDesignCornerSlot): string {
  return `A corner cabinet is required at every Auto-Design L/U corner. Choose a source-priced corner for ${slot.label} before filling the remaining runs.`;
}

/**
 * Warnings for real corners that still have no cabinet. A finished U-shape
 * (its two back corners chosen) returns none. An empty real L or U corner
 * still warns. Open ends are not slots, so they cannot produce a warning.
 */
export function autoDesignMissingCornerWarnings(
  slots: readonly AutoDesignCornerSlot[],
  choices: Readonly<Record<string, { cabinetId: number | null } | undefined>>,
): string[] {
  return slots
    .filter((slot) => (choices[slot.id]?.cabinetId ?? null) == null)
    .map((slot) => autoDesignMissingCornerMessage(slot));
}

function wallsShareVertex(firstWall: WallLabel, secondWall: WallLabel, measured: AutoDesignCornerMeasurement): boolean {
  return autoDesignCornerSlotPoint(
    { id: "", label: "", firstWall, secondWall },
    measured.room,
    measured.originCorner,
    measured.runDirection,
  ) != null;
}

/** Walls a U-shape always cabinets. Wall 4 is added when that wall exists. */
export const AUTO_DESIGN_U_SHAPE_WALLS = ["Wall 1", "Wall 2", "Wall 3"] as const satisfies readonly WallLabel[];

/** A galley cabinets the two opposite runs: Wall 1 and Wall 3. */
export const AUTO_DESIGN_GALLEY_WALLS = ["Wall 1", "Wall 3"] as const satisfies readonly WallLabel[];

export function autoDesignSelectableWallLabels(layoutType: AutoDesignLayoutType, wallCount: number): WallLabel[] {
  const available = AUTO_DESIGN_WALL_LABELS.slice(0, Math.max(1, Math.min(AUTO_DESIGN_WALL_LABELS.length, wallCount)));
  if (layoutType === "galley") return available.filter((label) => (AUTO_DESIGN_GALLEY_WALLS as readonly string[]).includes(label));
  if (layoutType === "u-shape") return available.filter((label) => label === "Wall 1" || label === "Wall 2" || label === "Wall 3");
  return [...available];
}

export function autoDesignLayoutUsesWall(layoutType: AutoDesignLayoutType, label: WallLabel): boolean {
  if (layoutType === "galley") return (AUTO_DESIGN_GALLEY_WALLS as readonly string[]).includes(label);
  if (layoutType !== "u-shape") return true;
  return (AUTO_DESIGN_U_SHAPE_WALLS as readonly string[]).includes(label) || label === "Wall 4";
}

function uShapeHasWall4(measured: AutoDesignCornerMeasurement): boolean {
  return wallLabelToEngineWallId("Wall 4", measured.room, measured.originCorner, measured.runDirection) != null;
}

/** Engine walls a U-shape must not receive any cabinet, filler, panel, or corner. */
export function autoDesignExcludedEngineWallIds(
  layoutType: AutoDesignLayoutType,
  room: RoomData,
  originCorner: AutoDesignOriginCorner,
  runDirection: AutoDesignRunDirection,
): string[] {
  if (layoutType !== "u-shape") return [];
  const measured = { wallIds: [], room, originCorner, runDirection };
  const excluded: string[] = [];
  for (const label of AUTO_DESIGN_WALL_LABELS) {
    if ((AUTO_DESIGN_U_SHAPE_WALLS as readonly string[]).includes(label)) continue;
    if (label === "Wall 4" && uShapeHasWall4(measured)) continue;
    const wall = wallLabelToEngineWallId(label, room, originCorner, runDirection);
    if (wall && !excluded.includes(wall.engineWallId)) excluded.push(wall.engineWallId);
  }
  return excluded;
}

/** Drops Wall 5+ from a U-shape. Wall 4 stays when the room actually has that wall. Other layouts keep every wall. */
export function autoDesignRunWallIds(input: {
  layoutType: AutoDesignLayoutType;
  room: RoomData;
  originCorner: AutoDesignOriginCorner;
  runDirection: AutoDesignRunDirection;
  wallIds: readonly string[];
}): string[] {
  const excluded = new Set(autoDesignExcludedEngineWallIds(input.layoutType, input.room, input.originCorner, input.runDirection));
  const kept: string[] = [];
  for (const wallId of input.wallIds) {
    if (excluded.has(wallId) || kept.includes(wallId)) continue;
    kept.push(wallId);
  }
  return kept;
}

/**
 * Real joins among the U's walls. Wall 4 is included only when the room has it,
 * which adds the two corners at the ends of that wall.
 */
function uShapeCornerPairs(measured: AutoDesignCornerMeasurement): Array<[WallLabel, WallLabel]> {
  const walls: WallLabel[] = [...AUTO_DESIGN_U_SHAPE_WALLS];
  if (uShapeHasWall4(measured)) walls.push("Wall 4");
  const pairs: Array<[WallLabel, WallLabel]> = [];
  for (let first = 0; first < walls.length; first++) {
    for (let second = first + 1; second < walls.length; second++) {
      if (wallsShareVertex(walls[first]!, walls[second]!, measured)) pairs.push([walls[first]!, walls[second]!]);
    }
  }
  return pairs;
}

/** Resolve the exact shared engine vertex for a selected wall-label pair. */
export function autoDesignCornerSlotPoint(
  slot: AutoDesignCornerSlot,
  room: RoomData,
  originCorner: AutoDesignOriginCorner,
  runDirection: AutoDesignRunDirection,
): { x: number; y: number; firstWallId: string } | null {
  const first = wallLabelToEngineWallId(slot.firstWall, room, originCorner, runDirection);
  const second = wallLabelToEngineWallId(slot.secondWall, room, originCorner, runDirection);
  if (!first || !second) return null;
  const endpoints = [first.frame.start, first.frame.end];
  const shared = endpoints.find((point) => (
    Math.hypot(point.x - second.frame.start.x, point.y - second.frame.start.y) <= 0.01
    || Math.hypot(point.x - second.frame.end.x, point.y - second.frame.end.y) <= 0.01
  ));
  return shared ? { x: shared.x, y: shared.y, firstWallId: first.engineWallId } : null;
}

/**
 * The corner stage uses actual buyable base-corner catalog rows. A straight base,
 * sink base, wall corner, or BEC end-return cannot be offered or substituted.
 */
export function autoBuildCornerCatalog<T extends AutoBuildCornerCandidate>(catalog: readonly T[]): T[] {
  return catalog
    .filter((candidate) => (
      candidate.placement === "base"
      && candidate.isCornerCabinet !== false
      && isCornerCabinet(candidate.masterCode, candidate.description ?? undefined, candidate.cornerType ?? null)
      && !isBaseEndCornerCabinet({
        masterCode: candidate.masterCode,
        description: candidate.description ?? "",
        cornerType: candidate.cornerType ?? null,
      })
    ))
    .sort((left, right) => (Number.parseFloat(right.width ?? "0") || 0) - (Number.parseFloat(left.width ?? "0") || 0));
}

export function isAutoDesignBlindCornerOption(candidate: Pick<AutoBuildCornerCandidate, "masterCode" | "description" | "placement" | "cornerType">): boolean {
  return candidate.placement === "base"
    && isBlindCorner(candidate.masterCode, candidate.description ?? undefined, candidate.cornerType ?? null);
}

export type AutoDesignCornerFamily = "diagonal" | "lazy-susan" | "blind" | "other";

export function autoDesignCornerFamily(candidate: Pick<AutoBuildCornerCandidate, "masterCode" | "description" | "cornerType">): AutoDesignCornerFamily {
  // Family comes from the model code prefix and the stored cornerType only, never from words in the description:
  // a plain base (B42...) with "blind" or "corner" in its text is not a corner of any family.
  const code = (candidate.masterCode ?? "").toUpperCase();
  if (isPlainBaseCode(code)) return "other";
  if (candidate.cornerType === "diagonal" || candidate.cornerType === "pie-cut" || /^(?:DCB|DCW|WDC)/.test(code)) return "diagonal";
  if (candidate.cornerType === "lazy-susan" || candidate.cornerType === "easy-reach" || /^(?:LSB|LS|ERB|BER)/.test(code)) return "lazy-susan";
  if (candidate.cornerType === "blind-corner" || /^(?:BBC|WBC|BBL|BBR)/.test(code)) return "blind";
  return "other";
}

/** Diagonal when the line sells one. Otherwise the largest lazy Susan, then a blind corner. */
export function preferredAutoDesignCorner<T extends AutoBuildCornerCandidate>(options: readonly T[]): T | null {
  const diagonal = options.find((option) => autoDesignCornerFamily(option) === "diagonal");
  if (diagonal) return diagonal;
  const lazy = options
    .filter((option) => autoDesignCornerFamily(option) === "lazy-susan")
    .sort((left, right) => (Number.parseFloat(right.width ?? "0") || 0) - (Number.parseFloat(left.width ?? "0") || 0));
  if (lazy[0]) return lazy[0];
  return options.find((option) => autoDesignCornerFamily(option) === "blind") ?? options[0] ?? null;
}

export type LazySusanFit = {
  size: number | null;
  reducedFrom: number | null;
  usedShiftIn: number;
  fallback: boolean;
  note: string | null;
};

/**
 * Try the largest lazy Susan with no shift, then the same size with the
 * allowed appliance shifts, then the next smaller size. `fits(size, limit)`
 * is true when that size seats if appliances may move up to `limit` inches.
 */
/** Lazy Susan sizes descend from the chosen one, then diagonal, then blind, then any other true corner. */
export function autoDesignCornerAttempts<T extends AutoBuildCornerCandidate>(selected: T | undefined, options: readonly T[]): T[] {
  if (!selected) return [];
  const rest = options.filter((option) => option.id !== selected.id);
  const byFamily = (family: AutoDesignCornerFamily) => rest.filter((option) => autoDesignCornerFamily(option) === family);
  if (autoDesignCornerFamily(selected) !== "lazy-susan") {
    return [selected, ...byFamily("diagonal"), ...byFamily("lazy-susan"), ...byFamily("blind"), ...byFamily("other")];
  }
  const lazy = [selected, ...byFamily("lazy-susan")]
    .sort((left, right) => (Number.parseFloat(right.width ?? "0") || 0) - (Number.parseFloat(left.width ?? "0") || 0));
  const selectedWidth = Number.parseFloat(selected.width ?? "0") || 0;
  const descending = lazy.filter((option) => (Number.parseFloat(option.width ?? "0") || 0) <= selectedWidth + 1e-6);
  return [...descending, ...byFamily("diagonal"), ...byFamily("blind"), ...byFamily("other")];
}

export function chooseLazySusanSize(
  sizes: readonly number[],
  fits: (size: number, shiftLimitIn: number) => boolean,
  shiftLimitIn = 6,
): LazySusanFit {
  const available = Array.from(new Set(sizes.map((size) => Math.round(size * 8) / 8).filter((size) => size > 0)))
    .sort((left, right) => right - left);
  const largest = available[0] ?? null;
  for (const size of available) {
    const reducedFrom = largest != null && size < largest - 1e-6 ? largest : null;
    const note = reducedFrom != null ? `Lazy Susan reduced to ${size}" to fit` : null;
    if (fits(size, 0)) return { size, reducedFrom, usedShiftIn: 0, fallback: false, note };
    if (shiftLimitIn > 0 && fits(size, shiftLimitIn)) {
      return { size, reducedFrom, usedShiftIn: shiftLimitIn, fallback: false, note };
    }
  }
  return { size: null, reducedFrom: largest, usedShiftIn: 0, fallback: true, note: null };
}
