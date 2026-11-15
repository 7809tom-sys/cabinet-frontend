/**
 * Auto-Design sweep checks (Tom, 14 Nov 2026: "i keep running designs and look for
 * good and bad").
 *
 * The expensive part of a sweep is knowing what "bad" means without a human looking
 * at a screenshot. These are the invariants we have learned the hard way, as pure
 * functions over a finished plan, so a matrix runner can print only the designs that
 * broke one.
 *
 * Each finding names the rule it came from, so a failure becomes a test case rather
 * than a note.
 */
import { cabinetWall, isCornerCabinet, isFillerItem, sharesPlanCollisionZone, wallLength, wallRunOffset, wallRunSpan } from "./design";
import type { DesignCabinet, PlacedCabinet, RoomData } from "./design";

export type SweepFinding = {
  ruleId: string;
  code: string;
  detail: string;
  cabinetUids: string[];
};

const EPSILON = 0.05;

function doorFace(item: PlacedCabinet): boolean {
  return item.placement === "base" || item.placement === "wall" || item.placement === "tall";
}

/**
 * Two cabinets on the same wall whose spans overlap in the same height band.
 * A wall cabinet or hood hanging over a base, sink base or appliance is
 * legitimate. Tall cabinets and tall panels span both the base and wall
 * bands, so they still conflict with any part whose elevation they actually
 * intersect. Bands come from the layout's own rule: placement plus the
 * physical elevation envelope (`sharesPlanCollisionZone` / `elevationBox`).
 */
export function findOverlaps(placed: readonly PlacedCabinet[], room: RoomData): SweepFinding[] {
  const findings: SweepFinding[] = [];
  const items = placed.filter((item) => doorFace(item) || item.placement === "appliance");
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i]!;
      const b = items[j]!;
      const wall = cabinetWall(a, room);
      if (!wall || wall !== cabinetWall(b, room)) continue;
      // Same rule the placer uses: only parts whose elevation envelopes
      // intersect (or that share a placement band) reserve the same run.
      if (!sharesPlanCollisionZone(a, b)) continue;
      const aStart = wallRunOffset(a, wall, room);
      const bStart = wallRunOffset(b, wall, room);
      const overlap = Math.min(aStart + wallRunSpan(a, wall, room), bStart + wallRunSpan(b, wall, room)) - Math.max(aStart, bStart);
      if (overlap > EPSILON) {
        findings.push({
          ruleId: "no-overlap",
          code: "cabinets-overlap",
          detail: `${a.masterCode} and ${b.masterCode} overlap by ${Math.round(overlap * 100) / 100}" on the ${wall} wall.`,
          cabinetUids: [a.uid, b.uid],
        });
      }
    }
  }
  return findings;
}

/**
 * Interior fillers: a board that touches neither a run end nor another filler is a
 * width-selection failure. A scribe at a wall end is legitimate and is not counted.
 */
export function interiorFillerCounts(placed: readonly PlacedCabinet[], room: RoomData): Map<string, number> {
  const byWall = new Map<string, number>();
  for (const item of placed) {
    if (!isFillerItem(item)) continue;
    const wall = cabinetWall(item, room);
    if (!wall) continue;
    const start = wallRunOffset(item, wall, room);
    const end = start + wallRunSpan(item, wall, room);
    const length = wallLength(wall, room);
    const atWall = start <= EPSILON || end >= length - EPSILON;
    if (atWall) continue;
    // A blind corner's required filler sits beside the blind box, not mid-run.
    const besideCorner = placed.some((other) => {
      if (other.uid === item.uid || cabinetWall(other, room) !== wall) return false;
      if (!isCornerCabinet(other.masterCode, other.description)) return false;
      const otherEnd = wallRunOffset(other, wall, room) + wallRunSpan(other, wall, room);
      return Math.abs(otherEnd - start) <= EPSILON || Math.abs(wallRunOffset(other, wall, room) - end) <= EPSILON;
    });
    if (besideCorner) continue;
    byWall.set(wall, (byWall.get(wall) ?? 0) + 1);
  }
  return byWall;
}

/** A wall cabinet must take the width of the base directly beneath it. */
export function wallWidthMismatches(placed: readonly PlacedCabinet[], room: RoomData): SweepFinding[] {
  const findings: SweepFinding[] = [];
  for (const upper of placed.filter((item) => item.placement === "wall" && !isFillerItem(item))) {
    const wall = cabinetWall(upper, room);
    if (!wall) continue;
    const upperStart = wallRunOffset(upper, wall, room);
    const upperEnd = upperStart + wallRunSpan(upper, wall, room);
    const base = placed.find((item) => {
      if (item.placement !== "base" || cabinetWall(item, room) !== wall) return false;
      const start = wallRunOffset(item, wall, room);
      return Math.abs(start - upperStart) <= 1 && Math.abs(start + wallRunSpan(item, wall, room) - upperEnd) <= 1;
    });
    if (!base) continue;
    const baseWidth = wallRunSpan(base, wall, room);
    const upperWidth = wallRunSpan(upper, wall, room);
    if (Math.abs(baseWidth - upperWidth) > 0.5) {
      findings.push({
        ruleId: "wall-mirrors-base",
        code: "wall-width-differs-from-base",
        detail: `${upper.masterCode} (${upperWidth}") sits over ${base.masterCode} (${baseWidth}").`,
        cabinetUids: [upper.uid, base.uid],
      });
    }
  }
  return findings;
}

/** A blind corner with no door side renders with no door at all. */
export function blindCornersWithoutDoorSide(placed: readonly PlacedCabinet[]): SweepFinding[] {
  return placed
    .filter((item) => item.placement === "base" && isCornerCabinet(item.masterCode, item.description) && !item.swing)
    .map((item) => ({
      ruleId: "blind-corner-door-side",
      code: "blind-corner-without-door-side",
      detail: `${item.masterCode} has no door side, so the 3D view draws no door.`,
      cabinetUids: [item.uid],
    }));
}

/** Every check, for a matrix runner. */
export function sweepFindings(placed: readonly PlacedCabinet[], room: RoomData): SweepFinding[] {
  const findings = [...findOverlaps(placed, room), ...wallWidthMismatches(placed, room), ...blindCornersWithoutDoorSide(placed)];
  for (const [wall, count] of Array.from(interiorFillerCounts(placed, room))) {
    if (count > 1) {
      findings.push({
        ruleId: "one-interior-filler",
        code: "too-many-interior-fillers",
        detail: `${count} interior fillers on the ${wall} wall; one is the limit.`,
        cabinetUids: [],
      });
    }
  }
  return findings;
}