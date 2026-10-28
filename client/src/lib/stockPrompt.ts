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
import { inventoryStockKeys, normalizeInventorySku, type StockStatusResult } from "./inventoryProvider";
import type { InventoryCatalogCandidate } from "./inventoryAlternatives";

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
