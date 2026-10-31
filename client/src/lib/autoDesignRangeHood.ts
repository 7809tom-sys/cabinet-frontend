import {
  overRangeMicrowaveAttachment, isHoodOverRangePair, isMicrowaveOverRangePair,
  type DesignCabinet, type PlacedCabinet, type RoomData,
} from "./design";
import { kitchenRuleNumber } from "./kitchenRuleParameters";

/** Every hood except the 42 inch hood sits with its bottom 54 inches off the floor. */
export const AUTO_DESIGN_STANDARD_HOOD_BOTTOM_IN = 54;

/** Only a 42 inch hood is raised so its bottom is at the owner 60 inch datum. */
export function autoDesignHoodMountBottom(widthIn: number): number {
  if (Math.abs(widthIn - 42) <= 0.5) return kitchenRuleNumber("hood_bottom_in");
  return AUTO_DESIGN_STANDARD_HOOD_BOTTOM_IN;
}

export type AutoDesignRangeHoodResult =
  | { ok: true; hood: PlacedCabinet }
  | { ok: false; message: string };

/** A range has nothing above it yet: no hood and no over-range microwave. */
export function autoDesignRangeNeedsVentilation(placed: readonly PlacedCabinet[], range: PlacedCabinet): boolean {
  return !placed.some((item) => item.uid !== range.uid
    && (isHoodOverRangePair(item, range) || isMicrowaveOverRangePair(item, range)));
}

/**
 * A stainless hood sized to the range (the hood whose width matches, otherwise
 * the closest), centered over it on the range's own wall at the standard hood
 * datum. It uses the Designer's own over-range attachment rule, so it lands
 * exactly where a hood added by hand to this range would.
 */
export function autoDesignRangeHood(input: {
  range: PlacedCabinet;
  room: RoomData;
  palette: readonly DesignCabinet[];
  uid: string;
}): AutoDesignRangeHoodResult {
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
  // A 42 inch hood is raised to 60 inches. Every other width keeps 54,
  // even when the palette stored a 66 inch mount.
  const mountBottom = autoDesignHoodMountBottom(width);
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
