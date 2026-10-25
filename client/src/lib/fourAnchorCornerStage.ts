import { FOUR_ANCHOR_WALL_LABELS, wallLabelToEngineWallId, type AutoBuildCatalogCandidate, type FourAnchorLayoutType, type FourAnchorOriginCorner, type FourAnchorRunDirection, type WallLabel } from "./fourAnchorAutoBuild";
import { isBaseEndCornerCabinet, isBlindCorner, isCornerCabinet, type RoomData } from "./design";

/** A real room vertex that the admin may explicitly populate after all anchors are seated. */
export type FourAnchorCornerSlot = {
  id: string;
  label: string;
  firstWall: WallLabel;
  secondWall: WallLabel;
};

/** An explicit source-priced selection: null is incomplete and cannot confirm a required corner. */
export type FourAnchorCornerChoice = {
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
export function fourAnchorCornerSlots(layoutType: FourAnchorLayoutType, measured?: {
  wallIds: readonly string[];
  room: RoomData;
  originCorner: FourAnchorOriginCorner;
  runDirection: FourAnchorRunDirection;
}): FourAnchorCornerSlot[] {
  const slots: FourAnchorCornerSlot[] = [];
  const add = (firstWall: WallLabel, secondWall: WallLabel) => {
    const id = `${firstWall}-${secondWall}`.toLowerCase().replaceAll(" ", "-");
    if (!slots.some((slot) => slot.id === id)) slots.push({ id, label: `Corner between ${firstWall} and ${secondWall}`, firstWall, secondWall });
  };
  if (layoutType === "l-shape" || layoutType === "u-shape") add("Wall 1", "Wall 2");
  if (layoutType === "u-shape") add("Wall 2", "Wall 3");
  if (!measured) return slots;
  const occupied = FOUR_ANCHOR_WALL_LABELS.filter((label) => {
    const ref = wallLabelToEngineWallId(label, measured.room, measured.originCorner, measured.runDirection);
    return ref != null && measured.wallIds.includes(ref.engineWallId);
  });
  for (let first = 0; first < occupied.length; first++) {
    for (let second = first + 1; second < occupied.length; second++) {
      const candidate = { id: "", label: "", firstWall: occupied[first], secondWall: occupied[second] };
      if (fourAnchorCornerSlotPoint(candidate, measured.room, measured.originCorner, measured.runDirection)) {
        add(candidate.firstWall, candidate.secondWall);
      }
    }
  }
  return slots;
}

/** Resolve the exact shared engine vertex for a selected wall-label pair. */
export function fourAnchorCornerSlotPoint(
  slot: FourAnchorCornerSlot,
  room: RoomData,
  originCorner: FourAnchorOriginCorner,
  runDirection: FourAnchorRunDirection,
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

export function isFourAnchorBlindCornerOption(candidate: Pick<AutoBuildCornerCandidate, "masterCode" | "description" | "placement" | "cornerType">): boolean {
  return candidate.placement === "base"
    && (candidate.cornerType === "blind-corner" || isBlindCorner(candidate.masterCode, candidate.description ?? undefined));
}
