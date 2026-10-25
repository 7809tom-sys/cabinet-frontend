// ─────────────────────────────────────────────────────────────────────────────
// groupStylesByDistributor
// Pure helper that groups door styles by their distributor (supply line) for the
// Design Tool door-style picker. Kept framework-free so it can be unit-tested
// directly. Headers use the NEUTRAL white-label distributor label only — the
// hidden supplier brand is never surfaced here.
// ─────────────────────────────────────────────────────────────────────────────

export type GroupableStyle = {
  id: number;
  distributorId?: number | null;
};

export type GroupableDistributor = { id: number; name: string | null };

export type StyleGroupOf<T> = {
  distributorId: number | null;
  label: string;
  styles: T[];
};

export interface GroupLabelOptions {
  /** Label for a style whose distributorId has no matching neutral label. */
  fallback: (id: number) => string;
  /** Label for styles with no distributorId at all. */
  other: string;
}

/**
 * Group `styles` by `distributorId`, attaching a neutral display label from
 * `distributors`. Groups are sorted by label for a stable order; the order of
 * styles within each group is preserved from the input.
 */
export function groupStylesByDistributor<T extends GroupableStyle>(
  styles: T[],
  distributors: GroupableDistributor[],
  opts: GroupLabelOptions,
): StyleGroupOf<T>[] {
  const labelById = new Map<number, string>();
  for (const d of distributors) {
    if (d.name) labelById.set(d.id, d.name);
  }

  const byDist = new Map<number | null, T[]>();
  for (const s of styles) {
    const key = s.distributorId ?? null;
    const arr = byDist.get(key);
    if (arr) arr.push(s);
    else byDist.set(key, [s]);
  }

  const out: StyleGroupOf<T>[] = [];
  byDist.forEach((list, distributorId) => {
    const label =
      distributorId != null
        ? labelById.get(distributorId) ?? opts.fallback(distributorId)
        : opts.other;
    out.push({ distributorId, label, styles: list });
  });
  out.sort((a, b) => a.label.localeCompare(b.label));
  return out;
}
