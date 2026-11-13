/**
 * What to change when a run cannot give the refrigerator its landing.
 *
 * Tom (Nov 13 2026): "sometimes you have to look at the math and suggest small
 * refrigerator or sink base". A 36" sink base and a 36" refrigerator in a short
 * run can leave no counter beside the fridge; the honest answer is not a filler
 * and not a silent zero - it is naming the smaller size that would fit.
 *
 * Pure: it never moves a cabinet. It answers "which stock sizes would free the
 * shortfall", so the review list can say it and a designer can act on it.
 */

/** Stock widths, largest first, that these lines actually sell. */
export const SUGGESTABLE_SINK_BASE_WIDTHS_IN = [36, 33, 30, 27, 24] as const;
export const SUGGESTABLE_REFRIGERATOR_WIDTHS_IN = [36, 33, 30] as const;

export type LandingFixKind = "sink-base" | "refrigerator";

export type LandingFixSuggestion = {
  kind: LandingFixKind;
  /** The size on the plan now. */
  currentIn: number;
  /** The smaller size that frees enough room. */
  suggestedIn: number;
  /** Counter inches this swap gives back. */
  freedIn: number;
  /** One line a person can read. */
  detail: string;
};

export type LandingFixInput = {
  /** Counter the run gives beside the refrigerator right now. */
  landingIn: number;
  /** The rule: fridge_landing_in. */
  requiredIn: number;
  sinkBaseWidthIn?: number | null;
  refrigeratorWidthIn?: number | null;
};

/**
 * Each suggestion is the LARGEST smaller size that frees the shortfall, so the
 * least cabinet is given up. Ordered sink base first: it is the cheaper swap and
 * it does not change the appliance.
 */
export function suggestFridgeLandingFixes(input: LandingFixInput): LandingFixSuggestion[] {
  const required = Number(input.requiredIn);
  const landing = Math.max(0, Number(input.landingIn) || 0);
  if (!Number.isFinite(required) || required <= 0) return [];
  const shortfall = required - landing;
  if (shortfall <= 0.05) return [];

  const cheaper = (widths: readonly number[], current: number | null | undefined): number | null => {
    const now = Number(current);
    if (!Number.isFinite(now) || now <= 0) return null;
    const options = widths
      .filter((width) => width < now - 0.05 && now - width >= shortfall - 0.05)
      .sort((a, b) => b - a);
    return options[0] ?? null;
  };

  const fixes: LandingFixSuggestion[] = [];
  const sinkNow = Number(input.sinkBaseWidthIn);
  const smallerSink = cheaper(SUGGESTABLE_SINK_BASE_WIDTHS_IN, sinkNow);
  if (smallerSink != null) {
    fixes.push({
      kind: "sink-base",
      currentIn: sinkNow,
      suggestedIn: smallerSink,
      freedIn: sinkNow - smallerSink,
      detail: `A ${smallerSink}" sink base instead of ${sinkNow}" frees ${sinkNow - smallerSink}" for the refrigerator landing.`,
    });
  }
  const fridgeNow = Number(input.refrigeratorWidthIn);
  const smallerFridge = cheaper(SUGGESTABLE_REFRIGERATOR_WIDTHS_IN, fridgeNow);
  if (smallerFridge != null) {
    fixes.push({
      kind: "refrigerator",
      currentIn: fridgeNow,
      suggestedIn: smallerFridge,
      freedIn: fridgeNow - smallerFridge,
      detail: `A ${smallerFridge}" refrigerator instead of ${fridgeNow}" frees ${fridgeNow - smallerFridge}" for the landing.`,
    });
  }
  return fixes;
}

/** One sentence for a review finding, or null when nothing smaller would help. */
export function fridgeLandingAdvice(input: LandingFixInput): string | null {
  const fixes = suggestFridgeLandingFixes(input);
  if (!fixes.length) {
    return "Neither a smaller sink base nor a smaller refrigerator frees enough room on this run; the landing needs a plan change.";
  }
  return `${fixes.map((fix) => fix.detail).join(" ")}`;
}
