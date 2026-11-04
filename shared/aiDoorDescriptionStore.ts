/**
 * Where the AI door-description comparison is stored.
 *
 * The door editor already persists the door's own profile record through
 * `doorStyles.adminUpdateDoorStyle` (profileDescription, rail/stile, bevel,
 * inside edge, panel construction, sheen). This module follows the same
 * browser-draft pattern the door editor already uses for `doorSkin`
 * (`shared/doorSkin.ts`) and the WalzCraft wizard record
 * (`shared/walzcraftDesignerPickup.ts`): a small keyed record until a backend
 * column lands.
 *
 * `docs/sql/0247_door_style_ai_description.tidb.sql` holds the columns that would
 * replace this store. That file is not run against production; it is there so the
 * migration is reviewable and ready when the backend work is scheduled.
 *
 * Two things are kept per style:
 *
 * - The comparison: all three descriptions with their model names, which one won,
 *   and the winner's parsed parameters. Nothing is discarded.
 * - The plain-text color description (sheen, undertone, finish beyond hex). Blank
 *   by default and never guessed.
 */
import {
  AI_DOOR_MODELS,
  parseAiDoorComparison,
  type AiDoorModel,
  type AiDoorParseResult,
} from "./aiDoorDescription";

export const AI_DOOR_COMPARISON_STORAGE_KEY = "doorAiDescriptionComparison.v1";
export const DOOR_COLOR_DESCRIPTION_STORAGE_KEY = "doorColorDescription.v1";

type Store = Pick<Storage, "getItem" | "setItem">;

function defaultStore(): Store | null {
  return typeof localStorage !== "undefined" ? localStorage : null;
}

function readMap(store: Store | null, key: string): Record<string, unknown> {
  if (!store) return {};
  try {
    const parsed = JSON.parse(store.getItem(key) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function writeMap(store: Store | null, key: string, value: Record<string, unknown>) {
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    /* A full or blocked store leaves the style with what it already had. */
  }
}

/** Everything saved for one style: the three descriptions and the winner. */
export type StoredAiDoorComparison = {
  /** Pasted text per model. Empty strings are dropped on save. */
  fields: Partial<Record<AiDoorModel, string>>;
  /** Which model was chosen official, or null while undecided. */
  chosen: AiDoorModel | null;
  /** The description texts the choice kept as reference, by model. */
  reference: Partial<Record<AiDoorModel, string>>;
};

function coerceModel(value: unknown): AiDoorModel | null {
  return (AI_DOOR_MODELS as readonly string[]).includes(String(value)) ? value as AiDoorModel : null;
}

/** Read one style's saved comparison, or an empty one. Never throws on bad data. */
export function readAiDoorComparison(
  styleId: number | string | null | undefined,
  store: Store | null = defaultStore(),
): StoredAiDoorComparison {
  const empty: StoredAiDoorComparison = { fields: {}, chosen: null, reference: {} };
  if (styleId == null) return empty;
  const record = readMap(store, AI_DOOR_COMPARISON_STORAGE_KEY)[String(styleId)];
  if (!record || typeof record !== "object" || Array.isArray(record)) return empty;
  const raw = record as Record<string, unknown>;
  const fields: Partial<Record<AiDoorModel, string>> = {};
  const rawFields = raw.fields && typeof raw.fields === "object" && !Array.isArray(raw.fields)
    ? raw.fields as Record<string, unknown>
    : {};
  for (const model of AI_DOOR_MODELS) {
    const text = rawFields[model];
    if (typeof text === "string" && text.trim()) fields[model] = text;
  }
  const reference: Partial<Record<AiDoorModel, string>> = {};
  const rawReference = raw.reference && typeof raw.reference === "object" && !Array.isArray(raw.reference)
    ? raw.reference as Record<string, unknown>
    : {};
  for (const model of AI_DOOR_MODELS) {
    const text = rawReference[model];
    if (typeof text === "string" && text.trim()) reference[model] = text;
  }
  return { fields, chosen: coerceModel(raw.chosen), reference };
}

/**
 * Save the three pasted descriptions for a style.
 *
 * The winner and the reference copies are kept as they were, so typing in one
 * field never silently changes which description is official.
 */
export function saveAiDoorComparison(
  styleId: number | string | null | undefined,
  comparison: StoredAiDoorComparison,
  store: Store | null = defaultStore(),
): StoredAiDoorComparison {
  if (styleId == null) return comparison;
  const fields: Partial<Record<AiDoorModel, string>> = {};
  for (const model of AI_DOOR_MODELS) {
    const text = comparison.fields[model]?.trim();
    if (text) fields[model] = text;
  }
  const reference: Partial<Record<AiDoorModel, string>> = {};
  for (const model of AI_DOOR_MODELS) {
    const text = comparison.reference[model]?.trim();
    if (text) reference[model] = text;
  }
  const record: StoredAiDoorComparison = {
    fields,
    chosen: comparison.chosen && fields[comparison.chosen] ? comparison.chosen : null,
    reference,
  };
  const all = readMap(store, AI_DOOR_COMPARISON_STORAGE_KEY);
  all[String(styleId)] = record;
  writeMap(store, AI_DOOR_COMPARISON_STORAGE_KEY, all);
  return record;
}

/**
 * Record a winner. The winner's own text stays in `fields`; the other two texts
 * are copied into `reference` so a later edit or deletion cannot lose them.
 */
export function chooseOfficialAiDoorDescription(
  styleId: number | string | null | undefined,
  comparison: StoredAiDoorComparison,
  winner: AiDoorModel,
  store: Store | null = defaultStore(),
): StoredAiDoorComparison {
  const winnerText = comparison.fields[winner]?.trim();
  if (!winnerText) return comparison;
  const reference: Partial<Record<AiDoorModel, string>> = {};
  for (const model of AI_DOOR_MODELS) {
    if (model === winner) continue;
    const text = comparison.fields[model]?.trim();
    if (text) reference[model] = text;
  }
  return saveAiDoorComparison(styleId, { fields: comparison.fields, chosen: winner, reference }, store);
}

/** Parse the saved comparison again, for previews after a reload. */
export function parsedAiDoorComparison(
  comparison: StoredAiDoorComparison,
): Record<AiDoorModel, AiDoorParseResult> {
  return parseAiDoorComparison(comparison.fields);
}

/**
 * The plain-text color description for one style. Blank until someone types one;
 * nothing derives it from a hex.
 */
export function readDoorColorDescription(
  styleId: number | string | null | undefined,
  store: Store | null = defaultStore(),
): string {
  if (styleId == null) return "";
  const value = readMap(store, DOOR_COLOR_DESCRIPTION_STORAGE_KEY)[String(styleId)];
  return typeof value === "string" ? value : "";
}

/** Save the color description. An empty string clears it. */
export function saveDoorColorDescription(
  styleId: number | string | null | undefined,
  description: string,
  store: Store | null = defaultStore(),
): string {
  if (styleId == null) return description;
  const trimmed = description.trim();
  const all = readMap(store, DOOR_COLOR_DESCRIPTION_STORAGE_KEY);
  if (trimmed) all[String(styleId)] = trimmed;
  else delete all[String(styleId)];
  writeMap(store, DOOR_COLOR_DESCRIPTION_STORAGE_KEY, all);
  return trimmed;
}
