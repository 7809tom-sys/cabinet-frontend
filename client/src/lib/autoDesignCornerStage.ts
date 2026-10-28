import { AUTO_DESIGN_WALL_LABELS, wallLabelToEngineWallId, type AutoBuildCatalogCandidate, type AutoDesignLayoutType, type AutoDesignOriginCorner, type AutoDesignRunDirection, type WallLabel } from "./autoDesignAutoBuild";
import { isBaseEndCornerCabinet, isBlindCorner, isCornerCabinet, type RoomData } from "./design";

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
 * A U-shape has one back run and two side runs, so it has two corners. The
 * open end of a side run — where that run meets the empty front wall of a
 * closed room — is not a corner. Treating that open end as a corner, and also
 * discovering the other side run from an appliance, is what placed a third
 * corner cabinet and then warned that the extra corner still needed one.
 *
 * An L-shape has the single back-to-side corner. A single wall or galley has
 * none, except that appliances measured on two adjoining walls still reveal
 * the one real corner those runs share. Opposing galley runs do not share an
 * endpoint.
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
  if (layoutType === "l-shape") {
    if (!measured || wallsShareVertex("Wall 1", "Wall 2", measured)) add("Wall 1", "Wall 2");
    return slots;
  }
  if (layoutType === "u-shape") {
    const pairs = measured ? uShapeCornerPairs(measured) : [["Wall 1", "Wall 2"], ["Wall 1", "Wall 4"]] as const;
    for (const [firstWall, secondWall] of pairs) add(firstWall, secondWall);
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

/** Walls that meet `label` at one of its endpoints, one wall per endpoint. */
function wallsMeeting(label: WallLabel, measured: AutoDesignCornerMeasurement): WallLabel[] {
  const found: WallLabel[] = [];
  const seen = new Set<string>();
  for (const other of AUTO_DESIGN_WALL_LABELS) {
    if (other === label) continue;
    const point = autoDesignCornerSlotPoint(
      { id: "", label: "", firstWall: label, secondWall: other },
      measured.room,
      measured.originCorner,
      measured.runDirection,
    );
    if (!point) continue;
    const key = `${Math.round(point.x * 1000)}:${Math.round(point.y * 1000)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(other);
  }
  return found;
}

/**
 * The two corners of a U are the two ends of the back run.
 * On a rectangular plan Wall 1 is that back run, and its two neighbors are the
 * side runs. The front wall shares no vertex with the back, so the open ends
 * where the side runs meet the front are not returned.
 * On an open three-wall U drawn from a side run, Wall 1 has one neighbor: that
 * neighbor is the back, and both of its joins are the corners.
 */
function uShapeCornerPairs(measured: AutoDesignCornerMeasurement): Array<[WallLabel, WallLabel]> {
  const backNeighbors = wallsMeeting("Wall 1", measured);
  if (backNeighbors.length >= 2) return backNeighbors.slice(0, 2).map((side) => ["Wall 1", side]);
  const back = backNeighbors[0];
  if (!back) return [];
  const sideRuns = wallsMeeting(back, measured);
  if (sideRuns.length >= 2) return sideRuns.slice(0, 2).map((side) => [back, side]);
  if (sideRuns.length === 1) return [[back, sideRuns[0]!]];
  return [];
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
      && isCornerCabinet(candidate.masterCode, candidate.description ?? undefined)
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
    && (candidate.cornerType === "blind-corner" || isBlindCorner(candidate.masterCode, candidate.description ?? undefined));
}

export type AutoDesignCornerFamily = "diagonal" | "lazy-susan" | "blind" | "other";

export function autoDesignCornerFamily(candidate: Pick<AutoBuildCornerCandidate, "masterCode" | "description" | "cornerType">): AutoDesignCornerFamily {
  const code = (candidate.masterCode ?? "").toUpperCase();
  const hay = `${candidate.cornerType ?? ""} ${candidate.description ?? ""} ${code}`.toLowerCase();
  if (candidate.cornerType === "diagonal" || candidate.cornerType === "pie-cut" || /diagonal|pie[-\s]?cut/.test(hay) || /^(?:DCB|DCW|WDC)/.test(code)) return "diagonal";
  if (candidate.cornerType === "lazy-susan" || /lazy\s*susan|easy\s*reach/.test(hay) || /^(?:LSB|LS|ERB|BER)/.test(code)) return "lazy-susan";
  if (candidate.cornerType === "blind-corner" || /blind/.test(hay) || /^(?:BBC|WBC|BBL|BBR)/.test(code)) return "blind";
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
