/**
 * Per-column AI door images stored on the door style.
 *
 * `door_styles.aiColumns` (cabinet-backend, `docs/sql/0281_ai_door_profile.tidb.sql`)
 * keeps the GPT, Claude, and Gemini pictures. The browser draft in
 * `aiDoorDescriptionStore` still holds pasted text until that row is present.
 * When both exist, the server column wins, the same way a saved door-color
 * choice wins over localStorage (PR 394).
 *
 * The tRPC procedure is `doorStyles.saveAiColumn`. Its input type lives here
 * because this checkout's `AppRouter` comes from cabinet-backend
 * (`client/src/lib/trpc.ts` → `../../../server/routers`) and does not list
 * `saveAiColumn` yet. The client casts the call until that type includes it.
 */
import type { AiDoorGeneratedImage } from "./aiDoorImage";
import { aiDoorImagePlan } from "./aiDoorImage";
import { AI_DOOR_MODELS, type AiDoorModel } from "./aiDoorPrompts";
import type { StoredAiDoorComparison } from "./aiDoorDescriptionStore";

/** The migration the API names when `aiColumns` is not on `door_styles` yet. */
export const AI_DOOR_COLUMNS_MIGRATION_FILE = "docs/sql/0281_ai_door_profile.tidb.sql";

/** Shown when a stored picture URL does not load. The sketch is not a substitute. */
export const AI_DOOR_SAVED_IMAGE_FAILED_NOTE = "Saved image failed to load.";

export type AiDoorColumnRecord = {
  imageUrl: string | null;
  model: string | null;
  text: string | null;
  renderHex: string | null;
  generatedAt: string;
};

export type AiDoorColumns = {
  gpt?: AiDoorColumnRecord;
  claude?: AiDoorColumnRecord;
  gemini?: AiDoorColumnRecord;
};

export type SaveAiColumnInput = {
  doorStyleId: number;
  column: AiDoorModel;
  imageUrl?: string | null;
  model?: string | null;
  text?: string | null;
  renderHex?: string | null;
};

export type SaveAiColumnResult = {
  ok: true;
  aiColumns: AiDoorColumns | null;
};

function blank(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readColumn(value: unknown): AiDoorColumnRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const imageUrl = blank(raw.imageUrl);
  const model = blank(raw.model);
  const text = blank(raw.text);
  const renderHex = blank(raw.renderHex);
  if (!imageUrl && !model && !text && !renderHex) return null;
  return {
    imageUrl,
    model,
    text,
    renderHex,
    generatedAt: typeof raw.generatedAt === "string" ? raw.generatedAt : "",
  };
}

/** Accepts the listForAdmin value: an object, a JSON string, or null. Never throws. */
export function readAiDoorColumns(value: unknown): AiDoorColumns | null {
  let raw = value;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      raw = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const columns: AiDoorColumns = {};
  let any = false;
  for (const model of AI_DOOR_MODELS) {
    const column = readColumn(source[model]);
    if (!column) continue;
    columns[model] = column;
    any = true;
  }
  return any ? columns : null;
}

export type SeededAiDoorColumns = {
  fields: Partial<Record<AiDoorModel, string>>;
  chosen: AiDoorModel | null;
  reference: Partial<Record<AiDoorModel, string>>;
  images: Partial<Record<AiDoorModel, AiDoorGeneratedImage>>;
  renderHexByColumn: Partial<Record<AiDoorModel, string>>;
};

/**
 * Server text and image win. localStorage supplies text only when that column
 * has none on the server. A server image is the picture; localStorage has no
 * image to compete with it.
 */
export function seedAiDoorColumns(
  server: unknown,
  local: StoredAiDoorComparison,
): SeededAiDoorColumns {
  const columns = readAiDoorColumns(server);
  const fields: Partial<Record<AiDoorModel, string>> = {};
  const images: Partial<Record<AiDoorModel, AiDoorGeneratedImage>> = {};
  const renderHexByColumn: Partial<Record<AiDoorModel, string>> = {};
  for (const model of AI_DOOR_MODELS) {
    const column = columns?.[model];
    const text = column?.text?.trim() || local.fields[model]?.trim() || "";
    if (text) fields[model] = text;
    const imageUrl = column?.imageUrl?.trim() || "";
    if (imageUrl) {
      images[model] = {
        url: imageUrl,
        painter: aiDoorImagePlan(model).painter,
        providerModel: column?.model ?? null,
        fromDescription: model,
      };
    }
    const renderHex = column?.renderHex?.trim() || "";
    if (renderHex) renderHexByColumn[model] = renderHex;
  }
  return {
    fields,
    chosen: local.chosen,
    reference: local.reference,
    images,
    renderHexByColumn,
  };
}

/** A column with neither text nor an image is not written, so an empty flush cannot wipe a stored picture. */
export function aiDoorColumnSaveInput(
  doorStyleId: number,
  column: AiDoorModel,
  current: { text?: string | null; imageUrl?: string | null; model?: string | null; renderHex?: string | null },
): SaveAiColumnInput | null {
  const text = current.text?.trim() || null;
  const imageUrl = current.imageUrl?.trim() || null;
  if (!text && !imageUrl) return null;
  return {
    doorStyleId,
    column,
    text,
    imageUrl,
    model: current.model?.trim() || column,
    renderHex: current.renderHex?.trim() || null,
  };
}

export function aiDoorColumnPayloadKey(input: SaveAiColumnInput): string {
  return [input.column, input.imageUrl ?? "", input.model ?? "", input.text ?? "", input.renderHex ?? ""].join("\u0001");
}

export type ColumnImageSaveProbe = {
  status: "idle" | "loading" | "error" | "not-connected" | null;
  imageUrl: string | null;
  renderHex: string | null;
  savedImageUrl: string | null;
  savedRenderHex: string | null;
  /** True after Generate or an edit in this visit. A seeded picture is not dirty. */
  dirty: boolean;
};

/**
 * Whether the column picture in state still needs `saveAiColumn`.
 *
 * A URL that was not part of the last save is a late-arriving image and is
 * saved. A sampled hex is saved only after this visit changed the column, so
 * merely opening a stored picture does not write. Loading clears the preview
 * and must not be saved as "no image".
 */
export function columnImageNeedsSave(probe: ColumnImageSaveProbe): boolean {
  if (probe.status === "loading" || probe.status == null) return false;
  const imageUrl = probe.imageUrl?.trim() || "";
  if (!imageUrl) return false;
  const savedUrl = probe.savedImageUrl?.trim() || "";
  const urlChanged = savedUrl !== imageUrl;
  const hex = probe.renderHex?.trim() || "";
  const savedHex = probe.savedRenderHex?.trim() || "";
  const hexChanged = Boolean(hex) && hex !== savedHex;
  if (urlChanged) return true;
  return hexChanged && probe.dirty;
}

function errorText(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error.trim();
  if (error instanceof Error) return error.message.trim();
  if (typeof error !== "object") return "";
  const record = error as { message?: unknown; data?: { message?: unknown; code?: unknown } };
  const parts: string[] = [];
  if (typeof record.message === "string") parts.push(record.message.trim());
  if (typeof record.data?.message === "string") parts.push(record.data.message.trim());
  if (typeof record.data?.code === "string") parts.push(record.data.code.trim());
  return parts.filter(Boolean).join(" ");
}

/**
 * The sentence to show when `saveAiColumn` fails.
 *
 * A missing `aiColumns` column comes back as PRECONDITION_FAILED whose message
 * names `docs/sql/0281_ai_door_profile.tidb.sql`. That sentence is shown as the
 * server wrote it.
 */
export function aiDoorColumnSaveErrorMessage(error: unknown): string {
  const text = errorText(error);
  if (text) return text;
  return "The AI door column could not be saved.";
}

export function isAiDoorColumnsMigrationError(error: unknown): boolean {
  return errorText(error).includes(AI_DOOR_COLUMNS_MIGRATION_FILE);
}
