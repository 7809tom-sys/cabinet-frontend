/**
 * Shadow strength for the Designer's 3D stage.
 *
 * The owner wants one control that takes the room from no shadows at all to the
 * current full strength, so the fixtures read clearly in a top-down view where
 * the cast shadows were hiding the floor.
 *
 * The value is a percentage of the stage's own shadow strength, not an absolute
 * brightness. 100% is exactly what the renderer drew before this control
 * existed; 0% means no cast shadows at all. It is a view preference about this
 * machine's display, like the peninsula-corner-snap feedback switch, so it is
 * remembered in localStorage rather than written into the saved plan. That
 * keeps a plan opened on another computer at that machine's own preference and
 * avoids making the saved-design payload carry presentation state.
 */
export const SHADOW_STRENGTH_PREFERENCE = "cabinetdealz.designer.shadow-strength";

/** Full current strength. Matches `THREE.DirectionalLight.shadow.intensity`. */
export const SHADOW_STRENGTH_MAX = 100;

export type ShadowStrength = number;

/** Parses anything (a stored string, a slider value) into 0–100. */
export function normalizeShadowStrength(value: unknown): ShadowStrength {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? "").trim());
  if (!Number.isFinite(parsed)) return SHADOW_STRENGTH_MAX;
  return Math.min(SHADOW_STRENGTH_MAX, Math.max(0, Math.round(parsed)));
}

/**
 * The multiplier the renderer applies to its own shadow strength. 1 at 100%,
 * 0 at 0%. Kept separate from the percentage so the 3D code never has to know
 * how the value is displayed.
 */
export function shadowStrengthScale(percent: ShadowStrength): number {
  return normalizeShadowStrength(percent) / SHADOW_STRENGTH_MAX;
}

/** Reads the saved preference. Anything unreadable falls back to full strength. */
export function readShadowStrengthPreference(storage?: Pick<Storage, "getItem"> | null): ShadowStrength {
  const target = storage ?? (typeof window === "undefined" ? null : window.localStorage);
  if (!target) return SHADOW_STRENGTH_MAX;
  try {
    const stored = target.getItem(SHADOW_STRENGTH_PREFERENCE);
    if (stored == null) return SHADOW_STRENGTH_MAX;
    return normalizeShadowStrength(stored);
  } catch {
    return SHADOW_STRENGTH_MAX;
  }
}

/** Saves the preference. Storage failures are non-fatal — the session keeps the value. */
export function writeShadowStrengthPreference(percent: ShadowStrength, storage?: Pick<Storage, "setItem"> | null): void {
  const target = storage ?? (typeof window === "undefined" ? null : window.localStorage);
  if (!target) return;
  try {
    target.setItem(SHADOW_STRENGTH_PREFERENCE, String(normalizeShadowStrength(percent)));
  } catch {
    /* storage full or unavailable — the live session still uses the value */
  }
}

/** "Shadows 60%" — the control's spoken and tooltip value. */
export function shadowStrengthLabel(percent: ShadowStrength): string {
  return `Shadows ${normalizeShadowStrength(percent)}%`;
}

/** What the slider means at its two ends, so the tooltip is unambiguous. */
export function shadowStrengthDescription(percent: ShadowStrength): string {
  const value = normalizeShadowStrength(percent);
  if (value === 0) return "Shadows off — no cast shadows in the 3D view";
  if (value === SHADOW_STRENGTH_MAX) return "Shadows at full strength";
  return `Shadows at ${value}% of full strength`;
}
