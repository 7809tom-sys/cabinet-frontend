/**
 * Economic corner keep-clear guard (Tom, voice, Nov 19 2026, 11:59 AM CT), budget friendly only.
 *
 * The economic corner is a 27″ footprint on each leg: a 24″ VOID (no cabinet, countertop over it) plus
 * a 3″ mitered filler. The dishwasher, the sink base and the range must never sit inside it. The
 * measured anchors are seated first, so when one lands inside a leg's 27″ footprint it is slid along
 * its own wall, away from the corner, until its near edge is on the footprint's edge. The sink base
 * and the dishwasher beside it slide together (they stay butted). When the slide would leave a gap
 * too small for a stock base and upper (under 12″) the group closes it, so the corner gets a 3″ filler and no
 * sliver. A slide that would run into another anchor, an opening or the far wall end is not taken:
 * the group stays where it was measured and the engine's existing "economy corner skipped" note
 * says why.
 *
 * Countertop-first rules (Tom, voice, Nov 19 2026, 12:59 + 1:06 PM CT): the countertop is decorative and
 * never yields to plumbing or windows. (1) Only an opening whose sill is BELOW the finished countertop
 * (a door, or a window under 36″) blocks a slide; a window higher than the counter is no obstacle, so
 * the sink and dishwasher may slide 3″ under it. (2) Anchors the customer said cannot move
 * (`lockedKinds`) stay put; the countertop then bridges whatever gap that leaves.
 */
import { autoBuildSelectedWallCornerReservations } from "./autoDesignAutoBuild";
import { STD, wallPlacementAt, type RoomData, type WallOpening, type WallSide } from "./design";
import { ECONOMY_CORNER_FOOTPRINT_IN } from "./autoDesignEconomyCorner";

/** Smallest stock base AND upper that fills a gap with no sliver (B12 / W12); a gap under this beside the footprint is closed (a 9–11″ gap can only be a BT9 plus a sliver filler, and no upper fits it). */
export const ECONOMY_KEEP_CLEAR_MIN_BASE_IN = 12;

export type KeepClearAnchor = {
  kind: string;
  wallId: WallSide;
  /** Along-wall start in the wall-run frame (the same number the anchor loop seats). */
  along: number;
  width: number;
  depth: number;
  /** Anchors with the same key slide together (the sink base and the dishwasher butted to it). */
  group: string;
};

export type KeepClearResult = {
  /** kind -> inches to add to that anchor's along-wall start. */
  shifts: Map<string, number>;
  notes: string[];
};

export function economyKeepClearShifts(input: {
  anchors: readonly KeepClearAnchor[];
  /** Kinds that may slide (sink, dishwasher, range). Anything else on the wall is an obstacle only. */
  movableKinds: readonly string[];
  room: RoomData;
  openings: readonly WallOpening[];
  frameOf: (wallId: WallSide) => { runStart: number; runEnd: number } | null;
  /** Kinds the customer said cannot move (sink/dishwasher via plumbing or sink base, range via hookup). They never slide. */
  lockedKinds?: readonly string[];
  label?: (kind: string) => string;
  /** Tom, Nov 20 2026, 11:03 AM CT: the rule runs in budget mode only. False means no reserved space and no range/sink shift, on any cabinet line. Omitted is treated as on, so direct unit tests of the geometry stay unchanged. */
  budgetMode?: boolean;
}): KeepClearResult {
  if (input.budgetMode === false) return { shifts: new Map(), notes: [] };
  const shifts = new Map<string, number>();
  const notes: string[] = [];
  const wallIds = Array.from(new Set(input.anchors.map((anchor) => anchor.wallId)));
  const label = input.label ?? ((kind: string) => kind);
  const fmt = (n: number) => Math.abs(n).toFixed(2).replace(/\.?0+$/, "");
  for (const wallId of wallIds) {
    const frame = input.frameOf(wallId);
    if (!frame) continue;
    // The cabineted runs are the walls that carry anchors; every corner they share is an economic corner.
    const claims = autoBuildSelectedWallCornerReservations(wallId, input.room, wallIds, ECONOMY_CORNER_FOOTPRINT_IN);
    if (claims.length === 0) continue;
    const onWall = input.anchors.filter((anchor) => anchor.wallId === wallId);
    const groups = Array.from(new Set(onWall.filter((anchor) => input.movableKinds.includes(anchor.kind)).map((anchor) => anchor.group)));
    for (const groupKey of groups) {
      const group = onWall.filter((anchor) => anchor.group === groupKey && input.movableKinds.includes(anchor.kind));
      const start = Math.min(...group.map((anchor) => anchor.along));
      const end = Math.max(...group.map((anchor) => anchor.along + anchor.width));
      let shift = 0;
      for (const claim of claims) {
        const atStart = Math.abs(claim.start - frame.runStart) <= 0.01;
        const gap = atStart ? start - claim.end : claim.start - end; // free inches between the footprint edge and the group
        const awayDir = atStart ? 1 : -1;
        if (gap < -0.01) { shift = awayDir * -gap; break; }
        if (gap > 0.01 && gap < ECONOMY_KEEP_CLEAR_MIN_BASE_IN - 0.01) { shift = -awayDir * gap; break; }
      }
      if (Math.abs(shift) < 0.01) continue;
      const names = group.map((anchor) => label(anchor.kind)).join(" + ");
      const skip = (why: string) => notes.push(`Economic corner keep-clear: the ${names} on ${wallId} stays where it was measured — ${why}.`);
      if (group.some((anchor) => (input.lockedKinds ?? []).includes(anchor.kind))) { skip("the customer said it cannot move, so it stays and the countertop bridges the gap beside the corner"); continue; }
      const movedStart = start + shift;
      const movedEnd = end + shift;
      if (movedStart < frame.runStart - 0.01 || movedEnd > frame.runEnd + 0.01) { skip("sliding it clear of the 27″ corner footprint would run past the wall end"); continue; }
      if (claims.some((claim) => movedStart < claim.end - 0.01 && movedEnd > claim.start + 0.01)) { skip("sliding it would land it inside another corner footprint on this wall"); continue; }
      const blocker = onWall.find((anchor) => anchor.group !== groupKey && anchor.along < movedEnd - 0.01 && anchor.along + anchor.width > movedStart + 0.01);
      if (blocker) { skip(`sliding it would run into the ${label(blocker.kind)}`); continue; }
      const opening = input.openings.find((item) => {
        if (item.side !== wallId) return false;
        // A window above the finished countertop (sill at or over 36″) does not stop a base from sliding under it.
        if (item.sill >= STD.COUNTERTOP_HEIGHT - 0.01) return false;
        const spot = wallPlacementAt(movedStart, movedEnd - movedStart, group[0].depth, wallId, input.room);
        const from = spot?.wallOffset ?? movedStart;
        return item.offset < from + (movedEnd - movedStart) - 0.01 && item.offset + item.width > from + 0.01;
      });
      if (opening) { skip(`sliding it would cover a ${opening.kind}`); continue; }
      for (const anchor of group) shifts.set(anchor.kind, shift);
      const towardCorner = claims.some((claim) => {
        const atStart = Math.abs(claim.start - frame.runStart) <= 0.01;
        return atStart ? shift < 0 : shift > 0;
      });
      notes.push(`Economic corner keep-clear: the ${names} on ${wallId} slid ${fmt(shift)}″ ${towardCorner ? "toward" : "away from"} the corner so nothing sits inside the 27″ footprint (24″ void + 3″ mitered filler)${towardCorner ? " and no sliver is left beside it" : ""}.`);
    }
  }
  return { shifts, notes };
}
