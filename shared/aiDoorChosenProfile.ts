/**
 * The door profile Tom just chose in the editor, ready for the 3D Designer.
 *
 * "Choose as official" fills the editor's own fields, and the editor's normal
 * Save persists them through `doorStyles.adminUpdateDoorStyle`. Tom also wants to
 * see the choice on the actual door straight away, without waiting for the
 * Designer to refetch its door-style list.
 *
 * This module is that bridge. On a choice, the editor writes the winner's stated
 * values into one browser record keyed by style id; the Designer merges the record
 * onto the style row it already has, for both the active style and every placed
 * cabinet, so the front redraws on the next frame. A Save still writes the real
 * record, and the draft is dropped as soon as the saved row already agrees with it.
 *
 * Only values the description actually stated are kept. Everything else stays
 * absent, so the Designer keeps the library default instead of being handed an
 * invented measurement: "don't put something in if you don't know".
 *
 * The color is deliberately NOT part of this record. Color precedence is the
 * resolver's (`resolveDoorColor`): an accepted render still wins, nothing snaps to
 * the brand palette, and a description's color words are text on the profile, not
 * a hex for the renderer.
 */
import type { AiDoorOfficialRecord } from "./aiDoorDescription";
import type { DoorFinishSheen, DoorGrainDirection, DoorPanelConstruction } from "./doorStyleAppearance";

export const AI_DOOR_CHOSEN_PROFILE_STORAGE_KEY = "doorAiChosenProfile.v1";

/** The stated profile values a choice hands the renderer. Absent means "not stated". */
export type ChosenDoorProfile = {
  doorStyle?: string | null;
  panelConstruction?: DoorPanelConstruction | null;
  railWidth?: number | null;
  stileWidth?: number | null;
  bevelWidth?: number | null;
  bevelDepth?: number | null;
  insideEdgeProfile?: string | null;
  finishSheen?: DoorFinishSheen | null;
  grainDirection?: DoorGrainDirection | null;
  /** The winning description, recorded as the profile's own words. */
  profileDescription?: string | null;
  /** Set by the writer so a stale read cannot outrank a newer choice. */
  chosenAt?: string | null;
};

type Store = Pick<Storage, "getItem" | "setItem">;

function defaultStore(): Store | null {
  return typeof localStorage !== "undefined" ? localStorage : null;
}

function readMap(store: Store | null): Record<string, unknown> {
  if (!store) return {};
  try {
    const parsed = JSON.parse(store.getItem(AI_DOOR_CHOSEN_PROFILE_STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function writeMap(store: Store | null, value: Record<string, unknown>) {
  if (!store) return;
  try {
    store.setItem(AI_DOOR_CHOSEN_PROFILE_STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* A full or blocked store leaves the Designer on the saved record. */
  }
}

const SHEENS: readonly DoorFinishSheen[] = ["matte", "satin", "gloss"];
const PANEL_CONSTRUCTIONS: readonly DoorPanelConstruction[] = ["raised", "flat", "slab", "glass"];
const GRAINS: readonly DoorGrainDirection[] = ["vertical-stiles-horizontal-rails", "vertical", "horizontal", "none"];

function positive(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? value as T : null;
}

function text(value: unknown): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed : null;
}

/**
 * The stated values from a chosen record, in the shape the Designer's style rows
 * already use. Nothing is defaulted here: an unstated value is absent, not null.
 */
export function chosenProfileFromRecord(record: AiDoorOfficialRecord): ChosenDoorProfile {
  const params = record.params;
  const profile: ChosenDoorProfile = {
    profileDescription: text(record.description),
    chosenAt: new Date().toISOString(),
  };
  if (params.family === "raised-panel") profile.doorStyle = "Raised Panel";
  else if (params.family === "shaker") profile.doorStyle = "Shaker";
  else if (params.family === "slab") profile.doorStyle = "Slab";
  const rail = positive(params.railIn);
  const stile = positive(params.stileIn);
  const bevelWidth = positive(params.bevelWidthIn);
  const bevelDepth = positive(params.bevelDepthIn);
  if (rail != null) profile.railWidth = rail;
  if (stile != null) profile.stileWidth = stile;
  if (bevelWidth != null) profile.bevelWidth = bevelWidth;
  if (bevelDepth != null) profile.bevelDepth = bevelDepth;
  // The renderer's construction vocabulary is raised / flat / slab / glass; a
  // description's "recessed" center is a flat panel with an inset, so it maps to
  // flat exactly as `officialRecordAsStylePatch` maps it. An unstated construction
  // stays absent and the library's own rule decides.
  if (params.panelConstruction === "raised") profile.panelConstruction = "raised";
  else if (params.panelConstruction === "flat" || params.panelConstruction === "recessed") profile.panelConstruction = "flat";
  else if (params.family === "slab") profile.panelConstruction = "slab";
  if (params.insideEdgeProfile) profile.insideEdgeProfile = params.insideEdgeProfile;
  if (params.sheen) profile.finishSheen = params.sheen === "semi-gloss" ? "satin" : params.sheen;
  // A painted face carries no grain; a stated grain direction is kept as stated.
  if (params.grainDirection === "vertical") profile.grainDirection = "vertical";
  else if (params.grainDirection === "horizontal") profile.grainDirection = "horizontal";
  else if (params.grainDirection === "none") profile.grainDirection = "none";
  return profile;
}

/** Save one style's chosen profile. Empty records are dropped rather than stored. */
export function saveChosenDoorProfile(
  styleId: number | string | null | undefined,
  profile: ChosenDoorProfile,
  store: Store | null = defaultStore(),
): ChosenDoorProfile | null {
  if (styleId == null) return null;
  const record: ChosenDoorProfile = {};
  if (profile.doorStyle) record.doorStyle = profile.doorStyle;
  const rail = positive(profile.railWidth);
  const stile = positive(profile.stileWidth);
  const bevelWidth = positive(profile.bevelWidth);
  const bevelDepth = positive(profile.bevelDepth);
  const panel = oneOf(profile.panelConstruction, PANEL_CONSTRUCTIONS);
  const sheen = oneOf(profile.finishSheen, SHEENS);
  const grain = oneOf(profile.grainDirection, GRAINS);
  if (rail != null) record.railWidth = rail;
  if (stile != null) record.stileWidth = stile;
  if (bevelWidth != null) record.bevelWidth = bevelWidth;
  if (bevelDepth != null) record.bevelDepth = bevelDepth;
  if (panel) record.panelConstruction = panel;
  if (profile.insideEdgeProfile) record.insideEdgeProfile = profile.insideEdgeProfile;
  if (sheen) record.finishSheen = sheen;
  if (grain) record.grainDirection = grain;
  if (profile.profileDescription) record.profileDescription = profile.profileDescription;
  record.chosenAt = profile.chosenAt ?? new Date().toISOString();

  const all = readMap(store);
  all[String(styleId)] = record;
  writeMap(store, all);
  return record;
}

/** Read one style's chosen profile, or null when nothing was chosen. Never throws. */
export function readChosenDoorProfile(
  styleId: number | string | null | undefined,
  store: Store | null = defaultStore(),
): ChosenDoorProfile | null {
  if (styleId == null) return null;
  const raw = readMap(store)[String(styleId)];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const record: ChosenDoorProfile = {};
  if (text(value.doorStyle)) record.doorStyle = text(value.doorStyle);
  const rail = positive(value.railWidth);
  const stile = positive(value.stileWidth);
  const bevelWidth = positive(value.bevelWidth);
  const bevelDepth = positive(value.bevelDepth);
  const panel = oneOf(value.panelConstruction, PANEL_CONSTRUCTIONS);
  const sheen = oneOf(value.finishSheen, SHEENS);
  const grain = oneOf(value.grainDirection, GRAINS);
  if (rail != null) record.railWidth = rail;
  if (stile != null) record.stileWidth = stile;
  if (bevelWidth != null) record.bevelWidth = bevelWidth;
  if (bevelDepth != null) record.bevelDepth = bevelDepth;
  if (panel) record.panelConstruction = panel;
  if (text(value.insideEdgeProfile)) record.insideEdgeProfile = text(value.insideEdgeProfile);
  if (sheen) record.finishSheen = sheen;
  if (grain) record.grainDirection = grain;
  if (text(value.profileDescription)) record.profileDescription = text(value.profileDescription);
  if (text(value.chosenAt)) record.chosenAt = text(value.chosenAt);
  return Object.keys(record).length > 1 ? record : null;
}

/** Drop a style's draft. Called once the saved record already agrees with it. */
export function clearChosenDoorProfile(
  styleId: number | string | null | undefined,
  store: Store | null = defaultStore(),
): void {
  if (styleId == null) return;
  const all = readMap(store);
  delete all[String(styleId)];
  writeMap(store, all);
}

/**
 * True when the style row already carries every value the draft holds, so the
 * draft has nothing left to add and can be dropped.
 */
export function chosenProfileAlreadySaved(
  profile: ChosenDoorProfile | null | undefined,
  style: {
    doorStyle?: string | null;
    railWidth?: string | number | null;
    stileWidth?: string | number | null;
    bevelWidth?: string | number | null;
    bevelDepth?: string | number | null;
    panelConstruction?: string | null;
    insideEdgeProfile?: string | null;
    finishSheen?: string | null;
    grainDirection?: string | null;
  } | null | undefined,
): boolean {
  if (!profile || !style) return false;
  const same = (left: unknown, right: unknown) => {
    if (left == null || left === "") return true;
    if (right == null || right === "") return false;
    const a = typeof left === "number" ? left : Number(left);
    const b = typeof right === "number" ? right : Number(right);
    if (Number.isFinite(a) && Number.isFinite(b)) return Math.abs(a - b) < 1e-6;
    return String(left).trim().toLowerCase() === String(right).trim().toLowerCase();
  };
  return same(profile.doorStyle, style.doorStyle)
    && same(profile.railWidth, style.railWidth)
    && same(profile.stileWidth, style.stileWidth)
    && same(profile.bevelWidth, style.bevelWidth)
    && same(profile.bevelDepth, style.bevelDepth)
    && same(profile.panelConstruction, style.panelConstruction)
    && same(profile.insideEdgeProfile, style.insideEdgeProfile)
    && same(profile.finishSheen, style.finishSheen)
    && same(profile.grainDirection, style.grainDirection);
}

/**
 * Merge a draft onto a style row. Stated draft values win over the saved row,
 * because they are the choice the operator just made; everything the draft does
 * not mention keeps whatever the row already had.
 *
 * `renderHex`, `color`, and any accepted-render marker are left exactly as they
 * were, so color precedence is untouched.
 */
export function withChosenDoorProfile<T extends object>(
  style: T | null | undefined,
  profile: ChosenDoorProfile | null | undefined,
): T | null | undefined {
  if (!style) return style;
  if (!profile) return style;
  const { chosenAt: _chosenAt, ...stated } = profile;
  return { ...style, ...stated } as T;
}
