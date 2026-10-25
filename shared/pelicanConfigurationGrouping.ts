/**
 * Pelican product configurations.
 *
 * Cabinet hardware is chosen as ONE card per model with a finish selector, and
 * each choice records the exact sellable SKU. Pelican rows are imported one SKU
 * per row ("PL-8237 BN", "PL-8237 CHR", "PL-HA109 R0 16g", ...), so the Designer
 * used to show every finish/gauge/size as its own near-identical card with a raw
 * item code as its title. This module folds those rows into the same
 * card-plus-selector shape.
 *
 * It is presentation only: every variant keeps the original row untouched (id,
 * pelicanCode, price, image, size), so master SKUs, pricing, fixture profiles and
 * saved designs are unchanged. Anything whose code does not follow a recognised
 * pattern stays a single-variant card.
 */

export type PelicanGroupable = {
  id: number;
  pelicanCode?: string | null;
  name: string;
  description?: string | null;
  category: string;
  subCategory?: string | null;
  size?: string | null;
  imageUrl?: string | null;
  sellPrice?: number | null;
};

export type PelicanFamily = "sink" | "faucet" | "quartz" | "fixture" | "other";

export type PelicanVariant<T extends PelicanGroupable> = {
  item: T;
  /** Short text for the selector, e.g. "Brushed Nickel", "16 ga · Zero radius", "126 × 63 in · Left". */
  label: string;
  /** Finish name when the variant differs by finish; used for the swatch dot. */
  finish: string | null;
  swatch: string | null;
};

export type PelicanConfiguration<T extends PelicanGroupable> = {
  /** Stable key for the model (never changes when a variant is added). */
  key: string;
  family: PelicanFamily;
  /** Small header above the title, e.g. "PL-HA109 · Sink". */
  eyebrow: string;
  /** Clean customer-facing title; never a bare item code or spec-book text. */
  label: string;
  /** Filterable style, e.g. "Farmhouse / apron front", "Pull-down". */
  style: string | null;
  /** What the selector row is called: "Finish", "Gauge & radius", "Slab size", "Drain", "Length". */
  optionLabel: string;
  variants: PelicanVariant<T>[];
};

const METAL_FINISHES: Record<string, { label: string; swatch: string }> = {
  BN: { label: "Brushed Nickel", swatch: "#aeb4b9" },
  CHR: { label: "Chrome", swatch: "#c9d0d6" },
  MB: { label: "Matte Black", swatch: "#1d2024" },
  BG: { label: "Brushed Gold", swatch: "#b08a36" },
  ORB: { label: "Oil Rubbed Bronze", swatch: "#5b4335" },
};

/** Wall-panel finishes only apply to shower/tub surrounds; "Marble" in a tile name is not a finish. */
const SURROUND_FINISHES: Record<string, { label: string; swatch: string }> = {
  brick: { label: "White brick", swatch: "#e9e5df" },
  "grey wood": { label: "Grey wood grain", swatch: "#8b8a85" },
  marble: { label: "Carrara marble", swatch: "#dcdcdc" },
  "white wood": { label: "White wood grain", swatch: "#f1eee8" },
};

const METAL_SUFFIX = /^(.*\S)\s+(BN|CHR|MB|BG|ORB)$/i;
const SURROUND_SUFFIX = /^(.*\S)\s+(Brick|Grey Wood|Marble|White Wood)$/i;

/** Finish phrases that appear inside source copy and must not stay in a shared card title. */
const FINISH_PHRASES = [
  "Brushed Nickel", "Brushed Gold", "Matte Black", "Chrome", "Oil Rubbed Bronze",
  "White Brick", "Grey Wood Grain", "Carrara Marble", "White Wood Grain",
];
const FINISH_PHRASE_PATTERN = FINISH_PHRASES.map((phrase) => phrase.replace(/\s+/g, "\\s+")).join("|");

function normalizedCode(value: string | null | undefined): string {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Removes import noise such as page counters ("86 of 154"), ligatures and repeated spaces. */
function cleanText(text: string | null | undefined): string {
  return (text ?? "")
    .normalize("NFKC")
    .replace(/\b\d+\s+of\s+\d+\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fractionSize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function dimensionsFromText(description: string): string | null {
  const match = description.replace(/''/g, '"').match(/(\d+(?:\s\d+\/\d+)?)"?\s*x\s*(\d+(?:\s\d+\/\d+)?)"?/i);
  return match ? `${fractionSize(match[1])} × ${fractionSize(match[2])} in` : null;
}

function capitalise(text: string): string {
  return text ? text[0]!.toUpperCase() + text.slice(1) : text;
}

// ---------------------------------------------------------------- sinks ---

/** PL-HA109 R15 16g, PL-HA109 ADA R0 18g, PL-VS3018 18g, PL-VR2718 ADA, PL-GMB135 R0 16g, PL-R1917W */
const SINK_CODE = /^(PL-[A-Z]{1,4}\d{2,5})([A-Z]?)\s*(.*)$/i;

function sinkKind(text: string): { mount: string; style: string } {
  const lower = text.toLowerCase();
  const metal = /gunmetal black/.test(lower) ? "Gunmetal black " : "";
  const bowls = /double bowl/.test(lower) ? " double bowl" : /single bowl/.test(lower) ? " single bowl" : "";
  if (/vanity top/.test(lower)) return { mount: "Cultured marble vanity top", style: "Vanity top" };
  if (/towel bar apron/.test(lower)) return { mount: capitalise(`${metal}towel-bar apron-front sink`), style: "Farmhouse / apron front" };
  if (/short apron/.test(lower)) return { mount: capitalise(`${metal}short apron-front sink`), style: "Farmhouse / apron front" };
  if (/farmhouse|apron[ -]?front/.test(lower)) return { mount: capitalise(`${metal}farmhouse apron-front sink`), style: "Farmhouse / apron front" };
  if (/drop[ -]?in/.test(lower)) return { mount: capitalise(`${metal}drop-in${bowls} sink`), style: "Drop-in" };
  return { mount: capitalise(`${metal}undermount${bowls} sink`), style: "Undermount" };
}

function sinkVariantLabel(rest: string, suffixLetter: string): string {
  const parts: string[] = [];
  const tokens = rest.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (/^ADA$/i.test(token)) parts.push("ADA");
    else if (/^\d{2}g$/i.test(token)) parts.push(`${token.slice(0, -1)} ga`);
  }
  const radius = tokens.find((token) => /^R\d+$/i.test(token));
  if (radius) parts.push(/^R0$/i.test(radius) ? "Zero radius" : `${radius.toUpperCase()} radius`);
  if (!parts.length && /^W$/i.test(suffixLetter)) parts.push("White");
  return parts.length ? parts.join(" · ") : "Standard";
}

// --------------------------------------------------------------- quartz ---

function quartzParts(name: string): { colour: string; superJumbo: boolean; hand: "Left" | "Right" | null } {
  let colour = cleanText(name);
  let superJumbo = false;
  let hand: "Left" | "Right" | null = null;
  // An older lot such as "Full Moon 3cm (old)" stays its own card; keep the note visible.
  let note = "";
  colour = colour.replace(/\s*\((old)\)\s*$/i, (_m, value: string) => {
    note = ` (${value.toLowerCase()})`;
    return "";
  });
  colour = colour.replace(/\s+(left|right)$/i, (_m, side: string) => {
    hand = side.toLowerCase() === "left" ? "Left" : "Right";
    return "";
  });
  colour = colour.replace(/\s+super\s+jumbo$/i, () => {
    superJumbo = true;
    return "";
  });
  colour = colour.replace(/\s+3\s?cm$/i, "");
  return { colour: `${colour.trim()}${note}`, superJumbo, hand };
}

// ------------------------------------------------------------- generic ----

type ParsedRow<T extends PelicanGroupable> = {
  item: T;
  family: PelicanFamily;
  key: string;
  eyebrowCode: string;
  label: string;
  style: string | null;
  optionLabel: string;
  variantLabel: string;
  finish: string | null;
  swatch: string | null;
  /** True when the row carries no variant token of its own (the plain/base SKU). */
  plain: boolean;
};

function faucetStyle(text: string): string | null {
  const lower = text.toLowerCase();
  if (/wall[ -]mounted/.test(lower)) return "Wall mounted";
  if (/pull[ -]?down/.test(lower)) return "Pull-down";
  if (/single hole/.test(lower)) return "Single hole";
  return null;
}

/**
 * Customer-facing title taken from the product name, or the description when the
 * name is only an item code. Everything that varies between the variants of one
 * card (finish words, drain side, tub length, item code) is removed.
 */
function titleFor(item: PelicanGroupable, modelCode: string, stripDrainSide = false): string {
  const code = normalizedCode(item.pelicanCode);
  const name = cleanText(item.name);
  const nameIsCode = normalizedCode(name) === code || normalizedCode(name) === normalizedCode(modelCode);
  let text = nameIsCode ? cleanText(item.description) || name : name;
  // Leading item code, optionally followed by variant tokens ("PL-8237 BN", "PL-VR2718 R20 ADA").
  text = text.replace(/^PL-[A-Z0-9/]+\s*(?:(?:BN|CHR|MB|BG|ORB|R\d+|ADA|\d{2}g)\b\s*)*/i, "");
  // Finish at the end: "— Brushed Nickel", "in Brushed Nickel", "Brushed Nickel".
  text = text.replace(new RegExp(`\\s*(?:[—–-]|\\bin\\b)?\\s*(?:${FINISH_PHRASE_PATTERN})\\s*$`, "i"), "");
  // Finish inside surround copy: "White Brick 3-Piece".
  text = text.replace(new RegExp(`\\b(?:${FINISH_PHRASE_PATTERN})\\b\\s*(?=\\d-Piece)`, "i"), "");
  text = text.replace(/\s+in\s+(?:Glossy|Matte)\s+Finish\s*$/i, "");
  text = text.replace(/\s+(?:BN|CHR|MB|BG|ORB)\s*$/i, "");
  // Drain side and tub length belong to the selector.
  if (stripDrainSide) {
    text = text.replace(/,?\s*\b(?:with\s+)?(?:Center|Left|Right)\s+(?:SS\s+)?Drain(?:\s+Cover)?(?:\s+Included)?\b,?/gi, " ");
    text = text.replace(/\b(?:Left|Right)-Handed\s*/i, "");
    text = text.replace(/\s+(?:With|Included)\s*$/i, "");
  }
  text = text.replace(/^\d{2,3}(?:"|'')\s+(?=Free Standing)/i, "");
  return text.replace(/\s+/g, " ").replace(/\s+,/g, ",").trim() || name || item.pelicanCode || "Pelican product";
}

function surroundSheen(description: string): string | null {
  const match = description.match(/\b(Glossy|Matte)\s+Finish\b/i);
  return match ? capitalise(match[1]!.toLowerCase()) : null;
}

function parseRow<T extends PelicanGroupable>(item: T): ParsedRow<T> {
  const code = cleanText(item.pelicanCode);
  const description = cleanText(item.description);
  const text = `${cleanText(item.name)} ${description}`;

  // Quartz slabs: "<Colour> 3cm [Super Jumbo|Left|Right]".
  if (item.category === "Quartz Slabs (Countertops)") {
    const { colour, superJumbo, hand } = quartzParts(item.name);
    const size = (item.size ?? "").replace(/''/g, '"').replace(/\s*x\s*/i, " × ").replace(/"/g, "").trim();
    const sizeText = size ? `${size} in` : "Standard slab";
    const label = [sizeText, superJumbo ? "Super Jumbo" : null, hand].filter(Boolean).join(" · ");
    return {
      item, family: "quartz", key: `quartz:${colour.toLowerCase()}`, eyebrowCode: "Quartz slab · 3 cm",
      label: colour || cleanText(item.name), style: null, optionLabel: "Slab",
      variantLabel: label, finish: null, swatch: null, plain: false,
    };
  }

  // Kitchen/bath sinks that follow the model + radius + gauge convention.
  const sinkMatch = code.match(SINK_CODE);
  if (item.subCategory === "Sinks" && sinkMatch) {
    const model = sinkMatch[1]!.toUpperCase();
    const { mount, style } = sinkKind(text);
    const dimensions = dimensionsFromText(description);
    return {
      item, family: "sink", key: `sink:${model}`, eyebrowCode: model,
      label: dimensions ? `${mount} · ${dimensions}` : mount, style,
      optionLabel: "Gauge & radius",
      variantLabel: sinkVariantLabel(sinkMatch[3] ?? "", sinkMatch[2] ?? ""),
      finish: null, swatch: null, plain: false,
    };
  }

  const family: PelicanFamily = item.subCategory === "Faucets" || /faucet/i.test(text)
    ? "faucet"
    : item.subCategory === "Sinks"
      ? "sink"
      : /shower|tub|toilet|bidet|bath/i.test(`${item.category} ${text}`)
        ? "fixture"
        : "other";
  const sinkStyle = family === "sink" ? sinkKind(text).style : null;

  // Finish-suffixed codes: "PL-8237 BN", "Aura Accessories Set MB", "PL-483696 Brick".
  const surround = item.subCategory === "Shower Surrounds";
  const finishMatch = code.match(surround ? SURROUND_SUFFIX : METAL_SUFFIX);
  if (finishMatch) {
    const model = finishMatch[1]!.trim();
    const token = finishMatch[2]!;
    const finish = surround ? SURROUND_FINISHES[token.toLowerCase()] : METAL_FINISHES[token.toUpperCase()];
    const sheen = surround ? surroundSheen(description) : null;
    const finishLabel = finish?.label ?? token;
    return {
      item, family, key: `finish:${normalizedCode(model)}`, eyebrowCode: model,
      label: titleFor(item, model),
      style: family === "faucet" ? faucetStyle(text) : sinkStyle,
      optionLabel: "Finish",
      variantLabel: sheen ? `${finishLabel} · ${sheen}` : finishLabel,
      finish: finishLabel, swatch: finish?.swatch ?? null, plain: false,
    };
  }

  // Tub length: "PL-02138 59\"" / "PL-02138 67\"".
  const lengthMatch = code.match(/^(PL-[A-Z0-9]+)\s+(\d{2,3})(?:"|''|”)$/i);
  if (lengthMatch) {
    return {
      item, family, key: `length:${normalizedCode(lengthMatch[1])}`, eyebrowCode: lengthMatch[1]!,
      label: titleFor(item, lengthMatch[1]!), style: null, optionLabel: "Length",
      variantLabel: `${lengthMatch[2]} in`, finish: null, swatch: null, plain: false,
    };
  }

  // Drain side: "PL-02849L" / "PL-016030C" / "PL-014836LSO" (the SO line is a different product).
  const handMatch = code.match(/^(PL-(?:SMC)?\d{4,6})([CLR])(SO)?$/i);
  if (handMatch) {
    const side = handMatch[2]!.toUpperCase();
    const flange = handMatch[3] ? "SO" : "";
    return {
      item, family, key: `hand:${normalizedCode(handMatch[1])}${flange}`, eyebrowCode: `${handMatch[1]}${flange ? " · tile flange" : ""}`,
      label: titleFor(item, handMatch[1]!, true), style: null, optionLabel: "Drain",
      variantLabel: side === "L" ? "Left-hand drain" : side === "R" ? "Right-hand drain" : "Center drain",
      finish: null, swatch: null, plain: false,
    };
  }

  // Anything else is its own single-variant card.
  return {
    item, family, key: `sku:${item.id}`, eyebrowCode: code || "Pelican",
    label: titleFor(item, code), style: family === "faucet" ? faucetStyle(text) : sinkStyle,
    optionLabel: "Option", variantLabel: "Standard", finish: null, swatch: null, plain: true,
  };
}

const EYEBROW_TYPE: Record<PelicanFamily, string> = { sink: "Sink", faucet: "Faucet", quartz: "", fixture: "", other: "" };

/**
 * Fold per-SKU Pelican rows into one card per model with selectable variants.
 * Order follows the first appearance of each model in `items`, so server-side
 * ranking (popular first, then name) is preserved.
 */
export function groupPelicanConfigurations<T extends PelicanGroupable>(items: readonly T[]): PelicanConfiguration<T>[] {
  const parsed = items.map((item) => parseRow(item));

  // A plain SKU ("PL-12011") joins the finish group of its coloured siblings ("PL-12011 MB").
  const finishModels = new Map<string, string>();
  for (const row of parsed) {
    if (row.key.startsWith("finish:")) finishModels.set(row.key.slice(7), row.key);
  }
  for (const row of parsed) {
    if (!row.plain) continue;
    const joinKey = finishModels.get(normalizedCode(row.item.pelicanCode));
    if (!joinKey) continue;
    row.key = joinKey;
    row.variantLabel = "Standard";
    row.optionLabel = "Finish";
    row.plain = false;
  }

  const groups = new Map<string, ParsedRow<T>[]>();
  for (const row of parsed) {
    const rows = groups.get(row.key) ?? [];
    rows.push(row);
    groups.set(row.key, rows);
  }

  const result: PelicanConfiguration<T>[] = [];
  groups.forEach((rows, key) => {
    const first = rows.find((row) => row.finish) ?? rows[0]!;
    // Title from the wording most variants agree on, so one mistyped source row cannot title the card.
    const titleVotes = new Map<string, number>();
    for (const row of rows) titleVotes.set(row.label, (titleVotes.get(row.label) ?? 0) + 1);
    let title = first.label;
    let best = titleVotes.get(title) ?? 0;
    titleVotes.forEach((count, candidate) => {
      if (count > best) { best = count; title = candidate; }
    });
    const typeText = EYEBROW_TYPE[first.family];
    const eyebrow = first.family === "quartz" || first.eyebrowCode.includes("·")
      ? first.eyebrowCode
      : [first.eyebrowCode, typeText].filter(Boolean).join(" · ");
    // Variant labels must be unique inside a card; fall back to the item code when two rows would read the same.
    const seen = new Map<string, number>();
    for (const row of rows) seen.set(row.variantLabel, (seen.get(row.variantLabel) ?? 0) + 1);
    const variants: PelicanVariant<T>[] = rows
      .map((row) => ({
        item: row.item,
        label: (seen.get(row.variantLabel) ?? 0) > 1 && row.item.pelicanCode
          ? `${row.variantLabel} · ${row.item.pelicanCode}`
          : row.variantLabel,
        finish: row.finish,
        swatch: row.swatch,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })
        || (a.item.sellPrice ?? Number.POSITIVE_INFINITY) - (b.item.sellPrice ?? Number.POSITIVE_INFINITY));
    result.push({ key, family: first.family, eyebrow, label: title, style: first.style, optionLabel: first.optionLabel, variants });
  });
  return result;
}

/** Ids of every exact SKU inside a configuration, for selection tests. */
export function pelicanConfigurationItemIds<T extends PelicanGroupable>(configuration: PelicanConfiguration<T>): number[] {
  return configuration.variants.map((variant) => variant.item.id);
}

/** The variant to display: the one the customer just picked, else a selected one, else the first. */
export function pelicanDisplayVariant<T extends PelicanGroupable>(
  configuration: PelicanConfiguration<T>,
  selectedIds: ReadonlySet<number>,
  chosenId?: number | null,
): PelicanVariant<T> {
  return configuration.variants.find((variant) => variant.item.id === chosenId)
    ?? configuration.variants.find((variant) => selectedIds.has(variant.item.id))
    ?? configuration.variants[0]!;
}

/** Style choices present in a list of configurations, alphabetical. */
export function pelicanConfigurationStyles<T extends PelicanGroupable>(configurations: readonly PelicanConfiguration<T>[]): string[] {
  return Array.from(new Set(configurations.map((entry) => entry.style).filter((value): value is string => Boolean(value))))
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Text for one entry of the variant selector. The price is added only when the
 * variants of this model are priced differently (e.g. 126" vs Super Jumbo slabs),
 * so equal-price finishes stay as clean as the hardware picker's finish list.
 */
export function pelicanVariantMenuLabel<T extends PelicanGroupable>(
  configuration: PelicanConfiguration<T>,
  variant: PelicanVariant<T>,
  formatPrice: (price: number | null | undefined) => string,
): string {
  const prices = new Set(configuration.variants.map((entry) => entry.item.sellPrice ?? null));
  return prices.size > 1 ? `${variant.label} · ${formatPrice(variant.item.sellPrice)}` : variant.label;
}

/**
 * Selected sibling SKUs of the same model, other than the variant being chosen.
 * Picking a different finish of a faucet or sink swaps it for the selected one
 * instead of quietly adding a second copy of the same product to the quote.
 */
export function pelicanSelectedSiblings<T extends PelicanGroupable>(
  configuration: PelicanConfiguration<T>,
  variant: PelicanVariant<T>,
  selectedIds: ReadonlySet<number>,
): T[] {
  return configuration.variants
    .filter((entry) => entry.item.id !== variant.item.id && selectedIds.has(entry.item.id))
    .map((entry) => entry.item);
}

/** Button wording for the selector family ("Use this finish", "Use this slab", ...). */
export function pelicanUseLabel(optionLabel: string): string {
  switch (optionLabel) {
    case "Finish": return "Use this finish";
    case "Gauge & radius": return "Use this sink";
    case "Slab": return "Use this slab";
    case "Drain": return "Use this drain side";
    case "Length": return "Use this length";
    default: return "Select";
  }
}
