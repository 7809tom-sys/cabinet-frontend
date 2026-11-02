/**
 * A plain straight base: B24, B36, B42, B-42, SB36, DB18, 3DB24... There is no B42 corner cabinet.
 *
 * Corner and blind status comes from the model code (or a stored cornerType), never from words in the
 * description, so this code shape is a normal base cabinet whatever its description, sub-category or
 * saved `isCornerCabinet` flag says (Tom, Oct 31). BBC/BLB/BER... do not match: the second character is
 * a letter, not a digit.
 *
 * Lives in its own module so both the drawing helpers and the placement engine read ONE predicate and
 * cannot drift apart (a B42 that drops out of the straight-base pool is seated as a blind corner).
 */
export function isPlainBaseCode(masterCode: string | null | undefined): boolean {
  return /^(?:B|SB|DB|3DB)-?\d/.test((masterCode || "").toUpperCase());
}

/** True when the row is a plain straight base and therefore can never be a corner of any family. */
export function isPlainBaseRow(row: {
  masterCode?: string | null;
  subCategory?: string | null;
  description?: string | null;
}): boolean {
  if (isPlainBaseCode(row.masterCode)) return true;
  return false;
}
