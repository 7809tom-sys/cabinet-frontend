/**
 * Interactive out-of-stock prompts. Nothing in this module changes a plan.
 * The Designer asks, and the caller applies a choice only after the customer picks.
 *
 * Owners edit `stock_prompts`. Each entry is `SKU:option,option`.
 * Entries are separated by semicolons. Known options are `full-height`,
 * `drawer`, and `readjust`. An unknown option is ignored so a typo cannot
 * invent a fourth replacement.
 */
import { kitchenRuleNumber, kitchenRuleText } from "./kitchenRuleParameters";
import { effectiveSmallGapFillerMaxIn } from "./smallGapFiller";
import { RANGE_NEIGHBOR_MIN_WIDTH_IN } from "./autoDesignSeamFillers";
import { inventoryStockKeys, normalizeInventorySku, type StockStatusResult } from "./inventoryProvider";
import type { InventoryCatalogCandidate } from "./inventoryAlternatives";
import {
  COLLISION_EPSILON_IN,
  cabinetPlacementCollisionDetail,
  cabinetWall,
  freeSegmentsOnWall,
  isCornerCabinet,
  isFillerItem,
  isRangeOrOven,
  makeUid,
  wallLength,
  wallPlacementAt,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
  type WallSide,
} from "./design";

export const STOCK_PROMPTS_DEFAULT = "B18:full-height,drawer,readjust";

export const STOCK_PROMPT_OPTION_IDS = ["full-height", "drawer", "readjust"] as const;

export type StockPromptOptionId = (typeof STOCK_PROMPT_OPTION_IDS)[number];

export type StockPromptRule = {
  sku: string;
  options: StockPromptOptionId[];
};

export type StockPromptChoice = {
  id: StockPromptOptionId;
  /** Phrase used in the order note: out of B18, customer chose <label>. */
  label: string;
  buttonLabel: string;
  candidate: InventoryCatalogCandidate | null;
};

export type StockPrompt = {
  fromCode: string;
  choices: StockPromptChoice[];
};

const OPTION_COPY: Record<StockPromptOptionId, { label: string; buttonLabel: string }> = {
  "full-height": { label: "full-height door base", buttonLabel: "Full-height door base" },
  drawer: { label: "drawer base", buttonLabel: "Drawer base" },
  readjust: { label: "readjust the plan", buttonLabel: "Readjust the plan" },
};

export function stockPromptOrderNote(fromCode: string, label: string): string {
  return `out of ${fromCode}, customer chose ${label}`;
}

export function compactCabinetCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function parseStockPrompts(raw: string): StockPromptRule[] {
  const rules: StockPromptRule[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(/[;\n]/)) {
    const trimmed = part.trim();
    if (!trimmed || !trimmed.includes(":")) continue;
    const splitAt = trimmed.indexOf(":");
    const sku = compactCabinetCode(trimmed.slice(0, splitAt));
    if (!sku || seen.has(sku)) continue;
    const options: StockPromptOptionId[] = [];
    for (const token of trimmed.slice(splitAt + 1).split(",")) {
      const id = token.trim().toLowerCase();
      if (!STOCK_PROMPT_OPTION_IDS.includes(id as StockPromptOptionId)) continue;
      if (!options.includes(id as StockPromptOptionId)) options.push(id as StockPromptOptionId);
    }
    if (options.length === 0) continue;
    seen.add(sku);
    rules.push({ sku, options });
  }
  return rules;
}

export function activeStockPromptRules(): StockPromptRule[] {
  if (kitchenRuleNumber("stock_prompt_enabled") === 0) return [];
  return parseStockPrompts(kitchenRuleText("stock_prompts", STOCK_PROMPTS_DEFAULT));
}

function nominalWidth(sku: string): number | null {
  const match = compactCabinetCode(sku).match(/(\d{2})$/);
  if (!match) return null;
  const width = Number(match[1]);
  return width >= 9 && width <= 96 ? width : null;
}

function stockStatus(
  keys: readonly string[],
  index: Map<string, StockStatusResult>,
  assumeUnlistedInStock: boolean,
): StockStatusResult["status"] {
  for (const key of keys) {
    const row = index.get(normalizeInventorySku(key));
    if (row && row.status !== "unknown") return row.status;
  }
  return assumeUnlistedInStock ? "in_stock" : "unknown";
}

function inStock(
  candidate: InventoryCatalogCandidate,
  index: Map<string, StockStatusResult>,
  assumeUnlistedInStock: boolean,
): boolean {
  return stockStatus(inventoryStockKeys(candidate), index, assumeUnlistedInStock) === "in_stock";
}

function blockedSpecialty(candidate: InventoryCatalogCandidate): boolean {
  const code = compactCabinetCode(candidate.masterCode);
  const hay = `${candidate.description ?? ""} ${candidate.subCategory ?? ""} ${candidate.category ?? ""}`.toLowerCase();
  if (/sink|corner|blind|lazy|susan|filler|panel|trash|waste|vanity|wine|spice/.test(hay)) return true;
  if (/TCPO|FHTCPO|SINK|CORNER|FILLER|PANEL/.test(code)) return true;
  return false;
}

function isDrawerCandidate(candidate: InventoryCatalogCandidate): boolean {
  const code = compactCabinetCode(candidate.masterCode);
  if (/^(?:\d+)?DB\d/.test(code)) return true;
  return (candidate.numberOfDrawers ?? 0) > 0 && (candidate.numberOfDoors ?? 0) === 0;
}

function isFullHeightDoorBase(candidate: InventoryCatalogCandidate, width: number): boolean {
  if (isDrawerCandidate(candidate) || blockedSpecialty(candidate)) return false;
  const code = compactCabinetCode(candidate.masterCode);
  const hay = `${candidate.description ?? ""} ${candidate.subCategory ?? ""}`.toLowerCase();
  const marked = code.startsWith(`B${width}FH`) || /full\s*height/.test(hay);
  if (!marked) return false;
  return (candidate.numberOfDoors ?? 1) > 0 || code.includes("FH");
}

function sameOpening(candidate: InventoryCatalogCandidate, placement: string, width: number, styleId: number | null, distributorId: number | null): boolean {
  if (candidate.placement !== placement) return false;
  if (Math.abs(candidate.width - width) > 0.05) return false;
  if (styleId != null && candidate.styleId !== styleId) return false;
  if (distributorId != null && candidate.distributorId !== distributorId) return false;
  return true;
}

/**
 * Full-height door base in this width and door style.
 * Exact B18FH wins. If that code is not in the line, the next choice is the
 * same-width full-height base whose code is closest to B18FH (B18FH2RS before
 * a differently named full-height box). Tall pantries are not candidates.
 */
export function pickFullHeightDoorBase(
  catalog: readonly InventoryCatalogCandidate[],
  width: number,
  styleId: number | null,
  distributorId: number | null,
  placement: string,
  index: Map<string, StockStatusResult>,
  assumeUnlistedInStock: boolean,
): InventoryCatalogCandidate | null {
  const preferred = `B${width}FH`;
  const matches = catalog.filter((candidate) => (
    sameOpening(candidate, placement, width, styleId, distributorId)
    && isFullHeightDoorBase(candidate, width)
    && inStock(candidate, index, assumeUnlistedInStock)
  ));
  matches.sort((left, right) => {
    const rank = (candidate: InventoryCatalogCandidate) => {
      const code = compactCabinetCode(candidate.masterCode);
      if (code === preferred) return 0;
      if (code.startsWith(preferred)) return 1;
      return 2;
    };
    const byRank = rank(left) - rank(right);
    if (byRank !== 0) return byRank;
    const distance = Math.abs(compactCabinetCode(left.masterCode).length - preferred.length)
      - Math.abs(compactCabinetCode(right.masterCode).length - preferred.length);
    if (distance !== 0) return distance;
    return left.masterCode.localeCompare(right.masterCode) || left.id - right.id;
  });
  return matches[0] ?? null;
}

/** Same-width drawer base. A 3-drawer DB code is preferred, then a plain DB code. */
export function pickDrawerBase(
  catalog: readonly InventoryCatalogCandidate[],
  width: number,
  styleId: number | null,
  distributorId: number | null,
  placement: string,
  index: Map<string, StockStatusResult>,
  assumeUnlistedInStock: boolean,
): InventoryCatalogCandidate | null {
  const matches = catalog.filter((candidate) => (
    sameOpening(candidate, placement, width, styleId, distributorId)
    && isDrawerCandidate(candidate)
    && !blockedSpecialty(candidate)
    && inStock(candidate, index, assumeUnlistedInStock)
  ));
  matches.sort((left, right) => {
    const rank = (candidate: InventoryCatalogCandidate) => {
      const code = compactCabinetCode(candidate.masterCode);
      if (code === `3DB${width}`) return 0;
      if (code === `DB${width}`) return 1;
      if ((candidate.numberOfDrawers ?? 0) >= 3) return 2;
      return 3;
    };
    return rank(left) - rank(right) || left.masterCode.localeCompare(right.masterCode) || left.id - right.id;
  });
  return matches[0] ?? null;
}

export function buildStockPrompt(input: {
  masterCode: string;
  placement: string;
  styleId: number | null;
  distributorId: number | null;
  catalog: readonly InventoryCatalogCandidate[];
  stock: readonly StockStatusResult[];
  assumeUnlistedInStock?: boolean;
}): StockPrompt | null {
  const rule = activeStockPromptRules().find((entry) => entry.sku === compactCabinetCode(input.masterCode));
  if (!rule) return null;
  const width = nominalWidth(rule.sku);
  if (width == null) return null;
  const index = new Map(input.stock.map((row) => [normalizeInventorySku(row.sku), row]));
  const assume = input.assumeUnlistedInStock === true;
  const own = stockStatus(
    inventoryStockKeys({ masterCode: input.masterCode, styleId: input.styleId }),
    index,
    assume,
  );
  if (own !== "out_of_stock") return null;
  const choices: StockPromptChoice[] = [];
  for (const option of rule.options) {
    const copy = OPTION_COPY[option];
    if (option === "readjust") {
      choices.push({ id: option, label: copy.label, buttonLabel: copy.buttonLabel, candidate: null });
      continue;
    }
    const candidate = option === "full-height"
      ? pickFullHeightDoorBase(input.catalog, width, input.styleId, input.distributorId, input.placement, index, assume)
      : pickDrawerBase(input.catalog, width, input.styleId, input.distributorId, input.placement, index, assume);
    if (!candidate) continue;
    choices.push({ id: option, label: copy.label, buttonLabel: copy.buttonLabel, candidate });
  }
  return { fromCode: input.masterCode, choices };
}

const READJUST_STEP_IN = 1 / 8;

export type ReadjustRunResult =
  | { ok: true; placed: PlacedCabinet[]; shiftIn: number; message: string }
  | { ok: false; message: string; shiftLimitIn: number };

function roundEighth(value: number): number {
  return Math.round(value * 8) / 8;
}

function spanOf(item: PlacedCabinet, side: WallSide, room: RoomData): { start: number; end: number } {
  const start = wallRunOffset(item, side, room);
  return { start, end: start + wallRunSpan(item, side, room) };
}

function canSlideOnRun(item: PlacedCabinet): boolean {
  if (item.placement === "appliance" || item.placement === "tall") return false;
  if (isFillerItem(item)) return true;
  if (item.placement !== "base") return false;
  if (isCornerCabinet(item.masterCode, item.description ?? undefined)) return false;
  return true;
}

function fillerUsable(candidate: InventoryCatalogCandidate, index: Map<string, StockStatusResult>): boolean {
  const status = stockStatus(inventoryStockKeys(candidate), index, false);
  return status !== "out_of_stock" && status !== "low";
}

type FillPack = { cabinets: InventoryCatalogCandidate[]; filler: number };

function fillPacks(opening: number, cabinets: readonly InventoryCatalogCandidate[], fillerMax: number): FillPack[] {
  const packs: FillPack[] = [];
  const width = roundEighth(opening);
  if (width <= COLLISION_EPSILON_IN) return packs;
  for (const cabinet of cabinets) {
    const remaining = roundEighth(width - cabinet.width);
    if (Math.abs(remaining) <= 0.05) packs.push({ cabinets: [cabinet], filler: 0 });
    else if (remaining > 0.05 && remaining <= fillerMax + 0.05) packs.push({ cabinets: [cabinet], filler: remaining });
  }
  for (let left = 0; left < cabinets.length; left += 1) {
    for (let right = left; right < cabinets.length; right += 1) {
      const pair = [cabinets[left]!, cabinets[right]!];
      if (pair[0].id === pair[1].id && (pair[0] as { qtyAvailable?: number }).qtyAvailable != null) continue;
      const remaining = roundEighth(width - pair[0].width - pair[1].width);
      if (remaining < -0.05) continue;
      if (Math.abs(remaining) <= 0.05) packs.push({ cabinets: pair, filler: 0 });
      else if (remaining <= fillerMax + 0.05) packs.push({ cabinets: pair, filler: remaining });
    }
  }
  if (width <= fillerMax + 0.05) packs.push({ cabinets: [], filler: width });
  packs.sort((left, right) => left.filler - right.filler
    || left.cabinets.length - right.cabinets.length
    || (right.cabinets[0]?.width ?? 0) - (left.cabinets[0]?.width ?? 0));
  return packs;
}

function shiftCabinet(item: PlacedCabinet, delta: number, side: WallSide, room: RoomData): PlacedCabinet | null {
  if (Math.abs(delta) <= COLLISION_EPSILON_IN) return item;
  const start = spanOf(item, side, room).start + delta;
  const width = wallRunSpan(item, side, room);
  const spot = wallPlacementAt(start, width, Math.max(0, item.depth), side, room, item.peninsulaSide ?? null, false);
  if (Math.abs((spot.wallOffset ?? start) - start) > 0.05) return null;
  return { ...item, ...spot, wallId: spot.wallId ?? side, wallOffset: spot.wallOffset ?? start };
}

function pieceFromCandidate(
  template: PlacedCabinet,
  candidate: InventoryCatalogCandidate,
  along: number,
  width: number,
  side: WallSide,
  room: RoomData,
  note: string,
  uid: string,
): PlacedCabinet | null {
  const spot = wallPlacementAt(along, width, Math.max(0, template.depth), side, room, template.peninsulaSide ?? null, false);
  if (Math.abs((spot.wallOffset ?? along) - along) > 0.05) return null;
  return {
    ...template,
    ...spot,
    uid,
    cabinetId: candidate.id,
    masterCode: candidate.masterCode,
    description: candidate.description,
    category: candidate.category ?? template.category ?? null,
    subCategory: candidate.subCategory ?? template.subCategory ?? null,
    width,
    height: candidate.height,
    depth: candidate.depth,
    nominalWidth: width,
    nominalHeight: candidate.height,
    nominalDepth: candidate.depth,
    placement: candidate.placement,
    numberOfDoors: candidate.numberOfDoors ?? null,
    numberOfDrawers: candidate.numberOfDrawers ?? null,
    cornerType: candidate.cornerType ?? null,
    isCornerCabinet: candidate.isCornerCabinet ?? false,
    wallId: spot.wallId ?? side,
    wallOffset: spot.wallOffset ?? along,
    fieldModificationNote: note,
    styleId: candidate.styleId === template.styleId ? template.styleId ?? null : candidate.styleId,
  };
}

function touchesRange(item: PlacedCabinet, others: readonly PlacedCabinet[], side: WallSide, room: RoomData): boolean {
  const span = spanOf(item, side, room);
  return others.some((other) => {
    if (!isRangeOrOven(other.masterCode, other.description)) return false;
    if (cabinetWall(other, room) !== side) return false;
    const neighbor = spanOf(other, side, room);
    return Math.abs(neighbor.end - span.start) <= 0.25 || Math.abs(span.end - neighbor.start) <= 0.25;
  });
}

function placementOk(item: PlacedCabinet, others: readonly PlacedCabinet[], openings: readonly WallOpening[], side: WallSide, room: RoomData): boolean {
  const span = spanOf(item, side, room);
  if (span.start < -COLLISION_EPSILON_IN || span.end > wallLength(side, room) + COLLISION_EPSILON_IN) return false;
  if (cabinetPlacementCollisionDetail(item, [...others], room)) return false;
  if (touchesRange(item, others, side, room) && item.width < RANGE_NEIGHBOR_MIN_WIDTH_IN - 0.05) return false;
  const layer = item.placement === "wall" ? "wall" : "base";
  return freeSegmentsOnWall(side, room, [...others], [...openings], item.width, 0, layer, false, item, Math.max(0, item.depth))
    .some((segment) => span.start >= segment.start - 0.05 && span.end <= segment.start + segment.length + 0.05);
}

/**
 * Removes the out-of-stock cabinet and slides the cabinets on that run left or
 * right, each by at most the shared jog, until the opening can be filled with
 * in-stock cabinets and a filler no wider than the filler rule. The smallest
 * shift that passes collision, wall, opening, and range-neighbor checks wins.
 */
export function readjustOutOfStockRun(input: {
  placed: readonly PlacedCabinet[];
  uid: string;
  room: RoomData;
  openings?: readonly WallOpening[];
  catalog: readonly InventoryCatalogCandidate[];
  stock: readonly StockStatusResult[];
  designStyleId: number | null;
  distributorId: number | null;
  assumeUnlistedInStock?: boolean;
  shiftLimitIn?: number;
}): ReadjustRunResult {
  const target = input.placed.find((item) => item.uid === input.uid);
  const limit = input.shiftLimitIn ?? kitchenRuleNumber("jog_max_in");
  const fail = (message: string): ReadjustRunResult => ({ ok: false, message, shiftLimitIn: limit });
  if (!target) return fail("That cabinet is no longer in the design.");
  const side = cabinetWall(target, input.room);
  if (!side) return fail("That cabinet is not on a wall run.");
  const wall = side as WallSide;
  const targetSpan = spanOf(target, wall, input.room);
  const sameRun = input.placed
    .filter((item) => item.uid !== target.uid && cabinetWall(item, input.room) === wall && (item.placement === target.placement || isFillerItem(item)))
    .map((item) => ({ item, span: spanOf(item, wall, input.room) }))
    .sort((left, right) => left.span.start - right.span.start || left.item.uid.localeCompare(right.item.uid));
  const left: PlacedCabinet[] = [];
  const right: PlacedCabinet[] = [];
  const leftTouching = [...sameRun].reverse().find((entry) => entry.span.end <= targetSpan.start + 0.25);
  const rightTouching = sameRun.find((entry) => entry.span.start >= targetSpan.end - 0.25);
  if (leftTouching && canSlideOnRun(leftTouching.item) && targetSpan.start - leftTouching.span.end <= 0.25) {
    for (let index = sameRun.findIndex((entry) => entry.item.uid === leftTouching.item.uid); index >= 0; index -= 1) {
      const entry = sameRun[index]!;
      const next = left[0];
      if (!canSlideOnRun(entry.item)) break;
      if (next && entry.span.end < spanOf(next, wall, input.room).start - 0.25) break;
      left.unshift(entry.item);
    }
  }
  if (rightTouching && canSlideOnRun(rightTouching.item) && rightTouching.span.start - targetSpan.end <= 0.25) {
    for (let index = sameRun.findIndex((entry) => entry.item.uid === rightTouching.item.uid); index < sameRun.length; index += 1) {
      const entry = sameRun[index]!;
      const previous = right[right.length - 1];
      if (!canSlideOnRun(entry.item)) break;
      if (previous && entry.span.start > spanOf(previous, wall, input.room).end + 0.25) break;
      right.push(entry.item);
    }
  }
  const leftBound = left.length
    ? sameRun.filter((entry) => entry.span.end <= spanOf(left[0]!, wall, input.room).start + 0.05).pop()?.span.end ?? 0
    : leftTouching && !left.includes(leftTouching.item) ? leftTouching.span.end : 0;
  const rightBound = right.length
    ? sameRun.find((entry) => entry.span.start >= spanOf(right[right.length - 1]!, wall, input.room).end - 0.05)?.span.start ?? wallLength(wall, input.room)
    : rightTouching && !right.includes(rightTouching.item) ? rightTouching.span.start : wallLength(wall, input.room);

  const index = new Map(input.stock.map((row) => [normalizeInventorySku(row.sku), row]));
  const assume = input.assumeUnlistedInStock === true;
  const outCode = compactCabinetCode(target.masterCode);
  const stocked = input.catalog.filter((candidate) => (
    candidate.placement === target.placement
    && (input.designStyleId == null || candidate.styleId === input.designStyleId)
    && (input.distributorId == null || candidate.distributorId === input.distributorId)
    && !isFillerItem(candidate)
    && !isCornerCabinet(candidate.masterCode, candidate.description)
    && !blockedSpecialty(candidate)
    && compactCabinetCode(candidate.masterCode) !== outCode
    && candidate.width >= 9
    && inStock(candidate, index, assume)
  ));
  const filler = input.catalog.find((candidate) => (
    isFillerItem(candidate)
    && candidate.placement === target.placement
    && (input.designStyleId == null || candidate.styleId === input.designStyleId)
    && fillerUsable(candidate, index)
  )) ?? null;
  const fillerMax = effectiveSmallGapFillerMaxIn();
  const note = stockPromptOrderNote(target.masterCode, "readjust the plan");
  const openings = input.openings ?? [];
  const stepCount = Math.round(limit / READJUST_STEP_IN);
  const magnitudes: number[] = [0];
  for (let step = 1; step <= stepCount; step += 1) magnitudes.push(step * READJUST_STEP_IN, -step * READJUST_STEP_IN);

  for (let step = 0; step <= stepCount; step += 1) {
    const pairs: Array<[number, number]> = [];
    for (const deltaLeft of magnitudes) {
      for (const deltaRight of magnitudes) {
        if (Math.abs(deltaLeft) > limit + 0.001 || Math.abs(deltaRight) > limit + 0.001) continue;
        if (Math.abs(Math.max(Math.abs(deltaLeft), Math.abs(deltaRight)) - step * READJUST_STEP_IN) > 0.001) continue;
        if (!left.length && Math.abs(deltaLeft) > 0.001) continue;
        if (!right.length && Math.abs(deltaRight) > 0.001) continue;
        pairs.push([deltaLeft, deltaRight]);
      }
    }
    pairs.sort((leftPair, rightPair) => (Math.abs(leftPair[0]) + Math.abs(leftPair[1])) - (Math.abs(rightPair[0]) + Math.abs(rightPair[1])));
    for (const [deltaLeft, deltaRight] of pairs) {
      const openingStart = roundEighth(targetSpan.start + deltaLeft);
      const openingEnd = roundEighth(targetSpan.end + deltaRight);
      const opening = roundEighth(openingEnd - openingStart);
      if (opening <= 0.05) continue;
      const shiftedLeft = left.map((item) => shiftCabinet(item, deltaLeft, wall, input.room));
      const shiftedRight = right.map((item) => shiftCabinet(item, deltaRight, wall, input.room));
      if (shiftedLeft.some((item) => !item) || shiftedRight.some((item) => !item)) continue;
      const leftEdge = shiftedLeft[0] ? spanOf(shiftedLeft[0], wall, input.room).start : openingStart;
      const rightEdge = shiftedRight.length ? spanOf(shiftedRight[shiftedRight.length - 1]!, wall, input.room).end : openingEnd;
      if (leftEdge < leftBound - 0.05 || rightEdge > rightBound + 0.05) continue;
      const packs = fillPacks(opening, stocked, filler ? fillerMax : 0);
      for (const pack of packs) {
        if (pack.filler > 0.05 && !filler) continue;
        const pieces: PlacedCabinet[] = [];
        let cursor = openingStart;
        let packFailed = false;
        pack.cabinets.forEach((candidate, pieceIndex) => {
          if (packFailed) return;
          const piece = pieceFromCandidate(target, candidate, cursor, candidate.width, wall, input.room, note, pieceIndex === 0 ? target.uid : makeUid());
          if (!piece) packFailed = true;
          else {
            pieces.push(piece);
            cursor = roundEighth(cursor + candidate.width);
          }
        });
        if (packFailed) continue;
        if (pack.filler > 0.05 && filler) {
          const piece = pieceFromCandidate(target, filler, cursor, pack.filler, wall, input.room, note, pieces.length === 0 ? target.uid : makeUid());
          if (!piece) continue;
          pieces.push(piece);
          cursor = roundEighth(cursor + pack.filler);
        }
        if (Math.abs(cursor - openingEnd) > 0.05 || pieces.length === 0) continue;
        const moved = new Map<string, PlacedCabinet>();
        for (const item of [...shiftedLeft, ...shiftedRight]) if (item) moved.set(item.uid, item);
        const next = input.placed.flatMap((item) => {
          if (item.uid === target.uid) return pieces;
          return [moved.get(item.uid) ?? item];
        });
        const changed = [...pieces, ...moved.values()];
        const valid = changed.every((item) => placementOk(item, next.filter((other) => other.uid !== item.uid), openings, wall, input.room));
        if (!valid) continue;
        const shiftIn = roundEighth(Math.max(Math.abs(deltaLeft), Math.abs(deltaRight)));
        const names = pieces.map((item) => item.masterCode).join(" + ");
        return {
          ok: true,
          placed: next,
          shiftIn,
          message: shiftIn === 0
            ? `${target.masterCode} was replaced with ${names} without moving the run.`
            : `The run moved ${shiftIn} inches and ${target.masterCode} was replaced with ${names}.`,
        };
      }
    }
  }
  const shown = Number.isInteger(limit) ? String(limit) : String(roundEighth(limit));
  return fail(`No fit within ${shown} inches. Choose a full-height door base or a drawer base.`);
}
