/**
 * Door Rendering Audit — shared types, view rules, and the wire adapter.
 *
 * The admin screen speaks the types below. cabinet-backend's `doorRenderingAudit`
 * router (adminProcedure) uses different field names: `scope` instead of `mode`,
 * `ourName` / `styleCode` / `profile` instead of `name` / `code` / `doorProfile`,
 * `woodGrain` instead of `grain`, and snake_case run statuses. Adapt responses
 * with the functions at the bottom of this file before they reach the screen.
 */

import {
  APPROVED_REFERENCE_LABEL,
  comparisonBaseline,
  featuredImagesAudit,
  NO_APPROVED_SOURCE_LABEL,
  type FeaturedImageFailure,
} from "@/lib/approvedDoorReference";

export const DOOR_AUDIT_IMPROVEMENT_POINTS = 1;

export { APPROVED_REFERENCE_LABEL, NO_APPROVED_SOURCE_LABEL, comparisonBaseline, featuredImagesAudit };

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

/** Sent on every audit run so "changed only" can see a new designer capture. */
export const DOOR_AUDIT_RENDERING_COMMIT = `door-audit-${DOOR_AUDIT_CAPTURE.widthPx}x${DOOR_AUDIT_CAPTURE.heightPx}`;

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
  isApprovedReference: boolean;
  review: DoorAuditReview | null;
};

export type DoorAuditApprovedReference = {
  versionId: number;
  imageUrl: string;
  approvedAt: string | null;
  approvedByUserId: number | null;
  approvedByName: string | null;
  note: string | null;
};

/** What the browser needs in order to capture one style. Echo `sourceFingerprint` as `renderingCommit` on upload. */
export type DoorAuditRenderInput = {
  styleId: number;
  name: string;
  code: string | null;
  distributorName: string | null;
  samplePhotoUrl: string | null;
  drawerSamplePhotoUrl?: string | null;
  needsDoorOnlyPhoto?: boolean;
  styleVerified?: boolean;
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
  /** Featured drawer photo. Compared with the approved reference; not replaced by it. */
  drawerSampleImageUrl: string | null;
  drawerSamplePhotoUrl?: string | null;
  needsDoorOnlyPhoto?: boolean;
  styleVerified?: boolean;
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
  /** Admin-approved source of truth. Null until a passing render is approved. */
  approvedReference: DoorAuditApprovedReference | null;
  featuredFailures: FeaturedImageFailure[];
  sourceStatus: "no-approved-source" | "featured-mismatch" | "approved";
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
  /** Style the progress line should name, when the server is waiting or scoring. */
  focusStyleId: number | null;
  focusLabel: string | null;
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
  key: "sample" | "drawer-sample" | "accepted" | "previous" | "latest";
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
    const left = a.current?.scores?.overall;
    const right = b.current?.scores?.overall;
    if (left == null && right == null) return a.name.localeCompare(b.name);
    if (left == null) return 1;
    if (right == null) return -1;
    return left - right || a.name.localeCompare(b.name);
  });
}

/** Same predicates the admin sends to `listStyles`. Applied again locally so the grid stays right if the payload is a full list. */
export function applyDoorAuditFilter(styles: DoorAuditStyleRow[], filter: DoorAuditFilter, search: string): DoorAuditStyleRow[] {
  const searched = (styles ?? []).filter((row) => row != null && doorAuditMatchesSearch(row, search));
  const filtered = searched.filter((row) => {
    if (filter === "flagged") return row.flag === "improved" || row.flag === "needs-review";
    if (filter === "unaudited") return row.flag === "unaudited" || row.current == null;
    if (filter === "furthest") return row.current?.scores?.overall != null;
    return true;
  });
  return orderDoorAuditStyles(filtered, filter);
}

export function doorAuditCompareSlots(row: DoorAuditStyleRow): DoorAuditCompareSlot[] {
  const latest = row.current;
  const approvedUrl = row.approvedReference?.imageUrl?.trim() || null;
  const slots: DoorAuditCompareSlot[] = [
    approvedUrl
      ? { key: "sample", label: APPROVED_REFERENCE_LABEL, imageUrl: approvedUrl, version: null }
      : { key: "sample", label: "Sample photo", imageUrl: row.samplePhotoUrl, version: null },
  ];
  if (row.drawerSamplePhotoUrl) {
    slots.push({ key: "drawer-sample", label: "DRAWER_FRONT sample", imageUrl: row.drawerSamplePhotoUrl, version: null });
  }
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
  const safeCompleted = Number.isFinite(completed) ? completed : 0;
  const safeTotal = Number.isFinite(total) ? total : 0;
  const count = `${Math.min(safeCompleted, safeTotal)} of ${safeTotal}`;
  if (phase === "rendering") {
    return styleName ? `Rendering ${styleName} · ${count}` : `Rendering doors · ${count}`;
  }
  return styleName ? `Scoring ${styleName} · ${count}` : `Scoring renders · ${count}`;
}

export function formatDoorAuditWhen(iso: string | null | undefined): string {
  if (!iso) return "";
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

export class DoorAuditClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DoorAuditClientError";
  }
}

export type DoorAuditBackendScope = "all" | "changed" | "selected";

export type DoorAuditStartRunResult = {
  runId: number;
  status: DoorAuditRunStatusName;
  styles: DoorAuditRenderInput[];
  truncated: boolean;
  totalEligible: number;
};

const PANEL_CONSTRUCTIONS = ["raised", "flat", "slab", "glass"] as const;
const DRAWER_FRONTS = ["five-piece-raised", "five-piece-flat", "slab"] as const;
const GRAIN_DIRECTIONS = ["vertical-stiles-horizontal-rails", "vertical", "horizontal", "none"] as const;
const FINISH_SHEENS = ["satin", "matte", "gloss"] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function positiveInt(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  if (!Number.isInteger(numeric) || numeric <= 0) return null;
  return numeric;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function dimension(value: unknown): string | number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return text(value);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== "string") return null;
  const match = allowed.find((item) => item.toLowerCase() === value.trim().toLowerCase());
  return match ?? null;
}

function toIso(value: unknown): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
}

function scoreValue(value: unknown): number | null {
  const numeric = finiteNumber(value);
  return numeric == null ? null : numeric;
}

function normalizeProfile(raw: unknown): DoorAuditDoorProfile {
  const record = asRecord(raw) ?? {};
  return {
    doorStyle: text(record.doorStyle),
    doorPanelType: text(record.doorPanelType),
    railWidth: dimension(record.railWidth),
    stileWidth: dimension(record.stileWidth),
    panelConstruction: oneOf(record.panelConstruction, PANEL_CONSTRUCTIONS),
    bevelWidth: dimension(record.bevelWidth),
    bevelDepth: dimension(record.bevelDepth),
    insideEdgeProfile: text(record.insideEdgeProfile),
    drawerFrontType: oneOf(record.drawerFrontType, DRAWER_FRONTS),
    grainDirection: oneOf(record.grainDirection, GRAIN_DIRECTIONS),
    finishSheen: oneOf(record.finishSheen, FINISH_SHEENS),
  };
}

function profileIsBlank(profile: DoorAuditDoorProfile | null | undefined): boolean {
  if (!profile) return true;
  return !profile.doorStyle
    && !profile.doorPanelType
    && !profile.panelConstruction
    && profile.railWidth == null
    && profile.stileWidth == null
    && !profile.finishSheen
    && !profile.insideEdgeProfile;
}

/** Catalog name the owner sees: ourName, then aliasName, then styleCode. */
export function doorAuditCatalogName(raw: Record<string, unknown>): string {
  return text(raw.ourName) ?? text(raw.aliasName) ?? text(raw.styleCode) ?? text(raw.name) ?? text(raw.code) ?? "Door style";
}

export function doorAuditStyleLabel(style: {
  name?: string | null;
  code?: string | null;
  distributorName?: string | null;
} | null | undefined): string {
  if (!style) return "Door style";
  const parts = [style.name, style.code, style.distributorName]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : "Door style";
}

export function doorAuditErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string") {
    const message = (error as { message: string }).message.trim();
    if (message) return message;
  }
  return fallback;
}

function supplierName(raw: Record<string, unknown>): string | null {
  return text(raw.distributorName) ?? text(raw.brandName) ?? text(raw.supplier);
}

function styleCodeOf(raw: Record<string, unknown>): string | null {
  return text(raw.styleCode) ?? text(raw.code);
}

function mapFlagStatus(value: unknown): DoorAuditFlag | null {
  if (value === "flagged" || value === "improved") return "improved";
  if (value === "rejected") return "rejected";
  if (value === "accepted") return "accepted";
  if (value === "no_baseline" || value === "within_baseline" || value === "needs-review") return "needs-review";
  if (value === "none" || value === "unaudited") return "unaudited";
  return null;
}

function mapMode(value: unknown): DoorAuditRunMode {
  if (value === "all" || value === "selected") return value;
  if (value === "changed" || value === "changed-only") return "changed-only";
  return "all";
}

function mapStatus(value: unknown): DoorAuditRunStatusName {
  if (value === "awaiting_renders" || value === "awaiting-renders") return "awaiting-renders";
  if (value === "scoring") return "scoring";
  if (value === "completed" || value === "complete") return "complete";
  return "failed";
}

function isNormalizedStatusName(value: unknown): value is DoorAuditRunStatusName {
  return value === "awaiting-renders" || value === "scoring" || value === "complete" || value === "failed";
}

function normalizeScores(raw: unknown, fallback: Record<string, unknown>): DoorAuditScores {
  const scores = asRecord(raw) ?? {};
  return {
    grain: scoreValue(scores.grain ?? scores.woodGrain ?? fallback.woodGrainScore),
    color: scoreValue(scores.color ?? fallback.colorScore),
    textureSheen: scoreValue(scores.textureSheen ?? fallback.textureSheenScore),
    profileEdges: scoreValue(scores.profileEdges ?? fallback.profileEdgesScore),
    overall: scoreValue(scores.overall ?? fallback.overallScore),
  };
}

function normalizeReview(raw: Record<string, unknown>, isAccepted: boolean): DoorAuditReview | null {
  if (raw.review === "accepted" || raw.review === "rejected" || raw.review === "pending") return raw.review;
  if (isAccepted) return "accepted";
  const events = Array.isArray(raw.events) ? raw.events : [];
  const latest = asRecord(events[0]);
  if (latest?.action === "rejected") return "rejected";
  if (latest?.action === "accepted" || latest?.action === "reverted") return "accepted";
  if (raw.verdict === "flagged" || raw.verdict === "not_flagged" || raw.verdict === "no_baseline") return "pending";
  return null;
}

function normalizeVersion(raw: unknown, options?: { isCurrent?: boolean; isAcceptedBaseline?: boolean; isApprovedReference?: boolean }): DoorAuditVersion | null {
  const record = asRecord(raw);
  if (!record) return null;
  const versionId = positiveInt(record.versionId ?? record.id);
  if (versionId == null) return null;
  const isAcceptedBaseline = options?.isAcceptedBaseline === true || record.isAcceptedBaseline === true || record.isCurrentAccepted === true;
  const isCurrent = options?.isCurrent === true || record.isCurrent === true;
  const scores = normalizeScores(record.scores, record);
  const scoreStatus = record.scoreStatus === "pending" || record.scoreStatus === "scored" || record.scoreStatus === "failed"
    ? record.scoreStatus
    : scores.overall == null ? "pending" : "scored";
  return {
    versionId,
    imageUrl: text(record.imageUrl) ?? text(record.renderImageUrl) ?? "",
    createdAt: toIso(record.createdAt) ?? "",
    scores,
    scoreStatus,
    isCurrent,
    isAcceptedBaseline,
    isApprovedReference: options?.isApprovedReference === true || record.isApprovedReference === true,
    review: normalizeReview(record, isAcceptedBaseline),
  };
}

function normalizeApprovedReference(raw: unknown, flat: Record<string, unknown>): DoorAuditApprovedReference | null {
  const record = asRecord(raw) ?? flat;
  const versionId = positiveInt(record.versionId ?? record.approvedRenderVersionId ?? flat.approvedRenderVersionId);
  const imageUrl = text(record.imageUrl) ?? text(record.approvedReferenceImageUrl) ?? text(flat.approvedReferenceImageUrl);
  if (versionId == null || !imageUrl) return null;
  return {
    versionId,
    imageUrl,
    approvedAt: toIso(record.approvedAt ?? flat.approvedAt),
    approvedByUserId: positiveInt(record.approvedByUserId ?? flat.approvedByUserId),
    approvedByName: text(record.approvedByName) ?? text(flat.approvedByName),
    note: text(record.note) ?? text(record.approvalNote) ?? text(flat.approvalNote),
  };
}

/** A scored render that was not rejected can become the approved reference. */
export function doorAuditCanApprove(version: Pick<DoorAuditVersion, "review" | "scoreStatus" | "scores" | "isApprovedReference"> | null | undefined): boolean {
  if (!version || version.isApprovedReference) return false;
  if (version.review === "rejected") return false;
  if (version.scoreStatus !== "scored") return false;
  return version.scores.overall != null;
}

export function normalizeDoorAuditRenderInput(raw: unknown, renderingCommit?: unknown): DoorAuditRenderInput | null {
  const record = asRecord(raw);
  if (!record) return null;
  const styleId = positiveInt(record.styleId ?? record.id);
  if (styleId == null) return null;
  const profileSource = record.profile ?? record.doorProfile;
  const featuredDoor = text(record.samplePhotoUrl) ?? text(record.doorSampleImageUrl);
  const approved = text(asRecord(record.approvedReference)?.imageUrl) ?? text(record.approvedReferenceImageUrl);
  const baseline = comparisonBaseline({
    approvedReferenceImageUrl: approved,
    samplePhotoUrl: featuredDoor,
  });
  return {
    styleId,
    name: doorAuditCatalogName(record),
    code: styleCodeOf(record),
    distributorName: supplierName(record),
    samplePhotoUrl: baseline.imageUrl,
    drawerSamplePhotoUrl: text(record.drawerSamplePhotoUrl) ?? text(record.drawerSampleImageUrl),
    // A combined featured swatch must not texture the capture. An approved
    // render is a door face, so it is safe to use even when the featured photo is not.
    needsDoorOnlyPhoto: baseline.source === "approved-reference" ? false : record.needsDoorOnlyPhoto === true,
    styleVerified: record.styleVerified === false || record.styleVerified === 0 ? false : true,
    color: text(record.color),
    sourceFingerprint: text(record.sourceFingerprint) ?? text(record.renderingCommit) ?? text(renderingCommit) ?? "",
    doorProfile: normalizeProfile(profileSource),
  };
}

export function normalizeDoorAuditStyle(raw: unknown): DoorAuditStyleRow | null {
  const record = asRecord(raw);
  if (!record) return null;
  const styleId = positiveInt(record.styleId ?? record.id);
  if (styleId == null) return null;
  const approvedReference = normalizeApprovedReference(record.approvedReference, record);
  const current = normalizeVersion(record.current ?? record.latestRender, {
    isCurrent: record.current != null || record.latestRender != null,
    isApprovedReference: approvedReference?.versionId != null && positiveInt(asRecord(record.current ?? record.latestRender)?.versionId ?? asRecord(record.current ?? record.latestRender)?.id) === approvedReference?.versionId,
  });
  const accepted = normalizeVersion(record.accepted ?? record.acceptedRender, { isAcceptedBaseline: record.accepted != null || record.acceptedRender != null });
  const previous = normalizeVersion(record.previous ?? record.previousRender);
  if (current && approvedReference && current.versionId === approvedReference.versionId) current.isApprovedReference = true;
  if (previous && approvedReference && previous.versionId === approvedReference.versionId) previous.isApprovedReference = true;
  if (accepted && approvedReference && accepted.versionId === approvedReference.versionId) accepted.isApprovedReference = true;
  if (current && accepted && current.versionId === accepted.versionId) {
    current.isAcceptedBaseline = true;
    current.review = current.review ?? "accepted";
    accepted.isCurrent = true;
  }
  const samplePhotoUrl = text(record.samplePhotoUrl) ?? text(record.doorSampleImageUrl);
  const drawerSampleImageUrl = text(record.drawerSamplePhotoUrl) ?? text(record.drawerSampleImageUrl);
  const featured = featuredImagesAudit({
    approvedReferenceImageUrl: approvedReference?.imageUrl,
    doorSampleImageUrl: samplePhotoUrl,
    drawerSampleImageUrl,
  });
  const flag = mapFlagStatus(record.flag ?? record.flagStatus) ?? (current ? "needs-review" : "unaudited");
  return {
    styleId,
    name: doorAuditCatalogName(record),
    code: styleCodeOf(record),
    distributorName: supplierName(record),
    samplePhotoUrl,
    drawerSampleImageUrl,
    drawerSamplePhotoUrl: drawerSampleImageUrl,
    needsDoorOnlyPhoto: record.needsDoorOnlyPhoto === true,
    styleVerified: record.styleVerified === false || record.styleVerified === 0 ? false : true,
    color: text(record.color),
    sourceFingerprint: text(record.sourceFingerprint)
      ?? text(asRecord(record.latestRender)?.renderingCommit)
      ?? text(asRecord(record.current)?.sourceFingerprint)
      ?? "",
    doorProfile: normalizeProfile(record.profile ?? record.doorProfile),
    changedSinceLastRender: record.changedSinceLastRender === true,
    current,
    accepted,
    previous,
    approvedReference,
    featuredFailures: featured.failures,
    sourceStatus: featured.sourceStatus,
    flag,
  };
}

export function doorAuditCounts(styles: readonly DoorAuditStyleRow[]): DoorAuditListResult["counts"] {
  return {
    all: styles.length,
    flagged: styles.filter((style) => style.flag === "improved" || style.flag === "needs-review").length,
    furthest: styles.filter((style) => style.current?.scores?.overall != null).length,
    unaudited: styles.filter((style) => style.flag === "unaudited" || style.current == null).length,
  };
}

export function normalizeDoorAuditList(raw: unknown): DoorAuditListResult {
  const record = asRecord(raw) ?? {};
  const list = Array.isArray(record.styles) ? record.styles : Array.isArray(record.items) ? record.items : [];
  const styles = list.flatMap((item) => {
    const style = normalizeDoorAuditStyle(item);
    return style ? [style] : [];
  });
  return {
    styles,
    counts: doorAuditCounts(styles),
    activeRun: normalizeDoorAuditRunStatus(record.activeRun),
  };
}

function styleListFrom(record: Record<string, unknown>): unknown[] | null {
  if (Array.isArray(record.styles)) return record.styles;
  if (Array.isArray(record.items)) return record.items;
  return null;
}

/** `mode: "changed-only"` is the screen's name. The server field is `scope: "changed"`. */
/** Newest open run in `runHistory`. Production `listStyles` does not return `activeRun`. */
export function doorAuditOpenRunId(
  runs: readonly { runId: number; status: DoorAuditRunStatusName | string }[],
): number | null {
  const open = runs.find((run) => run.status === "awaiting-renders" || run.status === "scoring");
  return open && Number.isInteger(open.runId) && open.runId > 0 ? open.runId : null;
}

/**
 * `startRun` answers 409 with "An audit run is already in progress (run 12)."
 * The id is how the page attaches to that run instead of leaving Run stuck.
 */
export function doorAuditOpenRunIdFromMessage(message: string | null | undefined): number | null {
  const match = /\brun\s+(\d+)\b/i.exec(message ?? "");
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function doorAuditRunLimitNotice(
  result: { truncated?: boolean; totalEligible?: number; styles?: unknown[] } | null | undefined,
): string | null {
  const shown = Array.isArray(result?.styles) ? result.styles.length : 0;
  const total = result?.totalEligible ?? shown;
  if (!result?.truncated || shown <= 0) return null;
  if (total > shown) {
    return `This run queued ${shown} of ${total} styles. Abandon it and start again if the server is still stopping early. Saved renders are kept.`;
  }
  return `This run queued ${shown} styles and stopped early. Abandon it and start again if the server is still stopping early. Saved renders are kept.`;
}

export function doorAuditStartRunInput(
  mode: DoorAuditRunMode,
  styleIds?: number[],
): { scope: DoorAuditBackendScope; styleIds?: number[]; renderingCommit: string } {
  const renderingCommit = DOOR_AUDIT_RENDERING_COMMIT;
  if (mode === "selected") {
    const ids = Array.from(new Set((styleIds ?? []).filter((id) => Number.isInteger(id) && id > 0)));
    if (ids.length === 0) throw new DoorAuditClientError("Select at least one door style.");
    return { scope: "selected", styleIds: ids, renderingCommit };
  }
  if (mode === "changed-only") return { scope: "changed", renderingCommit };
  return { scope: "all", renderingCommit };
}

export function normalizeDoorAuditStartRun(raw: unknown): DoorAuditStartRunResult {
  const record = asRecord(raw);
  if (!record) throw new DoorAuditClientError("The audit run did not return a response.");
  const runRecord = asRecord(record.run);
  const runId = positiveInt(record.runId ?? runRecord?.id ?? runRecord?.runId);
  if (runId == null) {
    throw new DoorAuditClientError("The audit run started, but the server did not return a run id.");
  }
  const list = styleListFrom(record);
  if (!list) {
    throw new DoorAuditClientError("The audit run started, but the server did not include the door styles to render.");
  }
  const renderingCommit = record.renderingCommit ?? runRecord?.renderingCommit;
  const styles = list.flatMap((item) => {
    const style = normalizeDoorAuditRenderInput(item, renderingCommit);
    return style ? [style] : [];
  });
  if (list.length > 0 && styles.length === 0) {
    throw new DoorAuditClientError("The server returned door styles the page could not read.");
  }
  const status = mapStatus(record.status ?? runRecord?.status);
  const totalEligible = finiteNumber(record.totalEligible) ?? styles.length;
  const truncated = record.truncated === true;
  return { runId, status, styles, truncated, totalEligible };
}

export function doorAuditApproveInput(input: { versionId: number; note?: string | null }): { versionId: number; note?: string } {
  const note = input.note?.trim().slice(0, 512) ?? "";
  return note ? { versionId: input.versionId, note } : { versionId: input.versionId };
}

export function doorAuditRevokeInput(input: { styleId: number; note?: string | null }): { styleId: number; note?: string } {
  const note = input.note?.trim().slice(0, 512) ?? "";
  return note ? { styleId: input.styleId, note } : { styleId: input.styleId };
}

export function doorAuditSubmitRenderInput(input: {
  runId: number;
  styleId: number;
  pngBase64: string;
  sourceFingerprint?: string | null;
}): {
  runId: number;
  styleId: number;
  imageBase64: string;
  contentType: "image/png";
  renderingCommit?: string;
} {
  const renderingCommit = input.sourceFingerprint?.trim().slice(0, 128) ?? "";
  return {
    runId: input.runId,
    styleId: input.styleId,
    imageBase64: input.pngBase64,
    contentType: "image/png",
    ...(renderingCommit ? { renderingCommit } : {}),
  };
}

export function doorAuditDecisionInput(input: { versionId: number; decision: "accept" | "reject" }) {
  return { versionId: input.versionId, decision: input.decision };
}

export function doorAuditRevertInput(input: { versionId: number }) {
  return { versionId: input.versionId };
}

function focusFromResults(results: unknown[]): { focusStyleId: number | null; focusLabel: string | null; pendingStyles: DoorAuditRenderInput[] } {
  const records = results.flatMap((item) => {
    const record = asRecord(item);
    return record ? [record] : [];
  });
  const pendingStyles = records
    .filter((row) => row.status === "pending_render" || row.status === "pending")
    .flatMap((row) => {
      const style = normalizeDoorAuditRenderInput(row);
      return style ? [style] : [];
    });
  const scoring = records.find((row) => row.status === "scoring");
  const focusRecord = scoring ?? records.find((row) => row.status === "pending_render" || row.status === "pending") ?? null;
  const focus = focusRecord ? normalizeDoorAuditRenderInput(focusRecord) : pendingStyles[0] ?? null;
  return {
    focusStyleId: focus?.styleId ?? null,
    focusLabel: focus ? doorAuditStyleLabel(focus) : null,
    pendingStyles,
  };
}

function isNormalizedRunStatus(record: Record<string, unknown>): record is Record<string, unknown> & {
  runId: number;
  status: DoorAuditRunStatusName;
  pendingStyles: unknown[];
} {
  return typeof record.runId === "number"
    && isNormalizedStatusName(record.status)
    && Array.isArray(record.pendingStyles)
    && !("results" in record)
    && !asRecord(record.run);
}

export function normalizeDoorAuditRunStatus(raw: unknown): DoorAuditRunStatus | null {
  if (raw == null) return null;
  const record = asRecord(raw);
  if (!record) return null;
  if (isNormalizedRunStatus(record)) {
    const pendingStyles = record.pendingStyles.flatMap((item: unknown) => {
      const style = normalizeDoorAuditRenderInput(item);
      return style ? [style] : [];
    });
    const status = record.status as DoorAuditRunStatusName;
    const runId = positiveInt(record.runId);
    if (runId == null) return null;
    return {
      runId,
      mode: mapMode(record.mode ?? record.scope),
      status,
      total: finiteNumber(record.total) ?? 0,
      uploaded: finiteNumber(record.uploaded) ?? 0,
      scored: finiteNumber(record.scored) ?? 0,
      failed: finiteNumber(record.failed) ?? 0,
      startedAt: toIso(record.startedAt) ?? "",
      finishedAt: toIso(record.finishedAt),
      error: text(record.error) ?? (status === "failed" ? "Door rendering audit failed." : null),
      pendingStyles,
      focusStyleId: positiveInt(record.focusStyleId) ?? pendingStyles[0]?.styleId ?? null,
      focusLabel: text(record.focusLabel) ?? (pendingStyles[0] ? doorAuditStyleLabel(pendingStyles[0]) : null),
    };
  }
  const run = asRecord(record.run) ?? record;
  const runId = positiveInt(run.runId ?? run.id);
  if (runId == null) return null;
  const progress = asRecord(record.progress) ?? {};
  const results = Array.isArray(record.results) ? record.results : [];
  const focus = focusFromResults(results);
  const total = finiteNumber(progress.total) ?? finiteNumber(run.selectedCount) ?? finiteNumber(run.total) ?? results.length;
  const pending = finiteNumber(progress.pending) ?? finiteNumber(run.pendingCount) ?? focus.pendingStyles.length;
  const status = mapStatus(run.status ?? record.status);
  const cancelled = run.status === "cancelled" || record.status === "cancelled";
  return {
    runId,
    mode: mapMode(run.scope ?? run.mode ?? record.scope ?? record.mode),
    status,
    total,
    uploaded: Math.max(0, total - pending),
    scored: finiteNumber(progress.scored) ?? finiteNumber(run.scoredCount) ?? finiteNumber(run.scored) ?? 0,
    failed: finiteNumber(progress.failed) ?? finiteNumber(run.failedCount) ?? finiteNumber(run.failed) ?? 0,
    startedAt: toIso(run.startedAt ?? run.createdAt) ?? "",
    finishedAt: toIso(run.finishedAt ?? run.completedAt),
    error: text(run.errorMessage) ?? text(run.error) ?? (cancelled ? "This audit run was stopped." : null),
    pendingStyles: focus.pendingStyles,
    focusStyleId: focus.focusStyleId,
    focusLabel: focus.focusLabel,
  };
}

export function normalizeDoorAuditRuns(raw: unknown): DoorAuditRunSummary[] {
  const record = asRecord(raw);
  const list = Array.isArray(raw) ? raw : Array.isArray(record?.runs) ? record.runs : [];
  return list.flatMap((item) => {
    const row = asRecord(item);
    if (!row) return [];
    const runId = positiveInt(row.runId ?? row.id);
    if (runId == null) return [];
    return [{
      runId,
      mode: mapMode(row.scope ?? row.mode),
      status: mapStatus(row.status),
      total: finiteNumber(row.total) ?? finiteNumber(row.selectedCount) ?? 0,
      scored: finiteNumber(row.scored) ?? finiteNumber(row.scoredCount) ?? 0,
      failed: finiteNumber(row.failed) ?? finiteNumber(row.failedCount) ?? 0,
      flagged: finiteNumber(row.flagged) ?? finiteNumber(row.flaggedCount) ?? 0,
      startedAt: toIso(row.startedAt ?? row.createdAt) ?? "",
      finishedAt: toIso(row.finishedAt ?? row.completedAt),
      startedByName: text(row.startedByName) ?? text(row.requestedByName),
    }];
  });
}

export function normalizeDoorAuditVersions(raw: unknown): DoorAuditVersion[] {
  const record = asRecord(raw);
  const list = Array.isArray(raw) ? raw : Array.isArray(record?.versions) ? record.versions : [];
  return list.flatMap((item) => {
    const version = normalizeVersion(item);
    return version ? [version] : [];
  });
}

export function enrichDoorAuditQueue(
  queue: readonly DoorAuditRenderInput[],
  catalog: readonly DoorAuditStyleRow[],
): DoorAuditRenderInput[] {
  const byId = new Map(catalog.map((style) => [style.styleId, style]));
  return queue.flatMap((style) => {
    if (!style || !Number.isInteger(style.styleId)) return [];
    const known = byId.get(style.styleId);
    if (!known) return [style];
    const baseline = comparisonBaseline({
      approvedReferenceImageUrl: known.approvedReference?.imageUrl,
      samplePhotoUrl: style.samplePhotoUrl ?? known.samplePhotoUrl,
    });
    return [{
      ...style,
      name: style.name && style.name !== "Door style" ? style.name : known.name,
      code: style.code ?? known.code,
      distributorName: style.distributorName ?? known.distributorName,
      samplePhotoUrl: baseline.imageUrl,
      needsDoorOnlyPhoto: baseline.source === "approved-reference" ? false : style.needsDoorOnlyPhoto,
      color: style.color ?? known.color,
      sourceFingerprint: style.sourceFingerprint || known.sourceFingerprint,
      doorProfile: profileIsBlank(style.doorProfile) ? known.doorProfile : style.doorProfile,
    }];
  });
}

export function assertDoorAuditRenderable(style: DoorAuditRenderInput | null | undefined): asserts style is DoorAuditRenderInput {
  if (!style || !Number.isInteger(style.styleId) || style.styleId <= 0) {
    throw new DoorAuditClientError("A selected door style was missing its id.");
  }
  if (!style.doorProfile) {
    throw new DoorAuditClientError(`${doorAuditStyleLabel(style)} is missing its door profile, so it cannot be rendered.`);
  }
}
