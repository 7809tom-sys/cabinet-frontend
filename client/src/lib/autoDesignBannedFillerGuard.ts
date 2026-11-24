/**
 * End-of-generation guard: no BFF or fluted filler in a generated plan.
 *
 * PERMANENT / HIGH-PRIORITY rule (Tom, owner voice, Nov 24 2026, 11:58 AM CT): fluted fillers
 * and BFF fillers are never used in any generated Auto Design plan. Every automatic picker
 * already skips them through `isBannedAutoDesignFiller` (catalogFillerForGap and the wall-blind
 * picker). This pass is the backstop for a path that slipped: after the plan is built, every
 * placed filler is scanned. A banned one is swapped for the line's plain filler of the same
 * stock (same layer, cut to the same installed width, same position and miter), or dropped with
 * a report note when the line sells no plain filler that covers it. Nothing is invented.
 *
 * Manual use is untouched: BFF / fluted products stay in the catalog for a person to add.
 */
import {
  catalogFillerForGap,
  fittedCatalogFillerDescription,
  isBannedAutoDesignFiller,
  isCatalogFiller,
  isFillerOverlay,
  type CatalogFillerCandidate,
  type CatalogFillerPlacement,
} from "./catalogFiller";
import type { DesignerReviewFinding } from "./designerReviewFindings";
import { formatEighthInches, isFillerItem, type PlacedCabinet } from "./design";

export type BannedFillerGuardResult = {
  placed: PlacedCabinet[];
  notes: string[];
  swapped: { uid: string; from: string; to: string }[];
  dropped: { uid: string; masterCode: string }[];
};

/** A placed piece that is a filler (or a filler overlay) and is banned from generated plans. */
export function isBannedPlacedAutoDesignFiller(item: {
  masterCode: string; description?: string | null; category?: string | null; subCategory?: string | null;
  fillerForCabinetUid?: string | null; fillerPieceGroupId?: string | null;
}): boolean {
  if (!isBannedAutoDesignFiller(item)) return false;
  const code = String(item.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^(?:BFF|WFF)/.test(code) || isFillerItem(item)
    || isCatalogFiller({ masterCode: item.masterCode, description: item.description ?? "", category: item.category ?? null, subCategory: item.subCategory ?? null })
    || isFillerOverlay(item);
}

function layerOf(item: PlacedCabinet): CatalogFillerPlacement {
  return item.placement === "wall" ? "wall" : item.placement === "tall" ? "tall" : "base";
}

export function enforceAutoDesignFillerBan(
  placed: readonly PlacedCabinet[],
  catalogFillers: readonly CatalogFillerCandidate[],
  /** Pieces a person put on the plan before the build (manual use stays allowed). */
  keepUids: ReadonlySet<string> = new Set(),
): BannedFillerGuardResult {
  const notes: string[] = [];
  const swapped: BannedFillerGuardResult["swapped"] = [];
  const dropped: BannedFillerGuardResult["dropped"] = [];
  const out: PlacedCabinet[] = [];
  for (const item of placed) {
    if (keepUids.has(item.uid) || !isBannedPlacedAutoDesignFiller(item)) {
      out.push(item);
      continue;
    }
    const installed = Number(item.width) || 0;
    const stockNeed = Math.max(installed, Number(item.fillerTransitionStockWidthIn) || 0);
    const stock = stockNeed > 0 ? catalogFillerForGap(catalogFillers, stockNeed, layerOf(item)) : null;
    if (stock) {
      out.push({
        ...item,
        cabinetId: stock.id,
        masterCode: stock.masterCode,
        // A mitered corner board keeps its cut instructions; only the stock code changes.
        description: /miter/i.test(String(item.description ?? ""))
          ? String(item.description).split(item.masterCode).join(stock.masterCode)
          : fittedCatalogFillerDescription(stock, installed),
        category: stock.category ?? item.category,
        subCategory: stock.subCategory ?? item.subCategory,
        catalogImageUrl: stock.catalogImageUrl ?? null,
      } as PlacedCabinet);
      swapped.push({ uid: item.uid, from: item.masterCode, to: stock.masterCode });
      notes.push(`No fluted or BFF fillers (Tom, Nov 24 2026): ${item.masterCode} ${formatEighthInches(installed)} became the plain ${stock.masterCode} filler.`);
    } else {
      dropped.push({ uid: item.uid, masterCode: item.masterCode });
      notes.push(`No fluted or BFF fillers (Tom, Nov 24 2026): ${item.masterCode} ${formatEighthInches(installed)} was removed and the line sells no plain filler that covers it, so that ${formatEighthInches(installed)} is left open for review.`);
    }
  }
  return { placed: out, notes, swapped, dropped };
}

/** Review-list line for the report when the guard had to act (null when nothing slipped through). */
export function bannedFillerFinding(result: BannedFillerGuardResult): DesignerReviewFinding | null {
  if (!result.swapped.length && !result.dropped.length) return null;
  return {
    ruleId: "no-fluted-or-bff-fillers",
    code: "banned-filler-replaced",
    severity: result.dropped.length ? "warning" : "info",
    title: "No fluted or BFF fillers in a generated plan",
    detail: result.notes.join(" "),
  } as DesignerReviewFinding;
}
