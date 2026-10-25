export const GEMINI_MATERIAL_MANIFEST_PROVENANCE_MAX = 160;
export const GEMINI_MATERIAL_MANIFEST_WIRE_VERSION = "compact-provenance-v2" as const;

export type GeminiMaterialManifestWireEntry = {
  id: string;
  role: string;
  label: string;
  itemIds: string[];
  referenceUrl: string | null;
  referenceSource?: "catalog-image" | "locked-designer-jpeg";
  provenance: string;
  provenanceDetails?: string;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function compactToken(value: string, fallback: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

/** A stable browser/server-safe digest used only in the short descriptive wire field. */
function stableDigest(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

function compactReferenceId(id: string): string {
  if (id.length <= 72) return id;
  return `${id.slice(0, 60)}~${stableDigest(id)}`;
}

function compactProvenance(entry: GeminiMaterialManifestWireEntry): string {
  const source = entry.referenceSource ?? (entry.referenceUrl ? "catalog-image" : "locked-designer-jpeg");
  const reference = compactReferenceId(text(entry.id) || "material");
  const category = compactToken(text(entry.role), "material");
  const concise = `source:${source};ref:${reference};cat:${category}`;
  if (concise.length <= GEMINI_MATERIAL_MANIFEST_PROVENANCE_MAX) return concise;
  const fallback = `source:${source};ref:${stableDigest(reference)};cat:${category.slice(0, 48)}`;
  return fallback.slice(0, GEMINI_MATERIAL_MANIFEST_PROVENANCE_MAX);
}

/**
 * Preserves complete traceability outside the provider-bounded provenance field.
 * The image service receives only the compact `provenance`; source URLs, original
 * provenance, and item mappings remain in `provenanceDetails` for audit/replay.
 */
function fullProvenanceDetails(entry: GeminiMaterialManifestWireEntry): string {
  return [
    `source:${entry.referenceSource ?? (entry.referenceUrl ? "catalog-image" : "locked-designer-jpeg")}`,
    `referenceId:${entry.id}`,
    `category:${entry.role}`,
    `itemIds:${JSON.stringify(entry.itemIds)}`,
    `referenceUrl:${entry.referenceUrl ?? ""}`,
    `originalProvenance:${entry.provenance}`,
    `originalProvenanceDetails:${entry.provenanceDetails ?? ""}`,
  ].join("\n");
}

/**
 * The sole browser/server wire boundary for image-test material manifests.
 * It always replaces potentially stale client provenance with an auditable,
 * deterministic provider-safe string before request validation and submission.
 */
export function serializeGeminiMaterialManifestForWire<T extends GeminiMaterialManifestWireEntry>(entries: readonly T[]): Array<T & { provenance: string; provenanceDetails: string }> {
  return entries.map((entry) => ({
    ...entry,
    provenance: compactProvenance(entry),
    provenanceDetails: fullProvenanceDetails(entry),
  }));
}

/** The complete provenance shape placed in the final startGeminiImageTest tRPC JSON body. */
export function serializeGeminiImageTestProvenanceForWire<T extends { materialManifest: readonly GeminiMaterialManifestWireEntry[] }>(provenance: T): Omit<T, "materialManifest"> & {
  materialManifestWireVersion: typeof GEMINI_MATERIAL_MANIFEST_WIRE_VERSION;
  materialManifest: Array<GeminiMaterialManifestWireEntry & { provenance: string; provenanceDetails: string }>;
} {
  return {
    ...provenance,
    materialManifestWireVersion: GEMINI_MATERIAL_MANIFEST_WIRE_VERSION,
    materialManifest: serializeGeminiMaterialManifestForWire(provenance.materialManifest),
  };
}

/** Client-readable manifest failures that must disable the image-test action. */
export function geminiMaterialManifestWireValidationIssues(entries: readonly GeminiMaterialManifestWireEntry[]): string[] {
  const issues: string[] = [];
  for (const entry of entries) {
    const identity = `${entry.role || "material"} — ${entry.label || "unnamed entry"} [reference: ${entry.id || "missing"}]`;
    if (!text(entry.id) || text(entry.id).length > 160) issues.push(`${identity}: product/reference ID must be 1–160 characters`);
    if (!text(entry.role) || text(entry.role).length > 80) issues.push(`${identity}: category must be 1–80 characters`);
    if (!text(entry.label) || text(entry.label).length > 255) issues.push(`${identity}: label must be 1–255 characters`);
    if (!Array.isArray(entry.itemIds) || entry.itemIds.length === 0 || entry.itemIds.length > 500 || entry.itemIds.some((itemId) => !text(itemId) || text(itemId).length > 160)) {
      issues.push(`${identity}: plan-item mappings must be 1–500 non-empty IDs up to 160 characters`);
    }
    const source = entry.referenceSource ?? (entry.referenceUrl ? "catalog-image" : "locked-designer-jpeg");
    if (source !== "catalog-image" && source !== "locked-designer-jpeg") issues.push(`${identity}: unsupported material source`);
    if (source === "catalog-image" && !text(entry.referenceUrl)) issues.push(`${identity}: exact catalog image is required`);
    if (source === "locked-designer-jpeg" && entry.referenceUrl !== null) issues.push(`${identity}: locked-image references cannot include a catalog URL`);
    if (!text(entry.provenance) || text(entry.provenance).length > GEMINI_MATERIAL_MANIFEST_PROVENANCE_MAX) issues.push(`${identity}: compact provenance must be 1–${GEMINI_MATERIAL_MANIFEST_PROVENANCE_MAX} characters`);
  }
  return issues;
}

export function hasCurrentGeminiMaterialManifestWireVersion(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && (value as { materialManifestWireVersion?: unknown }).materialManifestWireVersion === GEMINI_MATERIAL_MANIFEST_WIRE_VERSION);
}
