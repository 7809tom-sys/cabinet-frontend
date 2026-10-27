/**
 * Age-based forecast close rates. Percents are placeholders until the owner
 * replaces them in admin. Age is measured in whole days from a design's
 * updatedAt (last save), not createdAt.
 *
 * Brackets are inclusive. The open-ended "90+" band starts at day 91 so it
 * does not overlap the 61–90 band.
 */

export type CloseRateBracket = {
  minDays: number;
  /** Null means no upper bound. */
  maxDays: number | null;
  closePercent: number;
  sortOrder?: number;
};

export const PLACEHOLDER_CLOSE_BRACKETS: readonly CloseRateBracket[] = [
  { minDays: 0, maxDays: 30, closePercent: 70, sortOrder: 0 },
  { minDays: 31, maxDays: 60, closePercent: 55, sortOrder: 1 },
  { minDays: 61, maxDays: 90, closePercent: 40, sortOrder: 2 },
  { minDays: 91, maxDays: null, closePercent: 20, sortOrder: 3 },
];

export function ageDaysFromUpdatedAt(updatedAt: Date | string | number, now: Date | number = Date.now()): number {
  const updated = new Date(updatedAt).getTime();
  const at = now instanceof Date ? now.getTime() : now;
  if (!Number.isFinite(updated) || !Number.isFinite(at)) return 0;
  return Math.max(0, Math.floor((at - updated) / 86_400_000));
}

/** Null when the brackets overlap, leave a gap is allowed, or a percent is outside 0–100. */
export function validateCloseRateBrackets(brackets: readonly CloseRateBracket[]): string | null {
  if (brackets.length === 0) return "Add at least one close-rate bracket.";
  const ordered = [...brackets].sort((a, b) => a.minDays - b.minDays || (a.maxDays ?? 1e9) - (b.maxDays ?? 1e9));
  for (const bracket of ordered) {
    if (!Number.isInteger(bracket.minDays) || bracket.minDays < 0) return "Bracket days must be whole numbers starting at 0 or more.";
    if (bracket.maxDays != null && (!Number.isInteger(bracket.maxDays) || bracket.maxDays < bracket.minDays)) {
      return "A bracket's end day cannot come before its start day.";
    }
    if (!Number.isFinite(bracket.closePercent) || bracket.closePercent < 0 || bracket.closePercent > 100) {
      return "Close rate must be between 0 and 100 percent.";
    }
  }
  for (let i = 0; i < ordered.length; i++) {
    for (let j = i + 1; j < ordered.length; j++) {
      const a = ordered[i]!;
      const b = ordered[j]!;
      const aEnd = a.maxDays ?? Number.POSITIVE_INFINITY;
      const bEnd = b.maxDays ?? Number.POSITIVE_INFINITY;
      if (a.minDays <= bEnd && b.minDays <= aEnd) return "Close-rate brackets cannot overlap.";
    }
  }
  return null;
}

/** Close percent for an age, or null when no bracket covers that age. */
export function closeRateForAge(ageDays: number, brackets: readonly CloseRateBracket[]): number | null {
  const age = Math.max(0, Math.floor(ageDays));
  for (const bracket of brackets) {
    const end = bracket.maxDays ?? Number.POSITIVE_INFINITY;
    if (age >= bracket.minDays && age <= end) return bracket.closePercent;
  }
  return null;
}

export function closeRateFraction(ageDays: number, brackets: readonly CloseRateBracket[]): number {
  const percent = closeRateForAge(ageDays, brackets);
  return percent == null ? 0 : percent / 100;
}
