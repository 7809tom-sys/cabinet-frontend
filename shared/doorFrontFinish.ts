/**
 * Painted cabinet fronts vs a framed door photograph.
 *
 * A painted color (white, cream, sage, gray, navy, black, and the rest) stores a
 * hex and often a door photograph. The 3D view was wrapping that photograph onto
 * the fronts, and a tile repeat reprinted the frame across doors, drawers, the
 * box, and the toe kick.
 *
 * Paint renders flat only with a positive paint signal: painted / HDF / MDF /
 * thermofoil, a confirmed hex or Sherwin-Williams paint chip, or a paint color
 * name. A catalog hex is not enough. Wood tones, including Warm Toffee, keep
 * their door photo, mapped once. Zenith Sage still paints because the name is sage.
 */
import type { DoorColorInput } from "./doorColorResolve";
import { isAspenCharcoalIdentity } from "./doorRenderIdentity";
import { isPaintedFinish, type PaintedFinishInput } from "./paintedFinish";
import type { ShakerStyleInput } from "./shakerDoorBlueprint";

export type SolidPaintedShakerInput = ShakerStyleInput & DoorColorInput & PaintedFinishInput & {
  doorPanelType?: string | null;
  doorShape?: string | null;
  styleCode?: string | null;
  code?: string | null;
  grainDirection?: string | null;
  doorColorSource?: string | null;
  checkedDoorSource?: string | null;
  doorColorSourceSelection?: unknown;
  doorColorSourceValue?: unknown;
};

export type DoorFinishFamily = "paint" | "stain" | "unspecified";

export type DoorFinishClassification = {
  family: DoorFinishFamily;
  /** Short reason, safe to show in a review. */
  reason: string;
};

export type DoorFrontTextureWrap = "clamp" | "repeat" | "mirror";

export type DoorFrontTextureMapping = {
  wrap: DoorFrontTextureWrap;
  repeatX: number;
  repeatY: number;
  /** Per-piece grain windows belong on a grain board, not a framed door photo. */
  stampPieceGrain: boolean;
};

function selectionRecord(style: SolidPaintedShakerInput): Record<string, unknown> | null {
  const selection = style.doorColorSourceSelection;
  if (!selection || typeof selection !== "object" || Array.isArray(selection)) return null;
  return selection as Record<string, unknown>;
}

function confirmedSourceName(style: SolidPaintedShakerInput): string {
  const selection = selectionRecord(style);
  const fromSelection = typeof selection?.source === "string" ? selection.source : "";
  return (fromSelection || style.doorColorSource || style.checkedDoorSource || "").trim().toLowerCase();
}

function sherwinFinish(style: SolidPaintedShakerInput): string {
  const selection = selectionRecord(style);
  const selectedColor = selection?.color;
  const fromSelection = selectedColor && typeof selectedColor === "object"
    ? (selectedColor as { finish?: unknown }).finish
    : null;
  const value = style.doorColorSourceValue;
  const fromValue = value && typeof value === "object" && !Array.isArray(value)
    ? (value as { finish?: unknown }).finish
    : null;
  return String(fromSelection ?? fromValue ?? "").trim().toLowerCase();
}

function styleText(style: SolidPaintedShakerInput): string {
  return [style.ourName, style.aliasName, style.name, style.finish, style.woodSpecies, style.color, style.doorStyle]
    .filter((part) => typeof part === "string" && part.trim())
    .join(" ");
}

function isGlassDoor(style: SolidPaintedShakerInput): boolean {
  return /\bglass\b/i.test(`${style.doorStyle ?? ""} ${style.doorPanelType ?? ""} ${style.doorShape ?? ""}`);
}

function hasVisibleGrain(style: SolidPaintedShakerInput): boolean {
  const direction = (style.grainDirection ?? "").trim().toLowerCase();
  return direction === "horizontal" || direction === "vertical" || direction === "vertical-stiles-horizontal-rails";
}

/** Whole-word paint colors. A catalog hex is not one of these. */
const PAINT_COLOR_NAME = /\b(?:white|cream|ivory|alabaster|blanc|dove|gr[ae]y|greige|sage|navy|black|ebony|linen|platinum|cashmere|glacier|arctic|pearl|green|blue)\b/i;

/**
 * Wood tones and stain words. "Solid Birch" alone is not here: Preston paints
 * on a birch substrate. Espresso is a wood tone, so Shaker Espresso keeps its
 * photo unless the finish itself says paint.
 */
const WOOD_TONE_NAME = /\b(?:toffee|honey|caramel|carmel|terra|saddle|chestnut|mocha|espresso|natural|amber|rustic|driftwood|pecan|cherry|walnut|oak|maple|hickory|veneer(?:ed)?|grain|wood|cinnamon|coffee|chocolate|java|butterscotch|unfinished|stained|rift|alder|pine|mahogany|cognac|nutmeg)\b/i;

function hasExplicitPaintFinish(style: SolidPaintedShakerInput): boolean {
  if (isPaintedFinish(style)) return true;
  return /\b(?:thermofoil|thermo[\s-]?foil)\b/i.test(styleText(style));
}

/**
 * Paint, stain, or not enough to decide.
 *
 * Paint requires a positive signal: the finish says painted / HDF / MDF /
 * thermofoil, an admin confirmed a hex or a Sherwin-Williams paint chip, or
 * the name is a paint color (white, cream, sage, gray, navy, black, and the
 * rest). A saved catalog hex or render hex is not enough. Warm Toffee has a
 * tan hex and a veneered birch frame; that hex used to flatten it.
 *
 * Anything else keeps its door photo. Wood-tone names (toffee, honey, oak,
 * espresso, and the rest), a grain direction, or the color resolver's grain
 * flag make that explicit.
 */
export function classifyDoorFinish(style: SolidPaintedShakerInput | null | undefined): DoorFinishClassification {
  if (!style) return { family: "unspecified", reason: "No door style." };
  if (isGlassDoor(style)) return { family: "unspecified", reason: "Glass door. The glass face stays." };
  const source = confirmedSourceName(style);
  const sherwin = sherwinFinish(style);
  if (source === "sherwin-williams" && sherwin === "stain") {
    return { family: "stain", reason: "Sherwin-Williams stain chip." };
  }
  if (isAspenCharcoalIdentity(style)) {
    return { family: "stain", reason: "Aspen Charcoal is a stain." };
  }
  if (hasExplicitPaintFinish(style)) {
    return { family: "paint", reason: "Finish says painted, HDF, MDF, or thermofoil." };
  }
  if (source === "sherwin-williams" && sherwin === "paint") {
    return { family: "paint", reason: "Sherwin-Williams paint chip." };
  }
  const text = styleText(style);
  if (hasVisibleGrain(style)) {
    return { family: "stain", reason: `Grain direction is ${style.grainDirection}.` };
  }
  if (WOOD_TONE_NAME.test(text)) {
    return { family: "stain", reason: "Wood or stain name (toffee, oak, maple, hickory, espresso, and the rest)." };
  }
  if (/\bbirch\b/i.test(style.woodSpecies ?? "") && source === "original-image") {
    return { family: "stain", reason: "Original image on a birch species." };
  }
  if (source === "hex") {
    return { family: "paint", reason: "Confirmed hex color." };
  }
  if (PAINT_COLOR_NAME.test(text)) {
    return { family: "paint", reason: "Paint color name (white, cream, sage, gray, navy, black, and the rest)." };
  }
  return { family: "unspecified", reason: "No positive paint signal. The door photo stays." };
}

/** True when this door renders as a flat painted color instead of its photograph. */
export function prefersSolidPaintedFace(style: SolidPaintedShakerInput | null | undefined): boolean {
  return classifyDoorFinish(style).family === "paint";
}

/** @deprecated Name from the shaker-only rule. Same decision, any door style. */
export function prefersSolidPaintedShakerFace(style: SolidPaintedShakerInput | null | undefined): boolean {
  return prefersSolidPaintedFace(style);
}

/**
 * Frame-free grain (a repeating board), as opposed to a photograph of a whole
 * door. Grain files live under `/grain/` or are named as a vertical/horizontal
 * grain tile. A door photograph is anything else.
 */
export function isFrameFreeGrainTexture(url: string | null | undefined): boolean {
  const name = (url ?? "").trim().toLowerCase();
  if (!name) return false;
  if (name.includes("/grain/")) return true;
  return /(?:^|[/_-])(?:vertical|horizontal)[_-]?grain(?:[./_-]|$)/.test(name)
    || /(?:^|[/_-])grain[_-](?:vertical|horizontal)(?:[./_-]|$)/.test(name);
}

/**
 * How one door or drawer front samples its texture.
 *
 * A door photograph is clamped and mapped once (repeat 1). Repeating it reprints
 * the frame inside the frame. A frame-free grain board keeps its physical tile
 * repeat. A curated grain board stays one tile with repeat wrapping so a piece
 * window can cross the seam.
 */
export function doorFrontTextureMapping(input: {
  sampleUrl?: string | null;
  curatedGrain?: boolean;
  grainRepeat?: { repeatX: number; repeatY: number } | null;
}): DoorFrontTextureMapping {
  const grain = input.curatedGrain === true || isFrameFreeGrainTexture(input.sampleUrl);
  if (!grain) {
    return { wrap: "clamp", repeatX: 1, repeatY: 1, stampPieceGrain: false };
  }
  const tile = input.grainRepeat;
  if (input.curatedGrain !== true && tile && tile.repeatX > 0 && tile.repeatY > 0) {
    return { wrap: "mirror", repeatX: tile.repeatX, repeatY: tile.repeatY, stampPieceGrain: true };
  }
  return { wrap: "repeat", repeatX: 1, repeatY: 1, stampPieceGrain: true };
}
