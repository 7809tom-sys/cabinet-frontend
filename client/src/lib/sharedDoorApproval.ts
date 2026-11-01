/**
 * One approval per door style, shared by the Designer, the Door Rendering Audit
 * and Featured Styles. The backend keeps it as the style's accepted render;
 * this file only holds the labels and the request shapes the screens use.
 */

export const SHARED_APPROVAL_SOURCES = ["audit", "designer", "featured"] as const;
export type SharedApprovalSource = (typeof SHARED_APPROVAL_SOURCES)[number];

export const SHARED_APPROVAL_SOURCE_LABEL: Record<SharedApprovalSource, string> = {
  audit: "Door Rendering Audit",
  designer: "Designer",
  featured: "Featured Styles",
};

export type SharedDoorApproval = {
  styleId: number;
  versionId: number;
  source: SharedApprovalSource;
  renderImageUrl: string | null;
  renderHex: string | null;
  approvedDoorImageUrl: string | null;
  approvedDrawerImageUrl: string | null;
  approvedAt: string | null;
};

export function approvalSourceLabel(source: string | null | undefined): string {
  return SHARED_APPROVAL_SOURCES.includes(source as SharedApprovalSource)
    ? SHARED_APPROVAL_SOURCE_LABEL[source as SharedApprovalSource]
    : SHARED_APPROVAL_SOURCE_LABEL.audit;
}

/** "Approved in the Designer", "Approved in Featured Styles", "Approved in the Door Rendering Audit". */
export function approvalSummary(approval: Pick<SharedDoorApproval, "source"> | null | undefined): string {
  if (!approval) return "Not approved";
  const label = approvalSourceLabel(approval.source);
  return `Approved in ${approval.source === "designer" ? "the Designer" : approval.source === "audit" ? "the Door Rendering Audit" : label}`;
}

export function normalizeSharedApprovals(raw: unknown): Map<number, SharedDoorApproval> {
  const list = raw && typeof raw === "object" && Array.isArray((raw as { approvals?: unknown }).approvals)
    ? (raw as { approvals: unknown[] }).approvals
    : [];
  const out = new Map<number, SharedDoorApproval>();
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const styleId = Number(row.styleId);
    const versionId = Number(row.versionId);
    if (!Number.isInteger(styleId) || styleId <= 0 || !Number.isInteger(versionId) || versionId <= 0) continue;
    const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
    out.set(styleId, {
      styleId,
      versionId,
      source: SHARED_APPROVAL_SOURCES.includes(row.source as SharedApprovalSource) ? (row.source as SharedApprovalSource) : "audit",
      renderImageUrl: text(row.renderImageUrl),
      renderHex: text(row.renderHex),
      approvedDoorImageUrl: text(row.approvedDoorImageUrl),
      approvedDrawerImageUrl: text(row.approvedDrawerImageUrl),
      approvedAt: row.approvedAt == null ? null : String(row.approvedAt),
    });
  }
  return out;
}

export type ApproveDoorRequest =
  | { styleId: number; source: "designer"; imageBase64: string; contentType?: "image/png"; renderHex?: string | null; note?: string | null }
  | { styleId: number; source: "featured"; doorImageUrl: string; drawerImageUrl?: string | null; note?: string | null };

/** Builds the exact approveDoor request. Empty optional fields are left out. */
export function approveDoorInput(input: ApproveDoorRequest): Record<string, unknown> {
  const note = input.note?.trim().slice(0, 512);
  if (input.source === "designer") {
    const hex = input.renderHex?.trim();
    return {
      styleId: input.styleId,
      source: "designer",
      imageBase64: input.imageBase64,
      contentType: "image/png",
      ...(hex && /^#?[0-9a-fA-F]{6}$/.test(hex) ? { renderHex: hex } : {}),
      ...(note ? { note } : {}),
    };
  }
  const drawer = input.drawerImageUrl?.trim();
  return {
    styleId: input.styleId,
    source: "featured",
    doorImageUrl: input.doorImageUrl.trim(),
    ...(drawer ? { drawerImageUrl: drawer } : {}),
    ...(note ? { note } : {}),
  };
}
