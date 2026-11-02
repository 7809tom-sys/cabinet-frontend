/**
 * Admin door-style lookup by real name or white-label (alias) name.
 *
 * Matching is deliberately forgiving: case and every non-alphanumeric
 * character are ignored, so "umbershaker", "Umber Shaker" and "UMBER-SHAKER"
 * all find the door named "Umber Shaker". Partial queries also match.
 */

export type DoorStyleSearchFields = {
  /** The door's real working name, e.g. "Umber Shaker". */
  ourName?: string | null;
  /** The white-label name shown to shoppers, e.g. "Aurum Vault". */
  aliasName?: string | null;
  /** The curated homepage label, when different from the alias. */
  featuredLabel?: string | null;
  /** Other descriptive text (profile, color, finish, supply line). */
  detail?: string | null;
};

export type DoorStyleSearchMatchKind = "real-name" | "white-label" | "detail";

export type DoorStyleSearchMatch = {
  kind: DoorStyleSearchMatchKind;
  /** The real door name, always shown so the admin knows the canonical door. */
  name: string;
  /** The white-label name that matched; set only when kind is "white-label". */
  whiteLabel: string | null;
};

function clean(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

/** Lowercase a name and drop everything that is not a letter or digit. */
export function normalizeDoorStyleSearchText(
  value: string | null | undefined,
): string {
  return (value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/** 0 = exact, 1 = starts with the query, 2 = contains it, null = no match. */
function candidateRank(candidate: string, query: string): number | null {
  if (!candidate || !query) return null;
  if (candidate === query) return 0;
  if (candidate.startsWith(query)) return 1;
  if (candidate.includes(query)) return 2;
  return null;
}

/** Name matches always beat descriptive-text matches, then match quality decides. */
const KIND_WEIGHT: Record<DoorStyleSearchMatchKind, number> = {
  "real-name": 0,
  "white-label": 10,
  detail: 20,
};

/** Builds the searchable fields for one admin door-style record. */
export function doorStyleSearchFields(style: {
  ourName?: string | null;
  aliasName?: string | null;
  featuredLabel?: string | null;
  doorStyle?: string | null;
  color?: string | null;
  finish?: string | null;
  distributorName?: string | null;
  supplierBrandName?: string | null;
  supplierName?: string | null;
}): DoorStyleSearchFields {
  return {
    ourName: style.ourName,
    aliasName: style.aliasName,
    featuredLabel: style.featuredLabel,
    detail: [
      style.doorStyle,
      style.color,
      style.finish,
      style.distributorName,
      style.supplierBrandName,
      style.supplierName,
    ]
      .map((part) => clean(part))
      .filter(Boolean)
      .join(" "),
  };
}

/** Distinct white-label names on a door, excluding ones equal to the real name. */
export function doorStyleWhiteLabels(fields: DoorStyleSearchFields): string[] {
  const realName = normalizeDoorStyleSearchText(fields.ourName);
  const labels: string[] = [];
  for (const value of [fields.aliasName, fields.featuredLabel]) {
    const label = clean(value);
    const normalized = normalizeDoorStyleSearchText(label);
    if (!normalized || normalized === realName) continue;
    if (
      labels.some(
        (existing) => normalizeDoorStyleSearchText(existing) === normalized,
      )
    )
      continue;
    labels.push(label);
  }
  return labels;
}

/**
 * Matches one door by real name first, then its white-label names, then its
 * descriptive text. Better match quality wins and real names break ties, so a
 * door is never hidden behind an alias record.
 */
export function matchDoorStyle(
  style: DoorStyleSearchFields,
  rawQuery: string | null | undefined,
): DoorStyleSearchMatch | null {
  const query = normalizeDoorStyleSearchText(rawQuery);
  if (!query) return null;

  const name = clean(style.ourName);
  let best: {
    kind: DoorStyleSearchMatchKind;
    score: number;
    whiteLabel: string | null;
  } | null = null;
  const consider = (
    kind: DoorStyleSearchMatchKind,
    rank: number | null,
    whiteLabel: string | null,
  ) => {
    if (rank == null) return;
    const score = KIND_WEIGHT[kind] + rank;
    if (!best || score < best.score) best = { kind, score, whiteLabel };
  };

  consider(
    "real-name",
    candidateRank(normalizeDoorStyleSearchText(name), query),
    null,
  );
  for (const label of doorStyleWhiteLabels(style)) {
    consider(
      "white-label",
      candidateRank(normalizeDoorStyleSearchText(label), query),
      label,
    );
  }
  consider(
    "detail",
    candidateRank(normalizeDoorStyleSearchText(style.detail), query),
    null,
  );

  const winner = best as {
    kind: DoorStyleSearchMatchKind;
    score: number;
    whiteLabel: string | null;
  } | null;
  if (!winner) return null;

  return {
    kind: winner.kind,
    name: name || winner.whiteLabel || "",
    whiteLabel: winner.kind === "white-label" ? winner.whiteLabel : null,
  };
}

/** Result count line for the search box. Empty when there is no query. */
export function doorStyleSearchSummary(
  matchCount: number,
  total: number,
  rawQuery: string,
): string {
  const query = clean(rawQuery);
  if (!query) return "";
  if (matchCount === 0) {
    return `No door style matches “${query}”. Search the real door name or its white label.`;
  }
  return `${matchCount} of ${total} door ${total === 1 ? "style" : "styles"} match “${query}”.`;
}

/** Row-level note naming the white label that matched. Null for real-name matches. */
export function whiteLabelMatchNote(
  match: DoorStyleSearchMatch | null | undefined,
): string | null {
  if (!match || match.kind !== "white-label" || !match.whiteLabel) return null;
  return `White label “${match.whiteLabel}” matched — real door name ${match.name}`;
}
