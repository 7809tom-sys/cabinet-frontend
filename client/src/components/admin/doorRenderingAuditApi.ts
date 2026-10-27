import { trpc } from "@/lib/trpc";
import {
  doorAuditDecisionInput,
  doorAuditRevertInput,
  doorAuditStartRunInput,
  doorAuditSubmitRenderInput,
  normalizeDoorAuditList,
  normalizeDoorAuditRunStatus,
  normalizeDoorAuditRuns,
  normalizeDoorAuditStartRun,
  normalizeDoorAuditVersions,
  type DoorAuditFilter,
  type DoorAuditListResult,
  type DoorAuditRunMode,
  type DoorAuditRunStatus,
  type DoorAuditRunSummary,
  type DoorAuditStartRunResult,
  type DoorAuditVersion,
} from "@/lib/doorRenderingAudit";

/**
 * Adapts cabinet-backend `doorRenderingAudit` (adminProcedure) to the screen.
 * The router key is `doorRenderingAudit`. Wire names that differ from the screen:
 *   listStyles, startRun({ scope }), submitRender({ imageBase64 }), runStatus,
 *   decideRender, revertToVersion, runHistory, styleVersions, abandonRun.
 * There is no reportRenderFailure procedure. A capture the browser cannot upload
 * stops the open run with abandonRun so another run can start.
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

type MutationResult<TInput, TOutput> = {
  mutateAsync: (input: TInput) => Promise<TOutput>;
  isPending: boolean;
};

type RawQuery = {
  data?: unknown;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: { message: string } | null;
  refetch: () => Promise<unknown>;
};

type RawMutation = {
  mutateAsync: (input: never) => Promise<unknown>;
  isPending: boolean;
};

function rawApi() {
  return trpc as unknown as {
    doorRenderingAudit: {
      listStyles: {
        useQuery: (input: { search?: string }, options?: object) => RawQuery;
      };
      startRun: { useMutation: () => RawMutation };
      submitRender: { useMutation: () => RawMutation };
      runStatus: {
        useQuery: (input: { runId: number }, options?: object) => RawQuery;
      };
      decideRender: { useMutation: () => RawMutation };
      revertToVersion: { useMutation: () => RawMutation };
      runHistory: {
        useQuery: (input: { limit?: number }, options?: object) => RawQuery;
      };
      styleVersions: {
        useQuery: (input: { styleId: number }, options?: object) => RawQuery;
      };
      abandonRun: { useMutation: () => RawMutation };
    };
    useUtils: () => {
      doorRenderingAudit: {
        listStyles: { invalidate: () => Promise<void> };
        runHistory: { invalidate: () => Promise<void> };
        styleVersions: { invalidate: () => Promise<void> };
        runStatus: { invalidate: () => Promise<void> };
      };
    };
  };
}

function presentRunStatusQuery(options?: QueryOpts<DoorAuditRunStatus>): object | undefined {
  if (!options?.refetchInterval || typeof options.refetchInterval !== "function") return options;
  const refetchInterval = options.refetchInterval;
  return {
    ...options,
    refetchInterval: (query: { state: { data?: unknown } }) => refetchInterval({
      state: { data: normalizeDoorAuditRunStatus(query.state.data) ?? undefined },
    }),
  };
}

export function useDoorRenderingAuditApi() {
  const api = rawApi();
  return {
    doorRenderingAudit: {
      listStyles: {
        useQuery: (
          input: { filter: DoorAuditFilter; search?: string },
          options?: QueryOpts<DoorAuditListResult>,
        ): QueryResult<DoorAuditListResult> => {
          const search = input.search?.trim();
          const query = api.doorRenderingAudit.listStyles.useQuery(search ? { search } : {}, options);
          return {
            ...query,
            data: query.data ? normalizeDoorAuditList(query.data) : undefined,
          };
        },
      },
      startRun: {
        useMutation: (): MutationResult<{ mode: DoorAuditRunMode; styleIds?: number[] }, DoorAuditStartRunResult> => {
          const mutation = api.doorRenderingAudit.startRun.useMutation();
          return {
            isPending: mutation.isPending,
            mutateAsync: async (input) => normalizeDoorAuditStartRun(
              await mutation.mutateAsync(doorAuditStartRunInput(input.mode, input.styleIds) as never),
            ),
          };
        },
      },
      submitRender: {
        useMutation: (): MutationResult<{
          runId: number;
          styleId: number;
          sourceFingerprint: string;
          pngBase64: string;
          width: number;
          height: number;
        }, { versionId?: number; status?: string }> => {
          const mutation = api.doorRenderingAudit.submitRender.useMutation();
          return {
            isPending: mutation.isPending,
            mutateAsync: async (input) => {
              const result = await mutation.mutateAsync(doorAuditSubmitRenderInput(input) as never);
              const record = result && typeof result === "object" ? result as { versionId?: number; status?: string } : {};
              return { versionId: record.versionId, status: record.status };
            },
          };
        },
      },
      runStatus: {
        useQuery: (
          input: { runId: number },
          options?: QueryOpts<DoorAuditRunStatus>,
        ): QueryResult<DoorAuditRunStatus> => {
          const query = api.doorRenderingAudit.runStatus.useQuery(input, presentRunStatusQuery(options));
          return {
            ...query,
            data: query.data ? normalizeDoorAuditRunStatus(query.data) ?? undefined : undefined,
          };
        },
      },
      reviewRender: {
        useMutation: (): MutationResult<{ styleId: number; versionId: number; decision: "accept" | "reject" }, {
          styleId: number;
          versionId: number;
          decision: "accept" | "reject";
        }> => {
          const mutation = api.doorRenderingAudit.decideRender.useMutation();
          return {
            isPending: mutation.isPending,
            mutateAsync: async (input) => {
              await mutation.mutateAsync(doorAuditDecisionInput(input) as never);
              return input;
            },
          };
        },
      },
      listRuns: {
        useQuery: (
          input: { limit?: number },
          options?: QueryOpts<{ runs: DoorAuditRunSummary[] }>,
        ): QueryResult<{ runs: DoorAuditRunSummary[] }> => {
          const query = api.doorRenderingAudit.runHistory.useQuery(input, options);
          return {
            ...query,
            data: query.data ? { runs: normalizeDoorAuditRuns(query.data) } : undefined,
          };
        },
      },
      listVersions: {
        useQuery: (
          input: { styleId: number },
          options?: QueryOpts<{ versions: DoorAuditVersion[] }>,
        ): QueryResult<{ versions: DoorAuditVersion[] }> => {
          const query = api.doorRenderingAudit.styleVersions.useQuery(input, options);
          return {
            ...query,
            data: query.data ? { versions: normalizeDoorAuditVersions(query.data) } : undefined,
          };
        },
      },
      setCurrentVersion: {
        useMutation: (): MutationResult<{ styleId: number; versionId: number }, { styleId: number; currentVersionId: number }> => {
          const mutation = api.doorRenderingAudit.revertToVersion.useMutation();
          return {
            isPending: mutation.isPending,
            mutateAsync: async (input) => {
              await mutation.mutateAsync(doorAuditRevertInput(input) as never);
              return { styleId: input.styleId, currentVersionId: input.versionId };
            },
          };
        },
      },
      abandonRun: {
        useMutation: (): MutationResult<{ runId: number }, { runId: number }> => {
          const mutation = api.doorRenderingAudit.abandonRun.useMutation();
          return {
            isPending: mutation.isPending,
            mutateAsync: async (input) => {
              await mutation.mutateAsync(input as never);
              return { runId: input.runId };
            },
          };
        },
      },
    },
    useUtils: () => {
      const utils = api.useUtils();
      return {
        doorRenderingAudit: {
          listStyles: { invalidate: () => utils.doorRenderingAudit.listStyles.invalidate() },
          listRuns: { invalidate: () => utils.doorRenderingAudit.runHistory.invalidate() },
          listVersions: { invalidate: () => utils.doorRenderingAudit.styleVersions.invalidate() },
          runStatus: { invalidate: () => utils.doorRenderingAudit.runStatus.invalidate() },
        },
      };
    },
  };
}
