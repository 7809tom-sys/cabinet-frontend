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
  isFillerItem,
  isPanelItem,
  isRefrigerator,
  wallLength,
  wallPlacementAt,
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
export const AUTO_ADDED_PREFIX = "Auto-added:";

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
  stockFace: number;
  stockHeight: number;
  price: number | null;
};

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

function isHost(item: PlacedCabinet): boolean {
  if (isAutoPanel(item) || isPanelItem(item) || isFillerItem(item)) return false;
  return item.placement === "base" || item.placement === "wall" || item.placement === "tall" || item.placement === "appliance";
}

function span(item: PlacedCabinet, room: RoomData) {
  const side = cabinetWall(item, room);
  const start = wallRunOffset(item, side, room);
  return { side, start, end: start + wallRunSpan(item, side, room) };
}

function sameRun(a: PlacedCabinet, b: PlacedCabinet, room: RoomData): boolean {
  if (a.islandFace || b.islandFace) return a.islandFace != null && a.islandFace === b.islandFace;
  return cabinetWall(a, room) === cabinetWall(b, room) && a.placement === b.placement;
}

function layerMatches(owner: PlacedCabinet, other: PlacedCabinet): boolean {
  if (other.placement === "tall" || isPanelItem(other)) return true;
  if (owner.placement === "appliance") return other.placement === "base" || other.placement === "tall" || isPanelItem(other) || isFillerItem(other);
  return other.placement === owner.placement || isPanelItem(other) || (isFillerItem(other) && other.placement === owner.placement);
}

function meets(ownerStart: number, ownerEnd: number, otherStart: number, otherEnd: number, side: Side): boolean {
  if (side === "back") return false;
  if (side === "start") return otherEnd >= ownerStart - FLUSH && otherStart < ownerStart + FLUSH;
  return otherStart <= ownerEnd + FLUSH && otherEnd > ownerEnd - FLUSH;
}

function finishedAppliance(item: PlacedCabinet): boolean {
  return item.placement === "appliance" && /finished side/i.test(`${item.description ?? ""} ${item.masterCode ?? ""}`);
}

function coveredByNeighbor(owner: PlacedCabinet, side: Side, placed: readonly PlacedCabinet[], room: RoomData): boolean {
  const ownerSpan = span(owner, room);
  return placed.some((other) => {
    if (other.uid === owner.uid || isAutoPanel(other)) return false;
    if (!layerMatches(owner, other)) return false;
    if (owner.islandFace) {
      if (other.islandFace !== owner.islandFace) return false;
    } else if (cabinetWall(other, room) !== ownerSpan.side) return false;
    if (finishedAppliance(other)) return true;
    if (other.placement === "appliance" || isRefrigerator(other)) return false;
    const otherSpan = span(other, room);
    return meets(ownerSpan.start, ownerSpan.end, otherSpan.start, otherSpan.end, side);
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

function neighborAppliance(owner: PlacedCabinet, side: Side, placed: readonly PlacedCabinet[], room: RoomData): PlacedCabinet | null {
  const ownerSpan = span(owner, room);
  return placed.find((other) => {
    if (other.uid === owner.uid || other.placement !== "appliance" && !isRefrigerator(other)) return false;
    if (cabinetWall(other, room) !== ownerSpan.side) return false;
    const otherSpan = span(other, room);
    return meets(ownerSpan.start, ownerSpan.end, otherSpan.start, otherSpan.end, side);
  }) ?? null;
}

function reasonFor(owner: PlacedCabinet, side: Side, placed: readonly PlacedCabinet[], room: RoomData, openings: readonly WallOpening[]): ExposedPanelReason | null {
  const ownerSpan = span(owner, room);
  const edge = side === "start" ? ownerSpan.start : ownerSpan.end;
  const wallLen = wallLength(ownerSpan.side, room);
  const wallGap = side === "start" ? ownerSpan.start : side === "end" ? wallLen - ownerSpan.end : Number.POSITIVE_INFINITY;
  const againstWall = wallGap <= kitchenRuleNumber("panel_thickness_in") + FLUSH && !owner.islandFace;
  const window = windowAt(edge, side, ownerSpan.side, openings, kitchenRuleNumber("window_filler_max_in") + kitchenRuleNumber("panel_thickness_in"));
  const appliance = neighborAppliance(owner, side, placed, room);
  const applianceHay = `${appliance?.masterCode ?? ""} ${appliance?.description ?? ""}`.toLowerCase();
  if (window && owner.placement === "wall" && Math.abs((owner.height ?? 30) - kitchenRuleNumber("window_cabinet_height_in")) <= 0.5) return "beside-window";
  if (/dw|dishwasher/.test(applianceHay) || /dw|dishwasher/i.test(owner.masterCode) && side !== "back") return "dw-exposed-side";
  if (isRefrigerator(owner) || isRefrigerator(appliance ?? owner) && appliance) return "fridge-end";
  if (/range|cooktop/.test(applianceHay)) return "open-beside-range";
  if (againstWall && !owner.islandFace) return "end-of-run-against-wall";
  if (owner.islandFace === "back" || side === "back" && owner.islandFace) return owner.peninsulaSide || owner.peninsulaWizardId ? "peninsula-back" : "island-back";
  if (owner.islandFace) return owner.peninsulaSide || owner.peninsulaWizardId ? "peninsula-end" : "island-end";
  if (owner.placement === "wall") return "wall-cabinet-end";
  if (owner.placement === "tall") return "tall-cabinet-end";
  if (/vanity/i.test(`${owner.masterCode} ${owner.description ?? ""}`)) return "vanity-end";
  return "base-open-end";
}

function frameless(cabinet: PlacedCabinet): boolean {
  return cabinet.constructionMethod === "aef" || /frameless/i.test(cabinet.constructionMethod ?? "") || cabinet.constructionMethod === "AEF";
}

function pickStock(owner: PlacedCabinet, catalog: readonly ExposedPanelStock[]): ExposedPanelStock | null {
  const family = owner.placement === "wall" ? "wall" : owner.placement === "tall" || isRefrigerator(owner) ? "tall" : "base";
  const face = owner.placement === "wall" ? Math.max(owner.depth, 12) : Math.max(owner.depth, 24);
  const height = owner.height ?? (family === "wall" ? 30 : family === "tall" ? 96 : 34.5);
  const fits = catalog
    .filter((item) => item.placement === family && item.stockFace + FLUSH >= face && item.stockHeight + FLUSH >= height)
    .sort((a, b) => a.stockFace * a.stockHeight - b.stockFace * b.stockHeight);
  return fits[0] ?? catalog.find((item) => item.placement === family) ?? null;
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
  let hostsPlaced = hosts.map((item) => ({ ...item }));

  const refresh = (uid: string, next: PlacedCabinet) => {
    hostsPlaced = hostsPlaced.map((item) => item.uid === uid ? next : item);
  };

  for (const listed of hosts) {
    const sides: Side[] = listed.islandFace || listed.peninsulaWizardId ? ["start", "end", "back"] : ["start", "end"];
    for (const panelSide of sides) {
      const host = hostsPlaced.find((item) => item.uid === listed.uid) ?? listed;
      if (coveredByNeighbor(host, panelSide, [...hostsPlaced, ...input.placed.filter(isAutoPanel)], input.room)) continue;
      const reason = reasonFor(host, panelSide, hostsPlaced, input.room, openings);
      if (!reason || !enabled(reason)) continue;
      const framedWindow = reason === "beside-window" && !frameless(host);
      if (framedWindow && kitchenRuleNumber("window_framed_panel") === 0) continue;
      const stock = pickStock(host, input.catalog);
      const key = `${host.uid}:${panelSide}`;
      if (!stock || stock.price == null || !(stock.price > 0)) {
        warnings.push({
          id: `missing-price:${key}`,
          cabinetUid: host.uid,
          reason,
          message: `${host.masterCode} needs a finished panel (${EXPOSED_PANEL_REASONS[reason]}), and this door style has no priced panel SKU. Nothing was added at $0.`,
        });
        continue;
      }
      const hostSpan = span(host, input.room);
      const thickness = kitchenRuleNumber("panel_thickness_in");
      let along = panelSide === "end" ? hostSpan.end : Math.max(0, hostSpan.start - thickness);
      if (panelSide === "start" && hostSpan.start < thickness - FLUSH) {
        const shifted = shiftHost(host, thickness - hostSpan.start, input.room);
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
          const shifted = shiftHost(hostsPlaced.find((item) => item.uid === host.uid) ?? host, -thickness, input.room);
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
