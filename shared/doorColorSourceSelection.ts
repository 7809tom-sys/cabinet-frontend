/**
 * One door color source per door style (Tom, Nov 12 2026, by voice).
 *
 * The door editor used to offer several separate color controls: the render hex
 * field and photo eyedropper, the Sherwin-Williams stain and paint wheels in the
 * WalzCraft wizard (PR 229), and the AI render path (Door Rendering Audit, which
 * uses the Gemini image provider). They now sit behind ONE selector with four
 * mutually exclusive options:
 *
 *   1. original-image     the supplier-uploaded door photo, "the truth". DEFAULT.
 *   2. approved-ai-image  the accepted AI render for this style.
 *   3. sherwin-williams   a Sherwin-Williams stain or paint chip, once CONFIRMED.
 *   4. hex                a hand-picked hex, once CONFIRMED.
 *   paint-brand           a colorimeter match (brand, code, name, hex), once CONFIRMED.
 *                         It paints like a confirmed hex. The four tiles stay as they are.
 *
 * Rule (docs/rules/DOOR_COLOR_SOURCE_RULE.md): image first; any other color only
 * when someone explicitly chooses it. Sherwin-Williams and Hex only count after the
 * Confirm button ("that's the one"). An unconfirmed pick is never stored, so the
 * door falls back to the supplier photo.
 *
 * This module only decides WHICH source a door uses. It never starts, changes or
 * calls AI image generation.
 *
 * Storage: the confirmed choice lives on door_styles (doorColorSource,
 * doorColorSourceValue, doorColorSourceUpdatedAt; cabinet-backend 0280). The
 * browser record (`doorColorSourceSelection.v1`) is a fallback and a cache only.
 * A missing or NULL server value, and a missing browser record, both mean
 * "nothing chosen": the door keeps its current color order.
 */
import { PAINT_FINISH, STAIN_FINISH, type WizardFinish } from "./sherwinWilliamsStain";

export const DOOR_COLOR_SOURCE_STORAGE_KEY = "doorColorSourceSelection.v1";

export const DOOR_COLOR_SOURCES = ["original-image", "approved-ai-image", "sherwin-williams", "hex"] as const;
export type DoorColorSourceOption = (typeof DOOR_COLOR_SOURCES)[number];

export const DEFAULT_DOOR_COLOR_SOURCE: DoorColorSourceOption = "original-image";

export const DOOR_COLOR_SOURCE_LABELS: Record<DoorColorSourceOption, string> = {
  "original-image": "Original image",
  "approved-ai-image": "Approved AI image",
  "sherwin-williams": "Sherwin-Williams",
  hex: "Hex",
};

/**
 * Paint brands a Color Muse 3 colorimeter can match. The door editor's paint
 * brand control offers exactly these six, and no others.
 */
export const PAINT_BRANDS = [
  "Sherwin-Williams",
  "Behr",
  "Benjamin Moore",
  "Valspar",
  "PPG",
  "Clark + Kensington",
] as const;
export type PaintBrand = (typeof PAINT_BRANDS)[number];

/** The four picture tiles, plus the paint-brand form (not a fifth tile). */
export type DoorColorSourceActive = DoorColorSourceOption | "paint-brand";

export function isPaintBrand(value: unknown): value is PaintBrand {
  return typeof value === "string" && (PAINT_BRANDS as readonly string[]).includes(value);
}

/** Options that only take effect after Confirm. */
export function needsConfirm(source: DoorColorSourceActive): boolean {
  return source === "sherwin-williams" || source === "hex" || source === "paint-brand";
}

export type SherwinWilliamsChoice = {
  finish: WizardFinish;
  code: string;
  label: string;
  hex: string;
  woodSpecies: string | null;
  grainDirection: "horizontal" | "vertical" | "none";
  profileImageUrl: string | null;
};

/**
 * A confirmed paint-brand color. `kind` is the marker stored inside the color
 * source JSON (`doorColorSourceValue`), next to the hex the 3D view paints.
 */
export type PaintBrandColor = {
  kind: "paint-brand";
  brand: PaintBrand;
  code: string;
  name: string;
  hex: string;
};

/** What is stored. Only explicit, confirmed choices are ever written. */
export type DoorColorSourceSelection =
  | { source: "original-image"; chosenAt: string }
  | { source: "approved-ai-image"; chosenAt: string }
  | { source: "sherwin-williams"; confirmed: true; chosenAt: string; color: SherwinWilliamsChoice }
  | { source: "hex"; confirmed: true; chosenAt: string; hex: string }
  | ({ source: "paint-brand"; confirmed: true; chosenAt: string } & PaintBrandColor);

/**
 * What `adminUpdateDoorStyle` is sent. A paint brand is a confirmed hex (the
 * path the live API already accepts, which also sets renderHex) with the brand
 * record on the same object so it can live in `doorColorSourceValue`.
 */
export type DoorColorSourceSaveSelection =
  | Exclude<DoorColorSourceSelection, { source: "paint-brand" }>
  | ({ source: "hex"; confirmed: true; chosenAt: string } & PaintBrandColor);

type ReadStorage = Pick<Storage, "getItem">;
type WriteStorage = Pick<Storage, "getItem" | "setItem">;

const HEX = /^#[0-9a-f]{6}$/i;

export function normalizeHex(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  return HEX.test(text) ? text.toLowerCase() : null;
}

function defaultStorage(): Storage | undefined {
  try {
    return typeof globalThis.localStorage === "undefined" ? undefined : globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function readAll(storage: ReadStorage | undefined): Record<string, unknown> {
  if (!storage) return {};
  try {
    const all = JSON.parse(storage.getItem(DOOR_COLOR_SOURCE_STORAGE_KEY) ?? "{}");
    return all && typeof all === "object" && !Array.isArray(all) ? (all as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function textField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Validates a paint-brand record. A bad brand, a blank code or name, or a hex
 * that is not `#RRGGBB` reads as "nothing chosen".
 */
export function parsePaintBrandColor(raw: unknown, chosenAt = ""): ({ source: "paint-brand"; confirmed: true; chosenAt: string } & PaintBrandColor) | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (record.kind != null && record.kind !== "paint-brand") return null;
  if (record.confirmed != null && record.confirmed !== true) return null;
  const brand = record.brand;
  const code = textField(record.code);
  const name = textField(record.name);
  const hex = normalizeHex(typeof record.hex === "string" ? record.hex : undefined);
  if (!isPaintBrand(brand) || !code || !name || !hex) return null;
  const when = textField(record.chosenAt) || chosenAt;
  return { source: "paint-brand", confirmed: true, chosenAt: when, kind: "paint-brand", brand, code, name, hex };
}

/** The confirmed paint-brand record, or null when the fields are not valid yet. */
export function serializePaintBrandColor(input: {
  brand: unknown;
  code: unknown;
  name: unknown;
  hex: unknown;
  chosenAt?: string;
}): ({ source: "paint-brand"; confirmed: true; chosenAt: string } & PaintBrandColor) | null {
  return parsePaintBrandColor({
    kind: "paint-brand",
    confirmed: true,
    brand: input.brand,
    code: input.code,
    name: input.name,
    hex: input.hex,
    chosenAt: input.chosenAt ?? "",
  });
}

/**
 * The object written through `adminUpdateDoorStyle.doorColorSourceSelection`.
 * Paint brand keeps `source: "hex"` so the current API accepts it, and puts
 * `{ kind, brand, code, name, hex }` on that same object for `doorColorSourceValue`.
 */
export function doorColorSourceSelectionForSave(selection: DoorColorSourceSelection): DoorColorSourceSaveSelection {
  if (selection.source !== "paint-brand") return selection;
  return {
    source: "hex",
    confirmed: true,
    chosenAt: selection.chosenAt,
    kind: "paint-brand",
    brand: selection.brand,
    code: selection.code,
    name: selection.name,
    hex: selection.hex,
  };
}

/** Validates one stored record. Anything malformed or unconfirmed reads as "nothing chosen". */
export function parseDoorColorSourceSelection(raw: unknown): DoorColorSourceSelection | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const chosenAt = typeof record.chosenAt === "string" ? record.chosenAt : "";
  switch (record.source) {
    case "original-image":
    case "approved-ai-image":
      return { source: record.source, chosenAt };
    case "paint-brand":
      if (record.confirmed !== true) return null;
      return parsePaintBrandColor({ ...record, kind: "paint-brand" }, chosenAt);
    case "hex": {
      if (record.kind === "paint-brand") {
        if (record.confirmed !== true) return null;
        return parsePaintBrandColor(record, chosenAt);
      }
      const hex = normalizeHex(record.hex as string | undefined);
      if (record.confirmed !== true || !hex) return null;
      return { source: "hex", confirmed: true, chosenAt, hex };
    }
    case "sherwin-williams": {
      const color = record.color as Partial<SherwinWilliamsChoice> | undefined;
      const hex = normalizeHex(color?.hex);
      if (record.confirmed !== true || !color || !hex) return null;
      if (color.finish !== STAIN_FINISH && color.finish !== PAINT_FINISH) return null;
      return {
        source: "sherwin-williams",
        confirmed: true,
        chosenAt,
        color: {
          finish: color.finish,
          code: typeof color.code === "string" ? color.code : "",
          label: typeof color.label === "string" ? color.label : "",
          hex,
          woodSpecies: color.woodSpecies ?? null,
          grainDirection: color.grainDirection === "horizontal" || color.grainDirection === "vertical" ? color.grainDirection : "none",
          profileImageUrl: color.profileImageUrl ?? null,
        },
      };
    }
    default:
      return null;
  }
}

export function readDoorColorSourceSelection(
  styleId: number | string | null | undefined,
  storage: ReadStorage | undefined = defaultStorage(),
): DoorColorSourceSelection | null {
  if (styleId == null) return null;
  return parseDoorColorSourceSelection(readAll(storage)[String(styleId)]);
}

/** Writes (or, with null, clears) the explicit choice for one style. */
export function writeDoorColorSourceSelection(
  styleId: number | string,
  selection: DoorColorSourceSelection | null,
  storage: WriteStorage | undefined = defaultStorage(),
): DoorColorSourceSelection | null {
  if (!storage) return selection;
  try {
    const all = readAll(storage);
    if (selection) all[String(styleId)] = selection;
    else delete all[String(styleId)];
    storage.setItem(DOOR_COLOR_SOURCE_STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* A full or blocked store leaves the door on its supplier photo. */
  }
  return selection;
}

/** Server columns (and an optional assembled object) for one door style. All optional so a missing field never crashes. */
export type DoorColorSourceServerFields = {
  doorColorSource?: string | null;
  doorColorSourceValue?: unknown;
  doorColorSourceUpdatedAt?: string | Date | null;
  doorColorSourceSelection?: unknown;
};

function chosenAtFrom(value: Date | string | null | undefined): string {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  return "";
}

/**
 * Read a confirmed choice from server fields. Missing, NULL, or malformed fields
 * return null and never throw, so an older backend without the column is safe.
 */
export function selectionFromServerFields(
  fields: DoorColorSourceServerFields | null | undefined,
): DoorColorSourceSelection | null {
  if (!fields) return null;
  try {
    const assembled = parseDoorColorSourceSelection(fields.doorColorSourceSelection);
    if (assembled) return assembled;
    if (fields.doorColorSource == null || fields.doorColorSource === "") return null;
    const chosenAt = chosenAtFrom(fields.doorColorSourceUpdatedAt);
    switch (fields.doorColorSource) {
      case "original-image":
      case "approved-ai-image":
        return parseDoorColorSourceSelection({ source: fields.doorColorSource, chosenAt });
      case "hex": {
        const value = fields.doorColorSourceValue;
        if (value && typeof value === "object" && !Array.isArray(value) && (value as { kind?: unknown }).kind === "paint-brand") {
          const paint = parseDoorColorSourceSelection({ source: "paint-brand", confirmed: true, chosenAt, ...value });
          if (paint) return paint;
        }
        const hex = typeof value === "string"
          ? value
          : value && typeof value === "object" && !Array.isArray(value)
            ? (value as { hex?: unknown }).hex
            : undefined;
        return parseDoorColorSourceSelection({ source: "hex", confirmed: true, chosenAt, hex });
      }
      case "paint-brand": {
        const value = fields.doorColorSourceValue;
        const record = value && typeof value === "object" && !Array.isArray(value) ? value : {};
        return parseDoorColorSourceSelection({ source: "paint-brand", confirmed: true, chosenAt, kind: "paint-brand", ...record });
      }
      case "sherwin-williams":
        return parseDoorColorSourceSelection({
          source: "sherwin-williams",
          confirmed: true,
          chosenAt,
          color: fields.doorColorSourceValue,
        });
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * Prefer the server's confirmed choice; fall back to the browser cache when the
 * server has nothing (or the field is absent). A server value wins over a stale cache.
 */
export function selectionForStyle(
  style: (DoorColorSourceServerFields & { id?: number | string | null }) | null | undefined,
  storage: ReadStorage | undefined = defaultStorage(),
): DoorColorSourceSelection | null {
  const fromServer = selectionFromServerFields(style);
  const cached = readDoorColorSourceSelection(style?.id ?? null, storage);
  // The live API stores a paint brand as a confirmed hex and drops kind/brand/code/name
  // until cabinet-backend writes them into doorColorSourceValue. The browser cache
  // still has the full record; use it when the saved hex is the same one.
  if (
    cached?.source === "paint-brand"
    && fromServer?.source === "hex"
    && fromServer.hex === cached.hex
  ) {
    return { ...cached, chosenAt: fromServer.chosenAt || cached.chosenAt };
  }
  if (fromServer) return fromServer;
  return cached;
}

export type AcceptedAiAvailability = {
  approvedVersionId?: number | null;
  approvedReferenceImageUrl?: string | null;
  /** The official AI (Gemini) profile picture saved in the editor (0281). */
  aiProfileImageUrl?: string | null;
};

/** True when this style has an accepted AI render. */
export function hasAcceptedAiRender(style: AcceptedAiAvailability | null | undefined): boolean {
  return Boolean(style && style.approvedVersionId != null && (style.approvedReferenceImageUrl ?? "").trim());
}

/**
 * True when 3D can use an AI picture for this style: an accepted render, or a saved
 * Gemini picture (the official AI profile picture). Either one makes the Approved AI
 * tile pickable.
 */
export function hasApprovedAiImage(style: AcceptedAiAvailability | null | undefined): boolean {
  return hasAcceptedAiRender(style) || Boolean(style && (style.aiProfileImageUrl ?? "").trim());
}

/** A capture made by the door-rendering audit, not a picture: `.../door-rendering-audit/style-N/run-V_hash.png`. */
export function isAuditRunCapture(url: string | null | undefined): boolean {
  return /\/door-rendering-audit\/[^?#]*\/run-[^/?#]*\.(?:png|jpe?g|webp)(?:[?#]|$)/i.test((url ?? "").trim());
}

export type AiTilePicture = {
  url: string | null;
  /** Where the picture came from: the saved Gemini picture, or an accepted render. */
  source: "gemini" | "approved-render" | null;
  /** True when the only approved image is a rendering-audit capture, which is never shown as a Gemini picture. */
  auditCaptureOnly: boolean;
};

/**
 * The picture the Approved AI tile shows. The saved Gemini picture (0281) wins over an older
 * approved image. A rendering-audit capture is our own renderer's output, so it is not a
 * Gemini picture and is never used here (Tom, Nov 18 2026: a blank capture drew a white tile).
 */
export function aiTilePicture(style: AcceptedAiAvailability | null | undefined): AiTilePicture {
  const gemini = (style?.aiProfileImageUrl ?? "").trim();
  if (gemini) return { url: gemini, source: "gemini", auditCaptureOnly: false };
  const approved = (style?.approvedReferenceImageUrl ?? "").trim();
  if (approved && !isAuditRunCapture(approved)) return { url: approved, source: "approved-render", auditCaptureOnly: false };
  return { url: null, source: null, auditCaptureOnly: Boolean(approved) };
}

export type EffectiveDoorColorSource = {
  /** The source the door actually uses. */
  source: DoorColorSourceOption;
  /** The option someone explicitly chose, or null when nothing was chosen. */
  chosen: DoorColorSourceOption | null;
  /** True when the choice could not be honored and the door fell back to its supplier photo. */
  fellBack: boolean;
  note: string;
};

/**
 * Which source wins for a door. An explicit, confirmed choice wins; nothing chosen
 * means the supplier photo. An Approved AI image choice with no accepted render
 * falls back to the supplier photo and says so.
 */
export function effectiveDoorColorSource(
  selection: DoorColorSourceSelection | null | undefined,
  style?: AcceptedAiAvailability | null,
): EffectiveDoorColorSource {
  if (!selection) {
    return { source: DEFAULT_DOOR_COLOR_SOURCE, chosen: null, fellBack: false, note: "Nothing chosen: the supplier photo is used." };
  }
  // A paint brand paints the same way a confirmed hex does. The brand record
  // stays on the selection; the four tiles keep their existing sources.
  if (selection.source === "paint-brand") {
    return {
      source: "hex",
      chosen: "hex",
      fellBack: false,
      note: `${selection.brand} ${selection.code} ${selection.name} confirmed.`,
    };
  }
  if (selection.source === "approved-ai-image" && !hasApprovedAiImage(style)) {
    return {
      source: DEFAULT_DOOR_COLOR_SOURCE,
      chosen: selection.source,
      fellBack: true,
      note: "No accepted AI render exists for this door yet, so the supplier photo is used.",
    };
  }
  const label = DOOR_COLOR_SOURCE_LABELS[selection.source];
  return { source: selection.source, chosen: selection.source, fellBack: false, note: `${label} chosen explicitly.` };
}

/** The hex an explicit Sherwin-Williams, Hex, or paint-brand choice paints, or null for image sources. */
export function selectedDoorHex(selection: DoorColorSourceSelection | null | undefined): string | null {
  if (!selection) return null;
  if (selection.source === "hex" || selection.source === "paint-brand") return selection.hex;
  if (selection.source === "sherwin-williams") return selection.color.hex;
  return null;
}

/**
 * The style fields the color resolver should see for this choice.
 *
 * Original image is the DEFAULT, not an override: when the style has an accepted
 * render, that render still wins - approval is the alternative Tom signed off on,
 * and the supplier photo is only the fallback. A hand-typed render hex is still
 * removed for Original image, so a typed color can never tint the photo.
 *
 * With Hex or Sherwin-Williams the confirmed hex is the render hex. With Approved
 * AI image the style is unchanged.
 */
export function styleForDoorColorSource<T extends { renderHex?: string | null; approvedVersionId?: number | null; approvedReferenceImageUrl?: string | null }>(
  style: T,
  selection: DoorColorSourceSelection | null | undefined,
): T {
  const effective = effectiveDoorColorSource(selection, style);
  if (effective.source === "original-image") {
    const acceptedRender = style.approvedVersionId != null && (style.approvedReferenceImageUrl ?? "").trim() !== "";
    // An accepted render survives the default: approving one is an explicit choice
    // on its own, and the supplier photo is the fallback, not a veto.
    if (acceptedRender) return style;
    return { ...style, renderHex: null, approvedVersionId: null, approvedReferenceImageUrl: null };
  }
  const hex = selectedDoorHex(selection);
  if (hex) return { ...style, renderHex: hex, approvedVersionId: null };
  return style;
}

/**
 * The style as the finish resolver should see it: a confirmed Sherwin-Williams or hex
 * choice becomes the render hex (and clears an accepted-run flag so it cannot outrank
 * the pick), so a cabinet's finish color matches the door face the choice paints.
 * Every other choice (Original, Approved AI, nothing) leaves the style untouched.
 * Reads the server fields first, then the browser cache, like `selectionForStyle`.
 */
export function styleWithChosenColorHex<T extends { renderHex?: string | null; approvedVersionId?: number | null }>(
  style: T,
): T {
  if (!style) return style;
  const hex = selectedDoorHex(selectionForStyle(style as unknown as DoorColorSourceServerFields & { id?: number | string | null }));
  return hex ? { ...style, renderHex: hex, approvedVersionId: null } : style;
}

// ── The checkmark decides the door color (Tom, Nov 20 2026, voice) ──────────────

export type CheckedDoorImageInput = DoorColorSourceServerFields & AcceptedAiAvailability & {
  id?: number | string | null;
  renderHex?: string | null;
  doorSampleImageUrl?: string | null;
  thumbnailImageUrl?: string | null;
  checkedDoorSource?: "uploaded-sample" | "ai-image" | "hex" | "sherwin-williams" | null;
  uploadedSampleHex?: string | null;
  aiImageHex?: string | null;
};

/** Reads a sampled color for an image URL (the browser cache), or null when not sampled yet. */
export type DoorImageHexReader = (url: string) => string | null | undefined;

/** The uploaded sample photo: the door sample, else the thumbnail. */
export function uploadedSampleUrl(style: CheckedDoorImageInput | null | undefined): string | null {
  return (style?.doorSampleImageUrl ?? "").trim() || (style?.thumbnailImageUrl ?? "").trim() || null;
}

/**
 * Which source carries the checkmark. "Approved AI image" with no AI picture falls
 * back to the uploaded sample, which is what the picker shows in that case.
 */
export function checkedDoorSourceFor(
  style: CheckedDoorImageInput | null | undefined,
  storage?: ReadStorage,
): CheckedDoorImageInput["checkedDoorSource"] {
  if (!style) return null;
  const selection = storage === undefined ? selectionForStyle(style) : selectionForStyle(style, storage);
  if (!selection) return null;
  // Paint brand is a confirmed hex for the renderer: the image checkmark stays off
  // so the saved hex, not the supplier photo, decides the door color.
  if (selection.source === "paint-brand") return "hex";
  if (selection.source === "hex" || selection.source === "sherwin-williams") return selection.source;
  if (selection.source === "approved-ai-image" && hasApprovedAiImage(style)) return "ai-image";
  return "uploaded-sample";
}

/**
 * The style as every door-color reader should see it: which source is checkmarked,
 * and the colors of the two door images, taken from the images themselves.
 *
 * - uploadedSampleHex: the browser sample of the uploaded sample photo.
 * - aiImageHex: for a saved Gemini picture (the official AI image), the browser
 *   sample of that picture, else the render hex PR 475 sampled when it was chosen.
 *   An accepted render keeps its own layer (its derived color) in the resolver.
 *
 * Nothing is invented: an image nobody has sampled yet gives null. Fields already
 * on the style win, so calling this twice changes nothing.
 */
export function styleWithCheckedDoorImage<T extends CheckedDoorImageInput>(
  style: T,
  sampled?: DoorImageHexReader,
  storage?: ReadStorage,
): T {
  if (!style) return style;
  const read = (url: string | null | undefined) => {
    const key = (url ?? "").trim();
    return key && sampled ? normalizeHex(sampled(key) ?? null) : null;
  };
  const tile = aiTilePicture(style);
  const uploadedSampleHex = normalizeHex(style.uploadedSampleHex) ?? read(uploadedSampleUrl(style));
  const aiImageHex = normalizeHex(style.aiImageHex)
    ?? (tile.source === "gemini" ? read(tile.url) ?? normalizeHex(style.renderHex) : null);
  const checkedDoorSource = style.checkedDoorSource ?? checkedDoorSourceFor(style, storage) ?? null;
  // Nothing to add: hand the same object back, so memoised readers see no change.
  if (!checkedDoorSource && !uploadedSampleHex && !aiImageHex
    && style.checkedDoorSource == null && style.uploadedSampleHex == null && style.aiImageHex == null) return style;
  return { ...style, checkedDoorSource, uploadedSampleHex, aiImageHex };
}

// ── Selector state (pure, so the door editor and tests share one behavior) ──────

export type PaintBrandDraft = {
  brand: PaintBrand | "";
  code: string;
  name: string;
  hex: string;
};

export type DoorColorSourceDraft = {
  /** What is stored for the style: only explicit, confirmed choices. */
  stored: DoorColorSourceSelection | null;
  /** The option highlighted in the selector. Exactly one at a time. */
  active: DoorColorSourceActive;
  /** A Hex pick that has not been confirmed yet. */
  pendingHex: string | null;
  /** A Sherwin-Williams pick that has not been confirmed yet. */
  pendingSherwin: SherwinWilliamsChoice | null;
  /** A paint-brand pick that has not been confirmed yet. */
  pendingPaint: PaintBrandDraft | null;
  notice: string | null;
};

export type DoorColorSourceAction =
  | { type: "choose"; option: DoorColorSourceActive; aiAvailable: boolean; now: string; hexSeed?: string | null }
  | { type: "pendingHex"; hex: string }
  | { type: "pendingSherwin"; color: SherwinWilliamsChoice | null }
  | { type: "pendingPaint"; patch: Partial<PaintBrandDraft> }
  | { type: "confirm"; now: string }
  /** Leaving the selector (dialog closed) without confirming turns the toggle back off. */
  | { type: "abandon" }
  | { type: "reset"; stored: DoorColorSourceSelection | null };

export function initialDoorColorSourceDraft(stored: DoorColorSourceSelection | null): DoorColorSourceDraft {
  return {
    stored,
    active: stored?.source ?? DEFAULT_DOOR_COLOR_SOURCE,
    pendingHex: null,
    pendingSherwin: null,
    pendingPaint: null,
    notice: null,
  };
}

function blankPaintDraft(hex = ""): PaintBrandDraft {
  return { brand: "", code: "", name: "", hex };
}

function paintDraftFromState(state: DoorColorSourceDraft): PaintBrandDraft {
  if (state.pendingPaint) return state.pendingPaint;
  if (state.stored?.source === "paint-brand") {
    return { brand: state.stored.brand, code: state.stored.code, name: state.stored.name, hex: state.stored.hex };
  }
  return blankPaintDraft();
}

export function doorColorSourceReducer(state: DoorColorSourceDraft, action: DoorColorSourceAction): DoorColorSourceDraft {
  switch (action.type) {
    case "reset":
      return initialDoorColorSourceDraft(action.stored);
    case "choose": {
      const option = action.option;
      const base = { ...state, active: option, pendingHex: null, pendingSherwin: null, pendingPaint: null, notice: null };
      if (option === "original-image") {
        return { ...base, stored: { source: "original-image", chosenAt: action.now } };
      }
      if (option === "approved-ai-image") {
        if (!action.aiAvailable) {
          return {
            ...base,
            notice: "There is no accepted AI render for this door yet. The door keeps its supplier photo until a render is made and accepted.",
            // Mutually exclusive: the previous choice is turned off and the supplier photo is used.
            stored: { source: "original-image", chosenAt: action.now },
          };
        }
        return { ...base, stored: { source: "approved-ai-image", chosenAt: action.now } };
      }
      // Re-choosing the already confirmed option keeps it.
      if (state.stored?.source === option) return { ...base, notice: null };
      if (option === "paint-brand") {
        return {
          ...base,
          pendingPaint: blankPaintDraft(normalizeHex(action.hexSeed) ?? ""),
          stored: { source: "original-image", chosenAt: action.now },
          notice: "Enter a paint brand, color code, color name and hex, then press Confirm. Until then the door uses its supplier photo.",
        };
      }
      // Until Confirm, the door uses the supplier photo.
      return {
        ...base,
        stored: { source: "original-image", chosenAt: action.now },
        notice: `Pick a ${DOOR_COLOR_SOURCE_LABELS[option]} color, then press Confirm. Until then the door uses its supplier photo.`,
      };
    }
    case "pendingHex":
      return state.active === "hex" ? { ...state, pendingHex: action.hex.trim(), notice: null } : state;
    case "pendingSherwin":
      return state.active === "sherwin-williams" ? { ...state, pendingSherwin: action.color, notice: null } : state;
    case "pendingPaint":
      return state.active === "paint-brand"
        ? { ...state, pendingPaint: { ...paintDraftFromState(state), ...action.patch }, notice: null }
        : state;
    case "confirm": {
      if (state.active === "hex") {
        const hex = normalizeHex(state.pendingHex);
        if (!hex) return { ...state, notice: "Enter a 6-digit hex like #2a211c before confirming." };
        return { ...state, stored: { source: "hex", confirmed: true, chosenAt: action.now, hex }, pendingHex: null, notice: `Confirmed ${hex}.` };
      }
      if (state.active === "sherwin-williams") {
        const color = state.pendingSherwin;
        if (!color || !normalizeHex(color.hex)) return { ...state, notice: "Pick and apply a Sherwin-Williams color before confirming." };
        return {
          ...state,
          stored: { source: "sherwin-williams", confirmed: true, chosenAt: action.now, color: { ...color, hex: normalizeHex(color.hex)! } },
          pendingSherwin: null,
          notice: `Confirmed ${color.label || color.code || color.hex}.`,
        };
      }
      if (state.active === "paint-brand") {
        const draft = state.pendingPaint;
        if (!draft || !isPaintBrand(draft.brand)) return { ...state, notice: "Choose a paint brand before confirming." };
        if (!draft.code.trim() || !draft.name.trim()) return { ...state, notice: "Enter a color code and a color name before confirming." };
        const stored = serializePaintBrandColor({ ...draft, chosenAt: action.now });
        if (!stored) return { ...state, notice: "Enter a 6-digit hex like #f2f0ea before confirming." };
        return { ...state, stored, pendingPaint: null, notice: `Confirmed ${stored.brand} ${stored.code} ${stored.name}.` };
      }
      return state;
    }
    case "abandon": {
      if (!needsConfirm(state.active) || state.stored?.source === state.active) return state;
      return { ...state, active: state.stored?.source ?? DEFAULT_DOOR_COLOR_SOURCE, pendingHex: null, pendingSherwin: null, pendingPaint: null, notice: null };
    }
    default:
      return state;
  }
}

/** True when the active Sherwin-Williams or Hex option is still waiting for Confirm. */
export function awaitingConfirm(state: DoorColorSourceDraft): boolean {
  return needsConfirm(state.active) && state.stored?.source !== state.active;
}

/**
 * Turns a failed save into a message an operator can act on. The door color
 * source columns arrive with cabinet-backend migration 0280; until that SQL is
 * run the backend reports it, and the editor says so plainly instead of showing
 * a generic failure.
 */
export function doorColorSourceSaveMessage(message: string | null | undefined): string {
  const text = (message ?? "").trim();
  if (/0280|migration/i.test(text)) {
    return "Door color source was not saved: the 0280 SQL has not been run yet. Run the 0280 migration (the door_styles doorColorSource columns) on the database, then save again.";
  }
  return text || "The door style was not saved. Try again.";
}
