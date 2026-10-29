/**
 * In-stock alternatives for an out-of-stock cabinet.
 *
 * Suggestions are read-only. They use catalog identity the Designer already
 * has and never attach a price, discount, or surcharge. The caller decides
 * whether to swap; nothing here mutates the plan.
 *
 * Order, and only when the earlier tier is empty:
 * 1. Same width, height, depth, and cabinet type in the same door style.
 * 2. That same size and type in another door style from the same vendor.
 * 3. Two smaller cabinets of that type whose widths fill the opening exactly.
 *
 * Corner openings stay on the same corner type (blind, easy-reach, or
 * diagonal). A corner, sink, filler, or panel is never split. A range still
 * needs a neighbor at least 15 inches wide. A filler is never invented to
 * close a remainder, and a filler is never offered as a cabinet substitute.
 */

import { isStandardDoorBase } from "@/lib/genericCabinetDrawerReference";
import { RANGE_NEIGHBOR_MIN_WIDTH_IN } from "./autoDesignSeamFillers";
import { kitchenRuleNumber, kitchenRuleText } from "./kitchenRuleParameters";
import { buildStockPrompt, stockPromptOrderNote, type StockPromptChoice } from "./stockPrompt";
import { isRefrigeratorAppliance } from "./autoDesignAvailability";
import {
  DEFAULT_ROOM,
  STD,
  cabinetPlacementCollisionDetail,
  cabinetWall,
  effectiveStyleId,
  isCornerCabinet,
  isFarmSinkBasePaletteItem,
  isFillerItem,
  isGlassDoorCabinet,
  isPanelItem,
  isRangeOrOven,
  isRefrigerator,
  isSinkAppliance,
  isSinkBaseCabinet,
  makeUid,
  makeDefaultSinkForCabinet,
  placedCornerGeometryKind,
  placedHeight,
  resolvedDesignCabinetDimensions,
  wallPlacementAt,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type Placement,
  type PlacedCabinet,
  type RoomData,
  type SinkFixture,
} from "./design";
import {
  inventoryStockKeys,
  normalizeInventorySku,
  type InventoryProvider,
  type InventoryStockStatus,
  type StockStatusResult,
} from "./inventoryProvider";

const SIZE_TOLERANCE_IN = 0.02;
const NEIGHBOR_TOLERANCE_IN = 0.25;

/** Owner rule: an out-of-stock SBxx may be suggested as Bxx of the same width. */
export const SINK_BASE_FALSE_FRONT_RULE = "owner-sink-base-false-front";

export function sinkBaseNominalWidth(masterCode: string): number | null {
  const { fromPrefix } = sinkBaseSubstituteMap();
  const code = masterCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const match = code.match(new RegExp(`^(?:ADA)?${fromPrefix}(\\d{2})$`));
  if (!match) return null;
  const width = Number(match[1]);
  return width >= 12 && width <= 96 ? width : null;
}

export function plainBaseCodeForWidth(width: number): string {
  return `${sinkBaseSubstituteMap().toPrefix}${width}`;
}

export function sinkBaseFalseFrontLabel(baseCode: string): string {
  return `${baseCode} — remove drawer, install false front`;
}

/** Exact material-list wording for an automatic sink-base substitution. */
export function sinkBaseSubstitutionOrderNote(fromCode: string, toCode: string, includeSinkAndFaucet: boolean): string {
  const note = `out of ${fromCode}, sub with a ${toCode}. remove drawer, install false front`;
  return includeSinkAndFaucet ? `${note}. include sink and faucet` : note;
}

export function sinkBaseSubstituteMap(): { fromPrefix: string; toPrefix: string } {
  const raw = kitchenRuleText("sink_base_map", "SBxx->Bxx");
  const match = raw.toUpperCase().replace(/\s/g, "").match(/^([A-Z]+)XX->([A-Z]+)XX$/)
    ?? raw.toUpperCase().replace(/\s/g, "").match(/^([A-Z]+)->([A-Z]+)$/);
  if (!match) return { fromPrefix: "SB", toPrefix: "B" };
  return { fromPrefix: match[1]!, toPrefix: match[2]! };
}

export type InventoryCornerKind =
  | "blind"
  | "easy-reach"
  | "diagonal"
  | "triangle"
  | "corner-drawer"
  | "base-end"
  | "other-corner"
  | "none";

export type InventoryCatalogCandidate = {
  id: number;
  masterCode: string;
  sku?: string | null;
  vendorSku?: string | null;
  description: string;
  category?: string | null;
  subCategory?: string | null;
  width: number;
  height: number;
  depth: number;
  placement: Placement;
  styleId: number;
  distributorId: number;
  doorStyleName?: string;
  cornerType?: string | null;
  isCornerCabinet?: boolean | null;
  numberOfDoors?: number | null;
  numberOfDrawers?: number | null;
  glassDoor?: boolean | null;
  catalogImageUrl?: string | null;
};

export type InventorySuggestionTier = "same-style" | "cross-style" | "combination";

export type InventorySingleSuggestion = {
  id: string;
  kind: "single";
  tier: "same-style" | "cross-style";
  candidate: InventoryCatalogCandidate;
  reason: string;
  ruleNotes: readonly string[];
  /** Shown in place of the bare SKU, for a field modification. */
  displayLabel?: string;
  /** Copied onto the placed cabinet and the order line when the user swaps. */
  fieldModificationNote?: string;
};

export type InventoryCombinationSuggestion = {
  id: string;
  kind: "combination";
  tier: "combination";
  candidates: readonly InventoryCatalogCandidate[];
  reason: string;
  ruleNotes: readonly string[];
  fieldModificationNote?: string;
};

export type InventoryChoicePrompt = {
  fromCode: string;
  choices: readonly (StockPromptChoice & { suggestion: InventorySingleSuggestion | null })[];
};

export type InventorySuggestion = InventorySingleSuggestion | InventoryCombinationSuggestion;

export type InventoryCabinetNotice = {
  uid: string;
  masterCode: string;
  description: string;
  sku: string;
  status: "out_of_stock";
  qtyAvailable?: number;
  vendor?: string;
  asOf?: string;
  suggestions: readonly InventorySuggestion[];
  /** Present when this SKU must be asked about before any swap. */
  choicePrompt?: InventoryChoicePrompt;
};

export type DesignInventoryEvaluation = {
  providerId: InventoryProvider["id"];
  notices: readonly InventoryCabinetNotice[];
};

type CabinetProfile = {
  masterCode: string;
  description?: string | null;
  subCategory?: string | null;
  placement: Placement;
  width: number;
  height: number;
  depth: number;
  cornerType?: string | null;
  numberOfDoors?: number | null;
  numberOfDrawers?: number | null;
  glassDoor?: boolean | null;
  customProfile?: string | null;
};

type NeighborKind = "range" | "dishwasher" | "sink" | "refrigerator" | "corner" | "filler" | "cabinet" | "none";

type OpeningNeighbors = { before: NeighborKind; after: NeighborKind };

const EMPTY_EVALUATION: DesignInventoryEvaluation = { providerId: "unknown", notices: [] };

export function inventoryCandidateFromDesignCabinet(
  cabinet: DesignCabinet,
  meta: { styleId: number; distributorId: number; doorStyleName?: string },
): InventoryCatalogCandidate {
  const dims = resolvedDesignCabinetDimensions(cabinet);
  return {
    id: cabinet.id,
    masterCode: cabinet.masterCode,
    sku: cabinet.sku ?? null,
    vendorSku: cabinet.vendorSku ?? null,
    description: cabinet.description,
    category: cabinet.category,
    subCategory: cabinet.subCategory,
    width: dims.width,
    height: dims.height,
    depth: dims.depth,
    placement: cabinet.placement,
    styleId: meta.styleId,
    distributorId: meta.distributorId,
    doorStyleName: meta.doorStyleName,
    cornerType: cabinet.cornerType ?? null,
    isCornerCabinet: cabinet.isCornerCabinet,
    numberOfDoors: cabinet.numberOfDoors,
    numberOfDrawers: cabinet.numberOfDrawers,
    glassDoor: cabinet.glassDoor ?? null,
    catalogImageUrl: cabinet.catalogImageUrl ?? null,
  };
}

export function inventoryCornerKind(item: {
  masterCode: string;
  description?: string | null;
  cornerType?: string | null;
  placement: Placement;
  width?: number;
}): InventoryCornerKind {
  const probe = {
    uid: "inventory-probe",
    cabinetId: 0,
    masterCode: item.masterCode,
    description: item.description ?? "",
    placement: item.placement,
    cornerType: item.cornerType ?? null,
    x: 0,
    y: 0,
    width: item.width && item.width > 0 ? item.width : 36,
    depth: item.placement === "wall" ? STD.WALL_DEPTH : STD.BASE_DEPTH,
    rotation: 0,
  } as PlacedCabinet;
  const geometry = placedCornerGeometryKind(probe);
  if (geometry === "blind-corner") return "blind";
  if (geometry === "diagonal") return "diagonal";
  if (geometry === "l-shape") return "easy-reach";
  if (geometry === "triangle" || geometry === "corner-drawer" || geometry === "base-end") return geometry;
  if (isCornerCabinet(item.masterCode, item.description ?? undefined)) return "other-corner";
  return "none";
}

export function inventoryTypeKey(item: CabinetProfile): string {
  if (isFillerItem(item)) return "filler";
  if (isPanelItem(item)) return "panel";
  if (isDishwasherCode(item.masterCode)) return "dishwasher";
  if (item.placement === "appliance") return "appliance";
  const corner = inventoryCornerKind(item);
  if (corner !== "none") return `corner:${corner}`;
  if (isFarmSinkBasePaletteItem(item)) return "farm-sink-base";
  if (isSinkBaseCabinet(item)) return "sink-base";
  if (item.placement === "base" && isDrawerBase(item)) return "drawer-base";
  if (item.placement === "base") return "door-base";
  if (item.placement === "wall") return isGlassDoorCabinet(item) ? "wall-glass" : "wall";
  if (item.placement === "tall") return "tall";
  return item.placement;
}

function isDishwasherCode(masterCode?: string | null): boolean {
  const code = (masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^DW\d*$/.test(code) || /^DISHWASHER\d*$/.test(code);
}

function isDrawerBase(item: CabinetProfile): boolean {
  const code = item.masterCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/^(?:\d+)?DB\d/.test(code)) return true;
  // A standard B18 with a stale zero door count is still a door base, not a DB18.
  if (isStandardDoorBase(item.masterCode)) return false;
  const doors = item.numberOfDoors ?? 0;
  const drawers = item.numberOfDrawers ?? 0;
  return drawers > 0 && doors === 0;
}

function sameSize(left: Pick<CabinetProfile, "width" | "height" | "depth">, right: Pick<CabinetProfile, "width" | "height" | "depth">): boolean {
  return Math.abs(left.width - right.width) <= SIZE_TOLERANCE_IN
    && Math.abs(left.height - right.height) <= SIZE_TOLERANCE_IN
    && Math.abs(left.depth - right.depth) <= SIZE_TOLERANCE_IN;
}

function profileFromPlaced(cabinet: PlacedCabinet): CabinetProfile {
  return {
    masterCode: cabinet.masterCode,
    description: cabinet.description,
    subCategory: cabinet.subCategory,
    placement: cabinet.placement,
    width: cabinet.width,
    height: placedHeight(cabinet),
    depth: cabinet.depth,
    cornerType: cabinet.cornerType,
    numberOfDoors: cabinet.numberOfDoors,
    numberOfDrawers: cabinet.numberOfDrawers,
    glassDoor: cabinet.glassDoor,
    customProfile: cabinet.customProfile,
  };
}

function profileFromCandidate(candidate: InventoryCatalogCandidate): CabinetProfile {
  return candidate;
}

function checkedCabinet(cabinet: PlacedCabinet): boolean {
  if (cabinet.placement === "appliance") return false;
  if (isRefrigeratorAppliance(cabinet) || isRefrigerator(cabinet)) return false;
  if (isRangeOrOven(cabinet.masterCode, cabinet.description)) return false;
  if (isDishwasherCode(cabinet.masterCode)) return false;
  return true;
}

function runLayer(cabinet: PlacedCabinet): "upper" | "lower" | "other" {
  if (cabinet.placement === "wall" || cabinet.placement === "underCabinet") return "upper";
  if (cabinet.placement === "base" || cabinet.placement === "tall" || cabinet.placement === "appliance" || cabinet.placement === "baseTop") return "lower";
  return "other";
}

function neighborKind(cabinet: PlacedCabinet): NeighborKind {
  if (isFillerItem(cabinet)) return "filler";
  if (isRangeOrOven(cabinet.masterCode, cabinet.description)) return "range";
  if (isDishwasherCode(cabinet.masterCode)) return "dishwasher";
  if (isRefrigeratorAppliance(cabinet) || isRefrigerator(cabinet)) return "refrigerator";
  if (isSinkBaseCabinet(cabinet) || isSinkAppliance(cabinet)) return "sink";
  if (inventoryCornerKind(profileFromPlaced(cabinet)) !== "none") return "corner";
  return "cabinet";
}

function openingNeighbors(cabinet: PlacedCabinet, placed: readonly PlacedCabinet[], room: RoomData): OpeningNeighbors {
  if (cabinet.islandFace) return { before: "none", after: "none" };
  const wall = cabinetWall(cabinet, room);
  const start = wallRunOffset(cabinet, wall, room);
  const end = start + wallRunSpan(cabinet, wall, room);
  const layer = runLayer(cabinet);
  let before: NeighborKind = "none";
  let after: NeighborKind = "none";
  for (const other of placed) {
    if (other.uid === cabinet.uid || other.islandFace || runLayer(other) !== layer) continue;
    if (cabinetWall(other, room) !== wall) continue;
    const otherStart = wallRunOffset(other, wall, room);
    const otherEnd = otherStart + wallRunSpan(other, wall, room);
    if (Math.abs(otherEnd - start) <= NEIGHBOR_TOLERANCE_IN) before = neighborKind(other);
    if (Math.abs(otherStart - end) <= NEIGHBOR_TOLERANCE_IN) after = neighborKind(other);
  }
  return { before, after };
}

function widthsRespectNeighbors(widths: readonly number[], neighbors: OpeningNeighbors): boolean {
  const first = widths[0] ?? 0;
  const last = widths[widths.length - 1] ?? 0;
  if (neighbors.before === "range" && first < RANGE_NEIGHBOR_MIN_WIDTH_IN - SIZE_TOLERANCE_IN) return false;
  if (neighbors.after === "range" && last < RANGE_NEIGHBOR_MIN_WIDTH_IN - SIZE_TOLERANCE_IN) return false;
  return true;
}

function combinationBlocked(typeKey: string, cabinet: PlacedCabinet): boolean {
  if (typeKey.startsWith("corner:")) return true;
  if (typeKey === "filler" || typeKey === "panel" || typeKey === "sink-base" || typeKey === "farm-sink-base") return true;
  if (typeKey === "dishwasher" || typeKey === "appliance") return true;
  if (cabinet.islandFace || cabinet.peninsulaWizardId || cabinet.refrigeratorAssemblyId) return true;
  return false;
}

function ruleNotes(typeKey: string, tier: InventorySuggestionTier): string[] {
  const notes = ["catalog-price"];
  if (typeKey.startsWith("corner:")) notes.push(`corner-type:${typeKey.slice("corner:".length)}`);
  if (typeKey === "sink-base" || typeKey === "farm-sink-base") notes.push("sink-base");
  if (tier === "combination") notes.push("exact-opening", "no-filler");
  if (tier === "same-style") notes.push("same-style");
  if (tier === "cross-style") notes.push("same-vendor", "cross-style");
  return notes;
}

function typeLabel(typeKey: string): string {
  switch (typeKey) {
    case "door-base": return "door base";
    case "drawer-base": return "drawer base";
    case "sink-base": return "sink base";
    case "farm-sink-base": return "farm sink base";
    case "filler": return "filler";
    case "panel": return "panel";
    case "wall": return "wall cabinet";
    case "wall-glass": return "glass wall cabinet";
    case "tall": return "tall cabinet";
    case "corner:blind": return "blind corner";
    case "corner:easy-reach": return "easy-reach corner";
    case "corner:diagonal": return "diagonal corner";
    default: return typeKey.startsWith("corner:") ? `${typeKey.slice("corner:".length)} corner` : "cabinet";
  }
}

function styleLabel(candidate: InventoryCatalogCandidate): string {
  return candidate.doorStyleName?.trim() || `style ${candidate.styleId}`;
}

type ResolvedStock = StockStatusResult & { status: InventoryStockStatus };

function stockIndex(stock: readonly StockStatusResult[]): Map<string, StockStatusResult> {
  const index = new Map<string, StockStatusResult>();
  for (const row of stock) index.set(normalizeInventorySku(row.sku), row);
  return index;
}

function resolveStock(
  keys: readonly string[],
  index: Map<string, StockStatusResult>,
  assumeUnlistedInStock: boolean,
): ResolvedStock {
  for (const key of keys) {
    const row = index.get(normalizeInventorySku(key));
    if (row && row.status !== "unknown") return row;
  }
  if (assumeUnlistedInStock) {
    return { sku: keys[0] ?? "", status: "in_stock", qtyAvailable: 12, vendor: "simulation" };
  }
  return { sku: keys[0] ?? "", status: "unknown" };
}

function suggestForCabinet(
  cabinet: PlacedCabinet,
  placed: readonly PlacedCabinet[],
  catalog: readonly InventoryCatalogCandidate[],
  index: Map<string, StockStatusResult>,
  input: {
    designStyleId: number | null;
    distributorId: number | null;
    room: RoomData;
    assumeUnlistedInStock: boolean;
    limit: number;
  },
): InventoryCabinetNotice | null {
  if (!checkedCabinet(cabinet)) return null;
  const styleId = effectiveStyleId(cabinet, input.designStyleId);
  const keys = inventoryStockKeys({
    masterCode: cabinet.masterCode,
    styleId,
  });
  const stock = resolveStock(keys, index, input.assumeUnlistedInStock);
  if (stock.status !== "out_of_stock") return null;

  const profile = profileFromPlaced(cabinet);
  const typeKey = inventoryTypeKey(profile);
  const neighbors = openingNeighbors(cabinet, placed, input.room);
  const vendorId = input.distributorId;
  const pool = catalog.filter((candidate) => {
    if (vendorId != null && candidate.distributorId !== vendorId) return false;
    if (candidate.placement !== cabinet.placement) return false;
    if (inventoryTypeKey(profileFromCandidate(candidate)) !== typeKey) return false;
    const candidateStock = resolveStock(
      inventoryStockKeys(candidate),
      index,
      input.assumeUnlistedInStock,
    );
    return candidateStock.status === "in_stock";
  });

  const singles = pool
    .filter((candidate) => sameSize(candidate, profile))
    .filter((candidate) => !(candidate.styleId === styleId && normalizeInventorySku(candidate.masterCode) === normalizeInventorySku(cabinet.masterCode)))
    .filter((candidate) => widthsRespectNeighbors([candidate.width], neighbors));

  const sameStyle = styleId == null ? [] : singles.filter((candidate) => candidate.styleId === styleId);
  const crossStyle = singles.filter((candidate) => candidate.styleId !== styleId);
  const chosenSingles = (sameStyle.length > 0 ? sameStyle : crossStyle)
    .sort((left, right) => styleLabel(left).localeCompare(styleLabel(right)) || left.masterCode.localeCompare(right.masterCode));

  const suggestions: InventorySuggestion[] = [];
  if (chosenSingles.length > 0) {
    const tier = sameStyle.length > 0 ? "same-style" : "cross-style";
    for (const candidate of chosenSingles) {
      suggestions.push({
        id: `single:${candidate.styleId}:${candidate.masterCode}`,
        kind: "single",
        tier,
        candidate,
        reason: tier === "same-style"
          ? `Same ${formatSize(profile)} ${typeLabel(typeKey)} in ${styleLabel(candidate)}.`
          : `Same size ${typeLabel(typeKey)} in ${styleLabel(candidate)}, from this vendor.`,
        ruleNotes: ruleNotes(typeKey, tier),
      });
    }
  } else if (!combinationBlocked(typeKey, cabinet)) {
    suggestions.push(...combinations(cabinet, profile, typeKey, pool, styleId, neighbors));
  }

  const prompt = buildStockPrompt({
    masterCode: cabinet.masterCode,
    placement: cabinet.placement,
    styleId,
    distributorId: vendorId,
    catalog,
    stock: [...index.values()],
    assumeUnlistedInStock: input.assumeUnlistedInStock,
  });
  const choicePrompt = prompt
    ? {
      fromCode: prompt.fromCode,
      choices: prompt.choices.map((choice) => ({
        ...choice,
        suggestion: choice.candidate
          ? {
            id: `stock-prompt:${choice.id}:${choice.candidate.styleId}:${choice.candidate.masterCode}`,
            kind: "single" as const,
            tier: "same-style" as const,
            candidate: choice.candidate,
            displayLabel: choice.candidate.masterCode,
            fieldModificationNote: stockPromptOrderNote(cabinet.masterCode, choice.label),
            reason: choice.buttonLabel,
            ruleNotes: ["stock-prompt", choice.id, "same-style"],
          }
          : null,
      })),
    }
    : undefined;

  return {
    uid: cabinet.uid,
    masterCode: cabinet.masterCode,
    description: cabinet.description,
    sku: cabinet.masterCode,
    status: "out_of_stock",
    qtyAvailable: stock.qtyAvailable,
    vendor: stock.vendor,
    asOf: stock.asOf,
    suggestions: suggestions.slice(0, input.limit),
    ...(choicePrompt ? { choicePrompt } : {}),
  };
}

function combinations(
  cabinet: PlacedCabinet,
  profile: CabinetProfile,
  typeKey: string,
  pool: readonly InventoryCatalogCandidate[],
  styleId: number | null,
  neighbors: OpeningNeighbors,
): InventoryCombinationSuggestion[] {
  const pieces = pool.filter((candidate) => (
    candidate.width > SIZE_TOLERANCE_IN
    && candidate.width < profile.width - SIZE_TOLERANCE_IN
    && Math.abs(candidate.height - profile.height) <= SIZE_TOLERANCE_IN
    && Math.abs(candidate.depth - profile.depth) <= SIZE_TOLERANCE_IN
  ));
  const found: Array<{ order: InventoryCatalogCandidate[]; sameStyle: boolean; balance: number }> = [];
  const seen = new Set<string>();
  for (let left = 0; left < pieces.length; left += 1) {
    for (let right = left; right < pieces.length; right += 1) {
      const pair = [pieces[left]!, pieces[right]!];
      if (Math.abs(pair[0].width + pair[1].width - profile.width) > SIZE_TOLERANCE_IN) continue;
      if (pair[0].styleId !== pair[1].styleId) continue;
      const orders = pair[0].id === pair[1].id && pair[0].masterCode === pair[1].masterCode
        ? [pair]
        : [pair, [pair[1]!, pair[0]!]];
      for (const order of orders) {
        if (!widthsRespectNeighbors(order.map((item) => item.width), neighbors)) continue;
        const key = order.map((item) => `${item.styleId}:${item.id}:${item.masterCode}`).join("+");
        if (seen.has(key)) continue;
        seen.add(key);
        found.push({
          order,
          sameStyle: styleId != null && order.every((item) => item.styleId === styleId),
          balance: Math.abs(order[0]!.width - order[1]!.width),
        });
      }
    }
  }
  const sameStylePairs = found.filter((pair) => pair.sameStyle);
  const chosen = (sameStylePairs.length > 0 ? sameStylePairs : found.filter((pair) => !pair.sameStyle))
    .sort((left, right) => left.balance - right.balance
      || left.order.map((item) => item.masterCode).join().localeCompare(right.order.map((item) => item.masterCode).join()));
  return chosen.map((pair) => ({
    id: `combination:${pair.order.map((item) => `${item.styleId}:${item.masterCode}`).join("+")}`,
    kind: "combination" as const,
    tier: "combination" as const,
    candidates: pair.order,
    reason: `Two ${styleLabel(pair.order[0]!)} cabinets, ${pair.order.map((item) => item.masterCode).join(" + ")}, fill this ${trimInches(profile.width)} opening.`,
    ruleNotes: ruleNotes(typeKey, "combination"),
  }));
}

function formatSize(profile: CabinetProfile): string {
  return `${trimInches(profile.width)} × ${trimInches(profile.height)} × ${trimInches(profile.depth)}`;
}

function trimInches(value: number): string {
  const rounded = Math.round(value * 8) / 8;
  return Number.isInteger(rounded) ? `${rounded}"` : `${rounded}"`;
}

export type CatalogOrderFixture = {
  id: number;
  name: string;
  pelicanCode?: string | null;
  imageUrl?: string | null;
};

export type AutomaticSinkBaseSwap = {
  uid: string;
  fromCode: string;
  toCode: string;
  orderNote: string;
  /** True when no catalog sink and faucet SKU was available to add. */
  includeSinkAndFaucetNote: boolean;
  sinkProduct: CatalogOrderFixture | null;
  faucetProduct: CatalogOrderFixture | null;
};

/**
 * Swaps every out-of-stock SBxx for an in-stock Bxx in the same door style.
 * Nothing is invented: a sink or faucet line is added only when a catalog
 * product is passed in. Otherwise the order note says to include them.
 */
export function applyAutomaticSinkBaseSubstitutions(input: {
  placed: readonly PlacedCabinet[];
  catalog: readonly InventoryCatalogCandidate[];
  stock: readonly StockStatusResult[];
  room: RoomData;
  designStyleId: number | null;
  distributorId: number | null;
  assumeUnlistedInStock?: boolean;
  skipUids?: ReadonlySet<string>;
  sinkProduct?: CatalogOrderFixture | null;
  faucetProduct?: CatalogOrderFixture | null;
}): { placed: PlacedCabinet[]; sinks: SinkFixture[]; swaps: AutomaticSinkBaseSwap[] } {
  if (kitchenRuleNumber("sink_base_substitute") === 0 || input.designStyleId == null) {
    return { placed: [...input.placed], sinks: [], swaps: [] };
  }
  const index = stockIndex(input.stock);
  const assume = input.assumeUnlistedInStock === true;
  let placed = [...input.placed];
  const sinks: SinkFixture[] = [];
  const swaps: AutomaticSinkBaseSwap[] = [];
  for (const cabinet of input.placed) {
    if (input.skipUids?.has(cabinet.uid)) continue;
    if (cabinet.fieldModificationNote) continue;
    const styleId = effectiveStyleId(cabinet, input.designStyleId);
    if (styleId == null || !isSinkBaseCabinet(cabinet)) continue;
    const width = sinkBaseNominalWidth(cabinet.masterCode);
    if (width == null) continue;
    const ownStock = resolveStock(inventoryStockKeys({ masterCode: cabinet.masterCode, styleId }), index, assume);
    if (ownStock.status !== "out_of_stock") continue;
    const baseCode = plainBaseCodeForWidth(width);
    const candidate = input.catalog
      .filter((row) => {
        if (input.distributorId != null && row.distributorId !== input.distributorId) return false;
        if (row.styleId !== styleId || row.placement !== "base") return false;
        if (normalizeInventorySku(row.masterCode) !== normalizeInventorySku(baseCode)) return false;
        if (isSinkBaseCabinet(row) || isCornerCabinet(row.masterCode, row.description)) return false;
        return resolveStock(inventoryStockKeys(row), index, assume).status === "in_stock";
      })
      .sort((left, right) => left.id - right.id)[0];
    if (!candidate) continue;
    let includeSinkAndFaucetNote = !input.sinkProduct || !input.faucetProduct;
    let fixture: SinkFixture | null = null;
    if (input.sinkProduct && input.faucetProduct) {
      try {
        fixture = {
          ...makeDefaultSinkForCabinet(cabinet, input.room),
          faucet: true,
          pelicanProductId: input.sinkProduct.id,
          pelicanProductName: input.sinkProduct.name,
          pelicanProductImage: input.sinkProduct.imageUrl ?? undefined,
          pelicanFaucetProductId: input.faucetProduct.id,
          pelicanFaucetProductName: input.faucetProduct.name,
          pelicanFaucetProductImage: input.faucetProduct.imageUrl ?? undefined,
          autoDesignFaucet: true,
        };
      } catch {
        fixture = null;
        includeSinkAndFaucetNote = true;
      }
    }
    const orderNote = sinkBaseSubstitutionOrderNote(cabinet.masterCode, candidate.masterCode, includeSinkAndFaucetNote);
    const swapped = stampCandidate(cabinet, candidate, input.designStyleId, orderNote);
    placed = placed.map((item) => item.uid === cabinet.uid ? swapped : item);
    if (fixture) sinks.push({ ...fixture, cabinetUid: cabinet.uid });
    swaps.push({
      uid: cabinet.uid,
      fromCode: cabinet.masterCode,
      toCode: candidate.masterCode,
      orderNote,
      includeSinkAndFaucetNote,
      sinkProduct: input.sinkProduct ?? null,
      faucetProduct: input.faucetProduct ?? null,
    });
  }
  return { placed, sinks, swaps };
}

export function designInventoryFromStock(input: {
  providerId: InventoryProvider["id"];
  placed: readonly PlacedCabinet[];
  catalog: readonly InventoryCatalogCandidate[];
  stock: readonly StockStatusResult[];
  room: RoomData;
  designStyleId: number | null;
  distributorId: number | null;
  assumeUnlistedInStock?: boolean;
  limit?: number;
}): DesignInventoryEvaluation {
  if (input.providerId === "unknown") return EMPTY_EVALUATION;
  const index = stockIndex(input.stock);
  const notices = input.placed.flatMap((cabinet) => {
    const notice = suggestForCabinet(cabinet, input.placed, input.catalog, index, {
      designStyleId: input.designStyleId,
      distributorId: input.distributorId,
      room: input.room,
      assumeUnlistedInStock: input.assumeUnlistedInStock === true,
      limit: input.limit ?? 6,
    });
    return notice ? [notice] : [];
  });
  return { providerId: input.providerId, notices };
}

export function collectInventoryLookupSkus(
  placed: readonly PlacedCabinet[],
  catalog: readonly InventoryCatalogCandidate[],
  designStyleId: number | null,
): string[] {
  const keys: string[] = [];
  for (const cabinet of placed) {
    if (!checkedCabinet(cabinet)) continue;
    keys.push(...inventoryStockKeys({ masterCode: cabinet.masterCode, styleId: effectiveStyleId(cabinet, designStyleId) }));
  }
  for (const candidate of catalog) keys.push(...inventoryStockKeys(candidate));
  return [...new Set(keys)];
}

export async function evaluateDesignInventory(input: {
  provider: InventoryProvider;
  placed: readonly PlacedCabinet[];
  catalog: readonly InventoryCatalogCandidate[];
  room?: RoomData;
  designStyleId: number | null;
  distributorId: number | null;
  limit?: number;
}): Promise<DesignInventoryEvaluation> {
  if (input.provider.id === "unknown") return EMPTY_EVALUATION;
  const room = input.room ?? DEFAULT_ROOM;
  const skus = collectInventoryLookupSkus(input.placed, input.catalog, input.designStyleId);
  const stock = await input.provider.getStockStatus(skus);
  if (input.provider.id === "unknown") return EMPTY_EVALUATION;
  return designInventoryFromStock({
    providerId: input.provider.id,
    placed: input.placed,
    catalog: input.catalog,
    stock,
    room,
    designStyleId: input.designStyleId,
    distributorId: input.distributorId,
    assumeUnlistedInStock: input.provider.id === "stub",
    limit: input.limit,
  });
}

export type InventorySwapResult = {
  placed: PlacedCabinet[];
  selectedUid: string | null;
  unchanged: boolean;
  message: string;
};

/**
 * Apply a suggestion the user chose. Position and existing per-cabinet
 * discount stay on a one-for-one swap. New combination pieces get no
 * discount. No price field is written; catalog pricing is unchanged.
 */
export function applyInventorySuggestion(input: {
  placed: readonly PlacedCabinet[];
  uid: string;
  suggestion: InventorySuggestion;
  room: RoomData;
  designStyleId: number | null;
  makeUid?: () => string;
}): InventorySwapResult {
  const original = input.placed.find((cabinet) => cabinet.uid === input.uid);
  if (!original) {
    return { placed: [...input.placed], selectedUid: null, unchanged: true, message: "That cabinet is no longer in the design." };
  }
  const next = input.suggestion.kind === "single"
    ? replaceSingle(input.placed, original, input.suggestion.candidate, input.designStyleId, input.suggestion.fieldModificationNote ?? null)
    : replaceWithCombination(input.placed, original, input.suggestion.candidates, input.room, input.designStyleId, input.makeUid ?? makeUid, input.suggestion.fieldModificationNote ?? null);
  if (!next) {
    return {
      placed: [...input.placed],
      selectedUid: original.uid,
      unchanged: true,
      message: "That alternative does not fit this opening, so nothing was changed.",
    };
  }
  return next;
}

function replaceSingle(
  placed: readonly PlacedCabinet[],
  original: PlacedCabinet,
  candidate: InventoryCatalogCandidate,
  designStyleId: number | null,
  fieldModificationNote: string | null,
): InventorySwapResult | null {
  const swapped = stampCandidate(original, candidate, designStyleId, fieldModificationNote);
  return {
    placed: placed.map((cabinet) => cabinet.uid === original.uid ? swapped : cabinet),
    selectedUid: original.uid,
    unchanged: false,
    message: `${original.masterCode} swapped for ${candidate.masterCode}. Catalog price is unchanged.`,
  };
}

function replaceWithCombination(
  placed: readonly PlacedCabinet[],
  original: PlacedCabinet,
  candidates: readonly InventoryCatalogCandidate[],
  room: RoomData,
  designStyleId: number | null,
  nextUid: () => string,
  fieldModificationNote: string | null,
): InventorySwapResult | null {
  if (original.islandFace || candidates.length < 2) return null;
  const wall = cabinetWall(original, room);
  let along = wallRunOffset(original, wall, room);
  const pieces: PlacedCabinet[] = [];
  for (const candidate of candidates) {
    const spot = wallPlacementAt(along, candidate.width, candidate.depth, wall, room, original.peninsulaSide ?? null, false);
    const piece = stampCandidate({
      ...original,
      uid: nextUid(),
      x: spot.x,
      y: spot.y,
      rotation: spot.rotation,
      wallId: spot.wallId ?? original.wallId,
      wallOffset: spot.wallOffset ?? along,
      peninsulaSide: spot.peninsulaSide ?? original.peninsulaSide,
      discountPct: null,
      fillerPieceGroupId: null,
      fillerBillingRole: null,
      fillerForCabinetUid: null,
      peninsulaWizardId: null,
    }, candidate, designStyleId, fieldModificationNote);
    pieces.push(piece);
    along += candidate.width;
  }
  const others = placed.filter((cabinet) => cabinet.uid !== original.uid);
  for (const piece of pieces) {
    const peers = [...others, ...pieces.filter((item) => item.uid !== piece.uid)];
    if (cabinetPlacementCollisionDetail(piece, peers, room)) return null;
  }
  const insertAt = placed.findIndex((cabinet) => cabinet.uid === original.uid);
  const next = [...placed];
  next.splice(insertAt, 1, ...pieces);
  const codes = candidates.map((candidate) => candidate.masterCode).join(" + ");
  return {
    placed: next,
    selectedUid: pieces[0]?.uid ?? null,
    unchanged: false,
    message: `${original.masterCode} swapped for ${codes}. Catalog prices are unchanged.`,
  };
}

function stampCandidate(
  original: PlacedCabinet,
  candidate: InventoryCatalogCandidate,
  designStyleId: number | null,
  fieldModificationNote: string | null = null,
): PlacedCabinet {
  const effective = effectiveStyleId(original, designStyleId);
  const styleId = candidate.styleId === effective ? original.styleId ?? null : candidate.styleId;
  return {
    ...original,
    fieldModificationNote,
    cabinetId: candidate.id,
    masterCode: candidate.masterCode,
    description: candidate.description,
    category: candidate.category ?? original.category ?? null,
    subCategory: candidate.subCategory ?? original.subCategory ?? null,
    width: candidate.width,
    height: candidate.height,
    depth: candidate.depth,
    nominalWidth: candidate.width,
    nominalHeight: candidate.height,
    nominalDepth: candidate.depth,
    placement: candidate.placement,
    numberOfDoors: candidate.numberOfDoors ?? null,
    numberOfDrawers: candidate.numberOfDrawers ?? null,
    cornerType: candidate.cornerType ?? null,
    isCornerCabinet: candidate.isCornerCabinet ?? inventoryCornerKind(candidate) !== "none",
    glassDoor: candidate.glassDoor ?? undefined,
    catalogImageUrl: candidate.catalogImageUrl ?? original.catalogImageUrl,
    styleId,
  };
}
