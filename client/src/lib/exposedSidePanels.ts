/**
 * One engine for finished panels on exposed cabinet sides.
 *
 * The broad engine (every exposed side) stays behind exposed_panels_enabled,
 * which defaults off. Frameless and Hickory door styles use a narrower pass:
 * a 3/4" catalog panel on an open run end, a window side, an island back, or
 * the wall-cabinet side that faces a range/hood gap. A run end against a wall
 * does not get a panel. Other lines get a panel only when the customer chooses one.
 *
 * Panels are real placed pieces so plan, elevation, and 3D draw them. They
 * are priced from a catalog SKU. A missing price does not insert a $0 line.
 */
import { skinsAreNeeded } from "@shared/canHaveSkins";
import { requiresAutoEndPanels, type DoorStyleEndPanelInput } from "./autoEndPanels";
import { kitchenRuleNumber } from "./kitchenRuleParameters";
import {
  cabinetPlacementCollisionDetail,
  cabinetWall,
  isCornerCabinet,
  isFillerItem,
  isPanelItem,
  isRangeOrOven,
  isRefrigerator,
  isRefrigeratorEndPanel,
  refrigeratorEndPanelConflictDetail,
  wallLength,
  wallPlacementAt,
  wallRunFrame,
  wallRunJoinAt,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
  type WallSide,
} from "./design";
import type { CartItem } from "@/contexts/CartContext";
import { buildDesignCabinetCartLines } from "./designCartLines";
import { calculateCartSubtotal } from "./cartTotals";

const FLUSH = 0.125;
/** Butt joints, fillers, and corner returns within about an inch count as covered. */
export const EXPOSED_NEIGHBOR_TOLERANCE_IN = 1;
export const AUTO_ADDED_PREFIX = "Auto-added:";

export type ExposedPanelType = "base-end" | "wall-end" | "tall-fridge";

const MISSING_PRICE_BY_TYPE: Record<ExposedPanelType, string> = {
  "base-end": "This door style has no priced base end panel (BEP). Nothing was added at $0.",
  "wall-end": "This door style has no priced wall end panel (WEP). Nothing was added at $0.",
  "tall-fridge": "This door style has no priced tall or refrigerator end panel (REP/TEP). Nothing was added at $0.",
};

export const EXPOSED_PANEL_REASONS = {
  "end-of-run-against-wall": "Auto-added: end of run against wall",
  "dw-exposed-side": "Auto-added: DW exposed side",
  "fridge-end": "Auto-added: fridge end",
  "island-end": "Auto-added: island end",
  "island-back": "Auto-added: island back",
  "peninsula-end": "Auto-added: peninsula end",
  "peninsula-back": "Auto-added: peninsula back",
  "beside-window": "Auto-added: goes next to 30\" wall cabinets against the window sill",
  "open-beside-range": "Auto-added: open side next to range",
  "open-walkway": "Auto-added: open side next to a walkway",
  "wall-cabinet-end": "Auto-added: wall cabinet end",
  "tall-cabinet-end": "Auto-added: tall cabinet end",
  "vanity-end": "Auto-added: vanity end",
  "base-open-end": "Auto-added: open side",
  "open-end-of-run": "Auto-added: open end of run",
  "window-side": "Auto-added: window side",
  "wall-beside-range": "Auto-added: wall cabinet beside range",
} as const;

export type ExposedPanelReason = keyof typeof EXPOSED_PANEL_REASONS;

const REASON_SWITCH: Record<ExposedPanelReason, "panel_end_wall_enabled" | "panel_dw_enabled" | "panel_fridge_enabled" | "panel_island_enabled" | "panel_window_enabled" | "panel_open_enabled" | "panel_wall_end_enabled" | "panel_tall_enabled"> = {
  "end-of-run-against-wall": "panel_end_wall_enabled",
  "dw-exposed-side": "panel_dw_enabled",
  "fridge-end": "panel_fridge_enabled",
  "island-end": "panel_island_enabled",
  "island-back": "panel_island_enabled",
  "peninsula-end": "panel_island_enabled",
  "peninsula-back": "panel_island_enabled",
  "beside-window": "panel_window_enabled",
  "open-beside-range": "panel_open_enabled",
  "open-walkway": "panel_open_enabled",
  "wall-cabinet-end": "panel_wall_end_enabled",
  "tall-cabinet-end": "panel_tall_enabled",
  "vanity-end": "panel_open_enabled",
  "base-open-end": "panel_open_enabled",
  "open-end-of-run": "panel_open_enabled",
  "window-side": "panel_window_enabled",
  "wall-beside-range": "panel_open_enabled",
};

/** Reasons the frameless / Hickory pass is allowed to auto-add. */
export const QUALIFIED_AUTO_PANEL_REASONS = ["open-end-of-run", "window-side", "island-back", "wall-beside-range"] as const;

const QUALIFIED_AUTO_REASON_SET = new Set<string>(QUALIFIED_AUTO_PANEL_REASONS);

/** A wall cabinet this close to a range or hood opening faces that gap. */
const BESIDE_RANGE_GAP_IN = 12;

export type ExposedPanelStock = {
  id: number;
  masterCode: string;
  description: string;
  placement: "base" | "wall" | "tall";
  /** Covering face in inches. Width is often the 3/4" thickness, so callers should pass the real face. */
  stockFace: number;
  stockHeight: number;
  price: number | null;
  panelType?: ExposedPanelType;
};

export type ExposedPanelCatalogItem = {
  id: number;
  masterCode: string;
  description?: string | null;
  subCategory?: string | null;
  category?: string | null;
  placement?: string | null;
  width?: number | string | null;
  depth?: number | string | null;
  height?: number | string | null;
};

function numeric(value: number | string | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** REP/BEP/WEP/FEP/TEP and skins, including sheets stored thickness-first. */
export function exposedPanelTypeForCatalog(item: ExposedPanelCatalogItem): ExposedPanelType | null {
  const code = String(item.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const text = `${item.description ?? ""} ${item.subCategory ?? ""} ${item.category ?? ""}`.toLowerCase();
  const mentionsPanel = /\bpanel\b|\bskin\b/.test(text) || /(?:REP|REPV|BEP|WEP|TEP|FEP|DEP|BPS|WPS|TPS|PANEL)/.test(code);
  if (!mentionsPanel) return null;
  if (/^(?:REP|REPV|TEP|TPS)/.test(code) || /refrigerator|fridge|\btall\b/.test(text)) return "tall-fridge";
  if (/^(?:WEP|WPS)/.test(code) || /\bwall\b/.test(text)) return "wall-end";
  if (/^(?:BEP|BPS|FEP|DEP)/.test(code) || /\bbase\b|dishwasher|finished end|3\/4/.test(text)) return "base-end";
  if (item.placement === "wall") return "wall-end";
  if (item.placement === "tall") return "tall-fridge";
  return "base-end";
}

/** The sheet face that covers a cabinet side. A 3/4" thickness is not the face. */
export function exposedPanelFaceInches(item: ExposedPanelCatalogItem): number {
  const width = numeric(item.width);
  const depth = numeric(item.depth);
  const thin = (value: number) => value > 0 && value <= 2;
  if (thin(width) && depth > 2) return depth;
  if (thin(depth) && width > 2) return width;
  return Math.max(width, depth);
}

export function catalogItemToExposedPanelStock(item: ExposedPanelCatalogItem, price: number | null): ExposedPanelStock | null {
  const panelType = exposedPanelTypeForCatalog(item);
  if (!panelType) return null;
  const placement = panelType === "wall-end" ? "wall" : panelType === "tall-fridge" ? "tall" : "base";
  return {
    id: item.id,
    masterCode: item.masterCode,
    description: item.description || item.masterCode,
    placement,
    panelType,
    stockFace: exposedPanelFaceInches(item),
    stockHeight: numeric(item.height) || (placement === "wall" ? 30 : placement === "tall" ? 96 : 34.5),
    price,
  };
}

export type ExposedPanelWarning = {
  id: string;
  cabinetUid: string;
  reason: ExposedPanelReason;
  message: string;
};

export type ExposedSidePlan = {
  placed: PlacedCabinet[];
  warnings: ExposedPanelWarning[];
};

type Side = "start" | "end" | "back";

function enabled(reason: ExposedPanelReason): boolean {
  return kitchenRuleNumber("exposed_panels_enabled") !== 0 && kitchenRuleNumber(REASON_SWITCH[reason]) !== 0;
}

/**
 * Strips panels the broad engine auto-placed. Frameless and Hickory panels
 * from the narrow pass stay; every other auto panel is removed. User-chosen
 * panels have no auto-placed reason and always stay.
 */
export function removeAutoExposedPanels(
  placed: readonly PlacedCabinet[],
  doorStyleFor?: (cabinet: PlacedCabinet) => DoorStyleEndPanelInput | null | undefined,
): PlacedCabinet[] {
  const kept = placed.filter((item) => {
    if (!isAutoPanel(item)) return true;
    if (!doorStyleFor || !item.autoPlacedReason || !QUALIFIED_AUTO_REASON_SET.has(item.autoPlacedReason)) return false;
    const host = placed.find((candidate) => candidate.uid === item.autoPlacedForUid);
    const style = doorStyleFor(host ?? item);
    if (skinsAreNeeded(style)) return false;
    return requiresAutoEndPanels(style);
  });
  return kept.length === placed.length ? placed as PlacedCabinet[] : kept;
}

function isAutoPanel(item: PlacedCabinet): boolean {
  return Boolean(item.autoPlacedReason && item.autoPlacedForUid && item.autoPlacedSide);
}

function codeKey(item: { masterCode?: string | null }): string {
  return String(item.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function isRunFiller(item: PlacedCabinet): boolean {
  if (isFillerItem(item)) return true;
  return /^(?:WFF|BF|FF|WF|OF|F)\d/.test(codeKey(item));
}

function isDishwasherAppliance(item: PlacedCabinet): boolean {
  const hay = `${item.masterCode ?? ""} ${item.description ?? ""}`;
  return item.placement === "appliance" && (/^DW/i.test(item.masterCode ?? "") || /dishwasher/i.test(hay));
}

function isFridgeAppliance(item: PlacedCabinet): boolean {
  if (isRefrigerator(item)) return true;
  if (item.placement !== "appliance") return false;
  return /\b(fridge|refrigerator|ridge)\b/i.test(`${item.masterCode ?? ""} ${item.description ?? ""}`);
}

function isHost(item: PlacedCabinet): boolean {
  if (isAutoPanel(item) || isPanelItem(item) || isRunFiller(item)) return false;
  if (item.placement === "base" || item.placement === "wall" || item.placement === "tall") return true;
  return isDishwasherAppliance(item) || isFridgeAppliance(item);
}

function span(item: PlacedCabinet, room: RoomData) {
  const side = cabinetWall(item, room);
  const start = wallRunOffset(item, side, room);
  return { side, start, end: start + wallRunSpan(item, side, room) };
}

function layerMatches(owner: PlacedCabinet, other: PlacedCabinet): boolean {
  const otherWall = other.placement === "wall" || /^WFF|^WF\d/.test(codeKey(other));
  if (owner.placement === "wall") return otherWall || other.placement === "tall" || isPanelItem(other);
  if (other.placement === "tall" || isPanelItem(other)) return true;
  return !otherWall;
}

function intervalsMeet(ownerStart: number, ownerEnd: number, otherStart: number, otherEnd: number, side: Side): boolean {
  if (side === "back") return false;
  const tolerance = EXPOSED_NEIGHBOR_TOLERANCE_IN;
  if (side === "start") return otherEnd >= ownerStart - tolerance && otherStart <= ownerStart + tolerance;
  return otherStart <= ownerEnd + tolerance && otherEnd >= ownerEnd - tolerance;
}

function cornerReturnOnWall(ownerWall: string, item: PlacedCabinet, room: RoomData): { start: number; end: number } | null {
  if (item.islandFace || !isCornerCabinet(item.masterCode, item.description)) return null;
  const home = span(item, room);
  if (home.side === ownerWall) return null;
  const homeLen = wallLength(home.side, room);
  const atStart = home.start <= EXPOSED_NEIGHBOR_TOLERANCE_IN;
  const atEnd = homeLen - home.end <= EXPOSED_NEIGHBOR_TOLERANCE_IN;
  if (!atStart && !atEnd) return null;
  const frame = wallRunFrame(home.side, room);
  if (!frame) return null;
  const join = wallRunJoinAt(frame, atStart ? "start" : "end", room);
  if (!join || join.frame.id !== ownerWall) return null;
  const vertex = atStart ? frame.start : frame.end;
  const atOtherStart = Math.hypot(join.frame.start.x - vertex.x, join.frame.start.y - vertex.y) <= 0.5;
  const reach = Math.max(item.depth, item.width, 12);
  const otherLen = wallLength(ownerWall, room);
  return atOtherStart ? { start: 0, end: reach } : { start: otherLen - reach, end: otherLen };
}

function coveredByNeighbor(owner: PlacedCabinet, side: Side, placed: readonly PlacedCabinet[], room: RoomData): boolean {
  if (side === "back") return false;
  const ownerSpan = span(owner, room);
  return placed.some((other) => {
    if (other.uid === owner.uid || isAutoPanel(other)) return false;
    if (!isRunFiller(other) && !isPanelItem(other) && !isCornerCabinet(other.masterCode, other.description) && other.placement !== "base" && other.placement !== "wall" && other.placement !== "tall" && other.placement !== "appliance") return false;
    if (owner.islandFace) {
      if (other.islandFace !== owner.islandFace || !layerMatches(owner, other)) return false;
      const otherSpan = span(other, room);
      return intervalsMeet(ownerSpan.start, ownerSpan.end, otherSpan.start, otherSpan.end, side);
    }
    if (cabinetWall(other, room) === ownerSpan.side && layerMatches(owner, other)) {
      const otherSpan = span(other, room);
      if (intervalsMeet(ownerSpan.start, ownerSpan.end, otherSpan.start, otherSpan.end, side)) return true;
    }
    const corner = cornerReturnOnWall(ownerSpan.side, other, room);
    return corner != null && layerMatches(owner, other) && intervalsMeet(ownerSpan.start, ownerSpan.end, corner.start, corner.end, side);
  });
}

function windowAt(edge: number, side: Side, wall: string, openings: readonly WallOpening[], maxGap: number): WallOpening | null {
  if (side === "back") return null;
  for (const opening of openings) {
    if (opening.kind !== "window" || opening.side !== wall) continue;
    const gap = side === "start" ? edge - (opening.offset + opening.width) : opening.offset - edge;
    const overlaps = opening.offset < edge + FLUSH && opening.offset + opening.width > edge - FLUSH;
    if (overlaps || (gap >= -FLUSH && gap <= maxGap + FLUSH)) return opening;
  }
  return null;
}

function reasonFor(owner: PlacedCabinet, side: Side, room: RoomData, openings: readonly WallOpening[]): ExposedPanelReason | null {
  const ownerSpan = span(owner, room);
  const edge = side === "start" ? ownerSpan.start : ownerSpan.end;
  const wallLen = wallLength(ownerSpan.side, room);
  const wallGap = side === "start" ? ownerSpan.start : side === "end" ? wallLen - ownerSpan.end : Number.POSITIVE_INFINITY;
  const againstWall = !owner.islandFace && side !== "back" && wallGap <= EXPOSED_NEIGHBOR_TOLERANCE_IN && wallGap >= -EXPOSED_NEIGHBOR_TOLERANCE_IN;
  const window = windowAt(edge, side, ownerSpan.side, openings, kitchenRuleNumber("window_filler_max_in") + kitchenRuleNumber("panel_thickness_in"));
  if (window && owner.placement === "wall" && Math.abs((owner.height ?? 30) - kitchenRuleNumber("window_cabinet_height_in")) <= 0.5) return "beside-window";
  if (isDishwasherAppliance(owner)) return "dw-exposed-side";
  if (isFridgeAppliance(owner)) return "fridge-end";
  if (againstWall) return "end-of-run-against-wall";
  if (owner.islandFace === "back" || side === "back" && owner.islandFace) return owner.peninsulaSide || owner.peninsulaWizardId ? "peninsula-back" : "island-back";
  if (owner.islandFace) return owner.peninsulaSide || owner.peninsulaWizardId ? "peninsula-end" : "island-end";
  if (owner.placement === "wall") return "wall-cabinet-end";
  if (owner.placement === "tall") return "tall-cabinet-end";
  if (/vanity/i.test(`${owner.masterCode} ${owner.description ?? ""}`)) return "vanity-end";
  return "base-open-end";
}

function panelTypeFor(owner: PlacedCabinet, reason: ExposedPanelReason): ExposedPanelType {
  if (reason === "fridge-end" || reason === "tall-cabinet-end" || owner.placement === "tall" || isFridgeAppliance(owner)) return "tall-fridge";
  if (reason === "wall-cabinet-end" || reason === "beside-window" || owner.placement === "wall") return "wall-end";
  return "base-end";
}

function stockType(item: ExposedPanelStock): ExposedPanelType {
  if (item.panelType) return item.panelType;
  return exposedPanelTypeForCatalog(item) ?? (item.placement === "wall" ? "wall-end" : item.placement === "tall" ? "tall-fridge" : "base-end");
}

function frameless(cabinet: PlacedCabinet): boolean {
  return cabinet.constructionMethod === "aef" || /frameless/i.test(cabinet.constructionMethod ?? "") || cabinet.constructionMethod === "AEF";
}

/** Catalog accessories the exposed-side engine may cut a finished panel from. */
export function isExposedPanelStockCandidate(item: { masterCode: string; description?: string | null; subCategory?: string | null }): boolean {
  return exposedPanelTypeForCatalog(item) != null || /\bpanel\b/i.test(`${item.masterCode} ${item.description ?? ""} ${item.subCategory ?? ""}`);
}

function pickStock(owner: PlacedCabinet, reason: ExposedPanelReason, catalog: readonly ExposedPanelStock[]): ExposedPanelStock | null {
  const type = panelTypeFor(owner, reason);
  const face = owner.placement === "wall" ? Math.max(owner.depth, 12) : Math.max(owner.depth, 24);
  const height = owner.height ?? (type === "wall-end" ? 30 : type === "tall-fridge" ? 96 : 34.5);
  const priced = catalog.filter((item) => stockType(item) === type && item.price != null && item.price > 0);
  if (priced.length === 0) return null;
  const fits = priced
    .filter((item) => item.stockFace + FLUSH >= face && item.stockHeight + FLUSH >= height)
    .sort((a, b) => a.stockFace * a.stockHeight - b.stockFace * b.stockHeight);
  return fits[0] ?? [...priced].sort((a, b) => b.stockFace - a.stockFace || b.stockHeight - a.stockHeight)[0] ?? null;
}

function placePanel(template: PlacedCabinet, along: number, width: number, side: WallSide, room: RoomData, stock: ExposedPanelStock, reason: ExposedPanelReason, forUid: string, panelSide: Side): PlacedCabinet | null {
  const spot = wallPlacementAt(along, width, Math.max(template.depth, 0.75), side, room, template.peninsulaSide ?? null, false);
  if (Math.abs((spot.wallOffset ?? along) - along) > 0.2) return null;
  const label = EXPOSED_PANEL_REASONS[reason];
  return {
    ...template,
    ...spot,
    uid: `auto-panel:${forUid}:${panelSide}`,
    cabinetId: stock.id,
    masterCode: stock.masterCode,
    description: stock.description,
    category: "Panels",
    subCategory: "End panel",
    width,
    depth: template.depth,
    height: template.height,
    nominalWidth: width,
    nominalHeight: template.height,
    nominalDepth: template.depth,
    placement: template.placement === "wall" ? "wall" : "base",
    numberOfDoors: 0,
    numberOfDrawers: 0,
    wallId: spot.wallId ?? side,
    wallOffset: spot.wallOffset ?? along,
    fieldModificationNote: `${label}. Cut from ${stock.masterCode}.`,
    autoPlacedReason: reason,
    autoPlacedForUid: forUid,
    autoPlacedSide: panelSide,
    islandFace: template.islandFace ?? null,
  };
}

function isHoodAppliance(item: PlacedCabinet): boolean {
  const code = (item.masterCode ?? "").toUpperCase();
  const desc = (item.description ?? "").toLowerCase();
  if (/^RHF/.test(code) || /range\s*hood\s*front/.test(desc)) return false;
  return /^HOOD(?:-|\b)/.test(code) || (item.placement === "appliance" && /\bhood\b/.test(desc));
}

function isRunCabinet(item: PlacedCabinet): boolean {
  if (isAutoPanel(item) || isPanelItem(item) || isRunFiller(item)) return false;
  return item.placement === "base" || item.placement === "wall" || item.placement === "tall";
}

function isRunBridge(item: PlacedCabinet): boolean {
  if (isAutoPanel(item)) return false;
  if (isRunFiller(item) || isPanelItem(item)) return true;
  return item.placement === "appliance";
}

function runGroupKey(item: PlacedCabinet, room: RoomData): string {
  const layer = item.placement === "wall" ? "wall" : "base";
  return `${item.islandFace ?? ""}|${cabinetWall(item, room)}|${layer}`;
}

function endAgainstWall(owner: PlacedCabinet, side: Side, room: RoomData): boolean {
  if (side === "back" || owner.islandFace) return false;
  const ownerSpan = span(owner, room);
  const wallGap = side === "start" ? ownerSpan.start : wallLength(ownerSpan.side, room) - ownerSpan.end;
  return wallGap <= EXPOSED_NEIGHBOR_TOLERANCE_IN && wallGap >= -EXPOSED_NEIGHBOR_TOLERANCE_IN;
}

function facesWindow(owner: PlacedCabinet, side: Side, room: RoomData, openings: readonly WallOpening[]): boolean {
  if (side === "back" || owner.islandFace) return false;
  const ownerSpan = span(owner, room);
  const edge = side === "start" ? ownerSpan.start : ownerSpan.end;
  const maxGap = kitchenRuleNumber("window_filler_max_in") + kitchenRuleNumber("panel_thickness_in");
  return windowAt(edge, side, ownerSpan.side, openings, maxGap) != null;
}

/** A base or tall end that looks open only because a dishwasher or range sits there. */
function applianceBlocksOpenEnd(owner: PlacedCabinet, side: Side, placed: readonly PlacedCabinet[], room: RoomData): boolean {
  if (owner.placement === "wall" || side === "back") return false;
  const ownerSpan = span(owner, room);
  const edge = side === "start" ? ownerSpan.start : ownerSpan.end;
  let nearestDist = Number.POSITIVE_INFINITY;
  let blocks = false;
  for (const other of placed) {
    if (other.uid === owner.uid || isAutoPanel(other) || other.placement === "wall" || isHoodAppliance(other)) continue;
    if (owner.islandFace) {
      if (other.islandFace !== owner.islandFace) continue;
    } else if (other.islandFace || cabinetWall(other, room) !== ownerSpan.side) continue;
    const otherSpan = span(other, room);
    const dist = side === "end" ? otherSpan.start - edge : edge - otherSpan.end;
    if (dist < -EXPOSED_NEIGHBOR_TOLERANCE_IN || dist >= nearestDist) continue;
    nearestDist = dist;
    const appliance = other.placement === "appliance" || isRangeOrOven(other.masterCode, other.description) || isDishwasherAppliance(other);
    blocks = appliance && dist <= 48;
  }
  return blocks;
}

function collectRunEndKeys(placed: readonly PlacedCabinet[], room: RoomData): Set<string> {
  const members = placed.filter(isRunCabinet);
  const bridges = placed.filter(isRunBridge);
  const groups = new Map<string, PlacedCabinet[]>();
  for (const item of members) {
    const key = runGroupKey(item, room);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  const ends = new Set<string>();
  for (const group of Array.from(groups.values())) {
    const sorted = [...group].sort((a, b) => span(a, room).start - span(b, room).start);
    const runs: PlacedCabinet[][] = [];
    let current: PlacedCabinet[] = [];
    for (const item of sorted) {
      const previous = current[current.length - 1];
      if (!previous) {
        current.push(item);
        continue;
      }
      const gapStart = span(previous, room).end;
      const gapEnd = span(item, room).start;
      const bridged = gapEnd - gapStart <= EXPOSED_NEIGHBOR_TOLERANCE_IN || bridges.some((bridge) => {
        if ((bridge.islandFace ?? null) !== (previous.islandFace ?? null)) return false;
        if (!previous.islandFace && cabinetWall(bridge, room) !== cabinetWall(previous, room)) return false;
        const bridgeSpan = span(bridge, room);
        return bridgeSpan.end >= gapStart - EXPOSED_NEIGHBOR_TOLERANCE_IN && bridgeSpan.start <= gapEnd + EXPOSED_NEIGHBOR_TOLERANCE_IN;
      });
      if (bridged) current.push(item);
      else {
        runs.push(current);
        current = [item];
      }
    }
    if (current.length > 0) runs.push(current);
    for (const run of runs) {
      const first = run[0];
      const last = run[run.length - 1];
      if (first) ends.add(`${first.uid}:start`);
      if (last) ends.add(`${last.uid}:end`);
    }
  }
  return ends;
}

function wallCabinetsBesideCooking(placed: readonly PlacedCabinet[], room: RoomData): Set<string> {
  const raw: { wall: string; island: string | null; start: number; end: number }[] = [];
  for (const item of placed) {
    if (!isRangeOrOven(item.masterCode, item.description) && !isHoodAppliance(item)) continue;
    const itemSpan = span(item, room);
    raw.push({ wall: itemSpan.side, island: item.islandFace ?? null, start: itemSpan.start, end: itemSpan.end });
  }
  raw.sort((a, b) => a.start - b.start);
  const gaps: typeof raw = [];
  for (const gap of raw) {
    const last = gaps[gaps.length - 1];
    if (last && last.wall === gap.wall && last.island === gap.island && gap.start <= last.end + EXPOSED_NEIGHBOR_TOLERANCE_IN) {
      last.end = Math.max(last.end, gap.end);
    } else gaps.push({ ...gap });
  }
  const sides = new Set<string>();
  const wallCabinets = placed.filter((item) => item.placement === "wall" && isRunCabinet(item));
  for (const gap of gaps) {
    let left: { uid: string; dist: number } | null = null;
    let right: { uid: string; dist: number } | null = null;
    for (const cabinet of wallCabinets) {
      if ((cabinet.islandFace ?? null) !== gap.island) continue;
      const cabinetSpan = span(cabinet, room);
      if (cabinetSpan.side !== gap.wall) continue;
      const leftDist = gap.start - cabinetSpan.end;
      if (leftDist >= -EXPOSED_NEIGHBOR_TOLERANCE_IN && leftDist <= BESIDE_RANGE_GAP_IN && (!left || leftDist < left.dist)) {
        left = { uid: cabinet.uid, dist: leftDist };
      }
      const rightDist = cabinetSpan.start - gap.end;
      if (rightDist >= -EXPOSED_NEIGHBOR_TOLERANCE_IN && rightDist <= BESIDE_RANGE_GAP_IN && (!right || rightDist < right.dist)) {
        right = { uid: cabinet.uid, dist: rightDist };
      }
    }
    if (left) sides.add(`${left.uid}:end`);
    if (right) sides.add(`${right.uid}:start`);
  }
  return sides;
}

function placeBackPanel(host: PlacedCabinet, stock: ExposedPanelStock, room: RoomData): PlacedCabinet | null {
  const thickness = kitchenRuleNumber("panel_thickness_in");
  const rotation = ((Math.round(host.rotation) % 360) + 360) % 360;
  let x = host.x;
  let y = host.y;
  let width = host.width;
  let depth = thickness;
  if (rotation === 90 || rotation === 270) {
    width = thickness;
    depth = Math.max(host.width, 0.75);
    x = rotation === 90 ? host.x + host.depth : host.x - thickness;
  } else {
    width = Math.max(host.width, 0.75);
    depth = thickness;
    y = rotation === 180 ? host.y + host.depth : host.y - thickness;
  }
  const spot = { x, y, rotation: host.rotation, wallId: host.wallId, wallOffset: host.wallOffset };
  if (!Number.isFinite(spot.x) || !Number.isFinite(spot.y)) return null;
  const label = EXPOSED_PANEL_REASONS["island-back"];
  return {
    ...host,
    ...spot,
    uid: `auto-panel:${host.uid}:back`,
    cabinetId: stock.id,
    masterCode: stock.masterCode,
    description: stock.description,
    category: "Panels",
    subCategory: "End panel",
    width,
    depth,
    height: host.height,
    nominalWidth: width,
    nominalHeight: host.height,
    nominalDepth: depth,
    placement: host.placement === "wall" ? "wall" : "base",
    numberOfDoors: 0,
    numberOfDrawers: 0,
    fieldModificationNote: `${label}. Cut from ${stock.masterCode}.`,
    autoPlacedReason: "island-back",
    autoPlacedForUid: host.uid,
    autoPlacedSide: "back",
    islandFace: host.islandFace ?? null,
  };
}

type QualifiedSyncInput = {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings?: readonly WallOpening[];
  catalog: readonly ExposedPanelStock[];
  doorStyleFor?: (cabinet: PlacedCabinet) => DoorStyleEndPanelInput | null | undefined;
  pricesReady?: boolean;
  priceFor?: (stock: ExposedPanelStock, owner: PlacedCabinet) => number | null;
};

function syncQualifiedAutoPanels(input: QualifiedSyncInput): ExposedSidePlan {
  const doorStyleFor = input.doorStyleFor ?? (() => null);
  if (input.pricesReady === false) {
    const placed = removeAutoExposedPanels(input.placed, doorStyleFor);
    return { placed, warnings: [] };
  }
  const openings = input.openings ?? [];
  const runEnds = collectRunEndKeys(input.placed, input.room);
  const besideRange = wallCabinetsBesideCooking(input.placed, input.room);
  const warnings: ExposedPanelWarning[] = [];
  const wanted = new Map<string, PlacedCabinet>();
  const missingPrice = new Map<ExposedPanelType, { uid: string; reason: ExposedPanelReason }>();
  const hosts = input.placed.filter((item) => {
    const style = doorStyleFor(item);
    if (skinsAreNeeded(style)) return false;
    return isRunCabinet(item) && requiresAutoEndPanels(style);
  });

  const collides = (candidate: PlacedCabinet, ownerUid: string, ignoreUids: readonly string[] = []) => {
    const ignored = new Set(ignoreUids);
    const others = [
      ...input.placed.filter((item) => !isAutoPanel(item) && item.uid !== candidate.uid && item.uid !== ownerUid && !ignored.has(item.uid)),
      ...Array.from(wanted.values()).filter((item) => item.uid !== candidate.uid),
    ];
    if (cabinetPlacementCollisionDetail(candidate, others, input.room) != null) return true;
    return others.some((other) => isRefrigeratorEndPanel(other) && refrigeratorEndPanelConflictDetail(other, [candidate], null, input.room) != null);
  };

  const catalogFor = (owner: PlacedCabinet) => input.priceFor
    ? input.catalog.map((item) => ({ ...item, price: input.priceFor!(item, owner) }))
    : input.catalog;

  for (const host of hosts) {
    const sides: Side[] = host.islandFace ? ["start", "end", "back"] : ["start", "end"];
    for (const panelSide of sides) {
      const key = `${host.uid}:${panelSide}`;
      let reason: ExposedPanelReason | null = null;
      if (panelSide !== "back" && besideRange.has(key) && !coveredByNeighbor(host, panelSide, input.placed, input.room)) {
        reason = "wall-beside-range";
      } else if (facesWindow(host, panelSide, input.room, openings) && !coveredByNeighbor(host, panelSide, input.placed, input.room)) {
        reason = "window-side";
      } else if (panelSide === "back" && host.islandFace) {
        reason = "island-back";
      } else if (panelSide !== "back" && runEnds.has(key) && !endAgainstWall(host, panelSide, input.room) && !coveredByNeighbor(host, panelSide, input.placed, input.room) && !applianceBlocksOpenEnd(host, panelSide, input.placed, input.room)) {
        reason = "open-end-of-run";
      }
      if (!reason) continue;
      const stock = pickStock(host, reason, catalogFor(host));
      if (!stock) {
        const type = panelTypeFor(host, reason);
        if (!missingPrice.has(type)) missingPrice.set(type, { uid: host.uid, reason });
        continue;
      }
      const thickness = kitchenRuleNumber("panel_thickness_in");
      let panel: PlacedCabinet | null = null;
      const cookingUids = reason === "wall-beside-range"
        ? input.placed.filter((item) => isRangeOrOven(item.masterCode, item.description) || isHoodAppliance(item)).map((item) => item.uid)
        : [];
      if (panelSide === "back") {
        const back = placeBackPanel(host, stock, input.room);
        panel = back && !collides(back, host.uid) ? back : null;
      } else {
        const hostSpan = span(host, input.room);
        const along = panelSide === "end" ? hostSpan.end : hostSpan.start - thickness;
        const wall = hostSpan.side;
        if (along < -FLUSH || along + thickness > wallLength(wall, input.room) + FLUSH) {
          warnings.push({
            id: `no-room:${key}`,
            cabinetUid: host.uid,
            reason,
            message: `${host.masterCode} needs a ${thickness}" panel (${EXPOSED_PANEL_REASONS[reason]}) and the run has no room for it.`,
          });
          continue;
        }
        const placedPanel = placePanel(host, along, thickness, wall, input.room, stock, reason, host.uid, panelSide);
        panel = placedPanel && !collides(placedPanel, host.uid, cookingUids) ? placedPanel : null;
        if (!panel) {
          warnings.push({
            id: `no-room:${key}`,
            cabinetUid: host.uid,
            reason,
            message: `${host.masterCode} needs a panel (${EXPOSED_PANEL_REASONS[reason]}) and the run has no room for it.`,
          });
          continue;
        }
      }
      if (panel) wanted.set(key, panel);
    }
  }

  for (const [type, info] of Array.from(missingPrice.entries())) {
    warnings.push({
      id: `missing-price:${type}`,
      cabinetUid: info.uid,
      reason: info.reason,
      message: MISSING_PRICE_BY_TYPE[type],
    });
  }

  const nonAuto = input.placed.filter((item) => !isAutoPanel(item));
  const placed = [...nonAuto, ...Array.from(wanted.values())];
  const signature = (items: readonly PlacedCabinet[]) => items
    .map((item) => `${item.uid}:${item.wallOffset ?? ""}:${item.masterCode}:${item.autoPlacedReason ?? ""}`)
    .sort()
    .join("|");
  if (signature(placed) === signature(input.placed)) return { placed: input.placed as PlacedCabinet[], warnings };
  return { placed, warnings };
}

function shiftHost(host: PlacedCabinet, delta: number, room: RoomData): PlacedCabinet | null {
  if (Math.abs(delta) <= 0.001) return host;
  if (Math.abs(delta) > kitchenRuleNumber("jog_max_in") + 0.001) return null;
  const wall = cabinetWall(host, room);
  const start = span(host, room).start + delta;
  const spot = wallPlacementAt(start, host.width, host.depth, wall, room, host.peninsulaSide ?? null, false);
  if (Math.abs((spot.wallOffset ?? start) - start) > 0.2) return null;
  return { ...host, ...spot, wallId: spot.wallId ?? wall, wallOffset: spot.wallOffset ?? start };
}

export function syncExposedSidePanels(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings?: readonly WallOpening[];
  catalog: readonly ExposedPanelStock[];
  /** Frameless and Hickory pass. Does not use the broad exposed-side switch. */
  qualifiedOnly?: boolean;
  doorStyleFor?: (cabinet: PlacedCabinet) => DoorStyleEndPanelInput | null | undefined;
  /** False while catalog prices are still loading, so a missing price is not warned yet. */
  pricesReady?: boolean;
  priceFor?: (stock: ExposedPanelStock, owner: PlacedCabinet) => number | null;
}): ExposedSidePlan {
  if (input.qualifiedOnly) return syncQualifiedAutoPanels(input);
  if (kitchenRuleNumber("exposed_panels_enabled") === 0) {
    const placed = input.placed.filter((item) => !isAutoPanel(item));
    return { placed: placed.length === input.placed.length ? input.placed as PlacedCabinet[] : placed, warnings: [] };
  }
  const openings = input.openings ?? [];
  const hosts = input.placed.filter(isHost);
  const warnings: ExposedPanelWarning[] = [];
  const wanted = new Map<string, PlacedCabinet>();
  const seenSides = new Set<string>();
  const missingPrice = new Map<ExposedPanelType, { uid: string; reason: ExposedPanelReason }>();
  let hostsPlaced = hosts;

  const refresh = (uid: string, next: PlacedCabinet) => {
    hostsPlaced = hostsPlaced.map((item) => item.uid === uid ? next : item);
  };
  // A shifted host or a new panel must never land inside another piece: the
  // overlap repair that runs after every commit would then delete a cabinet
  // (it removed a B21 jogged into its neighbouring fridge panel).
  const collides = (candidate: PlacedCabinet, ownerUid: string) => {
    const others = [
      ...input.placed.filter((item) => !isAutoPanel(item) && item.uid !== candidate.uid && item.uid !== ownerUid)
        .map((item) => hostsPlaced.find((host) => host.uid === item.uid) ?? item),
      ...[...wanted.values()].filter((item) => item.uid !== candidate.uid),
    ];
    if (cabinetPlacementCollisionDetail(candidate, others, input.room) != null) return true;
    // Fridge end panels are exempt from the generic check; the overlap repair
    // tests them on their own and deletes the panel, so test them the same way.
    return others.some((other) => isRefrigeratorEndPanel(other) && refrigeratorEndPanelConflictDetail(other, [candidate], null, input.room) != null);
  };

  for (const listed of hosts) {
    const sides: Side[] = listed.islandFace || listed.peninsulaWizardId ? ["start", "end", "back"] : ["start", "end"];
    for (const panelSide of sides) {
      const host = hostsPlaced.find((item) => item.uid === listed.uid) ?? listed;
      const sideKey = `${host.uid}:${panelSide}`;
      if (seenSides.has(sideKey)) continue;
      seenSides.add(sideKey);
      if (coveredByNeighbor(host, panelSide, [...hostsPlaced, ...input.placed.filter((item) => !isHost(item))], input.room)) continue;
      const reason = reasonFor(host, panelSide, input.room, openings);
      if (!reason || !enabled(reason)) continue;
      const framedWindow = reason === "beside-window" && !frameless(host);
      if (framedWindow && kitchenRuleNumber("window_framed_panel") === 0) continue;
      const stock = pickStock(host, reason, input.catalog);
      const key = sideKey;
      if (!stock) {
        const type = panelTypeFor(host, reason);
        if (!missingPrice.has(type)) missingPrice.set(type, { uid: host.uid, reason });
        continue;
      }
      const hostSpan = span(host, input.room);
      const thickness = kitchenRuleNumber("panel_thickness_in");
      let along = panelSide === "end" ? hostSpan.end : Math.max(0, hostSpan.start - thickness);
      if (panelSide === "start" && hostSpan.start < thickness - FLUSH) {
        const shiftedCandidate = shiftHost(host, thickness - hostSpan.start, input.room);
        const shifted = shiftedCandidate && !collides(shiftedCandidate, host.uid) ? shiftedCandidate : null;
        if (!shifted) {
          warnings.push({
            id: `no-room:${key}`,
            cabinetUid: host.uid,
            reason,
            message: `${host.masterCode} needs a ${thickness}" panel on the start side and there is no room within the ${kitchenRuleNumber("jog_max_in")}" jog.`,
          });
          continue;
        }
        refresh(host.uid, shifted);
        along = 0;
      }
      if (panelSide === "end") {
        const wall = hostSpan.side;
        const end = span(hostsPlaced.find((item) => item.uid === host.uid) ?? host, input.room).end;
        if (end + thickness > wallLength(wall, input.room) + FLUSH) {
          const shiftedCandidate = shiftHost(hostsPlaced.find((item) => item.uid === host.uid) ?? host, -thickness, input.room);
          const shifted = shiftedCandidate && !collides(shiftedCandidate, host.uid) ? shiftedCandidate : null;
          if (!shifted) {
            warnings.push({
              id: `no-room:${key}`,
              cabinetUid: host.uid,
              reason,
              message: `${host.masterCode} needs a ${thickness}" panel on the end side and there is no room within the ${kitchenRuleNumber("jog_max_in")}" jog.`,
            });
            continue;
          }
          refresh(host.uid, shifted);
          along = span(shifted, input.room).end;
        }
      }
      const current = hostsPlaced.find((item) => item.uid === host.uid) ?? host;
      const wall = span(current, input.room).side;
      if (along < -FLUSH || along + thickness > wallLength(wall, input.room) + FLUSH) {
        warnings.push({
          id: `no-room:${key}`,
          cabinetUid: host.uid,
          reason,
          message: `${host.masterCode} needs a ${thickness}" panel (${EXPOSED_PANEL_REASONS[reason]}) and the run has no room within the ${kitchenRuleNumber("jog_max_in")}" jog.`,
        });
        continue;
      }
      const placedPanel = placePanel(current, along, thickness, wall, input.room, stock, reason, host.uid, panelSide);
      const panel = placedPanel && !collides(placedPanel, host.uid) ? placedPanel : null;
      if (!panel) {
        warnings.push({
          id: `no-room:${key}`,
          cabinetUid: host.uid,
          reason,
          message: `${host.masterCode} needs a panel (${EXPOSED_PANEL_REASONS[reason]}) and the run has no room for it.`,
        });
        continue;
      }
      wanted.set(key, panel);
    }
  }

  for (const [type, info] of Array.from(missingPrice.entries())) {
    warnings.push({
      id: `missing-price:${type}`,
      cabinetUid: info.uid,
      reason: info.reason,
      message: MISSING_PRICE_BY_TYPE[type],
    });
  }

  const kept = input.placed.filter((item) => !isAutoPanel(item));
  const hostByUid = new Map(hostsPlaced.map((item) => [item.uid, item]));
  const next = kept.map((item) => hostByUid.get(item.uid) ?? item);
  const panels = [...wanted.values()];
  const placed = panels.length || hostsPlaced.some((item, index) => item !== hosts[index])
    ? [...next.filter((item) => !isAutoPanel(item)), ...panels]
    : input.placed as PlacedCabinet[];
  const signature = (items: readonly PlacedCabinet[]) => items
    .map((item) => `${item.uid}:${item.wallOffset ?? ""}:${item.masterCode}:${item.autoPlacedReason ?? ""}`)
    .sort()
    .join("|");
  if (signature(placed) === signature(input.placed)) return { placed: input.placed as PlacedCabinet[], warnings };
  return { placed, warnings };
}

export function sameExposedPanelWarnings(left: readonly ExposedPanelWarning[], right: readonly ExposedPanelWarning[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((warning, index) => warning.id === right[index]?.id && warning.message === right[index]?.message && warning.cabinetUid === right[index]?.cabinetUid);
}

export type AutoAddedSurfaceLine = {
  sku: string;
  distributorItemName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  autoAddedLabel: string;
};

/** Material list, cart, invoice, and distributor PO all read this one set of lines. */
export function autoAddedOrderSurfaces(input: {
  placed: readonly PlacedCabinet[];
  styleId: number;
  distributorId: number | null;
  tier: CartItem["tier"];
  styleName: string;
  unitPriceFor: (cabinet: PlacedCabinet) => number | null;
}): {
  materialList: AutoAddedSurfaceLine[];
  cart: CartItem[];
  invoice: { lines: AutoAddedSurfaceLine[]; total: number };
  distributorPo: { lines: AutoAddedSurfaceLine[]; total: number };
} {
  const cart = buildDesignCabinetCartLines({
    placed: input.placed,
    styleId: input.styleId,
    distributorId: input.distributorId,
    tier: input.tier,
    styleNameById: new Map([[input.styleId, input.styleName]]),
    unitPriceFor: input.unitPriceFor,
  }).map((line) => {
    const label = line.name.includes(AUTO_ADDED_PREFIX)
      ? line.name.slice(line.name.indexOf(AUTO_ADDED_PREFIX))
      : line.qtyNote?.includes(AUTO_ADDED_PREFIX)
        ? line.qtyNote.slice(line.qtyNote.indexOf(AUTO_ADDED_PREFIX))
        : null;
    return label ? { ...line, autoAddedLabel: label } : line;
  });
  const toSurface = (line: CartItem): AutoAddedSurfaceLine | null => {
    if (!line.autoAddedLabel || line.unitPrice == null || line.unitPrice <= 0) return null;
    const lineTotal = Math.round(line.unitPrice * line.qty * 100) / 100;
    return {
      sku: line.masterCode,
      distributorItemName: line.name.replace(/\s+—\s+Auto-added:.*$/, "").trim(),
      qty: line.qty,
      unitPrice: line.unitPrice,
      lineTotal,
      autoAddedLabel: line.autoAddedLabel,
    };
  };
  const materialList = cart.map(toSurface).filter((line): line is AutoAddedSurfaceLine => line != null);
  const total = calculateCartSubtotal(cart.filter((line) => line.autoAddedLabel));
  return {
    materialList,
    cart,
    invoice: { lines: materialList, total },
    distributorPo: { lines: materialList, total },
  };
}
