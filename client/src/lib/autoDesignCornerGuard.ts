/**
 * Auto-Design's corner cabinet gate.
 *
 * A corner cabinet is seated first and owns the corner. Every later pass that
 * widens, resizes or re-places a run cabinet reads the same predicate here, so
 * none of them can turn a seated Lazy Susan or blind corner into a straight
 * base of the same run width.
 *
 * That conversion is what left the inside base corner of an L empty: a run pass
 * grew `LSB36` into a plain `B42` because "B" is a wider family match than
 * "LSB", the copied L-corner footprint then reached past the room shell, and the
 * bounds gate at the very end of the build deleted the corner without a word.
 */
import { isCornerCabinet, isPlainBaseCode } from "./design";

type CornerLike = { masterCode: string; description: string | null; cornerType: string | null };

/** The fields the shared classifier needs, from either a saved placement or a catalog row. */
function cornerFields(item: { masterCode?: string | null; description?: string | null; cornerType?: string | null }): CornerLike {
  return {
    masterCode: item.masterCode ?? "",
    description: item.description ?? null,
    cornerType: item.cornerType ?? null,
  };
}

/**
 * A placed cabinet that owns a room corner: a lazy Susan / easy reach, a blind
 * corner, a diagonal corner, or a corner drawer. The classification is the same
 * one the rest of the Designer uses, so a plain `B42` stays a straight base
 * whatever `cornerType` a stale pass may have copied onto it.
 */
export function isPlacedCornerCabinet(item: { masterCode?: string | null; description?: string | null; cornerType?: string | null }): boolean {
  const fields = cornerFields(item);
  if (isPlainBaseCode(fields.masterCode)) return false;
  return isCornerCabinet(fields.masterCode, fields.description ?? undefined, fields.cornerType);
}

/**
 * True when `candidate` may stand in as the wider version of `neighbor`: only a
 * run cabinet grows, and only into another run cabinet. A corner never matches a
 * straight base and a straight base never matches a corner, in either direction.
 */
export function sameWidthFamily(neighbor: { masterCode?: string | null; description?: string | null; cornerType?: string | null }, candidate: { masterCode?: string | null }): boolean {
  if (isPlacedCornerCabinet(neighbor)) return false;
  return !isPlacedCornerCabinet({ masterCode: candidate.masterCode ?? null });
}
