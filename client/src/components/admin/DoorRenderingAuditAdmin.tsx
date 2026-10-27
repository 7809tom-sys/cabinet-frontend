import { useEffect, useMemo, useRef, useState } from "react";
import { Check, History, ImageOff, RotateCcw, ShieldOff, X } from "lucide-react";
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
import { ApprovedDoorReferenceNotice } from "@/components/admin/ApprovedDoorReferenceNotice";
import { useDoorRenderingAuditApi } from "@/components/admin/doorRenderingAuditApi";
import {
  applyDoorAuditFilter,
  assertDoorAuditRenderable,
  doorAuditCanApprove,
  doorAuditCompareSlots,
  doorAuditErrorMessage,
  doorAuditFlagLabel,
  doorAuditModeLabel,
  doorAuditProgressLabel,
  doorAuditRevertVersionId,
  doorAuditStyleLabel,
  doorRenderingAuditAllowed,
  enrichDoorAuditQueue,
  formatDoorAuditDelta,
  formatDoorAuditScore,
  formatDoorAuditWhen,
  type DoorAuditFilter,
  type DoorAuditFlag,
  type DoorAuditRunMode,
  type DoorAuditRunStatus,
  type DoorAuditRunSummary,
  type DoorAuditRenderInput,
  type DoorAuditScores,
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
  onApprove: (styleId: number, versionId: number, note: string) => void;
  onRevoke: (styleId: number, note: string) => void;
  onUseVersion: (styleId: number, versionId: number) => void;
  historyStyleId: number | null;
  historyLoading: boolean;
  historyVersions: DoorAuditVersion[] | null;
  onToggleHistory: (styleId: number) => void;
  runs: DoorAuditRunSummary[];
  runsOpen: boolean;
  onToggleRuns: () => void;
  onAbandon: (() => void) | null;
  runLimitNotice: string | null;
  busy: boolean;
};

function flagBadge(flag: DoorAuditFlag) {
  if (flag === "rejected") return <Badge variant="destructive">{doorAuditFlagLabel(flag)}</Badge>;
  if (flag === "improved") return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">{doorAuditFlagLabel(flag)}</Badge>;
  if (flag === "needs-review") return <Badge className="bg-amber-500 text-white hover:bg-amber-500">{doorAuditFlagLabel(flag)}</Badge>;
  if (flag === "accepted") return <Badge variant="secondary">{doorAuditFlagLabel(flag)}</Badge>;
  return <Badge variant="outline">{doorAuditFlagLabel(flag)}</Badge>;
}

function versionScores(version: DoorAuditVersion | null | undefined): DoorAuditScores | null {
  return version?.scores ?? null;
}

function AuditFigure({
  label,
  imageUrl,
  version,
  identity,
}: {
  label: string;
  imageUrl: string | null;
  version: DoorAuditVersion | null;
  identity: string;
}) {
  const scores = versionScores(version);
  return (
    <figure className="min-w-0 space-y-1.5">
      <div className="flex h-48 items-center justify-center overflow-hidden rounded-md bg-[#f6f3ed] ring-1 ring-border">
        {imageUrl ? (
          <img src={imageUrl} alt={`${identity} ${label}`} className="h-full w-full object-contain" />
        ) : (
          <span className="flex flex-col items-center gap-1 px-3 text-center text-xs text-muted-foreground">
            <ImageOff className="h-4 w-4" />
            No image
          </span>
        )}
      </div>
      <figcaption className="text-[11px] font-medium text-muted-foreground">
        <span className="block normal-case tracking-normal text-foreground" data-testid="door-audit-style-label">{identity}</span>
        <span className="uppercase tracking-wide">{label}</span>
      </figcaption>
      {version ? (
        <p className="text-xs text-muted-foreground">
          {formatDoorAuditWhen(version.createdAt)} · Overall {formatDoorAuditScore(scores?.overall)}
        </p>
      ) : null}
    </figure>
  );
}

function VersionThumb({
  version,
  identity,
  disabled,
  onUse,
}: {
  version: DoorAuditVersion;
  identity: string;
  disabled: boolean;
  onUse: () => void;
}) {
  const scores = versionScores(version);
  return (
    <div className="w-28 shrink-0 space-y-1">
      <div className="flex h-36 items-center justify-center overflow-hidden rounded-md bg-[#f6f3ed] ring-1 ring-border">
        <img src={version.imageUrl} alt={identity} className="h-full w-full object-contain" />
      </div>
      <p className="text-[11px] font-medium leading-snug">{identity}</p>
      <p className="text-[11px] leading-snug text-muted-foreground">{formatDoorAuditWhen(version.createdAt)}</p>
      <p className="text-xs font-medium">Overall {formatDoorAuditScore(scores?.overall)}</p>
      <p className="text-[10px] leading-snug text-muted-foreground">
        Grain {formatDoorAuditScore(scores?.grain)} · Color {formatDoorAuditScore(scores?.color)} · Texture {formatDoorAuditScore(scores?.textureSheen)} · Profile {formatDoorAuditScore(scores?.profileEdges)}
      </p>
      <div className="flex flex-wrap gap-1">
        {version.isCurrent ? <Badge variant="secondary">Current</Badge> : null}
        {version.isAcceptedBaseline ? <Badge variant="outline">Accepted</Badge> : null}
        {version.isApprovedReference ? <Badge className="bg-sky-700 text-white hover:bg-sky-700">Approved reference</Badge> : null}
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
  onApprove,
  onRevoke,
  onUseVersion,
  historyStyleId,
  historyLoading,
  historyVersions,
  onToggleHistory,
  runs,
  runsOpen,
  onToggleRuns,
  onAbandon,
  runLimitNotice,
  busy,
}: DoorRenderingAuditViewProps) {
  const selected = new Set(selectedIds);
  const visibleStyles = styles.filter((style) => style?.styleId != null);
  const allVisibleSelected = visibleStyles.length > 0 && visibleStyles.every((style) => selected.has(style.styleId));
  const running = progress?.phase === "rendering" || progress?.phase === "scoring";
  const completed = progress && Number.isFinite(progress.completed) ? progress.completed : 0;
  const total = progress && Number.isFinite(progress.total) ? progress.total : 0;
  const progressValue = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-6" data-testid="door-rendering-audit">
      <div>
        <h2 className="font-serif text-2xl font-bold">Door Rendering Audit</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          An approved render is the source of truth for that door style. New audits compare against it, and fall back to the sample photo only when nothing is approved.
          Featured Styles photos are checked against that approved image. A photo that does not match fails this audit and is left unchanged.
          Running an audit captures every selected door in this browser, including runs larger than 40 styles.
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
                  ? `Waiting for door renders${progress.detail ? ` · ${progress.detail}` : ""} · ${completed} of ${total} uploaded`
                  : doorAuditProgressLabel(progress.phase, completed, total, progress.detail)}
            </p>
            <div className="flex flex-wrap gap-2">
              {onContinue ? (
                <Button type="button" size="sm" disabled={busy} onClick={onContinue}>Continue upload</Button>
              ) : null}
              {onAbandon ? (
                <Button type="button" size="sm" variant="outline" data-testid="door-audit-abandon" disabled={busy} onClick={onAbandon}>
                  Abandon run
                </Button>
              ) : null}
            </div>
          </div>
          {progress.phase !== "failed" ? <Progress value={progressValue} /> : null}
          {progress.error ? <p className="text-sm text-destructive">{progress.error}</p> : null}
        </div>
      ) : null}

      {runLimitNotice ? <p className="text-sm text-amber-800" data-testid="door-audit-run-limit">{runLimitNotice}</p> : null}

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
                    <TableCell className="capitalize">{String(run.status ?? "").replace(/[-_]/g, " ")}</TableCell>
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
          {visibleStyles.map((style) => {
            const identity = doorAuditStyleLabel(style);
            const slots = doorAuditCompareSlots(style);
            const revertId = doorAuditRevertVersionId(style);
            const flagged = style.flag === "improved" || style.flag === "needs-review";
            const delta = formatDoorAuditDelta(style.current?.scores?.overall, style.accepted?.scores?.overall);
            const historyOpen = historyStyleId === style.styleId;
            return (
              <li key={style.styleId} className="rounded-lg border border-border bg-card p-4" data-testid="door-audit-card">
                <div className="flex flex-wrap items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-primary"
                    checked={selected.has(style.styleId)}
                    aria-label={`Select ${identity}`}
                    onChange={(event) => onToggle(style.styleId, event.target.checked)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium" data-testid="door-audit-style-name">{style.name || "Door style"}</h3>
                      {style.code ? <span className="text-sm text-muted-foreground">{style.code}</span> : null}
                      {flagBadge(style.flag)}
                      {style.changedSinceLastRender ? <Badge variant="outline">Changed</Badge> : null}
                      {delta ? <span className="text-xs text-muted-foreground">{delta}</span> : null}
                    </div>
                    {style.distributorName ? (
                      <p className="text-xs text-muted-foreground">{style.distributorName}</p>
                    ) : null}
                    <div className="mt-2">
                      <ApprovedDoorReferenceNotice
                        approvedReferenceImageUrl={style.approvedReference?.imageUrl}
                        doorSampleImageUrl={style.samplePhotoUrl}
                        drawerSampleImageUrl={style.drawerSampleImageUrl}
                        approvedByName={style.approvedReference?.approvedByName}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="door-audit-comparison">
                  {slots.map((slot) => (
                    <AuditFigure key={slot.key} label={slot.label} imageUrl={slot.imageUrl} version={slot.version} identity={identity} />
                  ))}
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {SCORE_FIELDS.map(([key, label]) => (
                    <div key={key} className="rounded-md bg-muted/50 px-3 py-2">
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
                      <dd className={key === "overall" ? "text-lg font-semibold" : "text-sm font-medium"}>
                        {formatDoorAuditScore(style.current?.scores?.[key])}
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
                  {style.current && doorAuditCanApprove(style.current) ? (
                    <ApproveReferenceControls busy={busy} versionId={style.current.versionId} onApprove={(versionId, note) => onApprove(style.styleId, versionId, note)} />
                  ) : null}
                  {style.approvedReference ? (
                    <Button type="button" size="sm" variant="outline" data-testid="door-audit-revoke" disabled={busy} onClick={() => onRevoke(style.styleId, "")}>
                      <ShieldOff className="mr-1.5 h-4 w-4" />
                      Revoke approval
                    </Button>
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
                    <p className="mb-2 text-sm font-medium" data-testid="door-audit-version-history-label">{identity}</p>
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
                            identity={identity}
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

function ApproveReferenceControls({
  versionId,
  busy,
  onApprove,
}: {
  versionId: number;
  busy: boolean;
  onApprove: (versionId: number, note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <>
      <Input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Optional note"
        aria-label="Approval note"
        maxLength={512}
        className="h-8 w-full sm:w-56"
      />
      <Button type="button" size="sm" data-testid="door-audit-approve" disabled={busy} onClick={() => onApprove(versionId, note)}>
        <Check className="mr-1.5 h-4 w-4" />
        Approve reference
      </Button>
    </>
  );
}

function progressDetail(status: DoorAuditRunStatus, catalog: readonly DoorAuditStyleRow[]): string | null {
  const known = catalog.find((style) => style.styleId === status.focusStyleId);
  if (known) return doorAuditStyleLabel(known);
  if (status.focusLabel) return status.focusLabel;
  const pending = status.pendingStyles?.[0];
  return pending ? doorAuditStyleLabel(pending) : null;
}

function serverProgress(
  status: DoorAuditRunStatus | null | undefined,
  local: LocalProgress | null,
  catalog: readonly DoorAuditStyleRow[],
) {
  if (local) {
    return { phase: local.phase, completed: local.completed, total: local.total, detail: local.detail, error: null as string | null };
  }
  if (!status || status.status === "complete") return null;
  const detail = progressDetail(status, catalog);
  const total = Number.isFinite(status.total) ? status.total : 0;
  const scored = Number.isFinite(status.scored) ? status.scored : 0;
  const failed = Number.isFinite(status.failed) ? status.failed : 0;
  const uploaded = Number.isFinite(status.uploaded) ? status.uploaded : 0;
  if (status.status === "failed") {
    return { phase: "failed" as const, completed: scored, total, detail, error: status.error };
  }
  if (status.status === "scoring") {
    return {
      phase: "scoring" as const,
      completed: scored + failed,
      total,
      detail,
      error: null,
    };
  }
  return {
    phase: "awaiting-renders" as const,
    completed: uploaded,
    total,
    detail,
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
  const abandonRun = api.doorRenderingAudit.abandonRun.useMutation();
  const reviewRender = api.doorRenderingAudit.reviewRender.useMutation();
  const approveRender = api.doorRenderingAudit.approveRender.useMutation();
  const revokeApproval = api.doorRenderingAudit.revokeApproval.useMutation();
  const setCurrentVersion = api.doorRenderingAudit.setCurrentVersion.useMutation();
  const stopRequested = useRef(false);
  const [runLimitNotice, setRunLimitNotice] = useState<string | null>(null);

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

  async function captureStyles(activeRunId: number, queue: DoorAuditRenderInput[] | null | undefined) {
    const styles = enrichDoorAuditQueue(Array.isArray(queue) ? queue : [], list.data?.styles ?? []);
    if (styles.length === 0) return;
    setLocalProgress({ phase: "rendering", completed: 0, total: styles.length, detail: doorAuditStyleLabel(styles[0]) });
    let session: DoorAuditCapture | null = null;
    let failed = 0;
    try {
      const loaded = await import("@/lib/doorAuditDoorRender");
      if (typeof loaded?.createDoorAuditCapture !== "function") {
        throw new Error("The door renderer did not load. Reload the page and try again.");
      }
      session = loaded.createDoorAuditCapture();
      for (let index = 0; index < styles.length; index += 1) {
        if (stopRequested.current) break;
        const style = styles[index];
        const label = doorAuditStyleLabel(style);
        setLocalProgress({ phase: "rendering", completed: index, total: styles.length, detail: label });
        try {
          assertDoorAuditRenderable(style);
          const png = await session.capture(style);
          if (!png?.base64) throw new Error(`${label} produced an empty image.`);
          await submitRender.mutateAsync({
            runId: activeRunId,
            styleId: style.styleId,
            sourceFingerprint: style.sourceFingerprint,
            pngBase64: png.base64,
            width: png.width,
            height: png.height,
          });
        } catch (error) {
          failed += 1;
          toast.error(`${label}: ${doorAuditErrorMessage(error, "Could not render this door.")}`);
        }
      }
    } catch (error) {
      failed = Math.max(failed, 1);
      toast.error(doorAuditErrorMessage(error, "The door renderer could not start."));
    } finally {
      session?.dispose();
      if (failed > 0) {
        const stopped = await abandonRun.mutateAsync({ runId: activeRunId }).then(() => true, () => false);
        if (stopped) {
          toast.error("This audit run was stopped so you can start another. Renders that already scored are kept.");
        }
      }
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

  function limitNotice(result: { truncated?: boolean; totalEligible?: number; styles?: unknown[] } | null | undefined): string | null {
    const shown = Array.isArray(result?.styles) ? result.styles.length : 0;
    const total = result?.totalEligible ?? shown;
    if (!result?.truncated || total <= shown) return null;
    return `This run queued ${shown} of ${total} styles. Abandon it and start again if the server is still stopping early. Saved renders are kept.`;
  }

  async function abandon(activeRunId: number) {
    stopRequested.current = true;
    try {
      await abandonRun.mutateAsync({ runId: activeRunId });
      setLocalProgress(null);
      setRunId(null);
      setRunLimitNotice(null);
      toast.message("Audit run abandoned. Saved renders were kept.");
      void utils.doorRenderingAudit.listStyles.invalidate();
      void utils.doorRenderingAudit.runStatus.invalidate();
      void utils.doorRenderingAudit.listRuns.invalidate();
    } catch (error) {
      toast.error(doorAuditErrorMessage(error, "Could not abandon that audit run."));
    }
  }

  async function rerun(styleId: number) {
    await withCaptureLock(async () => {
      stopRequested.current = false;
      try {
        const result = await startRun.mutateAsync({ mode: "selected", styleIds: [styleId] });
        if (result?.runId == null) {
          toast.error("The audit run started, but the server did not return a run id.");
          return;
        }
        setRunId(result.runId);
        setRunLimitNotice(limitNotice(result));
        await captureStyles(result.runId, result.styles);
      } catch (error) {
        toast.error(doorAuditErrorMessage(error, "Could not re-run that style."));
      }
    });
  }

  async function onRun(mode: DoorAuditRunMode) {
    const styleIds = mode === "selected" ? selectedIds : undefined;
    if (mode === "selected" && (!styleIds || styleIds.length === 0)) return;
    await withCaptureLock(async () => {
      stopRequested.current = false;
      try {
        const result = await startRun.mutateAsync({ mode, styleIds });
        if (result?.runId == null) {
          toast.error("The audit run started, but the server did not return a run id.");
          return;
        }
        setRunId(result.runId);
        setRunLimitNotice(limitNotice(result));
        const queue = Array.isArray(result.styles) ? result.styles : [];
        if (queue.length === 0) {
          toast.message(mode === "changed-only" ? "No styles changed since the last render." : "No door styles need a new render.");
          return;
        }
        await captureStyles(result.runId, queue);
      } catch (error) {
        toast.error(doorAuditErrorMessage(error, "Could not start the audit."));
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
      toast.error(doorAuditErrorMessage(error, "Could not update that render."));
    }
  }

  async function onApprove(styleId: number, versionId: number, note: string) {
    try {
      await approveRender.mutateAsync({ styleId, versionId, note });
      toast.success("That render is the approved reference. Featured photos were not changed.");
      void utils.doorRenderingAudit.listStyles.invalidate();
      void utils.doorRenderingAudit.listVersions.invalidate();
    } catch (error) {
      toast.error(doorAuditErrorMessage(error, "Could not approve that render."));
    }
  }

  async function onRevoke(styleId: number) {
    try {
      await revokeApproval.mutateAsync({ styleId });
      toast.success("Approval revoked. Older renders are still saved.");
      void utils.doorRenderingAudit.listStyles.invalidate();
      void utils.doorRenderingAudit.listVersions.invalidate();
    } catch (error) {
      toast.error(doorAuditErrorMessage(error, "Could not revoke that approval."));
    }
  }

  async function onUseVersion(styleId: number, versionId: number) {
    try {
      await setCurrentVersion.mutateAsync({ styleId, versionId });
      toast.success("That version is the accepted baseline again.");
      void utils.doorRenderingAudit.listStyles.invalidate();
      void utils.doorRenderingAudit.listVersions.invalidate();
    } catch (error) {
      toast.error(doorAuditErrorMessage(error, "Could not restore that version."));
    }
  }

  const catalog = list.data?.styles ?? [];
  const status = runStatus.data ?? list.data?.activeRun ?? null;
  const progress = serverProgress(status, localProgress, catalog);
  const pending = status?.status === "awaiting-renders" && Array.isArray(status.pendingStyles)
    ? enrichDoorAuditQueue(status.pendingStyles, catalog)
    : [];
  const busy = capturing || startRun.isPending || abandonRun.isPending || reviewRender.isPending || approveRender.isPending || revokeApproval.isPending || setCurrentVersion.isPending;
  const runIsOpen = capturing || status?.status === "awaiting-renders" || status?.status === "scoring";

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
      onApprove={(styleId, versionId, note) => { void onApprove(styleId, versionId, note); }}
      onRevoke={(styleId) => { void onRevoke(styleId); }}
      onUseVersion={(styleId, versionId) => { void onUseVersion(styleId, versionId); }}
      historyStyleId={historyStyleId}
      historyLoading={history.isLoading}
      historyVersions={history.data?.versions ?? null}
      onToggleHistory={(styleId) => setHistoryStyleId((current) => current === styleId ? null : styleId)}
      runs={runs.data?.runs ?? []}
      runsOpen={runsOpen}
      onToggleRuns={() => setRunsOpen((open) => !open)}
      onAbandon={runIsOpen && effectiveRunId != null ? () => { void abandon(effectiveRunId); } : null}
      runLimitNotice={runLimitNotice}
      busy={busy}
    />
  );
}
