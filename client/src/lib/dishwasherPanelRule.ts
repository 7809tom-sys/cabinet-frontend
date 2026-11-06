/**
 * Owner rule: a dishwasher that ends a run, or a run that turns at an angle
 * (such as 45°) on the dishwasher, carries a dishwasher panel.
 *
 * The piece is the real DWR dishwasher return panel — a panel item, never an
 * accessory and never a cabinet box. It is placed at the dishwasher's open end
 * so the run is finished exactly the way a base cabinet end is:
 *
 *   • end of run — the DWR closes the run beside the dishwasher instead of
 *     leaving the appliance side open or trying to cover it with a 3/4" skin.
 *     Its run span is counter-bearing, so the continuous top runs over it and
 *     stops at the finished end of the run, exactly as it would past a cabinet.
 *   • 45° turn — the DWR fills the fitted corner slot at the dishwasher's end,
 *     inside the mandatory 11" hold. That pocket is already closed at counter
 *     height by the measured-wall miter and its corner infill, so the top runs
 *     continuously over the angled dishwasher and the panel from one cabinet to
 *     the next, with one real mitered seam and no gap or break.
 *
 * One panel per dishwasher end, keyed to the dishwasher, so a sync is
 * idempotent. A line that sells no dishwasher panel is reported as a
 * design-check warning; no SKU, price, or zero-dollar line is ever invented.
 *
 * A 90° corner is a flush corner already closed by the adjoining run, so a
 * dishwasher seated at one only gets this panel when its side is truly open.
 */
import {
  STD,
  cabinetCollisionDetail,
  cabinetPlacementCollisionDetail,
  cabinetWall,
  DISHWASHER_FORTY_FIVE_PANEL_REASON,
  DISHWASHER_RUN_END_PANEL_REASON,
  insideCornerHoldIn,
  isBaseHeightAppliance,
  isPanelItem,
  roomWallRunFrames,
  wallPlacementAt,
  wallRunJoinAt,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
  type WallRunFrame,
  type WallSide,
} from "./design";
import { kitchenRuleNumber } from "./kitchenRuleParameters";

/** Panel-stock fields this rule needs; the Designer passes its accessory catalog. */
export type DishwasherPanelStock = {
  id: number;
  masterCode: string;
  description?: string | null;
  category?: string | null;
  subCategory?: string | null;
  width?: number | string | null;
  height?: number | string | null;
  depth?: number | string | null;
  price: number | null;
};

export const DISHWASHER_PANEL_REASONS = {
  [DISHWASHER_RUN_END_PANEL_REASON]: "Auto-added: dishwasher panel at end of run",
  [DISHWASHER_FORTY_FIVE_PANEL_REASON]: "Auto-added: dishwasher panel at the angled turn",
} as const;

export { DISHWASHER_FORTY_FIVE_PANEL_REASON, DISHWASHER_RUN_END_PANEL_REASON };

export type DishwasherPanelReason = keyof typeof DISHWASHER_PANEL_REASONS;

export type DishwasherPanelWarning = {
  id: string;
  cabinetUid: string;
  reason: DishwasherPanelReason;
  message: string;
};

export type DishwasherPanelPlan = {
  placed: PlacedCabinet[];
  warnings: DishwasherPanelWarning[];
};

const EPS = 1 / 16;
/** DWR stock is printed as a 3-inch return (3" x 34-1/2" x 24"). */
export const DISHWASHER_PANEL_DEFAULT_WIDTH_IN = 3;
/** Wider than this and the piece is no longer a dishwasher return panel. */
export const DISHWASHER_PANEL_MAX_WIDTH_IN = 6;
/**
 * Depth a neighbouring cabinet body may reach into the fitted 45° corner slot
 * before it counts as an obstruction. At a 45° inside corner the cabinet bodies
 * legitimately reach up to three inches past the mandatory hold, so a shallow
 * contact with the finish board is the fitted condition, not an overlap.
 */
const FITTED_ANGLED_CONTACT_IN = 0.5;

function codeKey(value: string | null | undefined): string {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function numeric(value: number | string | null | undefined, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** True for a panel this rule auto-placed. */
export function isDishwasherPanelPlacement(item: Pick<PlacedCabinet, "autoPlacedReason">): boolean {
  return item.autoPlacedReason === DISHWASHER_RUN_END_PANEL_REASON
    || item.autoPlacedReason === DISHWASHER_FORTY_FIVE_PANEL_REASON;
}

/** A floor-standing dishwasher: base-height appliance under the finished counter. */
export function isDishwasherItem(item: PlacedCabinet): boolean {
  if (isPanelItem(item)) return false;
  const code = codeKey(item.masterCode);
  const text = `${item.description ?? ""} ${item.subCategory ?? ""}`.toLowerCase();
  const named = /^DW(?:[-_]?\d|$)/.test(code) || /\bdishwasher\b/.test(text);
  if (!named) return false;
  if (/range|fridge|refrigerator|hood|wine|microwave/.test(text)) return false;
  if (item.placement !== "appliance" && item.placement !== "base") return false;
  return isBaseHeightAppliance(item);
}

/** Runs that continue over a dishwasher: base boxes and counter-bearing appliances. */
function isRunPiece(item: PlacedCabinet): boolean {
  if (isPanelItem(item)) return false;
  if (item.placement === "base") return true;
  return item.placement === "appliance" && isBaseHeightAppliance(item);
}

/**
 * A dishwasher return panel (DWR) or a base panel board (BP / BEP). The owner
 * named DWR as the dishwasher panel and BP as a panel too; a refrigerator,
 * wall, or tall panel is never substituted here.
 */
export function isDishwasherPanelStock(item: {
  masterCode?: string | null;
  description?: string | null;
  subCategory?: string | null;
  category?: string | null;
}): boolean {
  const code = codeKey(item.masterCode);
  const text = `${item.category ?? ""} ${item.subCategory ?? ""} ${item.description ?? ""}`.toLowerCase();
  if (/refrigerator|fridge|\bwall\b|\btall\b/.test(text)) return false;
  return /DWR/i.test(code)
    || /dishwasher\s*(?:return|end|side)?\s*panel/.test(text)
    || /^(?:BP|BEP)\d/.test(code);
}

function panelWidthIn(stock: DishwasherPanelStock): number {
  const faces = [numeric(stock.width), numeric(stock.depth)]
    .filter((value) => value > 0 && value <= DISHWASHER_PANEL_MAX_WIDTH_IN);
  if (faces.length === 0) return DISHWASHER_PANEL_DEFAULT_WIDTH_IN;
  return Math.round(Math.min(...faces) * 8) / 8;
}

/** The priced dishwasher panel stock for this line, or null when the line sells none. */
export function dishwasherPanelStock(catalog: readonly DishwasherPanelStock[]): DishwasherPanelStock | null {
  const usable = catalog.filter(isDishwasherPanelStock);
  if (usable.length === 0) return null;
  // Prefer the printed DWR family, then any other priced board, then anything.
  const isDwr = (item: DishwasherPanelStock) => /dwr/i.test(codeKey(item.masterCode));
  return [...usable.filter(isDwr), ...usable.filter((item) => !isDwr(item) && item.price != null && item.price > 0), ...usable][0] ?? null;
}

type RunEdge = "start" | "end";

function runSpanOf(item: PlacedCabinet, wallId: string, room: RoomData): { start: number; end: number } {
  const start = wallRunOffset(item, wallId, room);
  return { start, end: start + wallRunSpan(item, wallId, room) };
}

function edgePoint(frame: WallRunFrame, edge: RunEdge): { x: number; y: number } {
  return edge === "start" ? frame.start : frame.end;
}

function framesMeetingAt(room: RoomData, frame: WallRunFrame, edge: RunEdge): WallRunFrame[] {
  const point = edgePoint(frame, edge);
  return roomWallRunFrames(room).filter((other) => other.id !== frame.id
    && (Math.hypot(other.start.x - point.x, other.start.y - point.y) <= 0.5
      || Math.hypot(other.end.x - point.x, other.end.y - point.y) <= 0.5));
}

function interiorTurnDeg(a: WallRunFrame, b: WallRunFrame): number {
  const raw = Math.abs(((a.angle - b.angle + Math.PI) % (Math.PI * 2)) - Math.PI);
  const interior = Math.min(raw, Math.abs(Math.PI - raw));
  return Math.round((interior * 180) / Math.PI);
}

/**
 * The interior turn at a run edge, or null when the run simply ends there.
 * Custom and cardinal vertices report through `wallRunJoinAt`; a peninsula has
 * two usable faces, so its turn is read from the frames meeting at the endpoint.
 * A turn only counts when the edge actually reaches that shared vertex: a
 * cabinet in the middle of a wall is not sitting at the room's corner.
 */
function turnAtEdge(
  room: RoomData,
  frame: WallRunFrame,
  edge: RunEdge,
  distanceToVertex: number,
  holdIn: number,
): number | null {
  if (distanceToVertex > holdIn + DISHWASHER_PANEL_MAX_WIDTH_IN) return null;
  const join = frame.kind === "peninsula" ? null : wallRunJoinAt(frame, edge, room);
  if (join) return join.turnDeg;
  const turns = framesMeetingAt(room, frame, edge).map((other) => interiorTurnDeg(frame, other));
  if (turns.length === 0) return null;
  return turns.includes(45) ? 45 : turns[0]!;
}

/** An adjoining run whose cabinets reach the shared vertex closes the corner. */
function adjoiningRunReachesVertex(
  room: RoomData,
  frame: WallRunFrame,
  edge: RunEdge,
  placed: readonly PlacedCabinet[],
): boolean {
  const point = edgePoint(frame, edge);
  return framesMeetingAt(room, frame, edge).some((other) => {
    const atOtherStart = Math.hypot(other.start.x - point.x, other.start.y - point.y) <= 0.5;
    return placed.some((item) => {
      if (!isRunPiece(item) || cabinetWall(item, room) !== other.id) return false;
      const span = runSpanOf(item, other.id, room);
      const distance = atOtherStart ? Math.abs(span.start) : Math.abs(other.length - span.end);
      return distance <= insideCornerHoldIn(45, Number(item.depth) || STD.BASE_DEPTH) + DISHWASHER_PANEL_MAX_WIDTH_IN;
    });
  });
}

/** A user-chosen panel already covers this dishwasher edge. */
function edgeAlreadyFinished(
  placed: readonly PlacedCabinet[],
  dishwasher: PlacedCabinet,
  wallId: string,
  room: RoomData,
  edge: RunEdge,
): boolean {
  const own = runSpanOf(dishwasher, wallId, room);
  return placed.some((item) => {
    if (!isPanelItem(item) || isDishwasherPanelPlacement(item)) return false;
    if (cabinetWall(item, room) !== wallId) return false;
    const span = runSpanOf(item, wallId, room);
    const touching = edge === "end"
      ? Math.abs(span.start - own.end) <= EPS
      : Math.abs(span.end - own.start) <= EPS;
    return touching;
  });
}

function sameSignature(left: readonly PlacedCabinet[], right: readonly PlacedCabinet[]): boolean {
  if (left.length !== right.length) return false;
  const key = (items: readonly PlacedCabinet[]) => items
    .map((item) => `${item.uid}:${item.autoPlacedReason ?? ""}:${Math.round(item.x * 8)}:${Math.round(item.y * 8)}:${item.wallOffset ?? ""}`)
    .sort()
    .join("|");
  return key(left) === key(right);
}

/**
 * Places one dishwasher panel per open dishwasher end. An end is open when no
 * counter-bearing run piece continues past it and no adjoining run closes onto
 * it. A 45° join at that end uses the angled-turn reason; every other open end
 * is the end-of-run reason.
 */
export function syncDishwasherPanels(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  catalog: readonly DishwasherPanelStock[];
}): DishwasherPanelPlan {
  const { placed, room, catalog } = input;
  const warnings: DishwasherPanelWarning[] = [];
  const hadOwnPanels = placed.some(isDishwasherPanelPlacement);
  const withoutPanels = placed.filter((item) => !isDishwasherPanelPlacement(item));
  const unchanged = (): DishwasherPanelPlan => ({
    placed: hadOwnPanels ? withoutPanels : (placed as PlacedCabinet[]),
    warnings,
  });
  // The owner's switch unpublishes the rule without disturbing any other panel.
  if (kitchenRuleNumber("dishwasher_panel_enabled") === 0) return unchanged();
  const dishwashers = withoutPanels.filter(isDishwasherItem);
  if (dishwashers.length === 0) return unchanged();

  const stock = dishwasherPanelStock(catalog);
  const width = stock ? panelWidthIn(stock) : DISHWASHER_PANEL_DEFAULT_WIDTH_IN;
  const occupants: PlacedCabinet[] = [...withoutPanels];
  const panels: PlacedCabinet[] = [];

  /**
   * Collision for a thin finish board. Cabinet bodies reach up to three inches
   * past the mandatory hold at a 45° join (design.ts
   * `FITTED_FORTY_FIVE_CORNER_FILLER_MAX_IN`), so the angled slot tolerates that
   * fitted contact. Every other end uses the normal placement collision, and a
   * deeper angled conflict still refuses the panel and warns.
   */
  const collides = (panel: PlacedCabinet, atAngledTurn: boolean): boolean => {
    if (!atAngledTurn) return cabinetPlacementCollisionDetail(panel, occupants, room) != null;
    return occupants.some((other) => {
      if (other.uid === panel.uid) return false;
      const detail = cabinetCollisionDetail(panel, [other]);
      return detail != null && detail.penetration > FITTED_ANGLED_CONTACT_IN;
    });
  };

  for (const dishwasher of dishwashers) {
    const wallId = cabinetWall(dishwasher, room) as string | null;
    if (!wallId) continue;
    const frame = roomWallRunFrames(room).find((candidate) => candidate.id === wallId) ?? null;
    if (!frame) continue;
    if (dishwasher.wallOffset == null || !Number.isFinite(Number(dishwasher.wallOffset))) continue;

    const own = runSpanOf(dishwasher, wallId, room);
    const peers = withoutPanels.filter((other) => (
      other.uid !== dishwasher.uid && isRunPiece(other) && cabinetWall(other, room) === wallId
    ));
    const neighbourAt = (edge: RunEdge): boolean => {
      const position = edge === "end" ? own.end : own.start;
      return peers.some((peer) => {
        const span = runSpanOf(peer, wallId, room);
        const gap = edge === "end" ? span.start - position : position - span.end;
        return Math.abs(gap) <= EPS;
      });
    };

    for (const edge of ["start", "end"] as const) {
      if (neighbourAt(edge)) continue;
      if (edgeAlreadyFinished(withoutPanels, dishwasher, wallId, room, edge)) continue;
      const hold = insideCornerHoldIn(45, Number(dishwasher.depth) || STD.BASE_DEPTH);
      const distanceToVertex = edge === "start" ? own.start : Math.max(0, frame.length - own.end);
      const turn = turnAtEdge(room, frame, edge, distanceToVertex, hold);
      // The run ends here: it simply stops, or it turns onto another run. A
      // square corner closed by the adjoining run needs nothing. A square
      // corner with no cabinet on the return is an open side, not a closed one.
      if (turn != null && turn !== 45 && adjoiningRunReachesVertex(room, frame, edge, withoutPanels)) continue;
      // The owner's switches unpublish a rule without disturbing any other panel.
      // The run-end and the 45 degree turn are separate rules, so one can be
      // turned off without losing the other.
      if (turn === 45 && kitchenRuleNumber("dishwasher_panel_forty_five_enabled") === 0) continue;
      if (turn !== 45 && kitchenRuleNumber("dishwasher_panel_enabled") === 0) continue;
      const reason: DishwasherPanelReason = turn === 45
        ? DISHWASHER_FORTY_FIVE_PANEL_REASON
        : DISHWASHER_RUN_END_PANEL_REASON;
      if (turn === 45) {
        // The panel fills only the fitted corner slot inside the 11" hold; a
        // wider piece would reach across the mitered front.
        if (hold <= 0 || width > hold + EPS) continue;
      }

      const along = edge === "end" ? own.end : own.start - width;
      if (along < -EPS || along + width > frame.length + EPS) continue;

      if (!stock || stock.price == null || stock.price <= 0) {
        warnings.push({
          id: `missing-price:dw-panel:${dishwasher.uid}:${edge}`,
          cabinetUid: dishwasher.uid,
          reason,
          message: `${dishwasher.masterCode} ends here and needs a dishwasher panel (DWR), and the selected line sells no priced dishwasher panel. Nothing was added at $0.`,
        });
        continue;
      }

      const depth = numeric(stock.depth, STD.BASE_DEPTH) || STD.BASE_DEPTH;
      const height = numeric(stock.height, STD.BASE_HEIGHT) || STD.BASE_HEIGHT;
      const spot = wallPlacementAt(along, width, depth, wallId as WallSide, room, dishwasher.peninsulaSide ?? null, false);
      if (Math.abs(numeric(spot.wallOffset, along) - along) > 0.2) continue;
      const panel: PlacedCabinet = {
        uid: `auto-dw-panel:${dishwasher.uid}:${edge}`,
        cabinetId: stock.id,
        masterCode: stock.masterCode,
        description: stock.description?.trim() || `${stock.masterCode} dishwasher return panel`,
        category: "Panels",
        subCategory: "Dishwasher Return Panel",
        placement: "base",
        x: spot.x,
        y: spot.y,
        width,
        depth,
        height,
        nominalWidth: width,
        nominalHeight: height,
        nominalDepth: depth,
        rotation: spot.rotation,
        wallId: spot.wallId ?? wallId,
        wallOffset: spot.wallOffset ?? along,
        mountBottom: 0,
        numberOfDoors: 0,
        numberOfDrawers: 0,
        fieldModificationNote: `${DISHWASHER_PANEL_REASONS[reason]}. Cut from ${stock.masterCode}.`,
        autoPlacedReason: reason,
        autoPlacedForUid: dishwasher.uid,
        autoPlacedSide: edge,
        islandFace: dishwasher.islandFace ?? null,
      };
      if (collides(panel, turn === 45)) {
        warnings.push({
          id: `no-room:dw-panel:${dishwasher.uid}:${edge}`,
          cabinetUid: dishwasher.uid,
          reason,
          message: `${dishwasher.masterCode} ends here and needs a ${width}" dishwasher panel (DWR) that has no clear ${width}" of run.`,
        });
        continue;
      }
      occupants.push(panel);
      panels.push(panel);
    }
  }

  if (panels.length === 0) return unchanged();
  const next = [...withoutPanels, ...panels];
  if (sameSignature(next, placed)) return { placed: placed as PlacedCabinet[], warnings };
  return { placed: next, warnings };
}
