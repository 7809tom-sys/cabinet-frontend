/**
 * Auto Design finish picks from the intake ("What the customer wants").
 *
 * Tom, Nov 14 2026: every option picked in the Auto Design form must be placed
 * for real. Glass-door uppers and crown molding used to reach the plan only as
 * "not placed automatically" review lines. These helpers apply them with the
 * selected line's own catalog rows; a review line appears only when the line
 * lacks the SKU. Nothing here invents a SKU or a price.
 */
import { hasPreference, type AutoDesignIntake } from "./autoDesignFifteenRules";
import type { DesignerReviewFinding } from "./designerReviewFindings";
import { cabinetWall, glassStackerFamily, glassStackerParentPlacement, isFillerItem, isPanelItem, isStacker, ordinaryWallMountBottom, resolvedDesignCabinetDimensions, roomCeiling, wallRunOffset, wallRunSpan, type DesignCabinet, type PlacedCabinet, type RoomData } from "./design";
import { stackerDraft } from "./glassStackerBulkPlacement";
import { resolveWallHeightClass } from "./autoDesignWallCabinets";

const HEIGHT_MATCH_IN = 0.5;
const WIDTH_MATCH_IN = 0.05;

/**
 * Glass cabinets above (Tom, Nov 17 2026): "glass" means 12, 15 or 18 inch
 * GLASS STACKERS that sit on top of the regular uppers. It does NOT mean a GD
 * version of the 30/36/42 inch upper itself, so the regular uppers keep their
 * solid doors. The tallest stacker that fits between the top of the upper and
 * the ceiling is used: a 108 in ceiling over 30 in uppers at the 84 in line
 * takes 18 in stackers (top at 102 in); a 96 in ceiling takes 12 in.
 */
export const AUTO_DESIGN_GLASS_STACKER_HEIGHTS_IN = [18, 15, 12] as const;

function normalizedCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function catalogHeight(row: DesignCabinet): number {
  return resolvedDesignCabinetDimensions(row).height;
}

function catalogWidth(row: DesignCabinet): number {
  return resolvedDesignCabinetDimensions(row).width;
}

/** A blind-corner wall cabinet (WBC…): no straight glass stacker belongs on its blind side. */
function isBlindCornerWall(item: Pick<PlacedCabinet, "masterCode" | "description" | "subCategory">): boolean {
  return /^WBC/.test(normalizedCode(item.masterCode)) || /blind/i.test(`${item.subCategory ?? ""} ${item.description ?? ""}`);
}

/** The line's real 12/15/18 in glass stacker rows (GD, or PG on lines that sell PG stackers). */
export function autoDesignGlassStackerCatalog(wallCatalog: readonly DesignCabinet[]): DesignCabinet[] {
  return wallCatalog.filter((row) => {
    if (!(row.id > 0) || row.placement !== "wall") return false;
    const height = catalogHeight(row);
    if (!AUTO_DESIGN_GLASS_STACKER_HEIGHTS_IN.some((wanted) => Math.abs(height - wanted) <= HEIGHT_MATCH_IN)) return false;
    return isStacker({ ...row, height });
  });
}

/**
 * Glass is offered when "Glass cabinets above" is on, the line sells glass stackers,
 * and the shortest one (12 in) still fits between the upper run's top and the
 * ceiling. Where it is not offered the plain uppers (39s included) are unchanged.
 */
export function autoDesignGlassOffered(input: {
  intake: AutoDesignIntake | null | undefined;
  wallCatalog: readonly DesignCabinet[];
  room: RoomData;
  wallCabinetHeightIn: number;
}): boolean {
  return hasPreference(input.intake, "glass-uppers") && autoDesignLineTakesGlass(input);
}

/** The line-and-ceiling half of `autoDesignGlassOffered`, for callers that already know the preference is on. */
export function autoDesignLineTakesGlass(input: {
  wallCatalog: readonly DesignCabinet[];
  room: RoomData;
  wallCabinetHeightIn: number;
}): boolean {
  if (autoDesignGlassStackerCatalog(input.wallCatalog).length === 0) return false;
  const height = resolveWallHeightClass(input.wallCatalog, input.wallCabinetHeightIn) ?? input.wallCabinetHeightIn;
  const top = ordinaryWallMountBottom({ placement: "wall", height }) + height;
  return roomCeiling(input.room) - top >= Math.min(...AUTO_DESIGN_GLASS_STACKER_HEIGHTS_IN) - HEIGHT_MATCH_IN;
}

/**
 * The line's own glass stacker for this upper at one height: same width, same
 * wall family (a DCW diagonal stacker never lands on a straight W upper), and a
 * real priced catalog row. Never an invented SKU.
 */
export function glassStackerRowFor(
  parent: Pick<PlacedCabinet, "masterCode" | "width">,
  heightIn: number,
  stackerCatalog: readonly DesignCabinet[],
): DesignCabinet | null {
  const family = glassStackerFamily(parent);
  if (family == null) return null;
  return stackerCatalog.find((row) => Math.abs(catalogWidth(row) - (Number(parent.width) || 0)) <= WIDTH_MATCH_IN
    && Math.abs(catalogHeight(row) - heightIn) <= HEIGHT_MATCH_IN
    && glassStackerFamily(row) === family) ?? null;
}

type StackerPick =
  | { ok: true; stacker: PlacedCabinet; heightIn: number }
  | { ok: false; reason: "blind-corner" | "no-row" | "ceiling"; ceilingIn?: number; topIn?: number };

function pickStackerFor(parent: PlacedCabinet, placed: readonly PlacedCabinet[], room: RoomData, stackerCatalog: readonly DesignCabinet[]): StackerPick {
  if (isBlindCornerWall(parent)) return { ok: false, reason: "blind-corner" };
  let anyRow = false;
  let ceilingBlock: { ceilingIn?: number; topIn?: number } | null = null;
  for (const heightIn of AUTO_DESIGN_GLASS_STACKER_HEIGHTS_IN) {
    const row = glassStackerRowFor(parent, heightIn, stackerCatalog);
    if (!row) continue;
    anyRow = true;
    const draft = { ...stackerDraft(parent, row, parent), uid: `auto-glass-stacker-${parent.uid}` };
    const seat = glassStackerParentPlacement(draft, placed, room, parent.uid);
    if (seat.ok && seat.parentUid === parent.uid) {
      return {
        ok: true,
        heightIn,
        stacker: {
          ...draft,
          x: seat.x,
          y: seat.y,
          rotation: seat.rotation,
          mountBottom: seat.mountBottom,
          stackedOnCabinetUid: seat.parentUid,
          depthPositionAdjusted: true,
          glassDoor: true,
          noDoor: false,
          autoPlacedReason: "Glass cabinets above: glass stacker on top of the upper",
        } as PlacedCabinet,
      };
    }
    // Keep the last (shortest) height tried so the warning names the best case.
    if (!seat.ok && seat.reason === "ceiling") ceilingBlock = { ceilingIn: seat.ceiling, topIn: seat.requiredTop };
  }
  if (!anyRow) return { ok: false, reason: "no-row" };
  return { ok: false, reason: "ceiling", ...(ceilingBlock ?? {}) };
}

function inches(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return "?";
  return `${Math.round(value * 100) / 100}″`;
}

/** Two upper-band items closer than this belong to the same run (a seam, not a break). */
const RUN_JOIN_IN = 0.5;

export type AutoDesignUpperRun = { wallId: string; start: number; end: number; uppers: PlacedCabinet[] };

/**
 * Upper runs for the all-or-nothing glass rule (Tom, Nov 18 2026, 11:22 AM CT).
 *
 * A run is one continuous stretch of the upper band on ONE wall: the regular
 * uppers at the design height (the glass parents) plus the fillers between them,
 * butted within RUN_JOIN_IN. A run ends at a hard break:
 *  - open wall (a window, the range hood space, an open span) wider than RUN_JOIN_IN;
 *  - any other wall item: a range or refrigerator bridge, a hood, a panel, an
 *    open shelf, a cabinet at another height;
 *  - a tall cabinet or the refrigerator (they leave open upper band, so a gap);
 *  - the wall end (each wall is its own run; a corner upper belongs to the wall
 *    it is placed on).
 */
export function autoDesignUpperRuns(placed: readonly PlacedCabinet[], parents: readonly PlacedCabinet[], room: RoomData): AutoDesignUpperRun[] {
  const parentUids = new Set(parents.map((item) => item.uid));
  const runs: AutoDesignUpperRun[] = [];
  const walls = Array.from(new Set(parents.map((item) => cabinetWall(item, room)).filter(Boolean))) as string[];
  for (const wallId of walls) {
    const band = placed
      .filter((item) => item.placement === "wall" && !item.islandFace && !isStacker(item) && cabinetWall(item, room) === wallId)
      .map((item) => {
        const start = wallRunOffset(item, wallId, room);
        return { item, start, end: start + wallRunSpan(item, wallId, room) };
      })
      .sort((a, b) => a.start - b.start || a.end - b.end);
    let current: AutoDesignUpperRun | null = null;
    const close = () => { if (current && current.uppers.length) runs.push(current); current = null; };
    for (const entry of band) {
      const isParent = parentUids.has(entry.item.uid);
      const neutral = !isParent && isFillerItem(entry.item);
      if (!isParent && !neutral) { close(); continue; } // a bridge, hood, panel, shelf: hard break
      if (current && entry.start - current.end > RUN_JOIN_IN) close(); // open wall between: hard break
      if (!current) current = { wallId, start: entry.start, end: entry.end, uppers: [] };
      current.end = Math.max(current.end, entry.end);
      if (isParent) current.uppers.push(entry.item);
    }
    close();
  }
  return runs;
}

function stackerPass(input: {
  placed: readonly PlacedCabinet[];
  wallCatalog: readonly DesignCabinet[];
  room: RoomData;
  wallHeightIn: number | null;
}): { placed: PlacedCabinet[]; stackers: PlacedCabinet[]; findings: DesignerReviewFinding[] } {
  const placed = [...input.placed];
  const stackerCatalog = autoDesignGlassStackerCatalog(input.wallCatalog);
  const height = input.wallHeightIn;
  const occupied = new Set(placed.flatMap((item) => item.stackedOnCabinetUid ? [item.stackedOnCabinetUid] : []));
  // Only the ordinary uppers at the design height take a stacker. Bridges over
  // the range / refrigerator, fillers, panels, open shelves and existing
  // stackers are left alone.
  const parents = placed.filter((item) => item.placement === "wall"
    && !item.islandFace
    && item.noDoor !== true
    && !isFillerItem(item)
    && !isPanelItem(item)
    && !isStacker(item)
    && !occupied.has(item.uid)
    && height != null
    && Math.abs((Number(item.height) || 0) - height) <= HEIGHT_MATCH_IN);
  const stackers: PlacedCabinet[] = [];
  const findings: DesignerReviewFinding[] = [];
  const list = (codes: string[]) => Array.from(new Set(codes)).sort().join(", ");
  const plainRuns: string[] = [];
  const partialRuns: string[] = [];
  // Rule 1b was all-or-nothing (Tom, Nov 18 2026). Superseded on Nov 20 2026 after
  // the sample-drawing review: the refrigerator bay and the range bridge stayed
  // plain because one cabinet in the run had no stacker. Glass is now decided per
  // upper - every upper that has a same-width stacker gets one, and the rest are
  // named in a single info finding.
  for (const run of autoDesignUpperRuns(placed, parents, input.room)) {
    const picks: PlacedCabinet[] = [];
    const blockers: string[] = [];
    for (const parent of run.uppers) {
      const pick = pickStackerFor(parent, placed, input.room, stackerCatalog);
      if (pick.ok) { picks.push(pick.stacker); continue; }
      if (pick.reason === "blind-corner") blockers.push(`${parent.masterCode} (a blind corner takes no straight glass stacker)`);
      else if (pick.reason === "no-row") blockers.push(`${parent.masterCode} (this line sells no 12″, 15″ or 18″ glass stacker ${inches(Number(parent.width))} wide)`);
      else blockers.push(`${parent.masterCode} (even the shortest stacker would reach ${inches(pick.topIn)}; ceiling ${inches(pick.ceilingIn)})`);
    }
    // Glass is decided per upper, not per run (Tom, Nov 20 2026, sample-drawing review):
    // the refrigerator bay and the range bridge lost their glass because one cabinet in
    // the run had no stacker. Place every stacker the line sells and name the rest.
    if (picks.length > 0) stackers.push(...picks);
    if (blockers.length === 0) continue;
    const where = `the ${run.wallId} wall run ${inches(run.start)}–${inches(run.end)}`;
    if (picks.length === 0) plainRuns.push(`${where} (${run.uppers.map((item) => item.masterCode).join(", ")}) stays plain because of ${list(blockers)}`);
    else partialRuns.push(`${where}: ${list(blockers)}`);
  }
  if (partialRuns.length > 0) {
    findings.push({
      ruleId: "auto-design-rule-12",
      code: "preference-glass-partial",
      severity: "info",
      title: "Customer pick: Glass cabinets above (partly placed)",
      detail: `${stackers.length} wall cabinet${stackers.length === 1 ? "" : "s"} took a glass stacker. No stacker exists for ${partialRuns.join("; ")}. Those uppers keep their solid doors.`,
    });
  }
  if (plainRuns.length > 0) {
    findings.push({
      ruleId: "auto-design-rule-12",
      code: "preference-glass-run-plain",
      severity: "warning",
      title: "Customer pick: Glass cabinets above (no partial glass)",
      detail: `${stackers.length > 0 ? `Glass stackers placed above ${stackers.length} wall cabinet${stackers.length === 1 ? "" : "s"} in runs that are 100% glass. ` : ""}A run of uppers that cannot be 100% glass gets no glass at all: ${plainRuns.join("; ")}.`,
    });
  }
  // Glass above a pantry (Tom, Nov 20 2026, sample-drawing review): a tall cabinet
  // gets the same treatment as an upper - a 12/15/18 in glass stacker of its own width
  // on top. The stacker is a 12 in deep wall box and the pantry is deeper, so the
  // difference is reported as a skin the plan still needs rather than silently ignored;
  // no panel is placed here without the panel rules being settled.
  const pantryGlass: Array<{ parent: PlacedCabinet; stacker: PlacedCabinet; skinDepthIn: number }> = [];
  const pantries = placed.filter((item) => String(item.placement) === "tall"
    && !item.islandFace
    && item.noDoor !== true
    && !isFillerItem(item)
    && !isPanelItem(item)
    && !isStacker(item)
    && !occupied.has(item.uid));
  for (const pantry of pantries) {
    const top = (Number(pantry.mountBottom) || 0) + (Number(pantry.height) || 0);
    const pick = pickStackerFor(pantry, placed, input.room, stackerCatalog);
    if (!pick.ok) continue;
    if (top + Number(pick.stacker.height) > roomCeiling(input.room) + HEIGHT_MATCH_IN) continue;
    const stacker = stackerDraft(pantry, pick.stacker, pantry);
    pantryGlass.push({
      parent: pantry,
      stacker,
      skinDepthIn: Math.max(0, (Number(pantry.depth) || 0) - (Number(stacker.depth) || 0)),
    });
  }
  if (pantryGlass.length > 0) {
    stackers.push(...pantryGlass.map((entry) => entry.stacker));
    const needsSkin = pantryGlass.filter((entry) => entry.skinDepthIn > 0.5);
    findings.push({
      ruleId: "auto-design-rule-12",
      code: "preference-glass-pantry",
      severity: needsSkin.length > 0 ? "info" : "info",
      title: "Customer pick: Glass cabinets above (pantry)",
      detail: `${pantryGlass.length} tall cabinet${pantryGlass.length === 1 ? "" : "s"} took a glass stacker on top.${needsSkin.length > 0 ? ` A ${needsSkin.map((entry) => `${inches(entry.skinDepthIn)} skin`).filter((value, index, all) => all.indexOf(value) === index).join(" / ")} is needed to bring the stacker flush with the pantry front (${needsSkin.map((entry) => entry.parent.masterCode).join(", ")}).` : ""}`,
    });
  }
  if (parents.length === 0) {
    findings.push({
      ruleId: "auto-design-rule-12",
      code: "preference-glass-stackers-skipped",
      severity: "warning",
      title: "Customer pick: Glass cabinets above",
      detail: "No regular wall cabinet at the design height was found to put a glass stacker on.",
    });
  }
  const heights = Array.from(new Set(stackers.map((item) => Number(item.height))));
  if (heights.length > 1) {
    findings.push({
      ruleId: "auto-design-rule-12",
      code: "preference-glass-stackers-mixed-heights",
      severity: "info",
      title: "Glass stackers are not all the same height",
      detail: `The line does not sell every width at the tallest height that fits, so the stackers are ${heights.sort((a, b) => b - a).map((value) => inches(value)).join(" and ")} tall.`,
    });
  }
  return { placed: [...placed, ...stackers], stackers, findings };
}

/**
 * Glass cabinets above: the regular uppers stay solid and each one gets the
 * line's own same-width glass stacker on top (18, then 15, then 12 in, the
 * tallest that fits under the ceiling). The stackers are real plan items, so
 * the parts list, the price and the 3D view carry them. Glass is placed per upper
 * (Tom, Nov 20 2026): an upper that cannot carry a stacker (no same-width row, a
 * blind corner, the ceiling) keeps its solid door while its neighbours get glass,
 * and one info finding names the cabinets that were left plain.
 *
 * One-redraw rule: if the pass throws, it is retried once; a second failure is
 * shown on the review list and the plan keeps its solid uppers.
 */
export function applyGlassUpperPreference(input: {
  placed: readonly PlacedCabinet[];
  wallCatalog: readonly DesignCabinet[];
  intake: AutoDesignIntake | null | undefined;
  room: RoomData;
  /** The real catalog height the upper run used (for example 30.25 for a 30" class). */
  wallHeightIn: number | null;
}): { placed: PlacedCabinet[]; switched: number; stackers: PlacedCabinet[]; findings: DesignerReviewFinding[] } {
  const placed = [...input.placed];
  if (!hasPreference(input.intake, "glass-uppers")) return { placed, switched: 0, stackers: [], findings: [] };
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = stackerPass(input);
      return { placed: result.placed, switched: result.stackers.length, stackers: result.stackers, findings: result.findings };
    } catch (error) {
      lastError = error;
    }
  }
  return {
    placed,
    switched: 0,
    stackers: [],
    findings: [{
      ruleId: "auto-design-rule-12",
      code: "preference-glass-stackers-error",
      severity: "warning",
      title: "Customer pick: Glass cabinets above",
      detail: `Glass stackers could not be placed (tried twice): ${lastError instanceof Error ? lastError.message : String(lastError)}. Add them from the glass stacker tool.`,
    }],
  };
}

/** Trim the designer turns on for the intake picks (crown molding along the top of the uppers). */
export function autoDesignTrimFromIntake(intake: AutoDesignIntake | null | undefined): { crown: boolean } {
  return { crown: hasPreference(intake, "crown-molding") };
}
