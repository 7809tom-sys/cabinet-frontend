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

/** Longest prompt the API server will forward. Mirrors `AI_DOOR_PROMPT_MAX_CHARS` on the server. */
export const AI_DOOR_PROMPT_MAX_CHARS = 6_000;

export type AiDoorDescribeInput = {
  model: AiDoorModel;
  /**
   * The prompt for this column, verbatim from `AI_DOOR_PROMPTS`, with the
   * operator's own instructions already appended by `composeAiDoorPrompt`.
   *
   * The instructions travel inside this string, not only in `instructions`
   * below, because the deployed procedure reads this field: an older server
   * that strips the extra key still receives them.
   */
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
  /**
   * What the operator typed into the door's description field, when they typed
   * anything. Absent when the field was empty, so a plain Generate sends exactly
   * the shape it always sent.
   *
   * The deployed procedure's input schema does not declare this key yet, so a
   * server that has not been updated strips it. The same text is therefore also
   * appended to `prompt` — this key is for the server change described in
   * `docs/rules/AI_DOOR_DESCRIPTION_TOOL.md`, not the path the model needs today.
   */
  instructions?: string | null;
};

/**
 * The prompt a column sends: the fixed prompt, then the operator's own
 * instructions, so their words reach the model instead of being ignored.
 *
 * The result is capped at the server's limit, which is also what the router's
 * own validation enforces, so a long instruction cannot fail the call.
 */
export function composeAiDoorPrompt(args: {
  prompt: string;
  instructions?: string | null;
}): string {
  const base = (args.prompt ?? "").trim().slice(0, AI_DOOR_PROMPT_MAX_CHARS);
  const instructions = (args.instructions ?? "").trim();
  if (!instructions) return base;
  const header = "The operator also wrote this about the door. Follow it, and still write \"not visible\" for anything the photo does not show:";
  const room = AI_DOOR_PROMPT_MAX_CHARS - base.length - header.length - 2;
  if (room <= 0) return base;
  const clipped = instructions.length <= room ? instructions : instructions.slice(0, room).trimEnd();
  // The cap is absolute: a clipped word plus the separator must still fit.
  return `${base}\n\n${header}\n${clipped}`.slice(0, AI_DOOR_PROMPT_MAX_CHARS);
}

/** True when the operator's own words will reach the model on the next call. */
export function aiDoorSendsInstructions(instructions: string | null | undefined): boolean {
  return Boolean((instructions ?? "").trim());
}

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

/** Plain sentence for a model that answered with nothing usable. */
export const AI_DOOR_EMPTY_ANSWER_MESSAGE = "That model answered with nothing. Try again.";

/** Plain sentence for a reply that never reached the door's own field. */
export const AI_DOOR_HANDOFF_FAILED_MESSAGE =
  "The description came back but did not reach the door's description field. Copy it from this column, or try again.";

/**
 * Why a Generate attempt did not produce a description in the door's field.
 *
 * The three server codes come from the API. `empty-response` and `handoff-failed`
 * are decided here: the model answered, but not with usable text, or the text
 * never made it into the door record.
 */
export type AiDoorGenerateReason =
  | AiDoorDescribeFailureCode
  | "empty-response"
  | "handoff-failed";

/** True when the model name is one this feature knows. */
export function isAiDoorModel(value: unknown): value is AiDoorModel {
  return (AI_DOOR_MODELS as readonly string[]).includes(String(value));
}

/**
 * The input the door editor sends. Kept as one function so a test can assert the
 * exact shape the backend must accept, and so the browser can never add a key.
 *
 * The operator's instructions, when there are any, are appended to the prompt
 * and also sent as their own key, so the deployed server and an updated one both
 * see them.
 */
export function aiDoorDescribeInput(args: {
  model: AiDoorModel;
  prompt: string;
  imageUrl?: string | null;
  doorName?: string | null;
  styleId?: number | null;
  instructions?: string | null;
}): AiDoorDescribeInput {
  const image = args.imageUrl?.trim();
  const instructions = (args.instructions ?? "").trim();
  const input: AiDoorDescribeInput = {
    model: args.model,
    prompt: composeAiDoorPrompt({ prompt: args.prompt, instructions }),
    image: image ? { url: image } : null,
    doorName: args.doorName?.trim() || null,
    styleId: args.styleId ?? null,
  };
  // Left off entirely when the field was empty, so a plain Generate keeps the
  // exact shape every existing server already accepts.
  if (instructions) input.instructions = instructions;
  return input;
}

/**
 * Read a procedure result into what a column needs to render: the text (or
 * null), a plain message (or null), whether it is missing a key, and a specific
 * reason when it failed so the status indicator can say what went wrong instead
 * of the word "error".
 */
export function readAiDoorDescribeResult(
  model: AiDoorModel,
  result: AiDoorDescribeResult | null | undefined,
): {
  description: string | null;
  message: string | null;
  notConnected: boolean;
  reason: AiDoorGenerateReason | null;
} {
  if (!result) {
    return { description: null, message: AI_DOOR_GENERATE_FAILED_MESSAGE, notConnected: false, reason: "provider-error" };
  }
  if (result.status === "ok") {
    const description = result.description.trim();
    return description
      ? { description, message: null, notConnected: false, reason: null }
      : { description: null, message: AI_DOOR_EMPTY_ANSWER_MESSAGE, notConnected: false, reason: "empty-response" };
  }
  if (result.status === "not-connected") {
    return {
      description: null,
      message: result.message || AI_DOOR_NOT_CONNECTED_MESSAGE[model],
      notConnected: true,
      reason: "not-connected",
    };
  }
  return {
    description: null,
    message: result.message || AI_DOOR_GENERATE_FAILED_MESSAGE,
    notConnected: false,
    reason: result.code ?? "provider-error",
  };
}

/**
 * The single sentence each status shows. Written once so the column's message and
 * its indicator can never disagree about what happened.
 */
export function aiDoorStatusSentence(args: {
  model: AiDoorModel;
  reason: AiDoorGenerateReason | null;
  message?: string | null;
}): string {
  switch (args.reason) {
    case "not-connected":
      return args.message?.trim() || AI_DOOR_NOT_CONNECTED_MESSAGE[args.model];
    case "timeout":
      return args.message?.trim() || `${modelName(args.model)} took too long to answer. Try Generate again.`;
    case "rate-limited":
      return args.message?.trim() || `${modelName(args.model)} is busy right now. Try Generate again in a moment.`;
    case "empty-response":
      return args.message?.trim() || AI_DOOR_EMPTY_ANSWER_MESSAGE;
    case "handoff-failed":
      return AI_DOOR_HANDOFF_FAILED_MESSAGE;
    default:
      return args.message?.trim() || AI_DOOR_GENERATE_FAILED_MESSAGE;
  }
}

/** The short status word the indicator shows beside the field. */
export function aiDoorStatusLabel(reason: AiDoorGenerateReason | null): string {
  switch (reason) {
    case "not-connected":
      return "AI not connected";
    case "timeout":
      return "AI timed out";
    case "rate-limited":
      return "AI is busy";
    case "empty-response":
      return "Empty description";
    case "handoff-failed":
      return "Not saved to the door field";
    default:
      return "AI error";
  }
}

function modelName(model: AiDoorModel): string {
  return model === "gpt" ? "GPT" : model === "claude" ? "Claude" : "Gemini";
}
