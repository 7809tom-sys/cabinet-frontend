/**
 * Exposed-side panel accounting for a wall run.
 *
 * Tom (Nov 9 2026, issue #354): a 3/4" panel is a REAL-WIDTH item in the run. It
 * occupies 3/4" of wall length exactly like a cabinet or a filler, so:
 *
 *   - every cabinet after it shifts by that 3/4";
 *   - wall-length, fit and remaining-space maths count it;
 *   - the base run and the wall run stay aligned to each other and to the true
 *     wall, so there is no 3/4" drift per panel across a run.
 *
 * This module is the single place that answers "what does this run really
 * contain, and does it fit?". It reads the placed items as they are (panels are
 * already real rows with a real width), so the plan, the 2D elevation, the 3D
 * view and the dimension labels all measure the same numbers.
 *
 * Nothing here invents a board or moves a cabinet: it measures, and it reports
 * the runs that do not fit so Auto Design can resize, swap or refuse with a
 * visible reason instead of overlapping or silently overrunning.
 */
import {
  STD,
  cabinetWall,
  isFillerItem,
  isPanelItem,
  wallLength,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "./design";

/** A panel is 3/4" stock; a skin is the 1/4" sheet the framed lines sell. */
export const EXPOSED_PANEL_THICKNESS_IN = STD.PANEL_THICKNESS;
export const SKIN_THICKNESS_IN = 0.25;

export type RunLayer = "base" | "wall";

export type RunContribution = {
  uid: string;
  masterCode: string;
  kind: "cabinet" | "panel" | "filler" | "appliance";
  startIn: number;
  widthIn: number;
  endIn: number;
};

export type WallRunAccounting = {
  wallId: WallSide;
  layer: RunLayer;
  /** Every item that really occupies this run, in along-wall order. */
  contributions: RunContribution[];
  cabinetIn: number;
  panelIn: number;
  fillerIn: number;
  applianceIn: number;
  /** cabinets + panels + fillers + appliances, in inches. */
  totalIn: number;
  /** The usable length of this wall, in inches. */
  wallLengthIn: number;
  /** Space left with nothing in it, in inches. */
  remainingIn: number;
  /** True when the run exceeds the wall it stands on. */
  overruns: boolean;
};

function layerOf(item: PlacedCabinet): RunLayer {
  return item.placement === "wall" ? "wall" : "base";
}

function kindOf(item: PlacedCabinet): RunContribution["kind"] {
  if (isPanelItem(item)) return "panel";
  if (isFillerItem(item)) return "filler";
  if (item.placement === "appliance") return "appliance";
  return "cabinet";
}

const roundIn = (value: number) => Math.round(value * 1000) / 1000;

/**
 * The true contents of one wall run on one layer.
 *
 * A tall pantry is deliberately counted on BOTH layers: it physically blocks the
 * whole height of the wall, so neither run may be tiled through it.
 */
export function wallRunAccounting(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  wallId: WallSide;
  layer: RunLayer;
  /** Item uids to ignore (used when measuring a run around a candidate). */
  ignoreUids?: readonly string[];
}): WallRunAccounting {
  const ignore = new Set(input.ignoreUids ?? []);
  const contributions: RunContribution[] = [];
  for (const item of input.placed) {
    if (ignore.has(item.uid)) continue;
    if (item.islandFace) continue;
    if (cabinetWall(item, input.room) !== input.wallId) continue;
    const spansBoth = item.placement === "tall";
    if (!spansBoth && layerOf(item) !== input.layer) continue;
    const startIn = roundIn(wallRunOffset(item, input.wallId, input.room));
    const widthIn = roundIn(wallRunSpan(item, input.wallId, input.room));
    if (!(widthIn > 0)) continue;
    contributions.push({
      uid: item.uid,
      masterCode: item.masterCode ?? "",
      kind: kindOf(item),
      startIn,
      widthIn,
      endIn: roundIn(startIn + widthIn),
    });
  }
  contributions.sort((left, right) => left.startIn - right.startIn);
  const sum = (kind: RunContribution["kind"]) => roundIn(contributions
    .filter((entry) => entry.kind === kind)
    .reduce((total, entry) => total + entry.widthIn, 0));
  const cabinetIn = sum("cabinet");
  const panelIn = sum("panel");
  const fillerIn = sum("filler");
  const applianceIn = sum("appliance");
  const totalIn = roundIn(cabinetIn + panelIn + fillerIn + applianceIn);
  const wallLengthIn = roundIn(wallLength(input.wallId, input.room));
  return {
    wallId: input.wallId,
    layer: input.layer,
    contributions,
    cabinetIn,
    panelIn,
    fillerIn,
    applianceIn,
    totalIn,
    wallLengthIn,
    remainingIn: roundIn(wallLengthIn - totalIn),
    overruns: totalIn > wallLengthIn + 0.01,
  };
}

/**
 * True when the base run and the wall run on this wall agree about where the
 * 3/4" panels sit. Each panel takes real length, so a base panel with no
 * matching wall panel (or one at a different offset) is what makes an elevation
 * drift off its lowers.
 */
export function layerAlignment(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  wallId: WallSide;
  toleranceIn?: number;
}): { aligned: boolean; basePanels: number[]; wallPanels: number[]; mismatched: number[] } {
  const tolerance = input.toleranceIn ?? 0.01;
  const base = wallRunAccounting({ placed: input.placed, room: input.room, wallId: input.wallId, layer: "base" });
  const wall = wallRunAccounting({ placed: input.placed, room: input.room, wallId: input.wallId, layer: "wall" });
  const pick = (accounting: WallRunAccounting) => accounting.contributions
    .filter((entry) => entry.kind === "panel")
    .map((entry) => entry.startIn);
  const basePanels = pick(base);
  const wallPanels = pick(wall);
  const mismatched = basePanels.filter((offset) => !wallPanels.some((other) => Math.abs(other - offset) <= tolerance));
  return { aligned: mismatched.length === 0, basePanels, wallPanels, mismatched };
}

export type RunFitProblem = {
  wallId: WallSide;
  layer: RunLayer;
  reason: string;
  overrunIn: number;
};

/**
 * Every run on the wall that does not fit. Auto Design reads this and resizes or
 * swaps a cabinet, or refuses with the reason — it never overlaps and never
 * silently runs past the wall.
 */
export function runFitProblems(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  wallIds?: readonly WallSide[];
}): RunFitProblem[] {
  const walls = input.wallIds
    ?? (Array.from(new Set(input.placed
      .map((item) => cabinetWall(item, input.room))
      .filter((side): side is WallSide => Boolean(side)))) as WallSide[]);
  const problems: RunFitProblem[] = [];
  for (const wallId of walls) {
    for (const layer of ["base", "wall"] as const) {
      const accounting = wallRunAccounting({ placed: input.placed, room: input.room, wallId, layer });
      if (!accounting.overruns) continue;
      const overrunIn = roundIn(accounting.totalIn - accounting.wallLengthIn);
      problems.push({
        wallId,
        layer,
        overrunIn,
        reason: `The ${layer} run on the ${wallId} wall needs ${accounting.totalIn}″ (cabinets ${accounting.cabinetIn}″ + panels ${accounting.panelIn}″ + fillers ${accounting.fillerIn}″ + appliances ${accounting.applianceIn}″) but the wall is ${accounting.wallLengthIn}″: ${overrunIn}″ over.`,
      });
    }
  }
  return problems;
}

/** The panel thickness a placed row contributes, or 0 when it is not a panel. */
export function panelRunThicknessIn(item: PlacedCabinet): number {
  if (!isPanelItem(item)) return 0;
  const width = Number(item.width);
  return Number.isFinite(width) && width > 0 ? width : EXPOSED_PANEL_THICKNESS_IN;
}
