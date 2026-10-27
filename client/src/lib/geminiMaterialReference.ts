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
  /** Extra instruction kept in the audit details. Not a separate wire field. */
  fidelityNote?: string;
}): GeminiMaterialManifestEntry {
  const referenceUrl = entry.referenceUrl?.trim() || null;
  const referenceSource = referenceUrl ? "catalog-image" : "locked-designer-jpeg";
  const fidelityNote = entry.fidelityNote?.trim();
  const manifestEntry = { ...entry };
  delete manifestEntry.fidelityNote;
  return serializeGeminiMaterialManifestForWire([{
    ...manifestEntry,
    referenceUrl,
    referenceSource,
    provenance: `${entry.role}: ${entry.label}`,
    provenanceDetails: referenceUrl
      ? `${entry.role}: ${entry.label} [${entry.itemIds.join(", ")}] — supplied swatch${fidelityNote ? `. ${fidelityNote}` : ""}`
      : `${entry.role}: ${entry.label} [${entry.itemIds.join(", ")}] — no swatch. Automatically render from the locked Designer image and saved description. Inferred appearance, not a verified product match.`,
  }])[0]!;
}

export function geminiInferredMaterialLabels(entries: readonly GeminiMaterialManifestEntry[] | null | undefined): string[] {
  return Array.from(new Set((entries ?? [])
    .filter(entry => entry.referenceSource === "locked-designer-jpeg" && entry.role !== "hardware/handles")
    .map(entry => entry.label)));
}
