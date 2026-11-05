/**
 * The client half of Generate.
 *
 * One call, on the button press only, to `aiDoorDescription.describeWithAi` in the
 * separate `cabinet-backend` repo, so this module also survives a build whose
 * router does not carry it yet: the button stays visible and answers with a plain
 * sentence instead of throwing.
 *
 * Nothing here holds, reads, or sends a provider key. The browser sends the
 * prompt and the door photo's URL; the server adds the credential.
 */
import { trpc } from "@/lib/trpc";
import {
  AI_DOOR_DESCRIBE_PROCEDURE,
  AI_DOOR_GENERATE_FAILED_MESSAGE,
  readAiDoorDescribeResult,
  type AiDoorDescribeInput,
  type AiDoorDescribeResult,
} from "@shared/aiDoorDescribe";
import { AI_DOOR_MODEL_LABELS, type AiDoorModel } from "@shared/aiDoorPrompts";

/** Shown when this build's router has no `aiDoorDescription.describeWithAi` at all. */
export const AI_DOOR_GENERATE_UNAVAILABLE_MESSAGE =
  "Generate needs the API server's AI door procedure, which is not deployed yet. Copy the prompt instead.";

type Mutation<TInput, TOutput> = {
  mutateAsync: (input: TInput) => Promise<TOutput>;
  isPending: boolean;
};

function api() {
  return trpc as unknown as {
    aiDoorDescription?: {
      describeWithAi?: {
        useMutation: () => Mutation<AiDoorDescribeInput, AiDoorDescribeResult>;
      };
    };
  };
}

/** True when this build's router carries the procedure. */
export function aiDoorDescribeProcedureAvailable(): boolean {
  return Boolean(api().aiDoorDescription?.describeWithAi);
}

/** The procedure path, for the status line and for the docs. */
export { AI_DOOR_DESCRIBE_PROCEDURE };

/**
 * Hook the three columns use.
 *
 * `generate` resolves to the same shape the column renders — text, a plain
 * message, and whether the provider is missing a key — and never rejects, so a
 * failed call cannot leave a column stuck on its spinner.
 */
export function useAiDoorDescribe() {
  const mutation = api().aiDoorDescription?.describeWithAi?.useMutation();
  const isPending = Boolean(mutation?.isPending);

  async function generate(model: AiDoorModel, input: AiDoorDescribeInput) {
    if (!mutation) {
      return { description: null, message: AI_DOOR_GENERATE_UNAVAILABLE_MESSAGE, notConnected: false };
    }
    try {
      const result = await mutation.mutateAsync(input);
      return readAiDoorDescribeResult(model, result);
    } catch (error) {
      const message = error instanceof Error && error.message.trim()
        ? `${AI_DOOR_MODEL_LABELS[model]}: ${error.message.trim()}`
        : AI_DOOR_GENERATE_FAILED_MESSAGE;
      return { description: null, message, notConnected: false };
    }
  }

  return { generate, isPending, available: Boolean(mutation) };
}
