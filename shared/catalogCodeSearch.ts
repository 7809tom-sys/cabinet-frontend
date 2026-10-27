// Schema-free cabinet code search.
//
// Catalog rows already carry an item code (masterCode / itemCode), an optional
// ReplacementMasterCode, and aliases (a semicolon-separated Aliases cell, an
// array, or the existing sku / vendorSku / altSku columns). This module matches
// those fields directly. It does not add tables or migrate data.
//
// Comparison ignores case, spaces, and dashes, so BT-09, bt09, and BT09 are the
// same code. An exact item-code match ranks ahead of an exact alias match, which
// ranks ahead of a partial code match. When an alias equals a row's
// ReplacementMasterCode, the hit resolves to that master instead of the row
// that merely lists the alias.

export const CATALOG_SEARCH_RANK = {
  exactItem: 0,
  exactAlias: 1,
  partialCode: 2,
  text: 3,
} as const;

export type CatalogSearchRank = (typeof CATALOG_SEARCH_RANK)[keyof typeof CATALOG_SEARCH_RANK];

export type CatalogSearchHit<T> = {
  item: T;
  rank: CatalogSearchRank;
};

type CatalogCodeCarrier = {
  itemCode?: string | null;
  masterCode?: string | null;
  displayMasterCode?: string | null;
  replacementMasterCode?: string | null;
  aliases?: readonly string[] | string | null;
  aliasCodes?: readonly string[] | string | null;
  sku?: string | null;
  vendorSku?: string | null;
  altSku1?: string | null;
  altSku2?: string | null;
  altSku3?: string | null;
};

/** Uppercase, then drop spaces, dashes, and every other non-alphanumeric separator. */
export function normalizeCatalogCode(value: string | null | undefined): string {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function carrier(item: object): CatalogCodeCarrier {
  return item as CatalogCodeCarrier;
}

function splitCodes(value: readonly string[] | string | null | undefined): string[] {
  if (!value) return [];
  const parts = typeof value === "string" ? value.split(";") : value;
  return parts.map((part) => part.trim()).filter(Boolean);
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function primaryCode(item: object): string {
  const row = carrier(item);
  return (row.masterCode ?? row.itemCode ?? "").trim();
}

function replacementCode(item: object): string {
  return normalizeCatalogCode(carrier(item).replacementMasterCode);
}

function listedAliases(item: object): string[] {
  const row = carrier(item);
  return unique([
    ...splitCodes(row.aliases),
    ...splitCodes(row.aliasCodes),
    row.sku ?? "",
    row.vendorSku ?? "",
    row.altSku1 ?? "",
    row.altSku2 ?? "",
    row.altSku3 ?? "",
  ].map((value) => value.trim()).filter(Boolean));
}

function canonicalItem<T extends object>(item: T, byCode: Map<string, T>): T {
  let current = item;
  const seen = new Set<T>();
  while (!seen.has(current)) {
    seen.add(current);
    const replacement = replacementCode(current);
    if (!replacement) break;
    const next = byCode.get(replacement);
    if (!next || next === current) break;
    current = next;
  }
  return current;
}

type CodeSets = {
  itemCodes: Set<string>;
  aliases: Set<string>;
};

function emptySets(): CodeSets {
  return { itemCodes: new Set(), aliases: new Set() };
}

function addAlias(sets: CodeSets, code: string) {
  if (!code || sets.itemCodes.has(code)) return;
  sets.aliases.add(code);
}

/** Codes that identify a row and the aliases that should find its master. */
function attributeCodes<T extends object>(items: readonly T[]): Map<T, CodeSets> {
  const byCode = new Map<string, T>();
  for (const item of items) {
    const code = normalizeCatalogCode(primaryCode(item));
    if (code && !byCode.has(code)) byCode.set(code, item);
  }

  const canonicalOf = new Map<T, T>();
  for (const item of items) canonicalOf.set(item, canonicalItem(item, byCode));

  const replacementMasters = new Map<string, T>();
  for (const item of items) {
    const replacement = replacementCode(item);
    if (replacement) replacementMasters.set(replacement, canonicalOf.get(item)!);
  }

  const sets = new Map<T, CodeSets>();
  const setsFor = (item: T) => {
    const existing = sets.get(item);
    if (existing) return existing;
    const created = emptySets();
    sets.set(item, created);
    return created;
  };

  for (const item of items) {
    const master = canonicalOf.get(item)!;
    const retired = master !== item;
    const ownReplacement = replacementCode(item);
    const standsInForMissingMaster = !retired && Boolean(ownReplacement) && !byCode.has(ownReplacement);
    const bucket = setsFor(master);
    const ownCode = normalizeCatalogCode(primaryCode(item));

    if (standsInForMissingMaster) {
      bucket.itemCodes.add(ownReplacement);
      addAlias(bucket, ownCode);
    } else     if (!retired && ownCode) {
      bucket.itemCodes.add(ownCode);
      const display = normalizeCatalogCode(carrier(item).displayMasterCode);
      if (display && display !== ownCode) addAlias(bucket, display);
    } else {
      addAlias(bucket, ownCode);
    }

    for (const alias of listedAliases(item)) {
      const normalized = normalizeCatalogCode(alias);
      if (!normalized) continue;
      const redirected = replacementMasters.get(normalized);
      const destination = redirected ?? master;
      const destinationSets = setsFor(destination);
      if (destinationSets.itemCodes.has(normalized) || normalizeCatalogCode(primaryCode(destination)) === normalized) {
        destinationSets.itemCodes.add(normalized);
        destinationSets.aliases.delete(normalized);
      } else {
        addAlias(destinationSets, normalized);
      }
    }
  }

  return sets;
}

function rankAgainst(sets: CodeSets, queryNorm: string): CatalogSearchRank | null {
  if (!queryNorm) return null;
  if (sets.itemCodes.has(queryNorm)) return CATALOG_SEARCH_RANK.exactItem;
  if (sets.aliases.has(queryNorm)) return CATALOG_SEARCH_RANK.exactAlias;
  if (Array.from(sets.itemCodes).some((code) => code.includes(queryNorm))) return CATALOG_SEARCH_RANK.partialCode;
  if (Array.from(sets.aliases).some((code) => code.includes(queryNorm))) return CATALOG_SEARCH_RANK.partialCode;
  return null;
}

export function searchCatalogItems<T extends object>(
  items: readonly T[],
  query: string,
  textMatches?: (item: T, query: string) => boolean,
): CatalogSearchHit<T>[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return items.map((item) => ({ item, rank: CATALOG_SEARCH_RANK.text }));
  }

  const queryNorm = normalizeCatalogCode(trimmed);
  const attributed = attributeCodes(items);
  const best = new Map<T, { rank: CatalogSearchRank; index: number }>();

  const consider = (item: T, rank: CatalogSearchRank, index: number) => {
    const existing = best.get(item);
    if (!existing || rank < existing.rank || (rank === existing.rank && index < existing.index)) {
      best.set(item, { rank, index });
    }
  };

  items.forEach((item, index) => {
    const sets = attributed.get(item);
    const codeRank = sets ? rankAgainst(sets, queryNorm) : null;
    if (codeRank != null) consider(item, codeRank, index);
    else if (textMatches?.(item, trimmed)) consider(item, CATALOG_SEARCH_RANK.text, index);
  });

  return Array.from(best.entries())
    .map(([item, hit]) => ({ item, rank: hit.rank, index: hit.index }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ item, rank }) => ({ item, rank }));
}

/** True when the query matches this row's item code or any of its aliases. */
export function catalogItemMatchesCode(item: object, query: string): boolean {
  const hit = searchCatalogItems([item], query)[0];
  return hit != null && hit.rank !== CATALOG_SEARCH_RANK.text;
}

export type CatalogCodeLookup = {
  recordIndex: number;
  rank: typeof CATALOG_SEARCH_RANK.exactItem | typeof CATALOG_SEARCH_RANK.exactAlias;
};

/**
 * Exact code lookup for a single typed code. Item codes of a current master
 * are omitted so an existing master-code match keeps its own precedence; alias
 * codes and codes that resolve through ReplacementMasterCode are included.
 */
export function catalogCodeLookup(items: readonly object[]): Map<string, CatalogCodeLookup> {
  const attributed = attributeCodes(items);
  const lookup = new Map<string, CatalogCodeLookup>();
  items.forEach((item, recordIndex) => {
    const sets = attributed.get(item);
    if (!sets) return;
    const own = normalizeCatalogCode(primaryCode(item));
    const current = !replacementCode(item) || replacementCode(item) === own;
    Array.from(sets.itemCodes).forEach((code) => {
      if (current && code === own) return;
      if (!lookup.has(code)) lookup.set(code, { recordIndex, rank: CATALOG_SEARCH_RANK.exactItem });
    });
    Array.from(sets.aliases).forEach((code) => {
      if (!lookup.has(code)) lookup.set(code, { recordIndex, rank: CATALOG_SEARCH_RANK.exactAlias });
    });
  });
  return lookup;
}
