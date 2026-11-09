import {
  cabinetWall,
  elevationBox,
  isRangeOrOven,
  isRefrigerator,
  isStacker,
  OVER_RANGE_UPPER_MIN_BOTTOM_IN,
  refrigeratorSurroundElevation,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
} from "./design";

/** Tom's rule (Nov 1): a 12 to 24 inch cabinet over a fridge or a range mounts with its bottom at 72 inches. */
export const OVER_APPLIANCE_UPPER_MOUNT_BOTTOM_IN = OVER_RANGE_UPPER_MIN_BOTTOM_IN;
export const OVER_APPLIANCE_UPPER_MIN_HEIGHT_IN = 12;
export const OVER_APPLIANCE_UPPER_MAX_HEIGHT_IN = 24;

export type OverApplianceWallMount = {
  kind: "refrigerator" | "range" | "microwave";
  mountBottom: number;
  /** Set for a refrigerator: the cabinet joins that fridge's assembly as its bridge. */
  refrigeratorUid: string | null;
  /** Set when the cabinet would pass the ceiling. The cabinet is never clipped. */
  warning: string | null;
};

const OVERLAP_IN = 0.02;

/**
 * The run's upper top line: the 54-inch bottom datum plus the height of the
 * straight wall cabinets already on this plan. A refrigerator bridge tops out
 * here so it lines up with the other uppers rather than with the appliance.
 */
function upperLineTopIn(room: RoomData, placed: readonly PlacedCabinet[]): number {
  const heights = placed
    .filter((item) => item.placement === "wall"
      && item.refrigeratorAssemblyRole !== "bridge"
      && !item.stackedOnCabinetUid
      && !item.islandFace
      && Number(item.height) > 0)
    .map((item) => Number(item.height));
  if (!heights.length) return 54 + 30;
  // The run's own class is the most common tall-ish upper, never a short bridge.
  const runHeights = heights.filter((height) => height >= 24);
  const pool = runHeights.length ? runHeights : heights;
  const counts = new Map<number, number>();
  for (const height of pool) counts.set(height, (counts.get(height) ?? 0) + 1);
  const commonest = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]!;
  return 54 + commonest[0];
}

function isHoodAppliance(item: PlacedCabinet): boolean {
  if (item.placement !== "appliance") return false;
  const code = (item.masterCode || "").toUpperCase();
  return /^HOOD(?:-|\b)/.test(code) || /\bhood\b/i.test(item.description || "");
}

function isOverRangeMicrowave(item: PlacedCabinet): boolean {
  return item.placement === "appliance" && /^MW-/.test((item.masterCode || "").toUpperCase());
}

/**
 * Where a short upper (12, 15, 18 or 24 in) belongs when it sits over a refrigerator or a range.
 *  - refrigerator: 72 in, or two inches above the fridge top when the fridge is taller
 *    (the same number refrigeratorSurroundElevation gives the builder).
 *  - range or cooktop: 72 in, or the top of an over-the-range microwave when that is higher.
 *  - hoods and hood-front cabinets (HOOD-*, RHF30/RHF36) keep their own mounting: null.
 * Anything else, and any other height, returns null and keeps the ordinary 54 in default.
 */
export function overApplianceWallMount(
  cabinet: PlacedCabinet,
  placed: readonly PlacedCabinet[],
  room: RoomData,
): OverApplianceWallMount | null {
  if (cabinet.placement !== "wall" || cabinet.islandFace || isStacker(cabinet)) return null;
  if (/^RHF[\s_-]*\d/i.test(cabinet.masterCode || "")) return null;
  const height = Number(cabinet.height) || 0;
  if (height < OVER_APPLIANCE_UPPER_MIN_HEIGHT_IN - 0.01 || height > OVER_APPLIANCE_UPPER_MAX_HEIGHT_IN + 0.01) return null;

  const side = cabinetWall(cabinet, room);
  const start = wallRunOffset(cabinet, side, room);
  const end = start + wallRunSpan(cabinet, side, room);
  const below = placed.filter((item) => {
    if (item.uid === cabinet.uid || item.placement !== "appliance" || item.islandFace) return false;
    if (cabinetWall(item, room) !== side) return false;
    const itemStart = wallRunOffset(item, side, room);
    const itemEnd = itemStart + wallRunSpan(item, side, room);
    return itemStart < end - OVERLAP_IN && itemEnd > start + OVERLAP_IN;
  });
  const topOf = (item: PlacedCabinet) => {
    const box = elevationBox(item, room);
    return box.bottom + box.height;
  };
  const ceiling = Number(room.ceilingHeight) || 96;
  const finish = (kind: OverApplianceWallMount["kind"], mountBottom: number, refrigeratorUid: string | null): OverApplianceWallMount => ({
    kind,
    mountBottom,
    refrigeratorUid,
    warning: mountBottom + height > ceiling + 0.01
      ? `${cabinet.masterCode} mounted at ${mountBottom}" reaches ${Math.round((mountBottom + height) * 100) / 100}", past the ${ceiling}" ceiling. It was not cut.`
      : null,
  });

  const fridge = below.find((item) => isRefrigerator(item));
  if (fridge) {
    // Owner rule (Tom, Nov 6 2026): the cabinet above a refrigerator lines up
    // with the other uppers — its TOP lands on the running upper line — and its
    // bottom keeps the two-inch appliance clearance. Hanging it from the 72-inch
    // datum instead left a short bridge topping above the run it belongs to.
    const clearanceBottomIn = refrigeratorSurroundElevation(room, topOf(fridge), height).mountBottom;
    const topAlignedBottomIn = upperLineTopIn(room, placed) - height;
    const mountBottom = topAlignedBottomIn >= clearanceBottomIn - 0.01
      ? topAlignedBottomIn
      : clearanceBottomIn;
    return finish("refrigerator", mountBottom, fridge.uid);
  }
  if (below.some(isHoodAppliance)) return null;
  const range = below.find((item) => isRangeOrOven(item.masterCode, item.description));
  if (!range) return null;
  const microwave = below.find(isOverRangeMicrowave);
  if (microwave) return finish("microwave", Math.max(OVER_APPLIANCE_UPPER_MOUNT_BOTTOM_IN, topOf(microwave)), null);
  return finish("range", OVER_APPLIANCE_UPPER_MOUNT_BOTTOM_IN, null);
}

/**
 * Applies the rule to a whole plan (hand-placed, saved or built). A customer-set vertical move
 * (`mountBottomAdjusted`) is left alone. A cabinet over a fridge joins that fridge's assembly as its bridge
 * so the panel clamp covers it.
 */
export function normalizeOverApplianceWallMounts(placed: PlacedCabinet[], room: RoomData): PlacedCabinet[] {
  let changed = false;
  const next = placed.map((cabinet) => {
    if (cabinet.mountBottomAdjusted) return cabinet;
    // A refrigerator bridge is height-ruled by its own bay (top on the run line,
    // bottom on the appliance clearance). Re-running the generic over-appliance
    // datum here is what re-hung it below the two-inch clearance.
    if (cabinet.refrigeratorAssemblyRole === "bridge") return cabinet;
    const mount = overApplianceWallMount(cabinet, placed, room);
    if (!mount) return cabinet;
    const attach = mount.refrigeratorUid != null && cabinet.refrigeratorAssemblyId == null;
    if (Math.abs((Number(cabinet.mountBottom) || 0) - mount.mountBottom) <= 0.01 && !attach) return cabinet;
    changed = true;
    return {
      ...cabinet,
      mountBottom: mount.mountBottom,
      ...(attach ? { refrigeratorAssemblyId: mount.refrigeratorUid!, refrigeratorAssemblyRole: "bridge" as const } : {}),
    };
  });
  return changed ? next : placed;
}
