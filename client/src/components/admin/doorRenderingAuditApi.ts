import { trpc } from "@/lib/trpc";
import type {
  DoorAuditFilter,
  DoorAuditListResult,
  DoorAuditRenderInput,
  DoorAuditRunMode,
  DoorAuditRunStatus,
  DoorAuditRunSummary,
  DoorAuditVersion,
} from "@/lib/doorRenderingAudit";

/**
 * `doorRenderingAudit` ships in the paired cabinet-backend PR. Cast until
 * AppRouter includes it. Every procedure is admin-only (`adminProcedure`).
 *
 * listStyles
 *   input: { filter: "all" | "flagged" | "furthest" | "unaudited"; search?: string }
 *   output: {
 *     styles: DoorAuditStyleRow[]
 *     counts: { all, flagged, furthest, unaudited }
 *     activeRun: DoorAuditRunStatus | null   // in-progress only
 *   }
 *   "flagged" = flag improved or needs-review.
 *   "furthest" = scored styles, lowest overall first (furthest from the photo).
 *   "unaudited" = no current render.
 *   Flag rule: improved when latest overall >= accepted overall + 1 and the
 *   latest version is not accepted or rejected. Otherwise a scored, unaccepted
 *   render needs review.
 *
 * startRun
 *   input: { mode: "all" | "changed-only" | "selected"; styleIds?: number[] }
 *   output: { runId: number; mode; status: "awaiting-renders"; styles: DoorAuditRenderInput[] }
 *   Re-run of one style is startRun { mode: "selected", styleIds: [styleId] }.
 *   changed-only is decided on the server (sample, color, or profile changed
 *   since the current render's sourceFingerprint).
 *
 * submitRender
 *   input: { runId, styleId, sourceFingerprint, pngBase64, width, height }
 *   pngBase64 is raw base64 (no data: prefix), image/png, max 8_000_000 chars.
 *   width/height are the locked capture size (720×1080).
 *   output: { versionId: number; status: "uploaded" }
 *
 * reportRenderFailure
 *   input: { runId, styleId, message: string }
 *   output: { ok: true }
 *   Called when this browser cannot capture that style, so the run can finish.
 *
 * runStatus
 *   input: { runId: number }
 *   output: DoorAuditRunStatus
 *   status: "awaiting-renders" | "scoring" | "complete" | "failed"
 *   pendingStyles lists renders still owed by the browser.
 *   Move to scoring when uploaded + failed === total. Gemini scores grain,
 *   color, texture/sheen, profile/edges, and overall.
 *
 * reviewRender
 *   input: { styleId, versionId, decision: "accept" | "reject" }
 *   output: { styleId, versionId, decision }
 *   accept makes that version the accepted baseline and the current render.
 *   reject marks the version rejected and leaves the accepted baseline in place.
 *
 * listRuns
 *   input: { limit?: number }  // default 20, max 50
 *   output: { runs: DoorAuditRunSummary[] }  // newest first
 *
 * listVersions
 *   input: { styleId: number }
 *   output: { versions: DoorAuditVersion[] }  // newest first
 *
 * setCurrentVersion
 *   input: { styleId: number; versionId: number }
 *   output: { styleId: number; currentVersionId: number }
 *   Makes a stored render current again ("Revert to previous" / "Use this version").
 *   Does not by itself change which version is the accepted baseline.
 */

type QueryOpts<T> = {
  enabled?: boolean;
  refetchInterval?: number | false | ((query: { state: { data?: T } }) => number | false);
};

type QueryResult<T> = {
  data?: T;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: { message: string } | null;
  refetch: () => Promise<unknown>;
};

export function useDoorRenderingAuditApi() {
  return trpc as unknown as {
    doorRenderingAudit: {
      listStyles: {
        useQuery: (
          input: { filter: DoorAuditFilter; search?: string },
          options?: QueryOpts<DoorAuditListResult>,
        ) => QueryResult<DoorAuditListResult>;
      };
      startRun: {
        useMutation: () => {
          mutateAsync: (input: { mode: DoorAuditRunMode; styleIds?: number[] }) => Promise<{
            runId: number;
            mode: DoorAuditRunMode;
            status: "awaiting-renders";
            styles: DoorAuditRenderInput[];
          }>;
          isPending: boolean;
        };
      };
      submitRender: {
        useMutation: () => {
          mutateAsync: (input: {
            runId: number;
            styleId: number;
            sourceFingerprint: string;
            pngBase64: string;
            width: number;
            height: number;
          }) => Promise<{ versionId: number; status: "uploaded" }>;
          isPending: boolean;
        };
      };
      reportRenderFailure: {
        useMutation: () => {
          mutateAsync: (input: { runId: number; styleId: number; message: string }) => Promise<{ ok: true }>;
          isPending: boolean;
        };
      };
      runStatus: {
        useQuery: (
          input: { runId: number },
          options?: QueryOpts<DoorAuditRunStatus>,
        ) => QueryResult<DoorAuditRunStatus>;
      };
      reviewRender: {
        useMutation: () => {
          mutateAsync: (input: { styleId: number; versionId: number; decision: "accept" | "reject" }) => Promise<{
            styleId: number;
            versionId: number;
            decision: "accept" | "reject";
          }>;
          isPending: boolean;
        };
      };
      listRuns: {
        useQuery: (
          input: { limit?: number },
          options?: QueryOpts<{ runs: DoorAuditRunSummary[] }>,
        ) => QueryResult<{ runs: DoorAuditRunSummary[] }>;
      };
      listVersions: {
        useQuery: (
          input: { styleId: number },
          options?: QueryOpts<{ versions: DoorAuditVersion[] }>,
        ) => QueryResult<{ versions: DoorAuditVersion[] }>;
      };
      setCurrentVersion: {
        useMutation: () => {
          mutateAsync: (input: { styleId: number; versionId: number }) => Promise<{
            styleId: number;
            currentVersionId: number;
          }>;
          isPending: boolean;
        };
      };
    };
    useUtils: () => {
      doorRenderingAudit: {
        listStyles: { invalidate: () => Promise<void> };
        listRuns: { invalidate: () => Promise<void> };
        listVersions: { invalidate: () => Promise<void> };
        runStatus: { invalidate: () => Promise<void> };
      };
    };
  };
}
