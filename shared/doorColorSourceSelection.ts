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

/** Options that only take effect after Confirm. */
export function needsConfirm(source: DoorColorSourceOption): boolean {
  return source === "sherwin-williams" || source === "hex";
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

/** What is stored. Only explicit, confirmed choices are ever written. */
export type DoorColorSourceSelection =
  | { source: "original-image"; chosenAt: string }
  | { source: "approved-ai-image"; chosenAt: string }
  | { source: "sherwin-williams"; confirmed: true; chosenAt: string; color: SherwinWilliamsChoice }
  | { source: "hex"; confirmed: true; chosenAt: string; hex: string };

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

/** Validates one stored record. Anything malformed or unconfirmed reads as "nothing chosen". */
export function parseDoorColorSourceSelection(raw: unknown): DoorColorSourceSelection | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const chosenAt = typeof record.chosenAt === "string" ? record.chosenAt : "";
  switch (record.source) {
    case "original-image":
    case "approved-ai-image":
      return { source: record.source, chosenAt };
    case "hex": {
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
        const hex = typeof value === "string"
          ? value
          : value && typeof value === "object" && !Array.isArray(value)
            ? (value as { hex?: unknown }).hex
            : undefined;
        return parseDoorColorSourceSelection({ source: "hex", confirmed: true, chosenAt, hex });
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
  if (fromServer) return fromServer;
  return readDoorColorSourceSelection(style?.id ?? null, storage);
}

export type AcceptedAiAvailability = {
  approvedVersionId?: number | null;
  approvedReferenceImageUrl?: string | null;
};

/** True when this style has an accepted AI render to use. */
export function hasApprovedAiImage(style: AcceptedAiAvailability | null | undefined): boolean {
  return Boolean(style && style.approvedVersionId != null && (style.approvedReferenceImageUrl ?? "").trim());
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

/** The hex an explicit Sherwin-Williams or Hex choice paints, or null for image sources. */
export function selectedDoorHex(selection: DoorColorSourceSelection | null | undefined): string | null {
  if (!selection) return null;
  if (selection.source === "hex") return selection.hex;
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

// ── Selector state (pure, so the door editor and tests share one behavior) ──────

export type DoorColorSourceDraft = {
  /** What is stored for the style: only explicit, confirmed choices. */
  stored: DoorColorSourceSelection | null;
  /** The option highlighted in the selector. Exactly one at a time. */
  active: DoorColorSourceOption;
  /** A Hex pick that has not been confirmed yet. */
  pendingHex: string | null;
  /** A Sherwin-Williams pick that has not been confirmed yet. */
  pendingSherwin: SherwinWilliamsChoice | null;
  notice: string | null;
};

export type DoorColorSourceAction =
  | { type: "choose"; option: DoorColorSourceOption; aiAvailable: boolean; now: string }
  | { type: "pendingHex"; hex: string }
  | { type: "pendingSherwin"; color: SherwinWilliamsChoice | null }
  | { type: "confirm"; now: string }
  /** Leaving the selector (dialog closed) without confirming turns the toggle back off. */
  | { type: "abandon" }
  | { type: "reset"; stored: DoorColorSourceSelection | null };

export function initialDoorColorSourceDraft(stored: DoorColorSourceSelection | null): DoorColorSourceDraft {
  return { stored, active: stored?.source ?? DEFAULT_DOOR_COLOR_SOURCE, pendingHex: null, pendingSherwin: null, notice: null };
}

export function doorColorSourceReducer(state: DoorColorSourceDraft, action: DoorColorSourceAction): DoorColorSourceDraft {
  switch (action.type) {
    case "reset":
      return initialDoorColorSourceDraft(action.stored);
    case "choose": {
      const option = action.option;
      const base = { ...state, active: option, pendingHex: null, pendingSherwin: null, notice: null };
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
      // Sherwin-Williams or Hex: re-choosing the already confirmed option keeps it.
      if (state.stored?.source === option) return { ...base, notice: null };
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
      return state;
    }
    case "abandon": {
      if (!needsConfirm(state.active) || state.stored?.source === state.active) return state;
      return { ...state, active: state.stored?.source ?? DEFAULT_DOOR_COLOR_SOURCE, pendingHex: null, pendingSherwin: null, notice: null };
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
