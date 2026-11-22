/**
 * Painted shaker fronts vs a framed door photograph.
 *
 * A cream/off-white shaker stores a color (render hex, catalog hex, a confirmed
 * Sherwin-Williams paint chip, or a confirmed hex) and the face plan already
 * paints that hex with no grain. The 3D view was still wrapping the style's door
 * photograph onto every front. That photograph contains its own frame, and the
 * grain-tile repeat (faceTileIn) stamped it many times, so each door looked like
 * doors inside doors. Box, face-frame, and toe-kick surfaces picked up the same
 * picture.
 *
 * A shaker with one of those saved colors renders flat, in that color, with the
 * single built shaker outline. A stained or wood-grain style keeps its photo.
 * A door photograph is never tiled: one copy, clamped, per front. Frame-free
 * grain boards still repeat.
 */
import { resolveDoorColor, type DoorColorInput } from "./doorColorResolve";
import { shakerDoorFamily, type ShakerStyleInput } from "./shakerDoorBlueprint";

const HEX = /^#?[0-9a-f]{6}$/i;

export type SolidPaintedShakerInput = ShakerStyleInput & DoorColorInput & {
  doorColorSource?: string | null;
  checkedDoorSource?: string | null;
  doorColorSourceSelection?: unknown;
  doorColorSourceValue?: unknown;
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

/**
 * True when this shaker should render as a flat painted color instead of its
 * door photograph.
 *
 * An explicit original-image or approved-AI choice keeps the photograph (mapped
 * once). An explicit hex or Sherwin-Williams paint choice is solid. Otherwise a
 * shaker that is not a stain and that has a saved render hex or catalog hex is
 * solid. Wood-grain and stained shakers stay on the photo.
 */
export function prefersSolidPaintedShakerFace(style: SolidPaintedShakerInput | null | undefined): boolean {
  if (!style) return false;
  if (shakerDoorFamily(style) === "other") return false;
  const source = confirmedSourceName(style);
  if (source === "original-image" || source === "approved-ai-image" || source === "uploaded-sample" || source === "ai-image") {
    return false;
  }
  if (source === "hex") return true;
  if (source === "sherwin-williams") {
    const finish = sherwinFinish(style);
    if (finish === "stain") return false;
    if (finish === "paint") return true;
  }
  if (resolveDoorColor(style).usesGrain) return false;
  return Boolean(exactHex(style.renderHex) || exactHex(style.color));
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
