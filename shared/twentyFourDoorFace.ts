/**
 * Door faces at 24 inches.
 *
 * Tom, Nov 9 2026: "there is no single door 24 cabinet." A standard hinged
 * cabinet 24 inches wide or wider is drawn and described as two doors. A
 * cabinet 21 inches or under stays one door. The altaeuro frameless book V8.2
 * still prints single-door rows at 24 inches. Those rows are a data error:
 * they stay in the catalog under their original codes, and nothing here
 * deletes, renames, or rewrites a SKU.
 *
 * W2430S: the book lists it under "Single Door 30\" High Wall Cabinets",
 * beside W2130 and before the double-door section that starts at W2430.
 * The trailing S is that single-door marker (the same marker as B24S /
 * SB24S / VSB24S). It is not a depth, spice, shelf, or standard-depth code.
 * The vanity BOM makes the same split: VSB24SFH ships one 23-7/8" door
 * (D2430 × 1) and VSB24FH ships two 11-7/8" doors (D1230 × 2).
 */

export type DoorFaceCabinet = {
  masterCode?: string | null;
  description?: string | null;
  width?: number | string | null;
  category?: string | null;
  subCategory?: string | null;
  graphicType?: string | null;
  cornerType?: string | null;
  facePattern?: string | null;
  openingType?: string | null;
  turnedSideways?: boolean | null;
  noDoor?: boolean | null;
  isCornerCabinet?: boolean | null;
};

/** Book rows whose trailing S marks the single-door 24" twin of a two-door SKU. */
const BOOK_SINGLE_DOOR_TWENTY_FOUR = /^(?:(?:B|SB|VSB)24S(?:FH)?|W2430S)$/;

function compact(masterCode: string | null | undefined): string {
  return (masterCode ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** True for B24S, B24SFH, SB24S, SB24SFH, VSB24S, VSB24SFH, and W2430S. */
export function isBookSingleDoorTwentyFourCode(masterCode: string | null | undefined): boolean {
  return BOOK_SINGLE_DOOR_TWENTY_FOUR.test(compact(masterCode));
}

function numericWidth(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Width the door rule uses. A standard code's nominal width wins over a stale
 * width field, so a B12 whose width says 42 is still a 12" one-door base.
 */
export function standardFaceWidthIn(input: Pick<DoorFaceCabinet, "masterCode" | "width">): number | null {
  const code = compact(input.masterCode);
  const wall = code.match(/^W(\d{2})(?:12|15|18|23|30|35|40)/);
  if (wall) return Number(wall[1]);
  const base = code.match(/^(?:VSB|SB|B)(\d{2})/);
  if (base) return Number(base[1]);
  return numericWidth(input.width);
}

/**
 * Families that really do have one door (or no hinged pair) at 24 inches:
 * diagonal and blind corners, flip-up lifts, appliance garages, drawer stacks,
 * oven and microwave openings, and a turned single-door bridge.
 */
export function keepsItsOwnDoorCount(input: DoorFaceCabinet): boolean {
  if (input.noDoor || input.turnedSideways) return true;
  if (input.facePattern) return true;
  if (input.openingType && input.openingType !== "none") return true;
  const corner = (input.cornerType ?? "").toLowerCase();
  if (corner && corner !== "none" && corner !== "straight") return true;
  const code = compact(input.masterCode);
  if (/^(?:DCW|WDC|KWD|DCB|DCFF|WAC|AW|WFD|BBC|WBC|BER|ERB|LSB|WTC|BTC|BEC|BAC|CDB|FSB|BMW|BMC|WMS|WXR|WWC|RHF|UOC|OC|VDDB|AG\d|CAG|DKD|VKD)/.test(code)) {
    return true;
  }
  if (/^(?:RB)?[23]DB/.test(code) || /^DB\d/.test(code) || /^[23]VDB/.test(code)) return true;
  const text = `${input.description ?? ""} ${input.subCategory ?? ""} ${input.category ?? ""}`.toLowerCase();
  if (/diagonal|blind corner|lazy susan|easy reach|flip-?up|aventos|appliance garage|tambour|oven cabinet|microwave|knee drawer|desk base|vanity combo|center door/.test(text)) {
    return true;
  }
  if (/^V\d{4}D[LR]$/.test(code) || /drawers?\s+(?:left|right)/.test(text)) return true;
  return false;
}

/**
 * True when a standard hinged cabinet is 24" or wider and the catalog set it
 * up as one door. Callers pass a face that already resolved to one door.
 */
export function isTwentyFourSingleDoorDataError(input: DoorFaceCabinet): boolean {
  if (keepsItsOwnDoorCount(input)) return false;
  if (isBookSingleDoorTwentyFourCode(input.masterCode)) return true;
  const width = standardFaceWidthIn(input);
  return width != null && width >= 24;
}

export function correctTwentyFourSingleDoor<T extends { doors: number; drawers: number }>(
  input: DoorFaceCabinet,
  counts: T,
): T {
  if (counts.doors !== 1) return counts;
  if (!isTwentyFourSingleDoorDataError(input)) return counts;
  return { ...counts, doors: 2 };
}

/** Presentation-only. The stored description and the order code stay as saved. */
export function describeAsTwoDoor(description: string | null | undefined): string {
  if (!description) return description ?? "";
  return description
    .replace(/\bSingle Door\b/g, "Double Door")
    .replace(/\bsingle door\b/g, "double door")
    .replace(/\bOne Door\b/g, "Two Doors")
    .replace(/\bone door\b/g, "two doors")
    .replace(/\b1 Door\b/g, "2 Doors")
    .replace(/\b1 door\b/g, "2 doors")
    .replace(/\b1-Door\b/g, "2-Door")
    .replace(/\b1-door\b/g, "2-door");
}

/**
 * Shopper copy for a cabinet whose stored words still say it is a single door.
 * Returns the original text when the cabinet is not a 24" single-door data error.
 */
export function twoDoorShopperDescription(input: DoorFaceCabinet & { description?: string | null }): string {
  const text = input.description ?? "";
  if (!/\b(?:single|one|1)(?:\s*|-)+doors?\b/i.test(text)) return text;
  if (keepsItsOwnDoorCount(input)) return text;
  const width = standardFaceWidthIn(input);
  if (width != null && width <= 21 && !isBookSingleDoorTwentyFourCode(input.masterCode)) return text;
  if (!isBookSingleDoorTwentyFourCode(input.masterCode) && (width == null || width < 24)) return text;
  return describeAsTwoDoor(text);
}
