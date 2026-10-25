import {
  APPLIANCES,
  overRangeMicrowaveAttachment,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "@/lib/design";

export type OverRangeMicrowavePlacement =
  | {
      ok: true;
      rangeUid: string;
      spot: { x: number; y: number; rotation: number };
      mountBottom: number;
    }
  | { ok: false; message: string };

/**
 * Shared by MW-30 palette adds and canvas drags. The drop point only chooses
 * among ranges; it can never become a floating OTR microwave position.
 */
export function resolveOverRangeMicrowavePlacement(
  placed: PlacedCabinet[],
  room: RoomData,
  activeWall: WallSide | null | undefined,
  selectedUid: string | null | undefined,
  target: Pick<PlacedCabinet, "x" | "y">,
  microwave: Pick<PlacedCabinet, "width" | "depth">,
): OverRangeMicrowavePlacement {
  const attachment = overRangeMicrowaveAttachment(placed, room, activeWall, selectedUid, target, microwave);
  if (!attachment) {
    return { ok: false, message: "MW-30 must be installed above a compatible range. Add or select a range first." };
  }
  return {
    ok: true,
    rangeUid: attachment.range.uid,
    spot: attachment.spot,
    mountBottom: APPLIANCES.find((appliance) => appliance.masterCode === "MW-30")?.elevBottom ?? 54,
  };
}
