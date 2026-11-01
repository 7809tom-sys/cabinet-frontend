import {
  cabinetWall,
  freeSegmentsOnWall,
  isFillerItem,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
  type WallSide,
} from "@/lib/design";
import { effectiveSmallGapFillerMaxIn } from "@/lib/smallGapFiller";

/** Gaps a filler can close are already offered as a filler finding; anything wider is a hole. */
export const OPEN_BASE_GAP_MIN_IN = 3.05;
/** Past this a run is a deliberate opening (doorway, passage), not a missed cabinet. */
export const OPEN_BASE_GAP_MAX_IN = 36;
const NEIGHBOR_TOLERANCE_IN = 0.75;

export type OpenBaseGap = {
  wall: WallSide;
  start: number;
  length: number;
  beforeUid: string;
  beforeCode: string;
  afterCode: string;
};

const isFloorRun = (item: PlacedCabinet) =>
  item.placement === "base" || item.placement === "appliance" || item.placement === "tall";

/**
 * Finds empty floor-layer space that sits directly between two cabinets on the
 * same wall and is too wide for a filler. Auto-Design leaves none, so these come
 * from edits made afterwards (a cabinet moved, resized or deleted).
 */
export function findOpenBaseGaps(
  room: RoomData,
  placed: readonly PlacedCabinet[],
  openings: readonly WallOpening[],
): OpenBaseGap[] {
  const out: OpenBaseGap[] = [];
  const walls = new Set<WallSide>();
  for (const item of placed) if (isFloorRun(item) && !item.islandFace) walls.add(cabinetWall(item, room));

  for (const wall of Array.from(walls)) {
    const onWall = placed
      .filter((item) => isFloorRun(item) && !item.islandFace && cabinetWall(item, room) === wall)
      .map((item) => {
        const start = wallRunOffset(item, wall, room);
        return { item, start, end: start + wallRunSpan(item, wall, room) };
      });
    const segments = freeSegmentsOnWall(wall, room, [...placed], [...openings], OPEN_BASE_GAP_MIN_IN, 0, "base", false);
    const fillerMax = Math.max(OPEN_BASE_GAP_MIN_IN, effectiveSmallGapFillerMaxIn());
    for (const seg of segments) {
      if (seg.length <= fillerMax + 0.01 || seg.length > OPEN_BASE_GAP_MAX_IN) continue;
      const before = onWall.find((n) => Math.abs(n.end - seg.start) <= NEIGHBOR_TOLERANCE_IN);
      const after = onWall.find((n) => Math.abs(n.start - (seg.start + seg.length)) <= NEIGHBOR_TOLERANCE_IN);
      if (!before || !after) continue;
      if (isFillerItem(before.item) || isFillerItem(after.item)) continue;
      out.push({ wall, start: seg.start, length: seg.length, beforeUid: before.item.uid, beforeCode: before.item.masterCode, afterCode: after.item.masterCode });
    }
  }
  return out;
}

/** 9.5 -> 9½, 9.25 -> 9¼, 9 -> 9 (nearest 1/8 shown as a fraction when it is a half or quarter). */
export function formatGapInches(value: number): string {
  const whole = Math.floor(value);
  const frac = Math.round((value - whole) * 8) / 8;
  const glyph: Record<number, string> = { 0.125: "⅛", 0.25: "¼", 0.375: "⅜", 0.5: "½", 0.625: "⅝", 0.75: "¾", 0.875: "⅞" };
  if (frac >= 1) return String(whole + 1);
  return frac === 0 ? String(whole) : `${whole}${glyph[frac]}`;
}
