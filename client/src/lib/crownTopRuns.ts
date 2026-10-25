import {
  cabinetWall,
  crownEligibleCabinets,
  elevationBox,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
} from "@/lib/design";

/**
 * One continuous crown run: edge-touching crown-eligible uppers on the same
 * wall whose tops sit on the same line. Crown is drawn once along the run's
 * top, so the run — not the individual cabinet — is what carries a "crown
 * top" height. A wall with two runs at different tops is a mismatch the
 * designer should see before opening 3D.
 */
export type CrownTopRun = {
  wallId: string;
  /** Inches along the wall where the run starts / ends. */
  start: number;
  end: number;
  /** Crown top height (inches above the floor). */
  top: number;
  uids: string[];
  /** Plan-view centre of the run (inches). */
  centerX: number;
  centerY: number;
  /** True when another run on the same wall finishes at a different top. */
  mismatch: boolean;
  /** Tops of the other runs on this wall that differ from this one. */
  otherTops: number[];
};

const CONTACT_TOLERANCE_IN = 0.125;
const LEVEL_TOLERANCE_IN = 0.25;

export function crownTopRuns(placed: readonly PlacedCabinet[], room: RoomData): CrownTopRun[] {
  const eligible = crownEligibleCabinets(placed, room);
  const byWall = new Map<string, Array<{ p: PlacedCabinet; start: number; end: number; top: number }>>();
  for (const p of eligible) {
    const side = p.wallId ?? cabinetWall(p, room);
    const start = wallRunOffset(p, side, room);
    const span = wallRunSpan(p, side, room);
    const box = elevationBox(p, room);
    const list = byWall.get(side) ?? [];
    list.push({ p, start, end: start + span, top: box.bottom + box.height });
    byWall.set(side, list);
  }
  const runs: CrownTopRun[] = [];
  byWall.forEach((items, wallId) => {
    items.sort((a, b) => a.start - b.start || a.top - b.top);
    const wallRuns: Array<{ start: number; end: number; top: number; members: PlacedCabinet[] }> = [];
    for (const item of items) {
      const last = wallRuns.find((run) =>
        Math.abs(run.top - item.top) <= LEVEL_TOLERANCE_IN
        && item.start <= run.end + CONTACT_TOLERANCE_IN
        && item.end >= run.start - CONTACT_TOLERANCE_IN,
      );
      if (last) {
        last.end = Math.max(last.end, item.end);
        last.start = Math.min(last.start, item.start);
        last.members.push(item.p);
      } else {
        wallRuns.push({ start: item.start, end: item.end, top: item.top, members: [item.p] });
      }
    }
    const distinctTops = Array.from(new Set(wallRuns.map((run) => Math.round(run.top * 8) / 8)));
    for (const run of wallRuns) {
      const rounded = Math.round(run.top * 8) / 8;
      const otherTops = distinctTops.filter((top) => Math.abs(top - rounded) > LEVEL_TOLERANCE_IN);
      // Plan-view centre: average of member footprint centres.
      let sumX = 0;
      let sumY = 0;
      for (const member of run.members) {
        const rotated = Math.round(member.rotation) % 180 !== 0;
        const w = rotated ? member.depth : member.width;
        const d = rotated ? member.width : member.depth;
        sumX += member.x + w / 2;
        sumY += member.y + d / 2;
      }
      runs.push({
        wallId,
        start: run.start,
        end: run.end,
        top: run.top,
        uids: run.members.map((member) => member.uid),
        centerX: sumX / run.members.length,
        centerY: sumY / run.members.length,
        mismatch: otherTops.length > 0,
        otherTops,
      });
    }
  });
  return runs;
}

export function formatCrownTop(inches: number): string {
  const whole = Math.floor(inches);
  const frac = inches - whole;
  if (frac < 1 / 16) return `${whole}"`;
  const eighths = Math.round(frac * 8);
  if (eighths === 8) return `${whole + 1}"`;
  const g = (a: number, b: number): number => (b === 0 ? a : g(b, a % b));
  const d = g(eighths, 8);
  return `${whole} ${eighths / d}/${8 / d}"`;
}
