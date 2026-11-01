import {
  cabinetWall,
  elevationBox,
  isRangeOrOven,
  isRefrigerator,
  isStacker,
  refrigeratorSurroundElevation,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
} from "./design";

/** Tom's rule (Nov 1): a 12 to 24 inch cabinet over a fridge or a range mounts with its bottom at 72 inches. */
export const OVER_APPLIANCE_UPPER_MOUNT_BOTTOM_IN = 72;
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
    const mountBottom = Math.max(OVER_APPLIANCE_UPPER_MOUNT_BOTTOM_IN, refrigeratorSurroundElevation(room, topOf(fridge), height).mountBottom);
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
