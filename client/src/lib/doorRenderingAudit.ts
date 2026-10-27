/**
 * Door Rendering Audit — shared types and rules for the admin UI.
 *
 * The companion cabinet-backend router is `doorRenderingAudit` (adminProcedure
 * only). Shapes live in `client/src/components/admin/doorRenderingAuditApi.ts`.
 * Flag and filter rules below are the contract the backend should match.
 */

export const DOOR_AUDIT_IMPROVEMENT_POINTS = 1;

/** Locked capture settings. Every style uses this camera, size, and lighting. */
export const DOOR_AUDIT_CAPTURE = {
  widthPx: 720,
  heightPx: 1080,
  pixelRatio: 1,
  doorWidthIn: 18,
  doorHeightIn: 30,
  doorThicknessIn: 0.75,
  /** Orthographic frame is this multiple of the door height, so every door fills the same share of the PNG. */
  margin: 1.08,
} as const;

/**
 * Designer scene lights (InteractiveRoom3D) use these colors and intensities.
 * Positions are fixed in door-local feet so a single front-on door reads the
 * same way every time — room-scaled designer positions would change with the kitchen.
 */
export const DOOR_AUDIT_LIGHTS = {
  background: "#f6f3ed",
  exposure: 0.84,
  hemisphere: { sky: "#fffaf2", ground: "#718096", intensity: 0.92 },
  key: { color: "#fff5e6", intensity: 1.5, position: [0.85, 1.35, 1.6] as const },
  fill: { color: "#cfe0f4", intensity: 0.38, position: [-1.1, 0.4, 1.8] as const },
} as const;

export type DoorAuditRunMode = "all" | "changed-only" | "selected";

export type DoorAuditFilter = "all" | "flagged" | "furthest" | "unaudited";

export type DoorAuditFlag = "improved" | "needs-review" | "accepted" | "rejected" | "unaudited";

export type DoorAuditReview = "pending" | "accepted" | "rejected";

export type DoorAuditScores = {
  grain: number | null;
  color: number | null;
  textureSheen: number | null;
  profileEdges: number | null;
  overall: number | null;
};

export type DoorAuditDoorProfile = {
  doorStyle: string | null;
  doorPanelType: string | null;
  railWidth: string | number | null;
  stileWidth: string | number | null;
  panelConstruction: "raised" | "flat" | "slab" | "glass" | null;
  bevelWidth: string | number | null;
  bevelDepth: string | number | null;
  insideEdgeProfile: string | null;
  drawerFrontType: "five-piece-raised" | "five-piece-flat" | "slab" | null;
  grainDirection: "vertical-stiles-horizontal-rails" | "vertical" | "horizontal" | "none" | null;
  finishSheen: "satin" | "matte" | "gloss" | null;
};

export type DoorAuditVersion = {
  versionId: number;
  imageUrl: string;
  createdAt: string;
  scores: DoorAuditScores;
  scoreStatus: "pending" | "scored" | "failed";
  isCurrent: boolean;
  isAcceptedBaseline: boolean;
  review: DoorAuditReview | null;
};

/** What the browser needs in order to capture one style. Echo `sourceFingerprint` on upload. */
export type DoorAuditRenderInput = {
  styleId: number;
  name: string;
  samplePhotoUrl: string | null;
  color: string | null;
  sourceFingerprint: string;
  doorProfile: DoorAuditDoorProfile;
};

export type DoorAuditStyleRow = {
  styleId: number;
  name: string;
  code: string | null;
  distributorName: string | null;
  samplePhotoUrl: string | null;
  color: string | null;
  sourceFingerprint: string;
  doorProfile: DoorAuditDoorProfile;
  changedSinceLastRender: boolean;
  /** Latest upload. This is the "new" render. */
  current: DoorAuditVersion | null;
  /** Accepted baseline. May be the same version as `current`. */
  accepted: DoorAuditVersion | null;
  /** Version immediately before `current`, when one exists. */
  previous: DoorAuditVersion | null;
  flag: DoorAuditFlag;
};

export type DoorAuditRunStatusName = "awaiting-renders" | "scoring" | "complete" | "failed";

export type DoorAuditRunStatus = {
  runId: number;
  mode: DoorAuditRunMode;
  status: DoorAuditRunStatusName;
  total: number;
  uploaded: number;
  scored: number;
  failed: number;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  /** Styles that still need a PNG. Empty once the run is scoring or finished. */
  pendingStyles: DoorAuditRenderInput[];
};

export type DoorAuditRunSummary = {
  runId: number;
  mode: DoorAuditRunMode;
  status: DoorAuditRunStatusName;
  total: number;
  scored: number;
  failed: number;
  flagged: number;
  startedAt: string;
  finishedAt: string | null;
  startedByName: string | null;
};

export type DoorAuditListResult = {
  styles: DoorAuditStyleRow[];
  counts: { all: number; flagged: number; furthest: number; unaudited: number };
  /** In-progress run only. Null when nothing is awaiting renders or scoring. */
  activeRun: DoorAuditRunStatus | null;
};

export type DoorAuditCompareSlot = {
  key: "sample" | "accepted" | "previous" | "latest";
  label: string;
  imageUrl: string | null;
  version: DoorAuditVersion | null;
};

const EMPTY_SCORES: DoorAuditScores = {
  grain: null,
  color: null,
  textureSheen: null,
  profileEdges: null,
  overall: null,
};

export function emptyDoorAuditScores(): DoorAuditScores {
  return { ...EMPTY_SCORES };
}

/**
 * Improved means the latest overall score is at least 1 point above the
 * accepted baseline. Anything scored and not yet accepted needs review.
 * The server should store this same flag; the admin UI displays `row.flag`.
 */
export function doorAuditFlag(input: {
  current: { overall: number | null; review: DoorAuditReview | null; isAcceptedBaseline: boolean } | null;
  acceptedOverall: number | null;
}): DoorAuditFlag {
  const current = input.current;
  if (!current) return "unaudited";
  if (current.review === "rejected") return "rejected";
  if (current.review === "accepted" || current.isAcceptedBaseline) return "accepted";
  if (
    current.overall != null
    && input.acceptedOverall != null
    && current.overall >= input.acceptedOverall + DOOR_AUDIT_IMPROVEMENT_POINTS
  ) {
    return "improved";
  }
  return "needs-review";
}

export function doorAuditMatchesSearch(row: Pick<DoorAuditStyleRow, "name" | "code" | "distributorName">, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return `${row.name} ${row.code ?? ""} ${row.distributorName ?? ""}`.toLowerCase().includes(needle);
}

export function orderDoorAuditStyles(styles: DoorAuditStyleRow[], filter: DoorAuditFilter): DoorAuditStyleRow[] {
  if (filter !== "furthest") return styles;
  return [...styles].sort((a, b) => {
    const left = a.current?.scores.overall;
    const right = b.current?.scores.overall;
    if (left == null && right == null) return a.name.localeCompare(b.name);
    if (left == null) return 1;
    if (right == null) return -1;
    return left - right || a.name.localeCompare(b.name);
  });
}

/** Same predicates the admin sends to `listStyles`. Applied again locally so the grid stays right if the payload is a full list. */
export function applyDoorAuditFilter(styles: DoorAuditStyleRow[], filter: DoorAuditFilter, search: string): DoorAuditStyleRow[] {
  const searched = styles.filter((row) => doorAuditMatchesSearch(row, search));
  const filtered = searched.filter((row) => {
    if (filter === "flagged") return row.flag === "improved" || row.flag === "needs-review";
    if (filter === "unaudited") return row.flag === "unaudited" || row.current == null;
    if (filter === "furthest") return row.current?.scores.overall != null;
    return true;
  });
  return orderDoorAuditStyles(filtered, filter);
}

export function doorAuditCompareSlots(row: DoorAuditStyleRow): DoorAuditCompareSlot[] {
  const latest = row.current;
  const slots: DoorAuditCompareSlot[] = [
    { key: "sample", label: "Sample photo", imageUrl: row.samplePhotoUrl, version: null },
  ];
  const shown = new Set<number>();
  const pushVersion = (key: "accepted" | "previous", label: string, version: DoorAuditVersion | null | undefined) => {
    if (!version || version.versionId === latest?.versionId || shown.has(version.versionId)) return;
    shown.add(version.versionId);
    slots.push({ key, label, imageUrl: version.imageUrl, version });
  };
  // The accepted baseline sits beside the new render. When the latest render
  // is already that baseline, the middle column is the prior version instead
  // of a duplicate of the latest image.
  if (row.accepted && row.accepted.versionId !== latest?.versionId) {
    pushVersion("accepted", "Accepted baseline", row.accepted);
  }
  pushVersion("previous", "Previous render", row.previous);
  if (!latest && !slots.some((slot) => slot.key === "accepted")) {
    slots.push({ key: "accepted", label: "Accepted baseline", imageUrl: null, version: null });
  }
  slots.push({
    key: "latest",
    label: latest?.isAcceptedBaseline || latest?.review === "accepted" ? "Latest render · accepted" : "Latest render",
    imageUrl: latest?.imageUrl ?? null,
    version: latest,
  });
  return slots;
}

/** Version the "Revert to previous" control restores. History can still restore any other version. */
export function doorAuditRevertVersionId(row: DoorAuditStyleRow): number | null {
  const previous = row.previous;
  if (previous && previous.versionId !== row.current?.versionId) return previous.versionId;
  if (row.accepted && row.accepted.versionId !== row.current?.versionId) return row.accepted.versionId;
  return null;
}

export function formatDoorAuditScore(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return "—";
  return score.toFixed(1);
}

export function formatDoorAuditDelta(latest: number | null | undefined, baseline: number | null | undefined): string | null {
  if (latest == null || baseline == null || Number.isNaN(latest) || Number.isNaN(baseline)) return null;
  const delta = latest - baseline;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)} vs accepted`;
}

export function doorAuditModeLabel(mode: DoorAuditRunMode): string {
  if (mode === "all") return "All styles";
  if (mode === "changed-only") return "Changed only";
  return "Selected styles";
}

export function doorAuditFlagLabel(flag: DoorAuditFlag): string {
  if (flag === "improved") return "Improved";
  if (flag === "needs-review") return "Needs review";
  if (flag === "accepted") return "Accepted";
  if (flag === "rejected") return "Rejected";
  return "Not audited";
}

export function doorAuditProgressLabel(
  phase: "rendering" | "scoring",
  completed: number,
  total: number,
  styleName: string | null,
): string {
  const count = `${Math.min(completed, total)} of ${total}`;
  if (phase === "rendering") {
    return styleName ? `Rendering ${styleName} · ${count}` : `Rendering doors · ${count}`;
  }
  return `Scoring renders · ${count}`;
}

export function formatDoorAuditWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function doorRenderingAuditAllowed(role: string | null | undefined): boolean {
  return role === "admin";
}

/** Orthographic front camera, in feet, locked to `DOOR_AUDIT_CAPTURE`. */
export function auditDoorCameraBounds() {
  const height = (DOOR_AUDIT_CAPTURE.doorHeightIn / 12) * DOOR_AUDIT_CAPTURE.margin;
  const width = height * (DOOR_AUDIT_CAPTURE.widthPx / DOOR_AUDIT_CAPTURE.heightPx);
  return {
    left: -width / 2,
    right: width / 2,
    top: height / 2,
    bottom: -height / 2,
    near: 0.01,
    far: 10,
    position: [0, 0, 2] as const,
    lookAt: [0, 0, 0] as const,
  };
}
