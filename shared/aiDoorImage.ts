/**
 * What each Generate column actually produces.
 *
 * Tom's goal for Generate is a photorealistic image of the door, not a paragraph
 * about it. The three providers are not equal here, and pretending they are is
 * how a column ends up showing a saved photo or a vector sketch while looking
 * like it generated something. So the split is written down once, here, and both
 * the door editor and the API server read it:
 *
 * | Column | Writes the description | Draws the image |
 * |--------|------------------------|-----------------|
 * | GPT    | GPT                    | OpenAI images   |
 * | Gemini | Gemini                 | Gemini images   |
 * | Claude | Claude                 | Gemini images   |
 *
 * Claude is the odd one: the Anthropic Messages API returns text only, so there
 * is no Claude image to return. Rather than fake one, Claude's description is
 * handed to the image model this backend already runs for room scenes, and the
 * column says so in plain words.
 *
 * This module holds no key and reads no environment: it is bundled for the
 * browser, so it may name a variable but never read one.
 */
import type { AiDoorModel } from "./aiDoorPrompts";

/** Which provider's image endpoint draws a column's picture. */
export type AiDoorImagePainter = "openai" | "gemini";

/**
 * How a column gets its picture.
 *
 * - `own-image`: the column's own provider writes text and draws the image.
 * - `description-then-image`: the column's provider writes only text, and a
 *   different provider's image model draws from that text.
 */
export type AiDoorImageRoute = "own-image" | "description-then-image";

export type AiDoorImagePlan = {
  route: AiDoorImageRoute;
  /** The provider that writes the description. */
  writer: AiDoorModel;
  /** The provider that draws the picture. */
  painter: AiDoorImagePainter;
  /** True only when the column's own provider can return an image. */
  painterIsWriter: boolean;
  /** The environment variable the writing provider reads. Never a key, only its name. */
  envKey: string;
  /** The environment variable that overrides the image model, when there is one. */
  imageModelEnv: string;
  /** The image model a column uses when that variable is unset. */
  imageModelFallback: string;
  /** One plain sentence the column can show beside its picture. */
  note: string;
};

/**
 * The image model each painter uses by default.
 *
 * Both ids are the ones this codebase already runs elsewhere: `gpt-image-2` is
 * the OpenAI image model the Designer's photo renders name, and
 * `gemini-3.1-flash-image` is the Gemini image model `server/_core/imageGeneration.ts`
 * already calls for room scenes. Neither is a new guess.
 */
export const AI_DOOR_IMAGE_MODELS: Record<AiDoorImagePainter, { env: string; fallback: string }> = {
  openai: { env: "OPENAI_DOOR_IMAGE_MODEL", fallback: "gpt-image-2" },
  gemini: { env: "GEMINI_IMAGE_MODEL", fallback: "gemini-3.1-flash-image" },
};

export const AI_DOOR_IMAGE_PLANS: Record<AiDoorModel, AiDoorImagePlan> = {
  gpt: {
    route: "own-image",
    writer: "gpt",
    painter: "openai",
    painterIsWriter: true,
    envKey: "OPENAI_API_KEY",
    imageModelEnv: AI_DOOR_IMAGE_MODELS.openai.env,
    imageModelFallback: AI_DOOR_IMAGE_MODELS.openai.fallback,
    note: "GPT writes the description and OpenAI's image model draws the door from the photo.",
  },
  gemini: {
    route: "own-image",
    writer: "gemini",
    painter: "gemini",
    painterIsWriter: true,
    envKey: "GEMINI_API_KEY",
    imageModelEnv: AI_DOOR_IMAGE_MODELS.gemini.env,
    imageModelFallback: AI_DOOR_IMAGE_MODELS.gemini.fallback,
    note: "Gemini writes the description and Gemini's image model draws the door from the photo.",
  },
  claude: {
    route: "description-then-image",
    writer: "claude",
    painter: "gemini",
    painterIsWriter: false,
    envKey: "ANTHROPIC_API_KEY",
    imageModelEnv: AI_DOOR_IMAGE_MODELS.gemini.env,
    imageModelFallback: AI_DOOR_IMAGE_MODELS.gemini.fallback,
    note: "Claude cannot return an image, so Claude writes the description and Gemini's image model draws the door from it.",
  },
};

/** The plan for one column. */
export function aiDoorImagePlan(model: AiDoorModel): AiDoorImagePlan {
  return AI_DOOR_IMAGE_PLANS[model];
}

/** True when this column's own provider can return an image. Claude cannot. */
export function aiDoorModelCanDrawImage(model: AiDoorModel): boolean {
  return AI_DOOR_IMAGE_PLANS[model].painterIsWriter;
}

/** A picture Generate actually made, and who made it. */
export type AiDoorGeneratedImage = {
  /** A `/manus-storage/…` key the storage proxy serves, or an absolute URL. */
  url: string;
  /** The provider that drew the pixels. Never the provider that wrote the text, unless they match. */
  painter: AiDoorImagePainter;
  /** The image model that drew it, for the audit line. */
  providerModel: string | null;
  /**
   * The column whose description the picture was drawn from, when that is not
   * this column's own provider. Null for GPT and Gemini, "claude" for Claude.
   */
  fromDescription: AiDoorModel | null;
};

/** The plain sentence a column shows under a picture, naming who drew it. */
export function aiDoorImageCaption(model: AiDoorModel, image: AiDoorGeneratedImage | null): string | null {
  if (!image) return null;
  const plan = aiDoorImagePlan(model);
  if (plan.painterIsWriter) return `${painterName(image.painter)} drew this door from the photo and the description.`;
  return `${painterName(image.painter)} drew this door from ${writerName(plan.writer)}'s description and the photo.`;
}

function painterName(painter: AiDoorImagePainter): string {
  return painter === "openai" ? "OpenAI's image model" : "Google's image model";
}

function writerName(model: AiDoorModel): string {
  return model === "gpt" ? "GPT" : model === "claude" ? "Claude" : "Gemini";
}

/** What to tell the operator when a column's picture could not be made. */
export const AI_DOOR_IMAGE_FAILED_MESSAGE = "The door image could not be generated. Try Generate again.";
