/**
 * Shared door-shape and render-color decisions.
 *
 * Precedence, highest first:
 * 1. An admin doorShape or renderHex. These are explicit corrections and win
 *    over automatic fallbacks.
 * 2. Distributor description text (raised, ogee, cathedral, arch, traditional,
 *    flat panel, recessed, slab, glass) and a stored panelConstruction other
 *    than an empty value. Distributor source beats name guesses and the
 *    Aspen hard-code.
 * 3. Aspen Charcoal / Aspen White (codes AC and AW) stay raised when no
 *    explicit shape and no distributor phrase says otherwise. The old
 *    name-wide Aspen hard-code does not run once doorShape is set.
 * 4. The word "shaker" is a distributor label, not a guess.
 * 5. Anything else is a Shaker guess and is badged in the audit.
 *
 * renderHex wins over a distributor color hex. A distributor hex wins over
 * the name map. The name map wins over the off-white default.
 */
import { CABINET_NAME_COLORS, matchCabinetColorName } from "./cabinetColorNames";
import { DEFAULT_CABINET_HEX } from "./doorRenderLights";
import { sherwinWilliamsColor } from "./sherwinWilliamsColors";

export const PROFILE_GUESSED_LABEL = "Profile guessed (Shaker default)";

export const DOOR_SHAPES = ["raised", "recessed-shaker", "slab", "glass"] as const;
export type DoorShape = (typeof DOOR_SHAPES)[number];
export type DoorProfileSource = "explicit" | "distributor" | "aspen-default" | "guessed";

export type DoorIdentityInput = {
  ourName?: string | null;
  aliasName?: string | null;
  name?: string | null;
  styleCode?: string | null;
  code?: string | null;
  doorStyle?: string | null;
  doorPanelType?: string | null;
  panelConstruction?: string | null;
  doorShape?: string | null;
  profileDescription?: string | null;
  profileNotes?: string | null;
  color?: string | null;
  finish?: string | null;
  woodSpecies?: string | null;
  renderHex?: string | null;
  swatchCode?: string | null;
  swatchHex?: string | null;
};

export type DoorShapeDecision = {
  shape: DoorShape;
  source: DoorProfileSource;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function exactHex(value: unknown): string | null {
  const match = /^#([0-9a-f]{6})$/i.exec(text(value));
  return match ? `#${match[1].toLowerCase()}` : null;
}

export function isAspenRaisedDefault(style: DoorIdentityInput | null | undefined): boolean {
  const name = [style?.ourName, style?.aliasName, style?.name].map(text).join(" ").toLowerCase();
  const code = text(style?.styleCode || style?.code).toUpperCase();
  if (code === "AC" || code === "AW") return true;
  return /\baspen\b/.test(name) && /\b(?:charcoal|white)\b/.test(name);
}

export function isAspenCharcoalIdentity(style: DoorIdentityInput | null | undefined): boolean {
  const name = [style?.ourName, style?.aliasName, style?.name].map(text).join(" ").toLowerCase();
  const code = text(style?.styleCode || style?.code).toUpperCase();
  if (/\baspen\b/.test(name) && /\bcharcoal\b/.test(name)) return true;
  return code === "AC" && /\b(?:aspen|charcoal)\b/.test(name);
}

/** Distributor phrases. "Flat panel" and "recessed" are shaker, not slab. The bare word "flat" is not slab. */
export function parseDistributorDoorShape(description: string): DoorShape | null {
  const source = description.toLowerCase();
  if (!source.trim()) return null;
  if (/\bglass\b/.test(source)) return "glass";
  if (/flat[\s-]?panel|\brecessed\b/.test(source)) return "recessed-shaker";
  if (/\braised\b|\bogee\b|\bcathedral\b|\barch(?:ed)?\b|\btraditional\b/.test(source)) return "raised";
  if (/\bslab\b/.test(source)) return "slab";
  return null;
}

export function resolveDoorShapeDecision(input: DoorIdentityInput | null | undefined): DoorShapeDecision {
  const explicit = text(input?.doorShape).toLowerCase();
  if ((DOOR_SHAPES as readonly string[]).includes(explicit)) {
    return { shape: explicit as DoorShape, source: "explicit" };
  }
  const description = [input?.doorStyle, input?.doorPanelType, input?.profileDescription, input?.profileNotes].map(text).join(" ");
  const parsed = parseDistributorDoorShape(description);
  if (parsed) return { shape: parsed, source: "distributor" };
  const stored = text(input?.panelConstruction).toLowerCase();
  if (stored === "raised" || stored === "slab" || stored === "glass") {
    return { shape: stored === "slab" ? "slab" : stored === "glass" ? "glass" : "raised", source: "distributor" };
  }
  if (isAspenRaisedDefault(input)) return { shape: "raised", source: "aspen-default" };
  if (stored === "flat" || /\bshaker\b/.test(description.toLowerCase())) {
    return { shape: "recessed-shaker", source: "distributor" };
  }
  return { shape: "recessed-shaker", source: "guessed" };
}

/** renderHex, then a distributor hex, then the Aspen Charcoal sample, then the name map. */
export function resolveRenderHex(input: DoorIdentityInput | null | undefined): string | null {
  const override = exactHex(input?.renderHex);
  if (override) return override;
  const supplied = exactHex(input?.color);
  if (supplied) return supplied;
  if (isAspenCharcoalIdentity(input)) return "#2a211c";
  const named = matchCabinetColorName([input?.ourName, input?.name, input?.color, input?.finish, input?.woodSpecies].map(text).join(" "));
  return named;
}

export function resolvedDoorColorHex(input: DoorIdentityInput | null | undefined): string {
  return resolveRenderHex(input) ?? DEFAULT_CABINET_HEX;
}

export function resolveDoorSwatchHex(input: Pick<DoorIdentityInput, "swatchCode" | "swatchHex"> | null | undefined): string | null {
  const eyedropper = exactHex(input?.swatchHex);
  if (eyedropper) return eyedropper;
  return sherwinWilliamsColor(input?.swatchCode)?.hex ?? null;
}

export function doorRenderFingerprint(input: {
  version: string;
  source: DoorProfileSource;
  panel: string | null;
  doorStyle: string | null;
  finishHex: string | null;
  swatch: string | null;
}): string {
  return [
    input.version,
    input.source,
    input.panel ?? "none",
    (input.doorStyle ?? "none").replace(/\|/g, "/"),
    (input.finishHex ?? "none").toLowerCase(),
    (input.swatch ?? "none").toLowerCase(),
  ].join("|").slice(0, 128);
}

export function doorAuditFingerprintForStyle(input: DoorIdentityInput & { version: string }): string {
  const decision = resolveDoorShapeDecision(input);
  const panel = decision.shape === "recessed-shaker" ? "flat" : decision.shape;
  return doorRenderFingerprint({
    version: input.version,
    source: decision.source,
    panel,
    doorStyle: text(input.doorStyle) || decision.shape,
    finishHex: resolvedDoorColorHex(input),
    swatch: resolveDoorSwatchHex(input),
  });
}

export const GRAY_CABINET_HEX = CABINET_NAME_COLORS.gray;
