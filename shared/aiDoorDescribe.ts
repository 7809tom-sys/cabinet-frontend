/**
 * The Generate button's contract, shared by the door editor and the API server.
 *
 * The API lives in the separate `cabinet-backend` repo (Railway). This file is
 * the agreement between the two: the procedure path, the input and output
 * shapes, and the plain-language message each failure produces. Both sides read
 * it, so a missing key can never fail silently and the wording is written once.
 *
 * Two rules the server side must keep:
 *
 * - The provider keys are read from the server environment only. Nothing here
 *   ever carries a key, and the browser never sees one.
 * - A missing key is DATA, not an exception. The procedure answers
 *   `{ status: "not-connected" }` so the column can say "Claude isn't
 *   connected yet" instead of showing a stack trace.
 */
import { AI_DOOR_MODELS, type AiDoorModel } from "./aiDoorPrompts";
import type { AiDoorGeneratedImage } from "./aiDoorImage";

/** The procedure the door editor calls. Its router is `server/routers/aiDoorDescription.ts`. */
export const AI_DOOR_DESCRIBE_PROCEDURE = "aiDoorDescription.describeWithAi" as const;
/** The key-presence read beside it. Booleans only; never a key. */
export const AI_DOOR_STATUS_PROCEDURE = "aiDoorDescription.providerStatus" as const;

/** The environment variable each model needs on the API server. */
export const AI_DOOR_MODEL_ENV_KEYS: Record<AiDoorModel, string> = {
  gpt: "OPENAI_API_KEY",
  claude: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
};

/** The service that must carry each key. Named so docs and code cannot disagree. */
export const AI_DOOR_KEY_SERVICE = "cabinet-backend (Railway: cabinet-backend-production)" as const;

/** Plain sentence a column shows when its provider is not connected. */
export const AI_DOOR_NOT_CONNECTED_MESSAGE: Record<AiDoorModel, string> = {
  gpt: "GPT isn't connected yet. Add OPENAI_API_KEY on the API server.",
  claude: "Claude isn't connected yet. Add ANTHROPIC_API_KEY on the API server.",
  gemini: "Gemini isn't connected yet. Add GEMINI_API_KEY on the API server.",
};

/** The photo a prompt is written about. Sent as a URL or a data URL. */
export type AiDoorDescribeImage = {
  /** `https://…`, a site-relative `/manus-storage/…` path, or a `data:image/…` URL. */
  url: string;
};

export type AiDoorDescribeInput = {
  model: AiDoorModel;
  /** The prompt for this column, verbatim from `AI_DOOR_PROMPTS`. */
  prompt: string;
  /**
   * The door's sample photo. Omitted when the style has none, which is allowed:
   * a text-only prompt still asks the model to say "not visible" rather than
   * guess, so the description just comes back without the photo-backed detail.
   */
  image?: AiDoorDescribeImage | null;
  /** Optional door identity so the prompt can be read with the right context. */
  doorName?: string | null;
  /** The door style this description is for. Recorded by the server, never used for auth. */
  styleId?: number | null;
  /** The editor's finish words, used only to brief the image model. */
  finish?: string | null;
  /** The plain-text color description, used only to brief the image model. */
  colorDescription?: string | null;
};

export type AiDoorDescribeFailureCode =
  | "not-connected"
  | "rate-limited"
  | "provider-error"
  | "timeout";

export type AiDoorDescribeResult =
  | {
    status: "ok";
    model: AiDoorModel;
    /** The model's answer, exactly as returned. The column pastes this in. */
    description: string;
    /** Which provider model answered, for the audit line. */
    providerModel: string | null;
    /**
     * The photorealistic door image Generate drew, when it could.
     *
     * This is the point of the button: an image of the door, not a paragraph
     * about it. It is null only for a genuine image failure, which the column
     * reports rather than quietly falling back to a saved photo or a sketch.
     */
    image?: AiDoorGeneratedImage | null;
    /**
     * Why an image is missing, in plain words, when the description still came
     * back. Never a provider payload.
     */
    imageMessage?: string | null;
  }
  | {
    status: "not-connected";
    model: AiDoorModel;
    /** Plain sentence for the column: "Claude isn't connected yet." */
    message: string;
  }
  | {
    status: "error";
    model: AiDoorModel;
    code: AiDoorDescribeFailureCode;
    /** Plain sentence for the column. Never a stack trace or a provider payload. */
    message: string;
  };

/** Plain sentence for a failure the server could not classify. */
export const AI_DOOR_GENERATE_FAILED_MESSAGE = "That description could not be generated. Try again.";

/** True when the model name is one this feature knows. */
export function isAiDoorModel(value: unknown): value is AiDoorModel {
  return (AI_DOOR_MODELS as readonly string[]).includes(String(value));
}

/**
 * The input the door editor sends. Kept as one function so a test can assert the
 * exact shape the backend must accept, and so the browser can never add a key.
 */
export function aiDoorDescribeInput(args: {
  model: AiDoorModel;
  prompt: string;
  imageUrl?: string | null;
  doorName?: string | null;
  styleId?: number | null;
  finish?: string | null;
  colorDescription?: string | null;
}): AiDoorDescribeInput {
  const image = args.imageUrl?.trim();
  return {
    model: args.model,
    prompt: args.prompt,
    image: image ? { url: image } : null,
    doorName: args.doorName?.trim() || null,
    styleId: args.styleId ?? null,
    finish: args.finish?.trim() || null,
    colorDescription: args.colorDescription?.trim() || null,
  };
}

/**
 * Read a procedure result into the things a column needs to render: the text (or
 * null), the generated door image (or null), a plain message (or null), and
 * whether it is missing a key.
 */
export function readAiDoorDescribeResult(
  model: AiDoorModel,
  result: AiDoorDescribeResult | null | undefined,
): {
  description: string | null;
  image: AiDoorGeneratedImage | null;
  imageMessage: string | null;
  message: string | null;
  notConnected: boolean;
} {
  if (!result) {
    return {
      description: null,
      image: null,
      imageMessage: null,
      message: AI_DOOR_GENERATE_FAILED_MESSAGE,
      notConnected: false,
    };
  }
  if (result.status === "ok") {
    const description = result.description.trim();
    const image = result.image ?? null;
    const imageMessage = result.imageMessage?.trim() || null;
    return {
      description,
      image,
      imageMessage,
      // Text alone is no longer the goal. A column with a description but no
      // picture says so plainly instead of looking finished.
      message: description || image ? null : "That model answered with nothing. Try again.",
      notConnected: false,
    };
  }
  if (result.status === "not-connected") {
    return {
      description: null,
      image: null,
      imageMessage: null,
      message: result.message || AI_DOOR_NOT_CONNECTED_MESSAGE[model],
      notConnected: true,
    };
  }
  return {
    description: null,
    image: null,
    imageMessage: null,
    message: result.message || AI_DOOR_GENERATE_FAILED_MESSAGE,
    notConnected: false,
  };
}
