/**
 * Painted cabinet fronts vs a framed door photograph.
 *
 * A painted color (white, cream, sage, gray, navy, black, and the rest) stores a
 * hex and often a door photograph. The 3D view was wrapping that photograph onto
 * the fronts, and a tile repeat reprinted the frame across doors, drawers, the
 * box, and the toe kick.
 *
 * Paint renders flat, in the saved hex, with the door style's own frame (one
 * shaker outline on a shaker). Stain and wood grain keep their photo, mapped
 * once. The signals are the grain direction, finish category, stain and wood
 * words, and the Sherwin-Williams finish. A color-source choice of "approved AI
 * image" or "original image" does not keep a photograph on a painted color:
 * Zenith Sage was missed that way.
 */
import { matchCabinetColorName } from "./cabinetColorNames";
import { resolveDoorColor, type DoorColorInput } from "./doorColorResolve";
import { isAspenCharcoalIdentity } from "./doorRenderIdentity";
import { isPaintedFinish, type PaintedFinishInput } from "./paintedFinish";
import type { ShakerStyleInput } from "./shakerDoorBlueprint";

const HEX = /^#?[0-9a-f]{6}$/i;

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

function exactHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return HEX.test(text) ? text.toLowerCase() : null;
}

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

function hasSavedPaintColor(style: SolidPaintedShakerInput): boolean {
  if (exactHex(style.renderHex) || exactHex(style.color)) return true;
  const named = matchCabinetColorName(`${style.color ?? ""} ${style.finish ?? ""}`);
  return Boolean(named);
}

/**
 * Paint, stain, or not enough to decide.
 *
 * Stain wins when the row says stain, names a wood the color resolver treats as
 * grain, or stores a real grain direction. "Solid Birch" by itself does not:
 * the Preston painted colors use that species for a painted substrate.
 * Paint wins from an explicit paint finish, a saved hex, or a named paint color.
 * An approved-AI or original-image choice does not keep a photo on a paint row.
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
  if (resolveDoorColor(style).usesGrain) {
    return { family: "stain", reason: "Wood species or name (oak, maple, hickory, walnut, and the rest)." };
  }
  if (!isPaintedFinish(style)) {
    if (hasVisibleGrain(style)) {
      return { family: "stain", reason: `Grain direction is ${style.grainDirection}.` };
    }
    if (/\b(?:unfinished|stained|veneer(?:ed)?)\b/i.test(styleText(style))) {
      return { family: "stain", reason: "Finish or species says unfinished, stained, or veneer." };
    }
    if (/\bbirch\b/i.test(style.woodSpecies ?? "") && source === "original-image") {
      return { family: "stain", reason: "Original image on a birch species." };
    }
  }
  if (isPaintedFinish(style)) {
    return { family: "paint", reason: "Finish says painted, HDF, or MDF." };
  }
  if (source === "hex" || (source === "sherwin-williams" && sherwin === "paint")) {
    return { family: "paint", reason: source === "hex" ? "Confirmed hex color." : "Sherwin-Williams paint chip." };
  }
  if (hasSavedPaintColor(style)) {
    return { family: "paint", reason: exactHex(style.renderHex) ? "Saved render hex." : exactHex(style.color) ? "Saved catalog hex." : "Named paint color." };
  }
  return { family: "unspecified", reason: "No paint color and no stain signal." };
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
