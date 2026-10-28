import { AUTO_DESIGN_WALL_LABELS, wallLabelToEngineWallId, type AutoBuildCatalogCandidate, type AutoDesignLayoutType, type AutoDesignOriginCorner, type AutoDesignRunDirection, type WallLabel } from "./autoDesignAutoBuild";
import { kitchenRuleNumber } from "./kitchenRuleParameters";
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

/**
 * Keep the requested L/U vertices, and also require any real shared vertex
 * between the measured appliance runs. A Single wall dropdown must not permit
 * appliances on adjoining walls to create a cornerless L-shaped kitchen.
 * Opposing galley runs have no shared endpoint and remain corner-free.
 */
export function autoDesignCornerSlots(layoutType: AutoDesignLayoutType, measured?: {
  wallIds: readonly string[];
  room: RoomData;
  originCorner: AutoDesignOriginCorner;
  runDirection: AutoDesignRunDirection;
}): AutoDesignCornerSlot[] {
  const slots: AutoDesignCornerSlot[] = [];
  const add = (firstWall: WallLabel, secondWall: WallLabel) => {
    const id = `${firstWall}-${secondWall}`.toLowerCase().replaceAll(" ", "-");
    if (!slots.some((slot) => slot.id === id)) slots.push({ id, label: `Corner between ${firstWall} and ${secondWall}`, firstWall, secondWall });
  };
  if (layoutType === "l-shape" || layoutType === "u-shape") add("Wall 1", "Wall 2");
  if (layoutType === "u-shape" && kitchenRuleNumber("u_shape_corner_count") >= 2) add("Wall 2", "Wall 3");
  if (!measured) return slots;
  const occupied = AUTO_DESIGN_WALL_LABELS.filter((label) => {
    const ref = wallLabelToEngineWallId(label, measured.room, measured.originCorner, measured.runDirection);
    return ref != null && measured.wallIds.includes(ref.engineWallId);
  });
  for (let first = 0; first < occupied.length; first++) {
    for (let second = first + 1; second < occupied.length; second++) {
      const candidate = { id: "", label: "", firstWall: occupied[first], secondWall: occupied[second] };
      if (autoDesignCornerSlotPoint(candidate, measured.room, measured.originCorner, measured.runDirection)) {
        add(candidate.firstWall, candidate.secondWall);
      }
    }
  }
  return slots;
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
