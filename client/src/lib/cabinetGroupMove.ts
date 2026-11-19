/**
 * Group move (Tom, voice, Nov 19 2026, 7:29 AM CT): several cabinets on one wall
 * (a range with the MW-30 microwave and the W3012 bridge above it, say) are
 * selected together and slide as ONE piece by the same offset. Members never
 * block each other; the combined group is checked against everything else, the
 * wall run ends clamp the whole group, and locked pieces and seated corners
 * (ERB36 and friends) still refuse to move.
 *
 * Pure: the designer page calls this from its single move path and commits the
 * returned plan; nothing here touches the frozen 3D view or the Wall Builder.
 */
import {
  cabinetWall,
  collisionReason,
  isBlindCorner,
  isFillerItem,
  isProtectedCornerCabinet,
  isRangeOrOven,
  shouldBlockPlacementCollision,
  wallPlacementAt,
  wallRunFrame,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "./design";

const EPS = 0.01;

export type GroupMoveGap = { wallId: string; layer: "base" | "wall"; start: number; end: number };

export type GroupMoveResult =
  | {
    ok: true;
    placed: PlacedCabinet[];
    wallId: string;
    requestedDeltaIn: number;
    appliedDeltaIn: number;
    clamped: boolean;
    movedUids: string[];
    /** Per-member plan shift, so the page can carry sink fixtures with a sink base. */
    shifts: { uid: string; dx: number; dy: number }[];
    /** Spans the group left behind. The seam-filler repair must not refill them. */
    openedGaps: GroupMoveGap[];
  }
  | { ok: false; reason: string };

function layerOf(item: PlacedCabinet): "base" | "wall" {
  if (item.placement === "wall") return "wall";
  if (/^HOOD/i.test(item.masterCode ?? "")) return "wall";
  if (item.placement === "appliance" && (Number(item.mountBottom) || 0) > 30) return "wall";
  return "base";
}

function isOverRangeCompanion(item: PlacedCabinet): boolean {
  return item.overRangeMicrowaveBridge === true
    || /^HOOD/i.test(item.masterCode ?? "")
    || /bridge/i.test(item.subCategory ?? "")
    || (item.placement === "appliance" && (Number(item.mountBottom) || 0) > 30);
}

/**
 * The stack a cabinet belongs to: a range (or oven) and what hangs over it
 * (microwave, bridge, hood). Picking any one of them returns the whole stack.
 * Anything else returns the pieces stacked directly over or under it on the
 * same wall (same span), so "select stack" also works for a base and its upper.
 */
export function cabinetStackFor(placed: readonly PlacedCabinet[], room: RoomData, uid: string): string[] {
  const picked = placed.find((item) => item.uid === uid);
  if (!picked || picked.islandFace) return picked ? [picked.uid] : [];
  const wallId = cabinetWall(picked, room);
  if (!wallRunFrame(wallId, room)) return [picked.uid];
  const spanOf = (item: PlacedCabinet) => {
    const start = wallRunOffset(item, wallId, room);
    return { start, end: start + wallRunSpan(item, wallId, room) };
  };
  const sameWall = placed.filter((item) => item.uid !== picked.uid && cabinetWall(item, room) === wallId && !isFillerItem(item));
  const pickedSpan = spanOf(picked);
  const range = picked.placement === "appliance" && isRangeOrOven(picked.masterCode, picked.description) && layerOf(picked) === "base"
    ? picked
    : isOverRangeCompanion(picked)
      ? sameWall.find((item) => item.placement === "appliance" && layerOf(item) === "base" && isRangeOrOven(item.masterCode, item.description)
        && spanOf(item).start <= pickedSpan.start + 0.5 && spanOf(item).end >= pickedSpan.end - 0.5) ?? null
      : null;
  if (range) {
    const rs = spanOf(range);
    const companions = placed.filter((item) => item.uid !== range.uid && cabinetWall(item, room) === wallId && isOverRangeCompanion(item)
      && spanOf(item).start >= rs.start - 0.5 && spanOf(item).end <= rs.end + 0.5);
    return [range.uid, ...companions.map((item) => item.uid)];
  }
  const stacked = sameWall.filter((item) => layerOf(item) !== layerOf(picked)
    && Math.abs(spanOf(item).start - pickedSpan.start) <= 0.5 && Math.abs(spanOf(item).end - pickedSpan.end) <= 0.5);
  return [picked.uid, ...stacked.map((item) => item.uid)];
}

/** Add or remove one cabinet from a group selection (Shift/Ctrl-click). */
export function toggleGroupMember(group: readonly string[], uid: string): string[] {
  return group.includes(uid) ? group.filter((entry) => entry !== uid) : [...group, uid];
}

export function planGroupWallMove(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  uids: readonly string[];
  deltaAlongIn: number;
  customPlacementMode?: boolean;
}): GroupMoveResult {
  const { room } = input;
  const ids = new Set(input.uids);
  // A refrigerator travels with its own panels and cap.
  for (const item of input.placed) {
    if (item.refrigeratorAssemblyId && ids.has(item.refrigeratorAssemblyId)) ids.add(item.uid);
  }
  // A filler that belongs to a member (its seam board) travels too.
  for (const item of input.placed) {
    if (item.fillerForCabinetUid && ids.has(item.fillerForCabinetUid) && isFillerItem(item)) ids.add(item.uid);
  }
  const members = input.placed.filter((item) => ids.has(item.uid));
  if (members.length < 1) return { ok: false, reason: "Nothing is selected to move." };
  const locked = members.find((item) => item.locked);
  if (locked) return { ok: false, reason: `${locked.masterCode} is locked — unlock it before moving the group.` };
  const seated = members.find((item) => isProtectedCornerCabinet(item.masterCode, item.description ?? undefined)
    && !isBlindCorner(item.masterCode, item.description ?? undefined) && !item.cornerSnapUnlocked);
  if (seated) return { ok: false, reason: `${seated.masterCode} is locked to its seated corner, so the group cannot move. Unlock it first or leave it out of the group.` };
  if (members.some((item) => item.islandFace)) return { ok: false, reason: "Group move works along one wall; an island piece is in the group." };
  const walls = new Set(members.map((item) => cabinetWall(item, room)));
  if (walls.size !== 1) return { ok: false, reason: "Every cabinet in the group has to be on the same wall to move together." };
  const wallId = Array.from(walls)[0]!;
  const frame = wallRunFrame(wallId, room);
  if (!frame) return { ok: false, reason: "That wall has no straight run to slide along." };
  const spans = members.map((item) => {
    const start = wallRunOffset(item, wallId, room);
    return { item, start, end: start + wallRunSpan(item, wallId, room) };
  });
  const groupStart = Math.min(...spans.map((entry) => entry.start));
  const groupEnd = Math.max(...spans.map((entry) => entry.end));
  const runStart = Math.max(0, frame.runStart);
  const lo = runStart - groupStart;
  const hi = frame.runEnd - groupEnd;
  const requested = input.deltaAlongIn;
  const applied = Math.round(Math.max(lo, Math.min(hi, requested)) * 1000) / 1000;
  if (Math.abs(applied) < EPS) {
    return { ok: false, reason: "The group is already against the end of the wall run in that direction." };
  }
  const moved = spans.map(({ item, start }) => {
    const spot = wallPlacementAt(start + applied, Number(item.width) || 0, Number(item.depth) || 0, wallId as WallSide, room);
    return { ...item, ...spot } as PlacedCabinet;
  });
  const others = input.placed.filter((item) => !ids.has(item.uid));
  for (const candidate of moved) {
    if (isFillerItem(candidate)) continue;
    if (shouldBlockPlacementCollision(candidate, others, Boolean(input.customPlacementMode), room)) {
      const reason = collisionReason(candidate, others, room);
      return { ok: false, reason: reason ?? `${candidate.masterCode} would overlap an item outside the group, so the group was not moved.` };
    }
  }
  const movedById = new Map(moved.map((item) => [item.uid, item]));
  const openedGaps: GroupMoveGap[] = [];
  for (const layer of ["base", "wall"] as const) {
    const layerSpans = spans.filter((entry) => layerOf(entry.item) === layer);
    if (!layerSpans.length) continue;
    const start = Math.min(...layerSpans.map((entry) => entry.start));
    const end = Math.max(...layerSpans.map((entry) => entry.end));
    if (applied > 0) openedGaps.push({ wallId, layer, start, end: Math.min(end, start + applied) });
    else openedGaps.push({ wallId, layer, start: Math.max(start, end + applied), end });
  }
  return {
    ok: true,
    placed: input.placed.map((item) => movedById.get(item.uid) ?? item),
    wallId,
    requestedDeltaIn: requested,
    appliedDeltaIn: applied,
    clamped: Math.abs(applied - requested) > EPS,
    movedUids: moved.map((item) => item.uid),
    shifts: moved.map((item) => {
      const before = input.placed.find((entry) => entry.uid === item.uid)!;
      return { uid: item.uid, dx: item.x - before.x, dy: item.y - before.y };
    }),
    openedGaps,
  };
}

/** A seam-filler board the repair wants to add inside a span a group move or swap just opened. */
export function fillerInsideOpenedGap(filler: PlacedCabinet, gaps: readonly GroupMoveGap[], room: RoomData): boolean {
  const wallId = cabinetWall(filler, room);
  const start = wallRunOffset(filler, wallId, room);
  const end = start + wallRunSpan(filler, wallId, room);
  const layer = layerOf(filler);
  return gaps.some((gap) => gap.wallId === wallId && gap.layer === layer && start < gap.end + 0.05 && end > gap.start - 0.05);
}
