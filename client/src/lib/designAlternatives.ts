/**
 * Alternatives for a homeowner, in plain words.
 *
 * When something does not fit, the auto-designer must not just show an error. It
 * says it is finding another way, computes at least one valid alternative, shows
 * it, and lets the homeowner accept it with one click — or see the next one.
 *
 * The framing is the owner's:
 *
 *   "Here's my alternative, closest to what you want, but this is what it should be."
 *
 * Then a plain reason ("the dishwasher needs a bit more room next to the corner"),
 * then Accept / Show another option.
 *
 * Everything here is presentation and phrasing over a real fix the caller already
 * computed. No SKU, no drawer count, no error code, no mention of a "run", a
 * "collision", or a "panel" ever reaches the homeowner.
 */

/** What kind of fix an alternative is, used only to pick the plain sentence. */
export type AlternativeKind =
  | "shift"
  | "resize"
  | "swap"
  | "corner"
  | "elsewhere"
  | "leftover"
  | "above-range"
  | "sink"
  | "dishwasher"
  | "no-room";

export type Alternative = {
  /** Stable id so Accept/Next can be wired without re-deriving anything. */
  id: string;
  kind: AlternativeKind;
  /**
   * One short sentence in homeowner words: what this alternative does.
   * Never contains a SKU, a code, or error wording.
   */
  summary: string;
  /** Why the first attempt did not work, in plain words, and why this does. */
  reason: string;
  /** True for the alternative closest to what they asked for (shown first). */
  closest: boolean;
};
export type AlternativeSet = {
  /** The plain opening line: what we are doing instead of failing. */
  opening: string;
  alternatives: Alternative[];
  /** Shown only when nothing at all can be done. Never an error tone. */
  noAlternative: string | null;
};

/** The owner's wording, verbatim, for the lead line. */
export const ALTERNATIVE_LEAD = "Here's my alternative, closest to what you want, but this is what it should be.";

/** Plain openers for each kind. No jargon, no apology, no error words. */
const KIND_OPENERS: Record<AlternativeKind, string> = {
  shift: "I moved a cabinet a little so everything fits.",
  resize: "I used a slightly different size cabinet so the space is filled.",
  swap: "I swapped in a cabinet that fits the space.",
  corner: "I used a different corner cabinet so the corner works.",
  elsewhere: "I found another spot that works.",
  leftover: "I filled the leftover space with a real cabinet.",
  "above-range": "I put a microwave with a short cabinet above it over the range.",
  sink: "I set the sink in the base cabinet where it fits.",
  dishwasher: "I found a place for the dishwasher that works.",
  "no-room": "There is not enough room for that here.",
};

/** Phrases that must never reach a homeowner. Used by the tests as a guard. */
export const FORBIDDEN_HOMEOWNER_TERMS = [
  "SKU", "collision", "overlap", "panel", "filler", "run end", "BOM",
  "undefined", "null", "NaN", "toast.error", "failed to", "invalid",
];

/**
 * Build the homeowner-facing alternative set from a plain list of candidate
 * fixes, closest first. Each candidate supplies only its own sentence.
 */
export function buildAlternativeSet(input: {
  candidates: readonly { id: string; kind: AlternativeKind; summary: string }[];
  /** Plain reason the first attempt did not work, already a sentence fragment. */
  reason: string;
  noAlternative?: string | null;
}): AlternativeSet {
  const alternatives: Alternative[] = input.candidates.map((entry, index) => ({
    ...entry,
    closest: index === 0,
    reason: input.reason,
  }));
  return {
    opening: alternatives.length ? ALTERNATIVE_LEAD : input.noAlternative ?? "",
    alternatives,
    noAlternative: alternatives.length ? null : input.noAlternative ?? null,
  };
}

/** One plain sentence for an alternative, for a toast or a list row. */
export function alternativeSentence(alternative: Alternative): string {
  return `${alternative.summary} ${alternative.reason}`;
}

/** Plain opener for a kind, so callers can compose a summary without jargon. */
export function alternativeOpener(kind: AlternativeKind): string {
  return KIND_OPENERS[kind];
}

/**
 * A plain "there is just no room" message. Used only when no valid placement
 * exists anywhere, never for a case that merely needs another attempt.
 */
export function noRoomNotice(what: string, detail?: string): string {
  return detail
    ? `This kitchen doesn't have enough room for ${what}. ${detail} That's just the space, not a mistake.`
    : `This kitchen doesn't have enough room for ${what}. That's just the space, not a mistake.`;
}

/** Guard used by tests and by any caller that wants to check its own copy. */
export function homeownerSafeCopy(text: string): boolean {
  const lower = text.toLowerCase();
  return !FORBIDDEN_HOMEOWNER_TERMS.some((term) => lower.includes(term.toLowerCase()));
}
