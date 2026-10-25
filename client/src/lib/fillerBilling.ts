import type { PlacedCabinet } from "@/lib/design";
import { isFillerItem } from "@/lib/design";

/** A gap at or below one inch is field-cut from another ordered filler. */
export const COMBINED_FILLER_MAX_IN = 1;

export function installedFillerCutWidthIn(cabinet: Pick<PlacedCabinet, "width" | "fillerTotalWidth">): number {
  const cut = Number(cabinet.fillerTotalWidth);
  if (Number.isFinite(cut) && cut > 0) return cut;
  return Number(cabinet.width) || 0;
}

export function isCombinedSmallFiller(cabinet: PlacedCabinet, placed: readonly PlacedCabinet[]): boolean {
  if (!isFillerItem(cabinet) || cabinet.fillerBillingRole === "secondary") return false;
  if (installedFillerCutWidthIn(cabinet) > COMBINED_FILLER_MAX_IN + 0.001) return false;
  return placed.some((candidate) =>
    candidate.uid !== cabinet.uid
    && isFillerItem(candidate)
    && candidate.fillerBillingRole !== "secondary"
    && installedFillerCutWidthIn(candidate) > COMBINED_FILLER_MAX_IN + 0.001,
  );
}

export function fillerCutSourceFor(cabinet: PlacedCabinet, placed: readonly PlacedCabinet[]): PlacedCabinet | null {
  if (!isCombinedSmallFiller(cabinet, placed)) return null;
  return placed.find((candidate) =>
    candidate.uid !== cabinet.uid
    && isFillerItem(candidate)
    && candidate.fillerBillingRole !== "secondary"
    && installedFillerCutWidthIn(candidate) > COMBINED_FILLER_MAX_IN + 0.001,
  ) ?? null;
}

export function combinedFillerNote(cabinet: PlacedCabinet, placed: readonly PlacedCabinet[]): string | null {
  const source = fillerCutSourceFor(cabinet, placed);
  if (!source) return null;
  const cut = installedFillerCutWidthIn(cabinet);
  return `Includes ${formatCut(cut)} field-cut from ${source.masterCode} already on order`;
}

function formatCut(value: number): string {
  const rounded = Math.round(value * 16) / 16;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}\"`;
}
