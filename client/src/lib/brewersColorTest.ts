/**
 * The Brewers test mode: a color that cannot be mistaken for a real finish.
 *
 * `?colorTest=brewers` (admin only, preview only, no database writes) pretends
 * Shaker Honey's accepted render is Brewers navy with gold accents, so a surface
 * that ignores the accepted appearance is instantly obvious — a tan box next to
 * navy doors instead of two slightly different yellows nobody can see.
 *
 * Doors and boxes take the navy. Handles (or a stripe, where a handle cannot be
 * drawn) take the gold. Nothing here is a finish: the values are fixed, they are
 * never written anywhere, and they only exist while the flag is in the URL.
 */
import type { DoorColorDecision } from "@shared/doorColorResolve";

/** Brewers navy — the test's door and box color. */
export const BREWERS_NAVY = "#12284B";
/** Brewers gold — the test's accent for handles or a stripe. */
export const BREWERS_GOLD = "#FFC52F";

/** The styles the test applies to. Shaker Honey is the one the owner checked. */
export const BREWERS_TEST_STYLE_IDS: readonly number[] = [330021];
export const BREWERS_TEST_STYLE_CODES: readonly string[] = ["SH"];

export type BrewersTestMode = {
  enabled: boolean;
  navy: string;
  gold: string;
  /** Which style ids and codes the fake accepted render applies to. */
  styleIds: readonly number[];
  styleCodes: readonly string[];
};

export const BREWERS_TEST_MODE: BrewersTestMode = {
  enabled: true,
  navy: BREWERS_NAVY,
  gold: BREWERS_GOLD,
  styleIds: BREWERS_TEST_STYLE_IDS,
  styleCodes: BREWERS_TEST_STYLE_CODES,
};

/**
 * True only for an admin who asked for the Brewers test. Nothing else turns it on,
 * so a shopper can never see it and no deploy can enable it by accident.
 */
export function brewersTestEnabled(input: { search?: string | null; isAdmin: boolean }): boolean {
  if (!input.isAdmin) return false;
  const query = (input.search ?? "").trim();
  if (!query) return false;
  const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  return (params.get("colorTest") ?? "").toLowerCase() === "brewers";
}

/** True when this style is one the Brewers test paints. */
export function isBrewersTestStyle(style: {
  id?: number | null;
  styleCode?: string | null;
} | null | undefined): boolean {
  if (!style) return false;
  if (style.id != null && BREWERS_TEST_STYLE_IDS.includes(style.id)) return true;
  const code = (style.styleCode ?? "").trim().toUpperCase();
  return code.length > 0 && BREWERS_TEST_STYLE_CODES.includes(code);
}

/**
 * The resolver decision the Brewers test would produce: the navy pretending to be
 * the accepted render for this style, with the same "accepted" provenance the real
 * pipeline uses. Everything downstream is untouched, which is the point — if the
 * surfaces still disagree under this, they disagree in production too.
 */
export function brewersTestDecision(decision: DoorColorDecision): DoorColorDecision {
  return {
    ...decision,
    appliedHex: BREWERS_NAVY,
    appliedSource: "render-hex",
    appliedCategory: "paint",
    usesGrain: false,
    candidateHex: BREWERS_NAVY,
    candidateSource: "render-hex",
    candidateCategory: "paint",
    layers: {
      ...decision.layers,
      renderHex: BREWERS_NAVY,
    },
    review: {
      ...decision.review,
      needsColorReview: false,
      keptBecause: "hand-set-render-hex",
      chosenHex: BREWERS_NAVY,
      chosenSource: "render-hex",
      chosenCategory: "paint",
    },
  };
}

/** The accent color a cabinet's handles or stripe should take in test mode. */
export function brewersAccentHex(testMode: boolean): string | null {
  return testMode ? BREWERS_GOLD : null;
}
