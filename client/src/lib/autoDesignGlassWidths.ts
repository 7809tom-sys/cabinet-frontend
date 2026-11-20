/**
 * Glass stackers need a matching upper width (Tom, Nov 20 2026).
 *
 * "Make sure you put the correct wall cabinet to insure glass stackers work": a
 * stacker only exists at certain widths, so letting the wall run pick a width with no
 * stacker silently costs that upper its glass - and today the whole run loses glass
 * because the rule is all-or-nothing.
 *
 * This filter removes the straight solid-door wall uppers whose width has no stacker in
 * the same line, leaving every width the line can actually glaze. Corner cabinets and
 * the stackers themselves are untouched: a corner is not a glass candidate, and the
 * stackers must survive the filter to be placed.
 *
 * Nothing is invented: a width survives only because the catalog already sells a
 * stacker in it.
 */
import type { DesignCabinet } from "./design";
import { autoDesignGlassStackerCatalog } from "./autoDesignFormOptions";

const WIDTH_MATCH_IN = 0.05;

function widthOf(row: DesignCabinet): number {
  const raw = row.width;
  const value = typeof raw === "number" ? raw : Number.parseFloat(String(raw ?? ""));
  return Number.isFinite(value) ? value : 0;
}

function codeOf(row: DesignCabinet): string {
  return String(row.masterCode ?? row.code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Straight solid-door uppers only: W, W2, W30, WD... but never DCW/WBC/stackers. */
function isStraightUpper(row: DesignCabinet): boolean {
  const code = codeOf(row);
  if (!/^W\d/.test(code)) return false;
  if (/^(DCW|WBC|WDC|WER)/.test(code)) return false;
  return true;
}

/** Widths this line can glaze, from its own stacker rows. */
export function autoDesignGlassWidths(wallCatalog: readonly DesignCabinet[]): number[] {
  const widths = new Set<number>();
  for (const row of autoDesignGlassStackerCatalog(wallCatalog)) {
    const width = widthOf(row);
    if (width > 0) widths.add(Math.round(width * 100) / 100);
  }
  return [...widths].sort((a, b) => a - b);
}

/**
 * Drop the straight uppers whose width has no stacker. Returns the catalog unchanged
 * when the line sells no stackers at all, so a non-glass line is never affected.
 */
export function onlyGlassCapableUppers(wallCatalog: readonly DesignCabinet[]): DesignCabinet[] {
  const widths = autoDesignGlassWidths(wallCatalog);
  if (widths.length === 0) return [...wallCatalog];
  return wallCatalog.filter((row) => {
    if (!isStraightUpper(row)) return true;
    const width = widthOf(row);
    return widths.some((wanted) => Math.abs(wanted - width) <= WIDTH_MATCH_IN);
  });
}