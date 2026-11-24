/**
 * `doorStyles.saveAiColumn` — persist one GPT / Claude / Gemini column.
 *
 * The shared router type (`AppRouter` in `client/src/lib/trpc.ts`) is imported
 * from cabinet-backend (`../../../server/routers`). This checkout does not
 * carry that procedure on the type yet, so the client is cast. The input and
 * result shapes are `SaveAiColumnInput` / `SaveAiColumnResult` in
 * `@shared/aiDoorColumns`, matching the backend contract:
 *
 *   input  { doorStyleId, column: 'gpt'|'claude'|'gemini', imageUrl?, model?, text?, renderHex? }
 *   output { ok: true, aiColumns }
 *
 * A database without `door_styles.aiColumns` throws PRECONDITION_FAILED and
 * names `docs/sql/0281_ai_door_profile.tidb.sql`. Callers show that message.
 */
import { trpc } from "@/lib/trpc";
import type { SaveAiColumnInput, SaveAiColumnResult } from "@shared/aiDoorColumns";

export type AiDoorColumnFlushResult = { ok: true } | { ok: false; message: string };

type SaveAiColumnMutation = {
  mutate: (input: SaveAiColumnInput) => void;
  mutateAsync: (input: SaveAiColumnInput) => Promise<SaveAiColumnResult>;
  isPending: boolean;
};

export function useSaveAiColumn(): SaveAiColumnMutation {
  // Cast the client, not `trpc.doorStyles`: this checkout's AppRouter is the
  // backend type and does not list saveAiColumn (and, without cabinet-backend
  // checked out beside this repo, the router type does not resolve at all).
  const client = trpc as unknown as {
    doorStyles: { saveAiColumn: { useMutation: () => SaveAiColumnMutation } };
  };
  return client.doorStyles.saveAiColumn.useMutation();
}
