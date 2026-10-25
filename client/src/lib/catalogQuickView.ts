export type CatalogQuickViewItem = {
  id: number;
  masterCode: string;
  description?: string | null;
  category?: string | null;
  subCategory?: string | null;
  width?: string | number | null;
  height?: string | number | null;
  depth?: string | number | null;
  placementType?: string | null;
  numberOfDoors?: number | null;
  numberOfDrawers?: number | null;
  numberOfAdjShelves?: number | null;
};

const trimWords = /\b(accessor(?:y|ies)|filler|panel|skin|scribe|moulding|molding|crown|light rail|toe kick|toe-kick|shelf|leg|trim|glass door)\b/i;
const panelWords = /\b(panel|skin|scribe|end)\b/i;
const moldingWords = /\b(moulding|molding|crown|light rail|toe kick|toe-kick|trim)\b/i;
const fillerWords = /\bfiller\b/i;

function textFor(item: CatalogQuickViewItem) {
  return [item.masterCode, item.category, item.subCategory, item.description, item.placementType]
    .filter(Boolean)
    .join(" ");
}

function numeric(value: string | number | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMeasure(value: string | number | null | undefined) {
  const parsed = numeric(value);
  if (parsed == null) return null;
  return Number.isInteger(parsed) ? String(parsed) : String(parsed);
}

export function cabinetDimensionSummary(item: CatalogQuickViewItem) {
  const width = formatMeasure(item.width);
  const height = formatMeasure(item.height);
  const depth = formatMeasure(item.depth);
  const parts = [width && `W ${width}\"`, height && `H ${height}\"`, depth && `D ${depth}\"`].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Dimensions pending verification";
}

export function cabinetConfigurationSummary(item: CatalogQuickViewItem) {
  const parts: string[] = [];
  if (typeof item.numberOfDoors === "number" && item.numberOfDoors > 0) {
    parts.push(`${item.numberOfDoors} door${item.numberOfDoors === 1 ? "" : "s"}`);
  }
  if (typeof item.numberOfDrawers === "number" && item.numberOfDrawers > 0) {
    parts.push(`${item.numberOfDrawers} drawer${item.numberOfDrawers === 1 ? "" : "s"}`);
  }
  if (typeof item.numberOfAdjShelves === "number" && item.numberOfAdjShelves > 0) {
    parts.push(`${item.numberOfAdjShelves} adjustable ${item.numberOfAdjShelves === 1 ? "shelf" : "shelves"}`);
  }
  return parts;
}

export function isCatalogAccessory(item: CatalogQuickViewItem) {
  const category = (item.category ?? "").toLowerCase();
  const placement = (item.placementType ?? "").toLowerCase();
  return placement.includes("accessory")
    || ["accessory", "filler", "molding", "moulding", "panel", "panels", "wall skin / scribe veneer"].includes(category)
    || trimWords.test(textFor(item));
}

function relevance(item: CatalogQuickViewItem, accessory: CatalogQuickViewItem) {
  const itemCategory = (item.category ?? "").toLowerCase();
  const accessoryText = textFor(accessory);
  let score = 0;

  if (fillerWords.test(accessoryText)) score += 4;
  if (panelWords.test(accessoryText)) score += 3;
  if (moldingWords.test(accessoryText)) score += 2;

  if (itemCategory.includes("wall")) {
    if (/\b(crown|light rail|wall|glass door)\b/i.test(accessoryText)) score += 3;
  } else if (itemCategory.includes("base") || itemCategory.includes("vanity")) {
    if (/\b(base|toe|dishwasher|end panel|side panel)\b/i.test(accessoryText)) score += 3;
  } else if (itemCategory.includes("tall")) {
    if (/\b(tall|pantry|refrigerator|end panel|skin)\b/i.test(accessoryText)) score += 3;
  }

  return score;
}

/**
 * Presents style-scoped trim and accessory choices as suggestions, never as a
 * geometric guarantee. Their fit still depends on the customer's wall run and
 * adjoining cabinet choices.
 */
export function suggestedAccessoryOptions(
  cabinet: CatalogQuickViewItem,
  catalogItems: CatalogQuickViewItem[],
  limit = 4,
) {
  return catalogItems
    .filter((item) => item.id !== cabinet.id && isCatalogAccessory(item))
    .map((item) => ({ item, score: relevance(cabinet, item) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.item.masterCode.localeCompare(b.item.masterCode, undefined, { numeric: true }))
    .slice(0, limit)
    .map(({ item }) => item);
}
