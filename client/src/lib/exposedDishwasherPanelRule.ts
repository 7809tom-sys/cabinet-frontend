/**
 * Owner rule, Nov 10 2026: every cabinet line finishes an exposed dishwasher
 * side with that line's own dishwasher panel.
 *
 * An exposed side is any end that does not touch a cabinet, an appliance, or a
 * wall. That includes the end of a run, a peninsula end, and an island end.
 * The countertop continues over the dishwasher and the panel and stops flush
 * with the panel's outer face.
 *
 * Auto Design should call `applyExposedDishwasherPanelRule`. Do not duplicate
 * this placement inside an Auto Design layout file.
 *
 * The panel is an existing catalog SKU with its existing price. A line with no
 * dishwasher panel, or a panel that has no price, is reported and nothing is
 * added. No SKU and no price is invented.
 */
import {
  STD,
  placedFootprint,
  type IslandZone,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import {
  DISHWASHER_RUN_END_PANEL_REASON,
  syncDishwasherPanels,
  type DishwasherPanelPlan,
  type DishwasherPanelStock,
  type DishwasherPanelWarning,
} from "./dishwasherPanelRule";

export type { DishwasherPanelStock, DishwasherPanelWarning, DishwasherPanelPlan };

const EPS = 1 / 16;

function codeKey(value: string | null | undefined): string {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * A dishwasher panel this line actually sells: DWR, DWP, DWEP, or a DEP-style
 * dishwasher panel. A base end skin, wall skin, or refrigerator panel is not
 * one, even when its code begins with BEP.
 */
export function isLineDishwasherPanelSku(item: {
  masterCode?: string | null;
  description?: string | null;
  subCategory?: string | null;
  category?: string | null;
}): boolean {
  const code = codeKey(item.masterCode);
  const text = `${item.category ?? ""} ${item.subCategory ?? ""} ${item.description ?? ""}`.toLowerCase();
  if (/^WDEP|^TDEP|^WEP|^TEP|^REP|^REPV|^WSV|^WS\d/.test(code)) return false;
  if (/refrigerator|fridge/.test(text) && !/dishwasher/.test(text)) return false;
  if (/\bwall\b/.test(text) && !/dishwasher/.test(text)) return false;
  if (/\btall\b/.test(text) && !/dishwasher/.test(text)) return false;
  if (/DWR/.test(code) || /^DWP/.test(code) || /^DWEP/.test(code)) return true;
  if (/^DEP\d/.test(code) || code === "DEP" || /^BDEP/.test(code)) return true;
  return /dishwasher\s*(?:return|end|side)?\s*panel/.test(text);
}

function skuRank(item: DishwasherPanelStock): number {
  const code = codeKey(item.masterCode);
  if (/DWR/.test(code)) return 0;
  if (/^DWP/.test(code)) return 1;
  if (/^DWEP/.test(code)) return 2;
  if (/^DEP/.test(code) || /^BDEP/.test(code)) return 3;
  return 4;
}

/** The line's priced dishwasher panel, or null when none is priced. */
export function selectLineDishwasherPanel(catalog: readonly DishwasherPanelStock[]): DishwasherPanelStock | null {
  const priced = catalog.filter((item) => isLineDishwasherPanelSku(item) && item.price != null && item.price > 0);
  return [...priced].sort((left, right) => skuRank(left) - skuRank(right))[0] ?? null;
}

export type DishwasherPanelLineAudit = {
  lineId: string;
  sku: string | null;
  priced: boolean;
  price: number | null;
};

/** What each catalog line sells for this rule. Unpriced matches are not usable. */
export function auditDishwasherPanelCatalog(
  lines: readonly { lineId: string; items: readonly DishwasherPanelStock[] }[],
): DishwasherPanelLineAudit[] {
  return lines.map((line) => {
    const matches = line.items.filter(isLineDishwasherPanelSku);
    const selected = selectLineDishwasherPanel(line.items);
    const listed = selected ?? matches[0] ?? null;
    return {
      lineId: line.lineId,
      sku: listed?.masterCode ?? null,
      priced: selected != null,
      price: selected?.price ?? null,
    };
  });
}

function panelThickness(stock: DishwasherPanelStock): number | null {
  const faces = [Number(stock.width), Number(stock.depth)].filter((value) => Number.isFinite(value) && value > 0 && value <= 6);
  if (faces.length === 0) return null;
  return Math.round(Math.min(...faces) * 8) / 8;
}

function missingNote(lineLabel: string, dishwasher: PlacedCabinet, edge: "start" | "end"): DishwasherPanelWarning {
  return {
    id: `missing-price:dw-panel:${dishwasher.uid}:${edge}`,
    cabinetUid: dishwasher.uid,
    reason: DISHWASHER_RUN_END_PANEL_REASON,
    message: `${lineLabel} has an exposed dishwasher side on ${dishwasher.masterCode} and no priced dishwasher panel in the catalog. Nothing was added.`,
  };
}

function presentWarning(warning: DishwasherPanelWarning, lineLabel: string): DishwasherPanelWarning {
  if (warning.id.startsWith("missing-price:")) {
    return {
      ...warning,
      message: `${lineLabel} has an exposed dishwasher side and no priced dishwasher panel in the catalog. Nothing was added.`,
    };
  }
  return { ...warning, message: warning.message.replace(" (DWR)", "") };
}

function isDishwasher(item: PlacedCabinet): boolean {
  const code = codeKey(item.masterCode);
  const text = `${item.description ?? ""} ${item.subCategory ?? ""}`.toLowerCase();
  return (item.placement === "appliance" || item.placement === "base")
    && (/^DW(?:\d|$)/.test(code) || /\bdishwasher\b/.test(text))
    && !/range|fridge|refrigerator|hood|wine|microwave/.test(text);
}

function isIslandDishwasher(item: PlacedCabinet, island: IslandZone | null): boolean {
  if (!isDishwasher(item)) return false;
  if (item.islandFace) return true;
  if (!island) return false;
  const foot = placedFootprint(item);
  const centerX = item.x + foot.w / 2;
  const centerY = item.y + foot.d / 2;
  return centerX >= island.x && centerX <= island.x + island.width && centerY >= island.y && centerY <= island.y + island.depth;
}

function runAxis(item: PlacedCabinet): "x" | "y" {
  const rotation = ((Math.round(Number(item.rotation) || 0) % 180) + 180) % 180;
  return rotation === 0 ? "x" : "y";
}

function alongOf(item: PlacedCabinet, axis: "x" | "y"): { start: number; end: number } {
  const foot = placedFootprint(item);
  if (axis === "x") return { start: item.x, end: item.x + foot.w };
  return { start: item.y, end: item.y + foot.d };
}

function touchesRoomWall(item: PlacedCabinet, edge: "start" | "end", room: RoomData): boolean {
  const axis = runAxis(item);
  const span = alongOf(item, axis);
  const limit = axis === "x" ? room.width : room.depth;
  const position = edge === "start" ? span.start : limit - span.end;
  return position <= 0.5;
}

function samePlan(left: readonly PlacedCabinet[], right: readonly PlacedCabinet[]): boolean {
  if (left.length !== right.length) return false;
  const key = (items: readonly PlacedCabinet[]) => items
    .map((item) => `${item.uid}:${item.autoPlacedReason ?? ""}:${Math.round(item.x * 8)}:${Math.round(item.y * 8)}:${item.wallOffset ?? ""}:${item.masterCode}`)
    .sort()
    .join("|");
  return key(left) === key(right);
}

function islandPanel(
  dishwasher: PlacedCabinet,
  edge: "start" | "end",
  stock: DishwasherPanelStock,
  thickness: number,
  island: IslandZone | null,
): PlacedCabinet {
  const axis = runAxis(dishwasher);
  const span = alongOf(dishwasher, axis);
  const runDepth = Number(dishwasher.depth) || STD.BASE_DEPTH;
  const height = Number(stock.height) || Number(dishwasher.height) || STD.BASE_HEIGHT;
  const x = axis === "x" ? (edge === "end" ? span.end : span.start - thickness) : dishwasher.x;
  const y = axis === "y" ? (edge === "end" ? span.end : span.start - thickness) : dishwasher.y;
  const face = dishwasher.islandFace ?? "front";
  const along = face === "front" || face === "back"
    ? x - (island?.x ?? 0)
    : y - (island?.y ?? 0);
  return {
    uid: `auto-dw-panel:${dishwasher.uid}:${edge}`,
    cabinetId: stock.id,
    masterCode: stock.masterCode,
    description: stock.description?.trim() || `${stock.masterCode} dishwasher panel`,
    category: "Panels",
    subCategory: "Dishwasher Panel",
    placement: "base",
    x,
    y,
    width: thickness,
    depth: runDepth,
    height,
    nominalWidth: thickness,
    nominalHeight: height,
    nominalDepth: runDepth,
    rotation: dishwasher.rotation ?? 0,
    mountBottom: 0,
    numberOfDoors: 0,
    numberOfDrawers: 0,
    fieldModificationNote: `Auto-added: dishwasher panel at the exposed ${edge} side. ${stock.masterCode}.`,
    autoPlacedReason: DISHWASHER_RUN_END_PANEL_REASON,
    autoPlacedForUid: dishwasher.uid,
    autoPlacedSide: edge,
    islandFace: dishwasher.islandFace ?? "front",
    islandOffset: along,
  };
}

function applyIslandExposedDishwasherPanels(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  island: IslandZone | null;
  stock: DishwasherPanelStock | null;
  lineLabel: string;
  original: readonly PlacedCabinet[];
}): DishwasherPanelPlan {
  const dishwashers = input.placed.filter((item) => isIslandDishwasher(item, input.island));
  if (dishwashers.length === 0) return { placed: input.placed as PlacedCabinet[], warnings: [] };
  const warnings: DishwasherPanelWarning[] = [];
  const thickness = input.stock ? panelThickness(input.stock) : null;
  const occupants = input.placed.filter((item) => item.autoPlacedReason !== DISHWASHER_RUN_END_PANEL_REASON || !item.islandFace);
  const panels: PlacedCabinet[] = [];
  for (const dishwasher of dishwashers) {
    const axis = runAxis(dishwasher);
    const own = alongOf(dishwasher, axis);
    const peers = occupants.filter((item) => {
      if (item.uid === dishwasher.uid || item.islandFace !== dishwasher.islandFace) return false;
      if (item.placement !== "base" && item.placement !== "appliance" && item.placement !== "tall") return false;
      return true;
    });
    for (const edge of ["start", "end"] as const) {
      const position = edge === "end" ? own.end : own.start;
      const covered = peers.some((peer) => {
        const span = alongOf(peer, axis);
        const gap = edge === "end" ? span.start - position : position - span.end;
        return Math.abs(gap) <= EPS;
      }) || touchesRoomWall(dishwasher, edge, input.room);
      if (covered) continue;
      if (!input.stock || input.stock.price == null || input.stock.price <= 0 || thickness == null) {
        warnings.push(missingNote(input.lineLabel, dishwasher, edge));
        continue;
      }
      panels.push(islandPanel(dishwasher, edge, input.stock, thickness, input.island));
    }
  }
  if (panels.length === 0 && warnings.length === 0) return { placed: input.placed as PlacedCabinet[], warnings };
  const next = [...occupants, ...panels];
  if (samePlan(next, input.original)) return { placed: input.original as PlacedCabinet[], warnings };
  return { placed: next, warnings };
}

/**
 * The function Auto Design should call.
 *
 * Places or removes the selected line's priced dishwasher panel on every
 * exposed dishwasher side. Wall runs and peninsula ends go through the shared
 * run placement. Island ends are placed on the island face. A missing or
 * unpriced SKU produces a warning and adds nothing.
 */
export function applyExposedDishwasherPanelRule(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  catalog: readonly DishwasherPanelStock[];
  island?: IslandZone | null;
  /** Customer-facing cabinet line, used only in the missing-panel note. */
  lineLabel?: string | null;
  /** False while catalog prices are still loading. The plan is left untouched. */
  pricesReady?: boolean;
}): DishwasherPanelPlan {
  if (input.pricesReady === false) return { placed: input.placed as PlacedCabinet[], warnings: [] };
  const lineLabel = input.lineLabel?.trim() || "This cabinet line";
  const stock = selectLineDishwasherPanel(input.catalog);
  const wall = syncDishwasherPanels({
    placed: input.placed,
    room: input.room,
    catalog: stock ? [stock] : [],
  });
  const island = applyIslandExposedDishwasherPanels({
    placed: wall.placed,
    room: input.room,
    island: input.island ?? null,
    stock,
    lineLabel,
    original: input.placed,
  });
  const warnings = [
    ...wall.warnings.map((warning) => presentWarning(warning, lineLabel)),
    ...island.warnings,
  ];
  if (island.placed === input.placed && wall.placed === input.placed) {
    return { placed: input.placed as PlacedCabinet[], warnings };
  }
  if (samePlan(island.placed, input.placed)) return { placed: input.placed as PlacedCabinet[], warnings };
  return { placed: island.placed, warnings };
}

/** Auto Design calls this function. The name is stable for that wiring. */
export const EXPOSED_DISHWASHER_PANEL_RULE = "applyExposedDishwasherPanelRule" as const;
