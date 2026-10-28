/**
 * One engine for finished panels on exposed cabinet sides.
 *
 * A side is exposed when no adjacent cabinet box, panel, or filler covers it,
 * and no built-in appliance with its own finished side covers it. A run end
 * that meets a wall is also exposed: the owner wants a 3/4" panel there.
 * Each named reason has its own Kitchen Rules switch. The master switch
 * turns the whole engine off.
 *
 * Panels are real placed pieces so plan, elevation, and 3D draw them. They
 * are priced from a catalog SKU. A missing price does not insert a $0 line.
 */
import { kitchenRuleNumber } from "./kitchenRuleParameters";
import {
  cabinetWall,
  isCornerCabinet,
  isFillerItem,
  isPanelItem,
  isRefrigerator,
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
};

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

function shiftClears(host: PlacedCabinet, delta: number, placed: readonly PlacedCabinet[], room: RoomData): PlacedCabinet | null {
  const shifted = shiftHost(host, delta, room);
  if (!shifted) return null;
  const next = span(shifted, room);
  const hitsNeighbor = placed.some((other) => {
    if (other.uid === host.uid || isAutoPanel(other)) return false;
    if (!isHost(other) && !isRunFiller(other) && !isPanelItem(other)) return false;
    if (other.islandFace !== shifted.islandFace) return false;
    if (!other.islandFace && cabinetWall(other, room) !== next.side) return false;
    if (!layerMatches(shifted, other)) return false;
    const otherSpan = span(other, room);
    const overlap = Math.min(next.end, otherSpan.end) - Math.max(next.start, otherSpan.start);
    return overlap > FLUSH;
  });
  return hitsNeighbor ? null : shifted;
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
}): ExposedSidePlan {
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
        const shifted = shiftClears(host, thickness - hostSpan.start, hostsPlaced, input.room);
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
          const shifted = shiftClears(hostsPlaced.find((item) => item.uid === host.uid) ?? host, -thickness, hostsPlaced, input.room);
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
      const panel = placePanel(current, along, thickness, wall, input.room, stock, reason, host.uid, panelSide);
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
