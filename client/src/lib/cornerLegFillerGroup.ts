/**
 * Group id of the clearance filler a lazy Susan / diagonal corner base owns on
 * each leg (see `autoDesignCornerLegFillers.ts`). Kept import-free so low-level
 * filler rules can recognise the board without pulling in the corner stage.
 */
const GROUP_PREFIX = "corner-leg-filler-";

export function cornerLegFillerGroupId(corner: { uid: string }, wallId: string): string {
  return `${GROUP_PREFIX}${corner.uid}-${wallId}`;
}

export function isCornerLegFillerGroupId(groupId: string | null | undefined): boolean {
  return (groupId ?? "").startsWith(GROUP_PREFIX);
}
