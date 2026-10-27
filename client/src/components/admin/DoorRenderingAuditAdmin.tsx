import { useEffect, useMemo, useRef, useState } from "react";
import { Check, History, ImageOff, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDoorRenderingAuditApi } from "@/components/admin/doorRenderingAuditApi";
import {
  applyDoorAuditFilter,
  doorAuditCompareSlots,
  doorAuditFlagLabel,
  doorAuditModeLabel,
  doorAuditProgressLabel,
  doorAuditRevertVersionId,
  doorRenderingAuditAllowed,
  formatDoorAuditDelta,
  formatDoorAuditScore,
  formatDoorAuditWhen,
  type DoorAuditFilter,
  type DoorAuditFlag,
  type DoorAuditRunMode,
  type DoorAuditRunStatus,
  type DoorAuditRunSummary,
  type DoorAuditRenderInput,
  type DoorAuditStyleRow,
  type DoorAuditVersion,
} from "@/lib/doorRenderingAudit";
import type { DoorAuditCapture } from "@/lib/doorAuditDoorRender";

const FILTERS: { value: DoorAuditFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "flagged", label: "Flagged" },
  { value: "furthest", label: "Furthest from photo" },
  { value: "unaudited", label: "Not yet audited" },
];

const SCORE_FIELDS = [
  ["grain", "Grain"],
  ["color", "Color"],
  ["textureSheen", "Texture / sheen"],
  ["profileEdges", "Profile / edges"],
  ["overall", "Overall"],
] as const;

type LocalProgress = {
  phase: "rendering" | "scoring";
  completed: number;
  total: number;
  detail: string | null;
};

export type DoorRenderingAuditViewProps = {
  styles: DoorAuditStyleRow[];
  counts: { all: number; flagged: number; furthest: number; unaudited: number } | null;
  isLoading: boolean;
  errorMessage: string | null;
  filter: DoorAuditFilter;
  onFilter: (filter: DoorAuditFilter) => void;
  search: string;
  onSearch: (value: string) => void;
  selectedIds: number[];
  onToggle: (styleId: number, selected: boolean) => void;
  onToggleVisible: (selected: boolean) => void;
  progress: { phase: "rendering" | "scoring" | "awaiting-renders" | "failed"; completed: number; total: number; detail: string | null; error: string | null } | null;
  onContinue: (() => void) | null;
  onRun: (mode: DoorAuditRunMode) => void;
  onRerun: (styleId: number) => void;
  onReview: (styleId: number, versionId: number, decision: "accept" | "reject") => void;
  onUseVersion: (styleId: number, versionId: number) => void;
  historyStyleId: number | null;
  historyLoading: boolean;
  historyVersions: DoorAuditVersion[] | null;
  onToggleHistory: (styleId: number) => void;
  runs: DoorAuditRunSummary[];
  runsOpen: boolean;
  onToggleRuns: () => void;
  busy: boolean;
};

function flagBadge(flag: DoorAuditFlag) {
  if (flag === "rejected") return <Badge variant="destructive">{doorAuditFlagLabel(flag)}</Badge>;
  if (flag === "improved") return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">{doorAuditFlagLabel(flag)}</Badge>;
  if (flag === "needs-review") return <Badge className="bg-amber-500 text-white hover:bg-amber-500">{doorAuditFlagLabel(flag)}</Badge>;
  if (flag === "accepted") return <Badge variant="secondary">{doorAuditFlagLabel(flag)}</Badge>;
  return <Badge variant="outline">{doorAuditFlagLabel(flag)}</Badge>;
}

function AuditFigure({ label, imageUrl, version }: { label: string; imageUrl: string | null; version: DoorAuditVersion | null }) {
  return (
    <figure className="min-w-0 space-y-1.5">
      <div className="flex h-48 items-center justify-center overflow-hidden rounded-md bg-[#f6f3ed] ring-1 ring-border">
        {imageUrl ? (
          <img src={imageUrl} alt={label} className="h-full w-full object-contain" />
        ) : (
          <span className="flex flex-col items-center gap-1 px-3 text-center text-xs text-muted-foreground">
            <ImageOff className="h-4 w-4" />
            No image
          </span>
        )}
      </div>
      <figcaption className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</figcaption>
      {version ? (
        <p className="text-xs text-muted-foreground">
          {formatDoorAuditWhen(version.createdAt)} · Overall {formatDoorAuditScore(version.scores.overall)}
        </p>
      ) : null}
    </figure>
  );
}

function VersionThumb({
  version,
  disabled,
  onUse,
}: {
  version: DoorAuditVersion;
  disabled: boolean;
  onUse: () => void;
}) {
  return (
    <div className="w-28 shrink-0 space-y-1">
      <div className="flex h-36 items-center justify-center overflow-hidden rounded-md bg-[#f6f3ed] ring-1 ring-border">
        <img src={version.imageUrl} alt="" className="h-full w-full object-contain" />
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">{formatDoorAuditWhen(version.createdAt)}</p>
      <p className="text-xs font-medium">Overall {formatDoorAuditScore(version.scores.overall)}</p>
      <p className="text-[10px] leading-snug text-muted-foreground">
        Grain {formatDoorAuditScore(version.scores.grain)} · Color {formatDoorAuditScore(version.scores.color)} · Texture {formatDoorAuditScore(version.scores.textureSheen)} · Profile {formatDoorAuditScore(version.scores.profileEdges)}
      </p>
      <div className="flex flex-wrap gap-1">
        {version.isCurrent ? <Badge variant="secondary">Current</Badge> : null}
        {version.isAcceptedBaseline ? <Badge variant="outline">Accepted</Badge> : null}
      </div>
      <Button type="button" size="sm" variant="outline" className="w-full" disabled={disabled || version.isCurrent} onClick={onUse}>
        {version.isCurrent ? "Current" : "Use this version"}
      </Button>
    </div>
  );
}

export function DoorRenderingAuditView({
  styles,
  counts,
  isLoading,
  errorMessage,
  filter,
  onFilter,
  search,
  onSearch,
  selectedIds,
  onToggle,
  onToggleVisible,
  progress,
  onContinue,
  onRun,
  onRerun,
  onReview,
  onUseVersion,
  historyStyleId,
  historyLoading,
  historyVersions,
  onToggleHistory,
  runs,
  runsOpen,
  onToggleRuns,
  busy,
}: DoorRenderingAuditViewProps) {
  const selected = new Set(selectedIds);
  const allVisibleSelected = styles.length > 0 && styles.every((style) => selected.has(style.styleId));
  const running = progress?.phase === "rendering" || progress?.phase === "scoring";
  const progressValue = progress && progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div className="space-y-6" data-testid="door-rendering-audit">
      <div>
        <h2 className="font-serif text-2xl font-bold">Door Rendering Audit</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Compare each style&apos;s sample photo with the accepted baseline and the latest front-on Designer render.
          Running an audit captures every door in this browser at the same size, camera, and lighting, then uploads the PNG for Gemini scoring.
          Accept a flagged render, revert to the previous one, or restore any version from the style&apos;s history.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((item) => {
          const count = counts ? counts[item.value] : null;
          return (
            <Button
              key={item.value}
              type="button"
              size="sm"
              variant={filter === item.value ? "default" : "outline"}
              onClick={() => onFilter(item.value)}
            >
              {item.label}{count != null ? ` (${count})` : ""}
            </Button>
          );
        })}
        <Input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search styles"
          aria-label="Search door styles"
          className="w-full sm:ml-auto sm:w-56"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={busy || running} onClick={() => onRun("all")}>Run all</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy || running} onClick={() => onRun("changed-only")}>Run changed only</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy || running || selectedIds.length === 0} onClick={() => onRun("selected")}>
          Run selected{selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => onToggleVisible(!allVisibleSelected)}>
          {allVisibleSelected ? "Clear selection" : "Select visible"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onToggleRuns}>
          <History className="mr-1.5 h-4 w-4" />
          {runsOpen ? "Hide run history" : "Run history"}
        </Button>
      </div>

      {progress ? (
        <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-4" data-testid="door-audit-progress">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p>
              {progress.phase === "failed"
                ? "Audit failed"
                : progress.phase === "awaiting-renders"
                  ? `Waiting for door renders · ${progress.completed} of ${progress.total} uploaded`
                  : doorAuditProgressLabel(progress.phase, progress.completed, progress.total, progress.detail)}
            </p>
            {onContinue ? (
              <Button type="button" size="sm" disabled={busy} onClick={onContinue}>Continue upload</Button>
            ) : null}
          </div>
          {progress.phase !== "failed" ? <Progress value={progressValue} /> : null}
          {progress.error ? <p className="text-sm text-destructive">{progress.error}</p> : null}
        </div>
      ) : null}

      {runsOpen ? (
        <div className="rounded-lg border border-border">
          {runs.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No audit runs yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scored</TableHead>
                  <TableHead>Flagged</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.runId}>
                    <TableCell>{formatDoorAuditWhen(run.startedAt)}</TableCell>
                    <TableCell>{doorAuditModeLabel(run.mode)}</TableCell>
                    <TableCell className="capitalize">{run.status.replace("-", " ")}</TableCell>
                    <TableCell>{run.scored} / {run.total}{run.failed > 0 ? ` · ${run.failed} failed` : ""}</TableCell>
                    <TableCell>{run.flagged}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      ) : null}

      {errorMessage ? (
        <p className="text-sm text-destructive">{errorMessage}</p>
      ) : null}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6 text-primary" />
        </div>
      ) : styles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No door styles match this filter.
        </div>
      ) : (
        <ul className="space-y-4">
          {styles.map((style) => {
            const slots = doorAuditCompareSlots(style);
            const revertId = doorAuditRevertVersionId(style);
            const flagged = style.flag === "improved" || style.flag === "needs-review";
            const delta = formatDoorAuditDelta(style.current?.scores.overall, style.accepted?.scores.overall);
            const historyOpen = historyStyleId === style.styleId;
            return (
              <li key={style.styleId} className="rounded-lg border border-border bg-card p-4" data-testid="door-audit-card">
                <div className="flex flex-wrap items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-primary"
                    checked={selected.has(style.styleId)}
                    aria-label={`Select ${style.name}`}
                    onChange={(event) => onToggle(style.styleId, event.target.checked)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{style.name}</h3>
                      {style.code ? <span className="text-sm text-muted-foreground">{style.code}</span> : null}
                      {flagBadge(style.flag)}
                      {style.changedSinceLastRender ? <Badge variant="outline">Changed</Badge> : null}
                      {delta ? <span className="text-xs text-muted-foreground">{delta}</span> : null}
                    </div>
                    {style.distributorName ? (
                      <p className="text-xs text-muted-foreground">{style.distributorName}</p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="door-audit-comparison">
                  {slots.map((slot) => (
                    <AuditFigure key={slot.key} label={slot.label} imageUrl={slot.imageUrl} version={slot.version} />
                  ))}
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {SCORE_FIELDS.map(([key, label]) => (
                    <div key={key} className="rounded-md bg-muted/50 px-3 py-2">
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
                      <dd className={key === "overall" ? "text-lg font-semibold" : "text-sm font-medium"}>
                        {formatDoorAuditScore(style.current?.scores[key])}
                      </dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={busy || running} onClick={() => onRerun(style.styleId)}>
                    <RotateCcw className="mr-1.5 h-4 w-4" />
                    Re-run
                  </Button>
                  {flagged && style.current ? (
                    <>
                      <Button type="button" size="sm" disabled={busy} onClick={() => onReview(style.styleId, style.current!.versionId, "accept")}>
                        <Check className="mr-1.5 h-4 w-4" />
                        Accept
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="text-destructive hover:text-destructive" disabled={busy} onClick={() => onReview(style.styleId, style.current!.versionId, "reject")}>
                        <X className="mr-1.5 h-4 w-4" />
                        Reject
                      </Button>
                    </>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    data-testid="door-audit-revert"
                    disabled={busy || revertId == null}
                    onClick={() => revertId != null && onUseVersion(style.styleId, revertId)}
                  >
                    Revert to previous
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => onToggleHistory(style.styleId)}>
                    {historyOpen ? "Hide version history" : "Version history"}
                  </Button>
                </div>

                {historyOpen ? (
                  <div className="mt-4" data-testid="door-audit-version-history">
                    {historyLoading ? (
                      <Spinner className="h-4 w-4 text-primary" />
                    ) : !historyVersions || historyVersions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No saved renders for this style yet.</p>
                    ) : (
                      <div className="flex gap-3 overflow-x-auto pb-1">
                        {historyVersions.map((version) => (
                          <VersionThumb
                            key={version.versionId}
                            version={version}
                            disabled={busy}
                            onUse={() => onUseVersion(style.styleId, version.versionId)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function serverProgress(status: DoorAuditRunStatus | null | undefined, local: LocalProgress | null) {
  if (local) {
    return { phase: local.phase, completed: local.completed, total: local.total, detail: local.detail, error: null as string | null };
  }
  if (!status || status.status === "complete") return null;
  if (status.status === "failed") {
    return { phase: "failed" as const, completed: status.scored, total: status.total, detail: null, error: status.error };
  }
  if (status.status === "scoring") {
    return {
      phase: "scoring" as const,
      completed: status.scored + status.failed,
      total: status.total,
      detail: null,
      error: null,
    };
  }
  return {
    phase: "awaiting-renders" as const,
    completed: status.uploaded,
    total: status.total,
    detail: null,
    error: null,
  };
}

export default function DoorRenderingAuditAdmin() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6 text-primary" />
      </div>
    );
  }
  if (!doorRenderingAuditAllowed(user?.role)) {
    return <p className="text-sm text-muted-foreground">Door Rendering Audit is limited to administrators.</p>;
  }
  return <DoorRenderingAuditScreen />;
}

function DoorRenderingAuditScreen() {
  const api = useDoorRenderingAuditApi();
  const utils = api.useUtils();
  const [filter, setFilter] = useState<DoorAuditFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [runId, setRunId] = useState<number | null>(null);
  const [localProgress, setLocalProgress] = useState<LocalProgress | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [historyStyleId, setHistoryStyleId] = useState<number | null>(null);
  const [runsOpen, setRunsOpen] = useState(false);
  const announced = useRef<number | null>(null);
  const sawActive = useRef<number | null>(null);
  const capturingRef = useRef(false);
  const utilsRef = useRef(utils);
  utilsRef.current = utils;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const list = api.doorRenderingAudit.listStyles.useQuery({
    filter,
    search: debouncedSearch || undefined,
  });
  const effectiveRunId = runId ?? list.data?.activeRun?.runId ?? null;
  const runStatus = api.doorRenderingAudit.runStatus.useQuery(
    { runId: effectiveRunId ?? 0 },
    {
      enabled: effectiveRunId != null,
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        if (!status || status === "complete" || status === "failed") return false;
        return 2000;
      },
    },
  );
  const runs = api.doorRenderingAudit.listRuns.useQuery({ limit: 20 }, { enabled: runsOpen });
  const history = api.doorRenderingAudit.listVersions.useQuery(
    { styleId: historyStyleId ?? 0 },
    { enabled: historyStyleId != null },
  );
  const startRun = api.doorRenderingAudit.startRun.useMutation();
  const submitRender = api.doorRenderingAudit.submitRender.useMutation();
  const reportFailure = api.doorRenderingAudit.reportRenderFailure.useMutation();
  const reviewRender = api.doorRenderingAudit.reviewRender.useMutation();
  const setCurrentVersion = api.doorRenderingAudit.setCurrentVersion.useMutation();

  useEffect(() => {
    const status = runStatus.data;
    if (!status) return;
    if (status.status === "awaiting-renders" || status.status === "scoring") {
      sawActive.current = status.runId;
      return;
    }
    if (sawActive.current !== status.runId || announced.current === status.runId) return;
    announced.current = status.runId;
    setLocalProgress(null);
    const live = utilsRef.current.doorRenderingAudit;
    void live.listStyles.invalidate();
    void live.listRuns.invalidate();
    void live.listVersions.invalidate();
    if (status.status === "complete") toast.success("Door rendering audit finished.");
    else toast.error(status.error || "Door rendering audit failed.");
  }, [runStatus.data]);

  useEffect(() => {
    const status = runStatus.data?.status;
    if (status !== "scoring" && status !== "awaiting-renders") return;
    const timer = window.setInterval(() => {
      void utilsRef.current.doorRenderingAudit.listStyles.invalidate();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [runStatus.data?.status]);

  const styles = useMemo(
    () => applyDoorAuditFilter(list.data?.styles ?? [], filter, debouncedSearch),
    [list.data?.styles, filter, debouncedSearch],
  );

  async function captureStyles(activeRunId: number, queue: DoorAuditRenderInput[]) {
    if (queue.length === 0) {
      toast.message("No door styles need a new render.");
      return;
    }
    setLocalProgress({ phase: "rendering", completed: 0, total: queue.length, detail: queue[0]?.name ?? null });
    let session: DoorAuditCapture | null = null;
    try {
      const module = await import("@/lib/doorAuditDoorRender");
      session = module.createDoorAuditCapture();
      for (let index = 0; index < queue.length; index += 1) {
        const style = queue[index]!;
        setLocalProgress({ phase: "rendering", completed: index, total: queue.length, detail: style.name });
        try {
          const png = await session.capture(style);
          await submitRender.mutateAsync({
            runId: activeRunId,
            styleId: style.styleId,
            sourceFingerprint: style.sourceFingerprint,
            pngBase64: png.base64,
            width: png.width,
            height: png.height,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not render this door.";
          await reportFailure.mutateAsync({ runId: activeRunId, styleId: style.styleId, message }).catch(() => undefined);
          toast.error(`${style.name}: ${message}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "The door renderer could not start.";
      toast.error(message);
      await Promise.all(queue.map((style) => (
        reportFailure.mutateAsync({ runId: activeRunId, styleId: style.styleId, message }).catch(() => undefined)
      )));
    } finally {
      session?.dispose();
      setLocalProgress(null);
      void utilsRef.current.doorRenderingAudit.listStyles.invalidate();
      void utilsRef.current.doorRenderingAudit.runStatus.invalidate();
    }
  }

  async function withCaptureLock(work: () => Promise<void>) {
    if (capturingRef.current) return;
    capturingRef.current = true;
    setCapturing(true);
    try {
      await work();
    } finally {
      capturingRef.current = false;
      setCapturing(false);
    }
  }

  async function rerun(styleId: number) {
    await withCaptureLock(async () => {
      try {
        const result = await startRun.mutateAsync({ mode: "selected", styleIds: [styleId] });
        setRunId(result.runId);
        await captureStyles(result.runId, result.styles);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not re-run that style.");
      }
    });
  }

  async function onRun(mode: DoorAuditRunMode) {
    const styleIds = mode === "selected" ? selectedIds : undefined;
    if (mode === "selected" && (!styleIds || styleIds.length === 0)) return;
    await withCaptureLock(async () => {
      try {
        const result = await startRun.mutateAsync({ mode, styleIds });
        setRunId(result.runId);
        if (result.styles.length === 0) {
          toast.message(mode === "changed-only" ? "No styles changed since the last render." : "No door styles need a new render.");
          return;
        }
        await captureStyles(result.runId, result.styles);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not start the audit.");
      }
    });
  }

  async function onReview(styleId: number, versionId: number, decision: "accept" | "reject") {
    try {
      await reviewRender.mutateAsync({ styleId, versionId, decision });
      toast.success(decision === "accept" ? "Render accepted as the baseline." : "Render rejected. The accepted baseline is unchanged.");
      void utils.doorRenderingAudit.listStyles.invalidate();
      void utils.doorRenderingAudit.listVersions.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update that render.");
    }
  }

  async function onUseVersion(styleId: number, versionId: number) {
    try {
      await setCurrentVersion.mutateAsync({ styleId, versionId });
      toast.success("That render is current again.");
      void utils.doorRenderingAudit.listStyles.invalidate();
      void utils.doorRenderingAudit.listVersions.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not restore that version.");
    }
  }

  const status = runStatus.data ?? list.data?.activeRun ?? null;
  const progress = serverProgress(status, localProgress);
  const pending = status?.status === "awaiting-renders" ? status.pendingStyles : [];
  const busy = capturing || startRun.isPending || reviewRender.isPending || setCurrentVersion.isPending;

  return (
    <DoorRenderingAuditView
      styles={styles}
      counts={list.data?.counts ?? null}
      isLoading={list.isLoading}
      errorMessage={list.isError ? list.error?.message ?? "Could not load door rendering audits." : null}
      filter={filter}
      onFilter={setFilter}
      search={search}
      onSearch={setSearch}
      selectedIds={selectedIds}
      onToggle={(styleId, checked) => {
        setSelectedIds((current) => {
          if (checked) return current.includes(styleId) ? current : [...current, styleId];
          return current.filter((id) => id !== styleId);
        });
      }}
      onToggleVisible={(checked) => {
        setSelectedIds((current) => {
          const visible = new Set(styles.map((style) => style.styleId));
          if (!checked) return current.filter((id) => !visible.has(id));
          const merged = current.concat(styles.map((style) => style.styleId));
          return merged.filter((id, index) => merged.indexOf(id) === index);
        });
      }}
      progress={progress}
      onContinue={!capturing && pending.length > 0 && effectiveRunId != null
        ? () => { void withCaptureLock(() => captureStyles(effectiveRunId, pending)); }
        : null}
      onRun={(mode) => { void onRun(mode); }}
      onRerun={(styleId) => { void rerun(styleId); }}
      onReview={(styleId, versionId, decision) => { void onReview(styleId, versionId, decision); }}
      onUseVersion={(styleId, versionId) => { void onUseVersion(styleId, versionId); }}
      historyStyleId={historyStyleId}
      historyLoading={history.isLoading}
      historyVersions={history.data?.versions ?? null}
      onToggleHistory={(styleId) => setHistoryStyleId((current) => current === styleId ? null : styleId)}
      runs={runs.data?.runs ?? []}
      runsOpen={runsOpen}
      onToggleRuns={() => setRunsOpen((open) => !open)}
      busy={busy}
    />
  );
}
