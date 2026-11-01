import {
  REFRIGERATOR_SIDE_CLEARANCE_IN,
  cabinetWall,
  elevationBox,
  refrigeratorBayRunMetrics,
  wallPlacementAt,
  wallRunFrame,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
} from "./design";

/** Tolerance when comparing a part's face to its end panels' faces. */
const FIT_EPSILON_IN = 0.05;
const OVERLAP_EPSILON_IN = 0.02;

export type RefrigeratorPanelSide = "left-panel" | "right-panel";

export type RefrigeratorPanelClampResult = {
  placed: PlacedCabinet[];
  /** Plain sentences for the material list: what was moved, clamped or added. */
  notes: string[];
  /** Things that could not be made to fit. Shown to the user; nothing is silently left poking out. */
  warnings: string[];
};

const fmt = (value: number) => String(Math.round(value * 100) / 100);

/**
 * Tom's rule (Oct 31, Nov 1): the refrigerator, and every piece of its assembly,
 * stays inside its surrounding end panels on every side. Nothing pokes through
 * or past a panel face.
 *
 * One shared pass for Auto-Design and the refrigerator options pop-up, run after
 * all fitting and shifting. It never moves a neighbor. For the assembly on one
 * refrigerator it:
 *  1. adds back a missing end panel on an open side when `addPanel` can place one
 *     without overlapping a neighbor, otherwise warns. A side that an adjoining
 *     wall closes (the corner case) needs no panel.
 *  2. checks the refrigerator's width against the opening between the panels
 *     (0.5 in clearance each side) and warns by name instead of overlapping.
 *  3. pulls the refrigerator back inside the panels' depth and height, and the
 *     cabinet above inside the panels' width, depth and height. Whatever cannot
 *     fit is kept and warned about.
 */
export function clampRefrigeratorAssemblyToPanels(input: {
  placed: readonly PlacedCabinet[];
  refrigeratorUid: string;
  room: RoomData;
  /** Builds a panel for an open side. Omit to only warn. */
  addPanel?: (side: RefrigeratorPanelSide, opening: { openingStart: number; openingEnd: number }) => PlacedCabinet | null;
}): RefrigeratorPanelClampResult {
  const { room } = input;
  let placed = [...input.placed];
  const notes: string[] = [];
  const warnings: string[] = [];
  const initial = placed.find((item) => item.uid === input.refrigeratorUid);
  if (!initial) return { placed, notes, warnings };

  const side = cabinetWall(initial, room);
  const frame = wallRunFrame(side, room);
  const along = (item: PlacedCabinet) => {
    const start = wallRunOffset(item, side, room);
    return { start, end: start + wallRunSpan(item, side, room) };
  };
  const memberOf = (role: string) => placed.find((item) => item.refrigeratorAssemblyId === initial.uid && item.refrigeratorAssemblyRole === role);

  // 1. Every open side needs a panel.
  const bay0 = refrigeratorBayRunMetrics(initial, room);
  const closedByWall: Record<RefrigeratorPanelSide, boolean> = {
    "left-panel": bay0.openingStart <= OVERLAP_EPSILON_IN,
    "right-panel": frame != null && bay0.openingEnd >= frame.length - OVERLAP_EPSILON_IN,
  };
  for (const role of ["left-panel", "right-panel"] as const) {
    if (memberOf(role) || closedByWall[role]) continue;
    const label = role === "left-panel" ? "left" : "right";
    const candidate = input.addPanel?.(role, { openingStart: bay0.openingStart, openingEnd: bay0.openingEnd }) ?? null;
    let added = false;
    if (candidate) {
      const span = along(candidate);
      const insideRun = frame == null || (span.start >= -OVERLAP_EPSILON_IN && span.end <= frame.length + OVERLAP_EPSILON_IN);
      const blocked = placed.some((other) => {
        if (other.uid === initial.uid || other.refrigeratorAssemblyId === initial.uid) return false;
        if (!["base", "tall", "appliance"].includes(other.placement)) return false;
        if (cabinetWall(other, room) !== side) return false;
        const o = along(other);
        return o.start < span.end - OVERLAP_EPSILON_IN && o.end > span.start + OVERLAP_EPSILON_IN;
      });
      if (insideRun && !blocked) {
        placed = [...placed, candidate];
        notes.push(`Refrigerator ${label} end panel added so the refrigerator stays inside its panels`);
        added = true;
      }
    }
    if (!added) warnings.push(`Refrigerator ${label} side is not closed by a panel.`);
  }

  const fridge = placed.find((item) => item.uid === initial.uid)!;
  const left = memberOf("left-panel");
  const right = memberOf("right-panel");
  const bay = refrigeratorBayRunMetrics(fridge, room);
  const fridgeWidth = bay.refrigeratorWidth;

  // 2. Width: the refrigerator sits between the inner faces of its panels.
  const innerStart = left ? along(left).end : null;
  const innerEnd = right ? along(right).start : null;
  let placedFridge = fridge;
  if (innerStart != null && innerEnd != null) {
    const usable = innerEnd - innerStart - REFRIGERATOR_SIDE_CLEARANCE_IN * 2;
    if (fridgeWidth > usable + FIT_EPSILON_IN) {
      warnings.push(`${fmt(fridgeWidth)}″ refrigerator does not fit the ${fmt(usable)}″ opening`);
    } else {
      const minStart = innerStart + REFRIGERATOR_SIDE_CLEARANCE_IN;
      const maxStart = innerEnd - REFRIGERATOR_SIDE_CLEARANCE_IN - fridgeWidth;
      const wanted = Math.min(Math.max(bay.refrigeratorStart, minStart), maxStart);
      if (Math.abs(wanted - bay.refrigeratorStart) > FIT_EPSILON_IN) {
        const spot = wallPlacementAt(wanted, fridgeWidth, Number(fridge.depth) || 0, side, room);
        placedFridge = { ...fridge, ...spot, rotation: spot.rotation };
        notes.push(`Refrigerator moved ${fmt(Math.abs(wanted - bay.refrigeratorStart))}″ so it stays between its end panels`);
      }
    }
  }

  // 3. Depth and height of the refrigerator against the panels.
  const panels = [left, right].filter((item): item is PlacedCabinet => item != null);
  if (panels.length > 0) {
    const panelDepth = Math.min(...panels.map((item) => Number(item.depth) || 0));
    const panelHeight = Math.min(...panels.map((item) => Number(item.height) || 0));
    const fridgeDepth = Number(placedFridge.depth) || 0;
    const fridgeHeight = Number(placedFridge.height) || 0;
    if (panelDepth > 0 && fridgeDepth > panelDepth + FIT_EPSILON_IN) {
      const start = wallRunOffset(placedFridge, side, room);
      const spot = wallPlacementAt(start, placedFridge.width, panelDepth, side, room);
      placedFridge = { ...placedFridge, ...spot, depth: panelDepth, rotation: spot.rotation };
      notes.push(`Refrigerator set to ${fmt(panelDepth)}" deep so it stays inside its end panels (was ${fmt(fridgeDepth)}")`);
    }
    if (panelHeight > 0 && fridgeHeight > panelHeight + FIT_EPSILON_IN) {
      placedFridge = { ...placedFridge, height: panelHeight };
      notes.push(`Refrigerator set to ${fmt(panelHeight)}" high so it stays inside its end panels (was ${fmt(fridgeHeight)}")`);
    }

    // The cabinet above (and any bridge filler): width, depth and height.
    const outerStart = Math.min(...panels.map((item) => along(item).start));
    const outerEnd = Math.max(...panels.map((item) => along(item).end));
    const bounded = left != null && right != null;
    placed = placed.map((item) => {
      if (item.uid === placedFridge.uid) return placedFridge;
      if (item.refrigeratorAssemblyId !== initial.uid) return item;
      if (item.refrigeratorAssemblyRole !== "bridge") return item;
      let next = item;
      const span = along(next);
      const width = span.end - span.start;
      if (bounded && (span.start < outerStart - FIT_EPSILON_IN || span.end > outerEnd + FIT_EPSILON_IN)) {
        if (width <= outerEnd - outerStart + FIT_EPSILON_IN) {
          const center = bay.refrigeratorStart + fridgeWidth / 2;
          const spot = wallPlacementAt(center - width / 2, width, Number(next.depth) || 0, side, room);
          next = { ...next, ...spot, rotation: spot.rotation };
          notes.push(`${item.masterCode} above the refrigerator centered so it stays inside the end panels`);
        } else {
          warnings.push(`${item.masterCode} above the refrigerator is ${fmt(width)}″ wide but the end panels are ${fmt(outerEnd - outerStart)}″ apart, so it sticks out`);
        }
      }
      const depth = Number(next.depth) || 0;
      if (panelDepth > 0 && depth > panelDepth + FIT_EPSILON_IN) {
        warnings.push(`${item.masterCode} above the refrigerator is ${fmt(depth)}" deep but the end panels are ${fmt(panelDepth)}" deep, so it sticks out ${fmt(depth - panelDepth)}" past them`);
      }
      const box = elevationBox(next, room);
      if (panelHeight > 0 && box.bottom + box.height > panelHeight + FIT_EPSILON_IN) {
        warnings.push(`${item.masterCode} above the refrigerator reaches ${fmt(box.bottom + box.height)}" but the end panels stop at ${fmt(panelHeight)}"`);
      }
      return next;
    });
  } else {
    placed = placed.map((item) => (item.uid === placedFridge.uid ? placedFridge : item));
  }

  return { placed, notes, warnings };
}
