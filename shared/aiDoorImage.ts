/**
 * The two steps Generate runs for every column.
 *
 * Generate in the door editor is one pipeline, repeated three times. Nothing here
 * is a special case:
 *
 *   step 1  the column's provider reads the door photo and the record, and writes
 *           a detailed text description of the door
 *   step 2  an image model draws a photo-accurate door image from that description,
 *           using the door photo as the reference
 *
 * The final output of every column is the image. The description is the input to
 * step 2, kept on screen because it is what "Choose as official" records.
 *
 * | Column | Step 1 (text) | Step 2 (image) |
 * |--------|---------------|----------------|
 * | GPT    | GPT           | OpenAI images  |
 * | Gemini | Gemini        | Gemini images  |
 * | Claude | Claude        | Gemini images  |
 *
 * Claude is a text writer in this pipeline, exactly like the other two. Anthropic's
 * Messages API returns text only, so its description is handed to the image model
 * the backend already runs for room scenes. That is the design, not a fallback.
 *
 * This module holds no key and reads no environment: it is bundled for the
 * browser, so it may name a variable but never read one.
 */
import type { AiDoorModel } from "./aiDoorPrompts";

/** Which provider's image endpoint draws step 2. */
export type AiDoorImagePainter = "openai" | "gemini";

export type AiDoorImagePlan = {
  /** The provider that writes the description in step 1. Always the column's own. */
  writer: AiDoorModel;
  /** The image model that draws step 2. */
  painter: AiDoorImagePainter;
  /** The environment variable step 1's provider reads. Never a key, only its name. */
  envKey: string;
  /** The environment variable that overrides the image model, when there is one. */
  imageModelEnv: string;
  /** The image model step 2 uses when that variable is unset. */
  imageModelFallback: string;
};

/**
 * The image model each painter uses by default.
 *
 * Both ids are ones this codebase already runs: `gpt-image-2` is the OpenAI image
 * model the Designer's photo renders name, and `gemini-3.1-flash-image` is what
 * `server/_core/imageGeneration.ts` calls for room scenes. Neither is invented.
 */
export const AI_DOOR_IMAGE_MODELS: Record<AiDoorImagePainter, { env: string; fallback: string }> = {
  openai: { env: "OPENAI_DOOR_IMAGE_MODEL", fallback: "gpt-image-2" },
  gemini: { env: "GEMINI_IMAGE_MODEL", fallback: "gemini-3.1-flash-image" },
};

export const AI_DOOR_IMAGE_PLANS: Record<AiDoorModel, AiDoorImagePlan> = {
  gpt: {
    writer: "gpt",
    painter: "openai",
    envKey: "OPENAI_API_KEY",
    imageModelEnv: AI_DOOR_IMAGE_MODELS.openai.env,
    imageModelFallback: AI_DOOR_IMAGE_MODELS.openai.fallback,
  },
  gemini: {
    writer: "gemini",
    painter: "gemini",
    envKey: "GEMINI_API_KEY",
    imageModelEnv: AI_DOOR_IMAGE_MODELS.gemini.env,
    imageModelFallback: AI_DOOR_IMAGE_MODELS.gemini.fallback,
  },
  claude: {
    writer: "claude",
    painter: "gemini",
    envKey: "ANTHROPIC_API_KEY",
    imageModelEnv: AI_DOOR_IMAGE_MODELS.gemini.env,
    imageModelFallback: AI_DOOR_IMAGE_MODELS.gemini.fallback,
  },
};

/** The plan for one column. */
export function aiDoorImagePlan(model: AiDoorModel): AiDoorImagePlan {
  return AI_DOOR_IMAGE_PLANS[model];
}

/** The visible name of each column. */
export const AI_DOOR_WRITER_NAMES: Record<AiDoorModel, string> = {
  gpt: "GPT",
  claude: "Claude",
  gemini: "Gemini",
};

/**
 * The one-line name of a column's pipeline, e.g. "Claude description → image".
 *
 * Every column reads the same way, because every column does the same thing.
 */
export function aiDoorPipelineLabel(model: AiDoorModel): string {
  return `${AI_DOOR_WRITER_NAMES[model]} description → image`;
}

/** A picture Generate actually made, and which model drew it. */
export type AiDoorGeneratedImage = {
  /** A `/manus-storage/…` key the storage proxy serves, or an absolute URL. */
  url: string;
  /** The provider that drew the pixels in step 2. */
  painter: AiDoorImagePainter;
  /** The image model that drew it, for the audit line. */
  providerModel: string | null;
  /** The column whose description the picture was drawn from. */
  fromDescription: AiDoorModel | null;
};

/**
 * The caption under a drawn door: both steps, named, in the same order for every
 * column. It never claims the text provider drew the picture.
 */
export function aiDoorImageCaption(model: AiDoorModel, image: AiDoorGeneratedImage | null): string | null {
  if (!image) return null;
  const writer = AI_DOOR_WRITER_NAMES[image.fromDescription ?? model];
  return `Step 1: ${writer} wrote the description from the door photo. Step 2: ${painterName(image.painter)} drew this image from it.`;
}

/** Where step 2 runs, in words, for the column's own status line. */
export function aiDoorImageStepLabel(model: AiDoorModel): string {
  const plan = aiDoorImagePlan(model);
  return `Step 1 ${AI_DOOR_WRITER_NAMES[plan.writer]} description → Step 2 ${painterName(plan.painter)} image`;
}

function painterName(painter: AiDoorImagePainter): string {
  return painter === "openai" ? "OpenAI's image model" : "Google's image model";
}

/** What to tell the operator when a column's picture could not be made. */
export const AI_DOOR_IMAGE_FAILED_MESSAGE = "The door image could not be generated. Try Generate again.";
