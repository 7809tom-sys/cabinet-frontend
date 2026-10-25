import {
  APPLIANCES,
  overRangeMicrowaveAttachment,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "@/lib/design";

export type RangeHoodPlacement =
  | {
      ok: true;
      rangeUid: string;
      spot: { x: number; y: number; rotation: number };
      mountBottom: number;
    }
  | { ok: false; message: string };

/**
 * A hood is an elevated appliance attached to a saved range, not a new item in
 * the next empty base-cabinet opening. Clicks prefer a selected range, then a
 * range on the active wall; explicit drops choose the nearest compatible range.
 */
export function resolveRangeHoodPlacement(
  placed: PlacedCabinet[],
  room: RoomData,
  activeWall: WallSide | null | undefined,
  selectedUid: string | null | undefined,
  target: Pick<PlacedCabinet, "x" | "y">,
  hood: Pick<PlacedCabinet, "masterCode" | "width" | "depth" | "mountBottom">,
): RangeHoodPlacement {
  const attachment = overRangeMicrowaveAttachment(placed, room, activeWall, selectedUid, target, hood);
  if (!attachment) {
    return { ok: false, message: `${hood.masterCode} must be installed above a compatible saved range. Add or select a range first.` };
  }
  const catalogBottom = APPLIANCES.find((item) => item.masterCode === hood.masterCode && item.width === hood.width)?.elevBottom;
  return {
    ok: true,
    rangeUid: attachment.range.uid,
    spot: attachment.spot,
    mountBottom: typeof hood.mountBottom === "number" && hood.mountBottom >= 0 ? hood.mountBottom : catalogBottom ?? 66,
  };
}
