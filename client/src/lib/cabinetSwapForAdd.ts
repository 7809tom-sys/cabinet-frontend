/**
 * Swap offer when a cabinet does not fit (Tom, voice, Nov 19 2026, 7:28 AM CT).
 *
 * When Add is refused because no opening is wide enough, the designer offers to
 * swap an existing cabinet for the new one instead: e.g. a 24 in drawer base on
 * a wall whose only free space is a 6 in end filler (F642) beside a B18 -> swap
 * the B18 for the 24, slide its neighbors, and absorb the end filler. Nothing is
 * applied until the person confirms. The refusal message also says how many
 * inches are actually free and what is sitting there.
 *
 * Pure planning only. Corners, sinks, appliances, panels, bridges, locked items
 * and required corner fillers never move; only plain run cabinets slide and only
 * ordinary seam/end fillers are absorbed.
 */
import {
  cabinetWall,
  isFillerItem,
  isPanelItem,
  isSinkBaseCabinet,
  wallPlacementAt,
  wallRunFrame,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
  type WallSide,
} from "./design";
import { cabinetFamilyToken, formatFillerInches, isProtectedCornerFiller, isRunCabinet, type FillerLayer } from "./autoDesignFillerConsolidation";
import type { GroupMoveGap } from "./cabinetGroupMove";

const EPS = 0.01;

type RowItem = { item: PlacedCabinet; start: number; end: number; role: "run" | "slide" | "filler" | "fixed" };

function inLayer(item: PlacedCabinet, layer: FillerLayer): boolean {
  if (item.placement === "tall") return true;
  const upper = item.placement === "wall" || /^HOOD/i.test(item.masterCode ?? "") || (item.placement === "appliance" && (Number(item.mountBottom) || 0) > 30);
  return layer === "wall" ? upper : !upper && (item.placement === "base" || item.placement === "appliance");
}

function rowItems(placed: readonly PlacedCabinet[], room: RoomData, wallId: string, layer: FillerLayer): RowItem[] {
  return placed
    .filter((item) => !item.islandFace && inLayer(item, layer) && cabinetWall(item, room) === wallId)
    .map((item) => {
      const start = wallRunOffset(item, wallId, room);
      const end = start + wallRunSpan(item, wallId, room);
      const filler = isFillerItem(item) && !isPanelItem(item) && !item.locked && !item.fillerTransitionKind && !isProtectedCornerFiller(item, placed, room);
      const run = !filler && !item.locked && isRunCabinet(item, layer);
      // A sink base and a dishwasher keep their width but may slide (the person confirms first).
      const slide = !filler && !run && !item.locked && layer === "base"
        && (isSinkBaseCabinet(item) || (item.placement === "appliance" && /^DW/i.test(item.masterCode ?? "")));
      return { item, start, end, role: filler ? "filler" : run ? "run" : slide ? "slide" : "fixed" } as RowItem;
    })
    .filter((entry) => entry.end - entry.start > EPS)
    .sort((a, b) => a.start - b.start);
}

export type FreeSpaceSummary = {
  /** Widest clear (open) stretch, in inches. */
  largestOpenIn: number;
  /** Open inches plus ordinary filler boards on the wall row. */
  freeIn: number;
  /** Widest single stretch a cabinet could take (clear inches plus filler boards). */
  largestContiguousIn: number;
  /** The pieces that split the free inches, when there is more than one stretch. */
  splitBy: string[];
  fillers: { masterCode: string; widthIn: number }[];
  text: string;
};

/** "Only 6″ free (F642 filler)" style summary for a refused Add. */
export function describeFreeSpaceOnWall(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings: readonly WallOpening[];
  wallId: string;
  layer: FillerLayer;
}): FreeSpaceSummary {
  const frame = wallRunFrame(input.wallId, input.room);
  const rows = rowItems(input.placed, input.room, input.wallId, input.layer);
  const solids = rows.filter((entry) => entry.role !== "filler").map((entry) => ({ start: entry.start, end: entry.end }));
  for (const opening of input.openings) {
    if (opening.side !== input.wallId) continue;
    if (input.layer === "base" && (Number(opening.sill) || 0) >= 34.5) continue;
    solids.push({ start: opening.offset, end: opening.offset + opening.width });
  }
  solids.sort((a, b) => a.start - b.start);
  let cursor = frame ? Math.max(0, frame.runStart) : 0;
  const runEnd = frame ? frame.runEnd : cursor;
  let largestOpenIn = 0;
  let openIn = 0;
  const fillerSpans = rows.filter((entry) => entry.role === "filler");
  const clearOf = (a: number, b: number) => {
    // open part of [a,b] not covered by filler boards
    let clear = b - a;
    for (const filler of fillerSpans) clear -= Math.max(0, Math.min(b, filler.end) - Math.max(a, filler.start));
    return Math.max(0, clear);
  };
  for (const solid of solids) {
    if (solid.start > cursor + EPS) {
      const clear = clearOf(cursor, solid.start);
      openIn += clear;
      largestOpenIn = Math.max(largestOpenIn, clear);
    }
    cursor = Math.max(cursor, solid.end);
  }
  if (runEnd > cursor + EPS) {
    const clear = clearOf(cursor, runEnd);
    openIn += clear;
    largestOpenIn = Math.max(largestOpenIn, clear);
  }
  const fillers = fillerSpans.map((entry) => ({ masterCode: entry.item.masterCode, widthIn: Math.round((entry.end - entry.start) * 1000) / 1000 }));
  const fillerIn = fillers.reduce((sum, entry) => sum + entry.widthIn, 0);
  const freeIn = Math.round((openIn + fillerIn) * 1000) / 1000;
  const parts: string[] = [];
  if (fillers.length) parts.push(fillers.map((entry) => `${entry.masterCode} filler ${formatFillerInches(entry.widthIn)}`).join(", "));
  if (openIn >= 0.125) parts.push(`${formatFillerInches(openIn)} open`);
  // Largest contiguous opening (clear inches plus ordinary filler boards, which a cabinet could take)
  // and the pieces that split the free inches into smaller stretches.
  const chunks: { start: number; end: number }[] = [];
  let at = frame ? Math.max(0, frame.runStart) : 0;
  const solidItems = rows.filter((entry) => entry.role !== "filler");
  const solidSpans = [...solidItems.map((entry) => ({ start: entry.start, end: entry.end, code: entry.item.masterCode })),
    ...input.openings.filter((opening) => opening.side === input.wallId && (input.layer === "wall" || (Number(opening.sill) || 0) < 34.5))
      .map((opening) => ({ start: opening.offset, end: opening.offset + opening.width, code: "window/door" }))].sort((a, b) => a.start - b.start);
  for (const solid of solidSpans) {
    if (solid.start > at + 0.125) chunks.push({ start: at, end: solid.start });
    at = Math.max(at, solid.end);
  }
  if (runEnd > at + 0.125) chunks.push({ start: at, end: runEnd });
  const largestContiguousIn = Math.round(Math.max(0, ...chunks.map((chunk) => chunk.end - chunk.start)) * 1000) / 1000;
  const splitters = chunks.length > 1
    ? Array.from(new Set(solidSpans.filter((solid) => solid.start >= chunks[0]!.end - 0.01 && solid.end <= chunks[chunks.length - 1]!.start + 0.01).map((solid) => solid.code)))
    : [];
  const splitText = chunks.length > 1
    ? ` The largest single opening is ${formatFillerInches(largestContiguousIn)}; the free inches are split by ${splitters.join(", ") || "other pieces"}.`
    : "";
  const text = freeIn < 0.125
    ? "No inches are free on this wall row."
    : `Only ${formatFillerInches(freeIn)} free${parts.length ? ` (${parts.join("; ")})` : ""}.${splitText}`;
  return { largestOpenIn: Math.round(largestOpenIn * 1000) / 1000, largestContiguousIn, splitBy: splitters, freeIn, fillers, text };
}

export type SwapForAddPlan = {
  wallId: string;
  layer: FillerLayer;
  replaceUid: string;
  replaceCode: string;
  newWidthIn: number;
  /** Where the new cabinet goes, as a run offset on `wallId`. */
  newStartIn: number;
  removedFillerUids: string[];
  removedFillerCodes: string[];
  slid: { uid: string; masterCode: string; deltaIn: number; dx: number; dy: number; isSinkBase: boolean }[];
  leftoverIn: number;
  leftoverAt: "wall-end" | "beside-fixed" | "none";
  /** The plan without the replaced cabinet and fillers, neighbors slid; the new cabinet is added next. */
  placedWithoutNew: PlacedCabinet[];
  /** Spans the slide left open; the seam-filler repair must not refill them. */
  openedGaps: GroupMoveGap[];
  question: string;
};

/**
 * Best swap that makes room for a `newWidthIn` cabinet on one wall row, or null.
 * The window is a stretch of plain run cabinets and ordinary fillers between two
 * fixed pieces (or a wall end). One run cabinet is replaced by the new one, the
 * others keep their order and widths and slide, and the fillers are absorbed.
 */
export function planSwapForAdd(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings: readonly WallOpening[];
  wallId: string;
  layer: FillerLayer;
  newMasterCode: string;
  newWidthIn: number;
}): SwapForAddPlan | null {
  const { room, wallId, layer } = input;
  const frame = wallRunFrame(wallId, room);
  if (!frame || !(input.newWidthIn > 0)) return null;
  const rows = rowItems(input.placed, room, wallId, layer);
  const bounds: { start: number; end: number; kind: "wall-end" | "fixed" }[] = [
    { start: frame.runStart - 1, end: Math.max(0, frame.runStart), kind: "wall-end" as const },
    ...rows.filter((entry) => entry.role === "fixed").map((entry) => ({ start: entry.start, end: entry.end, kind: "fixed" as const })),
    ...input.openings.filter((opening) => opening.side === wallId && (layer === "wall" || (Number(opening.sill) || 0) < 34.5))
      .map((opening) => ({ start: opening.offset, end: opening.offset + opening.width, kind: "wall-end" as const })),
    { start: frame.runEnd, end: frame.runEnd + 1, kind: "wall-end" as const },
  ].sort((a, b) => a.start - b.start);
  const newFamily = cabinetFamilyToken(input.newMasterCode);
  let best: { plan: SwapForAddPlan; score: number } | null = null;
  for (let i = 0; i + 1 < bounds.length; i += 1) {
    const left = bounds[i]!;
    const right = bounds[i + 1]!;
    const start = left.end;
    const end = right.start;
    if (end - start < input.newWidthIn - EPS) continue;
    const inside = rows.filter((entry) => entry.role !== "fixed" && (entry.start + entry.end) / 2 > start && (entry.start + entry.end) / 2 < end);
    const runs = inside.filter((entry) => entry.role === "run" || entry.role === "slide");
    const fillers = inside.filter((entry) => entry.role === "filler");
    for (const target of runs.filter((entry) => entry.role === "run")) {
      const others = runs.filter((entry) => entry !== target);
      const used = others.reduce((sum, entry) => sum + (entry.end - entry.start), 0) + input.newWidthIn;
      const leftover = Math.round((end - start - used) * 1000) / 1000;
      if (leftover < -EPS) continue;
      // Pack against the fixed side so the leftover lands at a wall end (never between cabinets) when it can.
      const packFromLeft = left.kind === "fixed" || right.kind === "wall-end";
      const leftoverAt: SwapForAddPlan["leftoverAt"] = leftover < 0.125 ? "none" : (packFromLeft ? right.kind : left.kind) === "wall-end" ? "wall-end" : "beside-fixed";
      let cursor = packFromLeft ? start : start + Math.max(0, leftover);
      const slid: SwapForAddPlan["slid"] = [];
      const replaced = new Map<string, PlacedCabinet>();
      let newStart = cursor;
      for (const entry of runs) {
        if (entry === target) {
          newStart = cursor;
          cursor += input.newWidthIn;
          continue;
        }
        const width = entry.end - entry.start;
        const delta = Math.round((cursor - entry.start) * 1000) / 1000;
        if (Math.abs(delta) > EPS) {
          const spot = wallPlacementAt(cursor, Number(entry.item.width) || width, Number(entry.item.depth) || 0, wallId as WallSide, room);
          replaced.set(entry.item.uid, { ...entry.item, ...spot });
          slid.push({
            uid: entry.item.uid, masterCode: entry.item.masterCode, deltaIn: delta,
            dx: spot.x - entry.item.x, dy: spot.y - entry.item.y, isSinkBase: isSinkBaseCabinet(entry.item),
          });
        }
        cursor += width;
      }
      const removedIds = new Set([target.item.uid, ...fillers.map((entry) => entry.item.uid)]);
      const placedWithoutNew = input.placed.filter((item) => !removedIds.has(item.uid)).map((item) => replaced.get(item.uid) ?? item);
      const sameFamily = cabinetFamilyToken(target.item.masterCode) === newFamily ? 0 : 1;
      const score = (leftoverAt === "beside-fixed" ? 1000 : 0) + slid.length * 2 + sameFamily * 3
        + Math.abs((target.end - target.start) - input.newWidthIn) * 0.5 + leftover * 0.1;
      const leftoverSpan = leftover >= 0.125
        ? packFromLeft ? { start: end - leftover, end } : { start, end: start + leftover }
        : null;
      const fillerText = fillers.length ? `, absorb the ${fillers.map((entry) => `${formatFillerInches(entry.end - entry.start)} ${entry.item.masterCode}`).join(" and ")} filler${fillers.length === 1 ? "" : "s"}` : "";
      const slideText = slid.length ? `, slide ${slid.map((entry) => `${entry.masterCode} ${formatFillerInches(Math.abs(entry.deltaIn))}`).join(", ")}` : "";
      const fixtureText = slid.some((entry) => entry.isSinkBase) ? " The sink and faucet move with the sink base; the uppers above stay where they are." : "";
      const leftoverText = leftover >= 0.125 ? ` ${formatFillerInches(leftover)} stays open ${leftoverAt === "wall-end" ? "at the wall end" : "beside the fixed piece"}.` : "";
      const plan: SwapForAddPlan = {
        wallId, layer,
        replaceUid: target.item.uid,
        replaceCode: target.item.masterCode,
        newWidthIn: input.newWidthIn,
        newStartIn: Math.round(newStart * 1000) / 1000,
        removedFillerUids: fillers.map((entry) => entry.item.uid),
        removedFillerCodes: fillers.map((entry) => entry.item.masterCode),
        slid,
        leftoverIn: Math.max(0, leftover),
        leftoverAt,
        placedWithoutNew,
        openedGaps: leftoverSpan ? [{ wallId, layer, ...leftoverSpan }] : [],
        question: `Swap ${target.item.masterCode} for ${input.newMasterCode}${slideText}${fillerText}?${leftoverText}${fixtureText} Nothing changes unless you confirm.`,
      };
      if (!best || score < best.score) best = { plan, score };
    }
  }
  return best?.plan ?? null;
}
