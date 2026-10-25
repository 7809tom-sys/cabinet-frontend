import type { GeminiMaterialManifestEntry } from "./geminiHardwareReference";
import { serializeGeminiMaterialManifestForWire } from "@shared/geminiMaterialManifest";

/** A missing swatch must not prevent the requested image. It is an explicitly
 * inferred visual based on the locked scene, never an invented catalog asset. */
export function geminiMaterialReference(entry: {
  id: string;
  role: string;
  label: string;
  itemIds: string[];
  referenceUrl: string | null | undefined;
}): GeminiMaterialManifestEntry {
  const referenceUrl = entry.referenceUrl?.trim() || null;
  const referenceSource = referenceUrl ? "catalog-image" : "locked-designer-jpeg";
  return serializeGeminiMaterialManifestForWire([{
    ...entry,
    referenceUrl,
    referenceSource,
    provenance: `${entry.role}: ${entry.label}`,
    provenanceDetails: referenceUrl
      ? `${entry.role}: ${entry.label} [${entry.itemIds.join(", ")}] — supplied swatch`
      : `${entry.role}: ${entry.label} [${entry.itemIds.join(", ")}] — no swatch. Automatically render from the locked Designer image and saved description. Inferred appearance, not a verified product match.`,
  }])[0]!;
}

export function geminiInferredMaterialLabels(entries: readonly GeminiMaterialManifestEntry[] | null | undefined): string[] {
  return Array.from(new Set((entries ?? [])
    .filter(entry => entry.referenceSource === "locked-designer-jpeg" && entry.role !== "hardware/handles")
    .map(entry => entry.label)));
}
