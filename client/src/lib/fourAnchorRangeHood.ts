import {
  overRangeMicrowaveAttachment, isHoodOverRangePair, isMicrowaveOverRangePair,
  type DesignCabinet, type PlacedCabinet, type RoomData,
} from "./design";

/** The standard hood bottom datum when the catalog row carries none. */
const DEFAULT_HOOD_MOUNT_BOTTOM_IN = 66;

export type FourAnchorRangeHoodResult =
  | { ok: true; hood: PlacedCabinet }
  | { ok: false; message: string };

/** A range has nothing above it yet: no hood and no over-range microwave. */
export function fourAnchorRangeNeedsVentilation(placed: readonly PlacedCabinet[], range: PlacedCabinet): boolean {
  return !placed.some((item) => item.uid !== range.uid
    && (isHoodOverRangePair(item, range) || isMicrowaveOverRangePair(item, range)));
}

/**
 * A stainless hood sized to the range (the hood whose width matches, otherwise
 * the closest), centered over it on the range's own wall at the standard hood
 * datum. It uses the Designer's own over-range attachment rule, so it lands
 * exactly where a hood added by hand to this range would.
 */
export function fourAnchorRangeHood(input: {
  range: PlacedCabinet;
  room: RoomData;
  palette: readonly DesignCabinet[];
  uid: string;
}): FourAnchorRangeHoodResult {
  const { range, room, palette, uid } = input;
  const hoods = palette.filter((item) => /^HOOD-/.test(item.masterCode) && Number(item.width) > 0);
  if (!hoods.length) return { ok: false, message: "No range hood is available for this room type." };
  const source = [...hoods].sort((a, b) => (
    Math.abs(Number(a.width) - range.width) - Math.abs(Number(b.width) - range.width)
  ))[0]!;
  const width = Number(source.width);
  const depth = Number(source.depth);
  const attachment = overRangeMicrowaveAttachment([range], room, null, range.uid, { x: range.x, y: range.y }, { width, depth });
  if (!attachment) return { ok: false, message: `${source.masterCode} must be installed above a compatible saved range.` };
  const spot = attachment.spot as { x: number; y: number; rotation: number; wallId?: string; wallOffset?: number };
  const mountBottom = source.mountBottom != null && Number(source.mountBottom) >= 0
    ? Number(source.mountBottom)
    : DEFAULT_HOOD_MOUNT_BOTTOM_IN;
  return {
    ok: true,
    hood: {
      uid, cabinetId: source.id, masterCode: source.masterCode, description: source.description,
      category: source.category, subCategory: source.subCategory, placement: "appliance",
      x: spot.x, y: spot.y, rotation: spot.rotation,
      ...(spot.wallId ? { wallId: spot.wallId, wallOffset: spot.wallOffset ?? 0 } : {}),
      width, depth, height: Number(source.height), mountBottom,
      numberOfDoors: source.numberOfDoors, numberOfDrawers: source.numberOfDrawers,
      catalogImageUrl: source.catalogImageUrl ?? null,
    } as PlacedCabinet,
  };
}
