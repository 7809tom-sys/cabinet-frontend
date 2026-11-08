/**
 * Per-model side and end profiles for Pelican's freestanding tubs.
 *
 * Owner report (Nov 8 2026), with a side view of PL-02563 beside its catalog
 * photo: the 3D tub flared out at the rim and curved sharply in to a narrow
 * pedestal foot, like a bowl on a plinth, and the selection box stood well
 * outside the base. The real PL-02563 is a soft rectangle whose sides drop
 * almost straight to the floor, with a footprint about as wide as its rim.
 *
 * Cause: one hard-coded `BASE_TAPER = 0.74` was applied to every model, so every
 * tub was the same narrow-footed bowl regardless of what its photo shows. The
 * earlier audit only asserted closure and envelope, which a tapered shell passes
 * just as well as a straight one, so nothing caught it.
 *
 * Each entry below is read off that model's own catalog photo. The numbers are
 * the *visible silhouette*, expressed as a share of the published envelope:
 *
 * - `baseFootprint` — how wide the floor contact is versus the rim. A straight
 *   sided acrylic tub is 0.86–0.92; a genuine pedestal or clawfoot would be much
 *   lower, and none of Pelican's freestanding line is one.
 * - `rimFlare` — how far the rim overhangs the widest point of the wall. Real
 *   photos show ~1.00 (flush): the rim is an extension of the wall, not a lip.
 * - `waistMid` — the width at mid height, which is what makes a wall read as
 *   "straight" rather than "bulged".
 * - `cornerRadiusShare` — plan-view corner roundness against the short side.
 * - `slipperRise` — how much higher the backrest end is than the foot end.
 * - `rimThickness` — the flat top edge, as a share of the tub height.
 *
 * `TUB_SIDE_PROFILES` is keyed by the Pelican code with any length suffix removed,
 * so the 59-inch and 67-inch sheets of one model share a family profile.
 */

export type TubSideProfile = {
  /** Floor footprint as a share of the rim footprint, 0–1. */
  baseFootprint: number;
  /** Rim overhang past the widest wall point; 1 means flush. */
  rimFlare: number;
  /** Wall width at mid height, as a share of the rim. */
  waistMid: number;
  /** Plan-view corner radius as a share of the short side. */
  cornerRadiusShare: number;
  /** Extra height at the backrest end, as a share of the tub height. 0 = flat ends. */
  slipperRise: number;
  /** Flat top edge thickness, as a share of the tub height. */
  rimThickness: number;
  /**
   * "box" builds a straight rectangular prism — vertical walls right to the
   * floor, square ends, flat deck and a full-height front apron that is part of
   * the same shell. "profile" builds a lofted body whose wall follows
   * `baseFootprint`/`waistMid`. An alcove tub is a box; a freestanding tub is
   * not.
   */
  profile?: "profile" | "box";
  /** One-line note pointing at the photo the numbers came from. */
  source: string;
};

/**
 * Straight-sided soft rectangle. The owner's PL-02563 and its siblings: sides
 * drop almost vertically, rim flat and flush, footprint ~0.9 of the rim.
 */
const SOFT_RECTANGLE: TubSideProfile = {
  baseFootprint: 0.90,
  rimFlare: 1.0,
  waistMid: 0.965,
  cornerRadiusShare: 0.17,
  slipperRise: 0,
  rimThickness: 0.014,
  profile: "profile",
  source: "Catalog photo: soft rectangle, near-vertical sides, flat flush rim, base nearly the full footprint.",
};

/** The same straight body with a smaller corner radius, for the squarer sheets. */
const CRISP_RECTANGLE: TubSideProfile = {
  ...SOFT_RECTANGLE,
  cornerRadiusShare: 0.09,
  source: "Catalog photo: square-shouldered rectangle, vertical sides, tight plan corners, flat rim.",
};

/** Rounded oval with a gently curved wall, still a broad floor contact. */
const SOFT_OVAL: TubSideProfile = {
  baseFootprint: 0.86,
  rimFlare: 1.0,
  waistMid: 0.955,
  cornerRadiusShare: 0.5,
  slipperRise: 0,
  rimThickness: 0.014,
  profile: "profile",
  source: "Catalog photo: oval plan, gently curved wall, broad flat floor contact, no pedestal.",
};

/**
 * Slipper oval: one end rises into a backrest. The photo also shows a broad
 * base (~0.86 of the rim), so the taper is mild even though the end is raised.
 */
const SLIPPER_OVAL: TubSideProfile = {
  baseFootprint: 0.86,
  rimFlare: 1.0,
  waistMid: 0.95,
  cornerRadiusShare: 0.5,
  slipperRise: 0.17,
  rimThickness: 0.014,
  profile: "profile",
  source: "Catalog photo: slipper oval — raised backrest end, gently curved straight-ish wall, broad base.",
};

/**
 * An alcove tub is a literal rectangular box: flat front apron at full height to
 * the floor, square vertical ends, a flat rectangular top deck. Nothing about it
 * tapers, flares or curves in plan, and it has no separate panel.
 *
 * The first attempt reused the freestanding oval profile with only a wider plan
 * corner radius, so the alcove tubs still swept inward like a bowl and carried a
 * detached apron slab. `profile: "box"` below marks the models that must be
 * built as a true box, and the builder draws them as one prism with no apron
 * part.
 */
const ALCOVE_BOX: TubSideProfile = {
  baseFootprint: 1,
  rimFlare: 1.0,
  waistMid: 1,
  // Square plan. A real alcove tub's deck meets the apron at a crisp corner.
  cornerRadiusShare: 0,
  slipperRise: 0,
  rimThickness: 0.012,
  profile: "box",
  source: "Alcove sheet: rectangular box — vertical walls, square ends, flat deck, full-height apron.",
};

/**
 * Model families, from each model's own catalog photo. Everything Pelican sells
 * freestanding is a straight-sided or gently curved body with a broad base;
 * none is a pedestal or clawfoot, so `baseFootprint` never drops near the old
 * 0.74 default.
 */
export const TUB_SIDE_PROFILES: Record<string, TubSideProfile> = {
  "PL-02563": SOFT_RECTANGLE,
  "PL-02562": SOFT_RECTANGLE,
  "PL-02146": CRISP_RECTANGLE,
  "PL-02138": SOFT_OVAL,
  "PL-02141": SLIPPER_OVAL,
};

/** The family a code belongs to, ignoring the length suffix ("PL-02563 59""). */
export function tubProfileKey(pelicanCode: string): string {
  return pelicanCode.trim().toUpperCase().replace(/\s+\d+"$/, "").replace(/\s+\d+IN$/, "");
}

/**
 * The profile for one model. An unknown freestanding code falls back to the
 * straight-sided soft rectangle rather than the old narrow-foot bowl: every
 * freestanding tub Pelican publishes is straight sided, so that is the honest
 * default, and the audit test fails loudly if a new model arrives with no entry.
 */
export function tubSideProfile(input: {
  pelicanCode: string;
  kind?: string | null;
  tubShape?: string | null;
}): TubSideProfile {
  const key = tubProfileKey(input.pelicanCode);
  const explicit = TUB_SIDE_PROFILES[key];
  if (explicit) return explicit;
  if (input.kind === "alcove-tub") return ALCOVE_BOX;
  if (input.tubShape === "rectangular") return CRISP_RECTANGLE;
  if (input.tubShape === "rounded-rectangular") return SOFT_RECTANGLE;
  return SOFT_OVAL;
}

/**
 * The widest point of the wall as a share of the rim, taking the rim flare into
 * account. The shell is built so the rim is exactly the published envelope, and
 * everything below it sits inside.
 */
export function tubWallShare(profile: TubSideProfile): number {
  return Math.min(1, profile.rimFlare > 0 ? 1 / profile.rimFlare : 1);
}

/**
 * Wall width at height share `t` (0 = floor, 1 = rim), as a share of the rim.
 *
 * The wall leaves the floor at `baseFootprint`, reaches `waistMid` by the time
 * it is two-thirds of the way up, and turns into the rim at the top. A straight
 * tub only moves a few percent across the whole height, which is the point.
 */
export function tubWidthShareAt(profile: TubSideProfile, t: number): number {
  // A box tub has vertical walls at full width from the floor to the deck.
  // Nothing about it tapers, so there is no silhouette curve to apply.
  if (isBoxTub(profile)) return 1;
  const clamped = Math.min(1, Math.max(0, t));
  const ease = (value: number) => value * value * (3 - 2 * value);
  // Rise quickly off the floor, then stay near vertical for the rest of the body.
  const rise = ease(Math.min(1, clamped / 0.62));
  const width = profile.baseFootprint + (profile.waistMid - profile.baseFootprint) * rise;
  // The last sliver turns over into the rim itself.
  const toRim = ease(Math.min(1, Math.max(0, (clamped - 0.88) / 0.12)));
  const withRim = width + (1 - width) * toRim;
  return Math.min(1, Math.max(0, withRim));
}

/** True when the base footprint clears the straight-sided threshold. */
export const STRAIGHT_SIDED_MIN_BASE_SHARE = 0.85;

export function isStraightSided(profile: TubSideProfile): boolean {
  return profile.baseFootprint >= STRAIGHT_SIDED_MIN_BASE_SHARE;
}

/** True when this model must be built as a straight rectangular box (an alcove tub). */
export function isBoxTub(profile: TubSideProfile): boolean {
  return profile.profile === "box";
}
