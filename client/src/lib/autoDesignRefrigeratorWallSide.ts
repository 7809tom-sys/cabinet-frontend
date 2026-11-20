/**
 * Refrigerator: no excess fillers (Tom, voice, Nov 19 2026, 7:41 AM CT).
 *
 * Only the OPEN side of a refrigerator needs its end panel. The side against a
 * wall needs no panel and no filler. When a build seats a refrigerator at a wall
 * end with a panel (or a filler) on that wall side, this pass removes them,
 * sets the refrigerator against the wall, and closes the open-side panel onto
 * the appliance (dropping the "inside the panel" filler too). The inches freed
 * show up beside the open-side panel, where the minimum-filler pass (which runs
 * next) turns them into a bigger cabinet or a strip at a run end.
 *
 * Budget friendly keeps its own rule: no refrigerator panels at all, so here it
 * only loses any wall-side filler.
 */
import { BRIDGE_FILLER_WIDTH_IN, isBridgeHalfInchFiller } from "./bridgeHalfInchFillers";
import {
  cabinetWall,
  isFillerItem,
  isPanelItem,
  isRefrigerator,
  wallPlacementAtUnbounded,
  wallRunFrame,
  wallRunJoinAt,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "./design";

/** A panel or filler whose outer edge is this close to the wall end is on the wall side. */
export const REFRIGERATOR_WALL_SIDE_REACH_IN = 3;
/**
 * Standard mode (Tom, Nov 20 2026, 4:14 / 4:33 PM CT): slide the refrigerator
 * flush to a free wall end. Reach is measured to the wall-side panel or the
 * empty gap, not only the appliance box, and the cap is at least the budget
 * 6.05 in slide. The wall-side panel and filler come off; one open-side panel
 * stays.
 */
export const STANDARD_FRIDGE_SLIDE_MAX_IN = 6.05;
const EPS = 0.01;

export function trimRefrigeratorWallSide(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  /** True when the wall joined at this end carries no run, so the fridge may sit flush there. */
  isFreeWallEnd?: (joinedWallId: string | null) => boolean;
  /** How far the fridge may slide in standard mode. Defaults to STANDARD_FRIDGE_SLIDE_MAX_IN. */
  maxSlideIn?: number;
}): { placed: PlacedCabinet[]; notes: string[]; removedUids: string[] } {
  let working = [...input.placed];
  const notes: string[] = [];
  const removedUids: string[] = [];
  const fridges = working.filter((item) => isRefrigerator(item) && item.placement === "appliance" && !item.islandFace);
  for (const fridgeAtStart of fridges) {
    const fridge = working.find((item) => item.uid === fridgeAtStart.uid);
    if (!fridge) continue;
    const wallId = cabinetWall(fridge, input.room);
    const frame = wallRunFrame(wallId, input.room);
    if (!frame) continue;
    const runStart = Math.max(0, frame.runStart);
    const runEnd = frame.runEnd;
    const spanOf = (item: PlacedCabinet) => {
      const start = wallRunOffset(item, wallId, input.room);
      return { start, end: start + wallRunSpan(item, wallId, input.room) };
    };
    const f = spanOf(fridge);
    const members = working.filter((item) => item.refrigeratorAssemblyId === fridge.uid);
    const panels = members.filter((item) => item.refrigeratorAssemblyRole === "left-panel" || item.refrigeratorAssemblyRole === "right-panel");
    const maxSlide = input.maxSlideIn ?? STANDARD_FRIDGE_SLIDE_MAX_IN;
    const isFreeWallEnd = input.isFreeWallEnd ?? (() => true);
    for (const end of ["start", "end"] as const) {
      const wallEdge = end === "start" ? runStart : runEnd;
      const gapToWall = end === "start" ? f.start - wallEdge : wallEdge - f.end;
      if (gapToWall < -EPS || gapToWall > maxSlide + EPS) continue;
      const joined = wallRunJoinAt(frame, end, input.room);
      if (!isFreeWallEnd(joined?.frame.id ?? null)) continue;
      const role = end === "start" ? "left-panel" : "right-panel";
      // Everything between the wall end and the refrigerator on this wall: the wall-side panel
      // (it may overlap the appliance box) and/or filler boards.
      const between = working.filter((item) => {
        if (item.uid === fridge.uid || cabinetWall(item, input.room) !== wallId) return false;
        const s = spanOf(item);
        if (panels.includes(item)) {
          return item.refrigeratorAssemblyRole === role
            && (end === "start" ? s.start - wallEdge <= REFRIGERATOR_WALL_SIDE_REACH_IN + EPS : wallEdge - s.end <= REFRIGERATOR_WALL_SIDE_REACH_IN + EPS);
        }
        const inside = end === "start" ? s.end <= f.start + EPS && s.start >= wallEdge - EPS : s.start >= f.end - EPS && s.end <= wallEdge + EPS;
        return inside && (isFillerItem(item) || isPanelItem(item));
      });
      const blocking = working.some((item) => {
        if (item.uid === fridge.uid || between.includes(item) || cabinetWall(item, input.room) !== wallId) return false;
        if (item.placement === "wall" && item.refrigeratorAssemblyId !== fridge.uid) return false;
        const s = spanOf(item);
        return end === "start" ? s.start < f.start - EPS && s.end > wallEdge + EPS : s.end > f.end + EPS && s.start < wallEdge - EPS;
      });
      // Reach is measured to the wall-side panel or the empty gap, not only
      // the fridge box. A 4 in stand-off with a panel in the gap still slides.
      const reachEdge = between.reduce((edge, item) => {
        const s = spanOf(item);
        const itemEdge = end === "start" ? s.start : s.end;
        return end === "start" ? Math.min(edge, itemEdge) : Math.max(edge, itemEdge);
      }, end === "start" ? f.start : f.end);
      const reach = end === "start" ? reachEdge - wallEdge : wallEdge - reachEdge;
      if (reach > maxSlide + EPS) continue;
      if (blocking) continue;
      if (!between.length && gapToWall <= EPS) continue;
      const delta = end === "start" ? wallEdge - f.start : wallEdge - f.end; // toward the wall
      // The open side: the other panel and any filler between it and the refrigerator.
      const openPanel = panels.find((panel) => !between.includes(panel)) ?? null;
      const insideFillers = openPanel
        ? working.filter((item) => {
          if (!isFillerItem(item) || isPanelItem(item) || cabinetWall(item, input.room) !== wallId) return false;
          const s = spanOf(item);
          const p = spanOf(openPanel);
          return end === "start" ? s.start >= f.end - EPS && s.end <= p.start + EPS : s.end <= f.start + EPS && s.start >= p.end - EPS;
        })
        : [];
      // The bridge's 1/2" board on the open side is required, so it stays (Rich's bridge rule).
      const keepInside = insideFillers.filter((item) => isBridgeHalfInchFiller(item));
      const dropInside = insideFillers.filter((item) => !isBridgeHalfInchFiller(item));
      const hasBridgeBoardOnOpenSide = keepInside.length > 0 || working.some((item) => item.refrigeratorAssemblyId === fridge.uid
        && isBridgeHalfInchFiller(item) && item.fillerPlacementMode === (end === "start" ? "right" : "left"));
      const removeIds = new Set([...between, ...dropInside].map((item) => item.uid));
      const movedFridgeStart = f.start + delta;
      const movedFridgeEnd = f.end + delta;
      working = working
        .filter((item) => !removeIds.has(item.uid))
        .map((item) => {
          if (item.uid === fridge.uid || (item.refrigeratorAssemblyId === fridge.uid && item !== openPanel)) {
            const s = spanOf(item);
            const spot = wallPlacementAtUnbounded(s.start + delta, Number(item.width) || 0, Number(item.depth) || 0, wallId as WallSide, input.room);
            return { ...item, ...spot };
          }
          if (openPanel && item.uid === openPanel.uid) {
            const width = Number(item.width) || 0;
            // Rich's bridge rule: when the bridge keeps its 1/2" board on this side, the panel stands beyond
            // that board (the 37" opening), not against the appliance.
            const bridgeBoard = hasBridgeBoardOnOpenSide ? BRIDGE_FILLER_WIDTH_IN : 0;
            const along = end === "start" ? movedFridgeEnd + bridgeBoard : movedFridgeStart - bridgeBoard - width;
            const spot = wallPlacementAtUnbounded(along, width, Number(item.depth) || 0, wallId as WallSide, input.room);
            return { ...item, ...spot };
          }
          return item;
        });
      removedUids.push(...Array.from(removeIds));
      const removedText = [...between, ...dropInside].map((item) => item.masterCode).join(", ");
      notes.push(`Refrigerator: the wall side needs no end panel and no filler, so ${removedText} ${between.length + dropInside.length === 1 ? "was" : "were"} removed and ${fridge.masterCode} sits against the wall${openPanel ? `; only the open side keeps its ${openPanel.masterCode} panel` : ""}.`);
      break;
    }
  }
  return { placed: working, notes, removedUids };
}
