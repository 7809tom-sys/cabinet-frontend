/**
 * Door-style identity, read case-insensitively from the fields a user actually
 * enters or picks.
 *
 * Two sources of truth, in this order:
 *
 * 1. Construction fields (`doorStyle`, `doorPanelType`, `profileDescription`,
 *    `profileNotes`). These are the distributor's own words about how the door is
 *    built, so they outrank a product name.
 * 2. The style's names (`ourName`, `aliasName`, `name`). Used only when the
 *    construction fields say nothing, so "Shaker Honey" with a blank doorStyle is
 *    a shaker and "Shaker Honey" with a doorStyle of "Slab" is not.
 *
 * A name never overrides an explicit slab or glass construction.
 */
export type DoorProfileIdentityInput = {
  doorStyle?: string | null;
  doorPanelType?: string | null;
  ourName?: string | null;
  aliasName?: string | null;
  name?: string | null;
  styleCode?: string | null;
  profileDescription?: string | null;
  profileNotes?: string | null;
};

function normalized(...values: Array<string | null | undefined>): string {
  // `toLowerCase` covers "Shaker", "SHAKER", and "sHaKeR" identically.
  return values
    .map((value) => (value ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

/** Construction words only: the distributor's description of the door build. */
export function doorProfileConstructionText(style: DoorProfileIdentityInput | null | undefined): string {
  return normalized(
    style?.doorStyle,
    style?.doorPanelType,
    style?.profileDescription,
    style?.profileNotes,
  );
}

/** The style's product names, not its finish. A finish called "Shaker" is not a door style. */
export function doorProfileNameText(style: DoorProfileIdentityInput | null | undefined): string {
  return normalized(style?.ourName, style?.aliasName, style?.name);
}

/** An explicit slab or glass build outranks any word in the product name. */
export function doorProfileIsSlabOrGlass(style: DoorProfileIdentityInput | null | undefined): boolean {
  return /\bglass\b|\bslab\b/.test(doorProfileConstructionText(style));
}

/**
 * Match one profile word against the construction fields, then (only when they
 * say nothing) against the names. `pattern` is matched case-insensitively.
 */
export function doorProfileMatches(
  style: DoorProfileIdentityInput | null | undefined,
  pattern: RegExp,
): boolean {
  if (pattern.test(doorProfileConstructionText(style))) return true;
  if (doorProfileIsSlabOrGlass(style)) return false;
  return pattern.test(doorProfileNameText(style));
}
