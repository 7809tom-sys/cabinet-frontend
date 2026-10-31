/**
 * Shared size comparison for cabinet-line substitution.
 *
 * A future spec-book ladder can call this with the widths, heights, and depths
 * a line actually sells. Callers decide which axes must match and which axis
 * wins a tie. This module does not read a database or place a cabinet.
 */

export type CatalogSize = { width: number; height: number; depth: number };
export type CatalogSizeAxis = keyof CatalogSize;

const DEFAULT_TOLERANCE_IN = 0.5;

export function catalogSizeFromNumbers(
  width: number,
  height: number,
  depth: number,
): CatalogSize | null {
  if (!(width > 0) || !(height > 0) || !(depth > 0)) return null;
  if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(depth)) return null;
  return { width, height, depth };
}

export function sameCatalogSize(actual: number, expected: number, toleranceIn = DEFAULT_TOLERANCE_IN): boolean {
  return Math.abs(actual - expected) <= toleranceIn + 1e-9;
}

export type ClosestCatalogSizeOptions<T> = {
  candidates: readonly T[];
  wanted: Partial<CatalogSize>;
  read: (item: T) => CatalogSize | null;
  /** Axes that must match before an item can win. */
  require?: readonly CatalogSizeAxis[];
  toleranceIn?: number;
  /** Extra eligibility test, for example "height must stay under 30". */
  accept?: (size: CatalogSize, item: T) => boolean;
  /**
   * Sort priority. Earlier axes matter more. `closest` prefers the smaller
   * absolute difference. `smaller` breaks a tie toward the size that cannot
   * overrun the opening. `larger` prefers the bigger box (a tallest-height pick).
   */
  rank?: readonly { axis: CatalogSizeAxis; by: "closest" | "smaller" | "larger" }[];
};

/**
 * The closest catalog size to `wanted`. Null when nothing is eligible.
 * Equal rank keeps the earlier candidate, so callers should pre-sort when a
 * SKU tie-break matters.
 */
export function pickClosestCatalogSize<T>(options: ClosestCatalogSizeOptions<T>): { item: T; size: CatalogSize } | null {
  const tolerance = options.toleranceIn ?? DEFAULT_TOLERANCE_IN;
  const require = options.require ?? [];
  const rank = options.rank ?? (["width", "height", "depth"] as const).map((axis) => ({ axis, by: "closest" as const }));
  const eligible = options.candidates.flatMap((item) => {
    const size = options.read(item);
    if (!size) return [];
    if (require.some((axis) => options.wanted[axis] == null || !sameCatalogSize(size[axis], options.wanted[axis]!, tolerance))) return [];
    if (options.accept && !options.accept(size, item)) return [];
    return [{ item, size }];
  });
  if (!eligible.length) return null;
  eligible.sort((left, right) => {
    for (const step of rank) {
      const wanted = options.wanted[step.axis];
      const delta = step.by === "larger"
        ? right.size[step.axis] - left.size[step.axis]
        : step.by === "smaller"
          ? left.size[step.axis] - right.size[step.axis]
          : Math.abs(left.size[step.axis] - (wanted ?? left.size[step.axis]))
            - Math.abs(right.size[step.axis] - (wanted ?? right.size[step.axis]));
      if (Math.abs(delta) > 1e-9) return delta;
      if (step.by === "closest" && wanted != null) {
        const smaller = left.size[step.axis] - right.size[step.axis];
        if (Math.abs(smaller) > 1e-9) return smaller;
      }
    }
    return 0;
  });
  return eligible[0] ?? null;
}
