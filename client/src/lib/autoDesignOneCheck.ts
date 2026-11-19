/**
 * Auto Design "one check": a single pass over a finished design that answers pass or
 * fail and lists the problems per cabinet (Tom, voice, Nov 18 2026, 6:06-6:07 PM CT).
 *
 * This module is PURE and READ-ONLY. It reads placements, the room, openings and the
 * line's catalog rows. It never moves, adds or removes a cabinet. It lives next to
 * the layout engine but changes no layout, 3D, Wall Builder or database code.
 *
 * The ten checks (ids in `ONE_CHECK_IDS`):
 *  1  bases-present            no missing base spot on a run (kitchen only)
 *  2  glass-stackers           a glass stacker above every upper that can take one (kitchen only)
 *  3  no-39-where-glass        no 39 in wall cabinet where glass is offered; uppers sized
 *                              base-first and square over the base below (kitchen only)
 *  4  no-filler-outside-panel  no filler outside an exposed or fridge panel
 *                              (a filler INSIDE a fridge panel is fine)
 *  5  corner-filler            a corner filler is a horizontal clearance filler, never a
 *                              vertical decorative strip, and carries a written reason
 *  6  one-door-style           one door style for the whole design (390009 shaker, or the
 *                              style the caller selects)
 *  7  one-crown-height         one crown / top line for the regular uppers
 *  8  drawer-banks             drawer banks only beside the range (kitchen only)
 *  9  island-aisle             island aisle 42 in, 48 in when ADA (kitchen only)
 * 10  ada-styles-offered       when the design is ADA, only ADA cabinets the catalog really
 *                              sells (see `catalogAdaHook`)
 *
 * Bathrooms: kitchen-only checks (1, 2, 3, 8, 9) are skipped and listed in
 * `checksSkipped`. Checks 4, 5, 6, 7 and 10 apply to both. One `ada` toggle covers both.
 *
 * Only NEW problems fail the check. Pass `baseline` (a list of problem keys, see
 * `oneCheckProblemKey` / `oneCheckBaselineKeys`) and a problem already in it is reported
 * under `known` and does not count. Severity "warning" is reported but never fails.
 */
import { parseCatalogNomenclature } from "@shared/catalogNomenclature";
import {
  cabinetWall,
  effectiveStyleId,
  isCornerCabinet,
  isFillerItem,
  isPanelItem,
  isRangeOrOven,
  isStacker,
  placedFootprint,
  wallRunFrame,
  wallRunOffset,
  wallRunSpan,
  elevationBox,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
} from "./design";
import { autoDesignGlassStackerCatalog, autoDesignUpperRuns, glassStackerRowFor, AUTO_DESIGN_GLASS_STACKER_HEIGHTS_IN } from "./autoDesignFormOptions";
import { cornerLegSpanOnWall } from "./autoDesignUpperAlignment";
import { fillersOutsideExposedPanels } from "./fillerOutsideExposedPanel";
import { isRequiredBlindCornerFillerGroupId } from "./blindCornerRequiredFiller";

export const ONE_CHECK_IDS = [
  "bases-present",
  "glass-stackers",
  "no-39-where-glass",
  "uppers-square-over-bases",
  "no-filler-outside-panel",
  "corner-filler",
  "one-door-style",
  "one-crown-height",
  "drawer-banks",
  "island-aisle",
  "ada-styles-offered",
] as const;
export type OneCheckId = (typeof ONE_CHECK_IDS)[number];

export type OneCheckKind = "kitchen" | "bathroom";
export type OneCheckSeverity = "error" | "warning";

export type OneCheckProblem = {
  check: OneCheckId;
  code: string;
  severity: OneCheckSeverity;
  /** The cabinet the problem is about; null for a design-level problem. */
  cabinetUid: string | null;
  cabinetCode: string | null;
  wallId: string | null;
  message: string;
  /** Stable fingerprint for the baseline (check, code, SKU, wall, position). */
  key: string;
};

/** ADA data hook. The default reads the catalog's own marker (see `catalogAdaHook`). */
export type OneCheckAdaHook = {
  /** True when this catalog row / placed cabinet is an ADA-compliant cabinet. */
  isAdaCabinet(item: { masterCode?: string | null; category?: string | null; subCategory?: string | null }): boolean;
  /** The structural code with the ADA marker removed (B24ADA -> B24), or null when not ADA. */
  adaCoreCode(item: { masterCode?: string | null }): string | null;
};

/**
 * How the catalog marks ADA today (searched repo + public design.placeableCabinets reads,
 * Nov 18 2026): there is NO dedicated database flag. ADA is a positional marker in the
 * master code (`B24ADA` and `ADA-B24` are the same cabinet, `shared/catalogNomenclature`)
 * and, on lines that sell it, the category "ADA" / "American disability act cabinet".
 * No line is hard-coded here. A line with no marked rows simply offers no ADA cabinets.
 */
export const catalogAdaHook: OneCheckAdaHook = {
  isAdaCabinet(item) {
    const code = String(item.masterCode ?? "");
    if (code && parseCatalogNomenclature(code).isAdaAccessible === true) return true;
    return /^ada\b|american disabilit/i.test(String(item.category ?? "")) || /^ada\b|american disabilit/i.test(String(item.subCategory ?? ""));
  },
  adaCoreCode(item) {
    const code = String(item.masterCode ?? "");
    if (!code) return null;
    return parseCatalogNomenclature(code).adaCoreCode ?? null;
  },
};

export type OneCheckOptions = {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  /** Defaults to "kitchen". */
  kind?: OneCheckKind;
  openings?: readonly WallOpening[];
  /** The line's wall rows. Needed to know where glass is offered. */
  wallCatalog?: readonly DesignCabinet[];
  /** The line's base rows (plus vanity). Needed to know which ADA cabinets are offered. */
  baseCatalog?: readonly DesignCabinet[];
  /** The design is set to ADA (one toggle for kitchen and bathroom). */
  ada?: boolean;
  adaHook?: OneCheckAdaHook;
  /** The customer asked for glass uppers. Default: true when the plan already has a glass stacker. */
  glassUppers?: boolean;
  /** An island was requested (the engine does not build one yet). */
  islandExpected?: boolean;
  /** The style every cabinet must carry (390009 for the shaker check). Default: the plan's style. */
  expectedStyleId?: number | null;
  /** Style a cabinet without its own styleId inherits. */
  defaultStyleId?: number | null;
  /** The design wall-cabinet height (30/36/42). Default: the most common regular upper height. */
  upperHeightIn?: number | null;
  /** Problem keys already known; they are listed under `known` and never fail the check. */
  baseline?: readonly string[];
};

export type OneCheckResult = {
  /** True when there is no NEW error. */
  ok: boolean;
  kind: OneCheckKind;
  ada: boolean;
  /** New problems (not in the baseline). Errors fail the check, warnings do not. */
  problems: OneCheckProblem[];
  /** Problems found that the baseline already lists. */
  known: OneCheckProblem[];
  /** New problems grouped by cabinet uid (design-level ones under "(design)"). */
  byCabinet: Record<string, OneCheckProblem[]>;
  checksRun: OneCheckId[];
  checksSkipped: { check: OneCheckId; reason: string }[];
  cabinetsChecked: number;
  /** Plain-language summary for a report. */
  summary: string;
};

const TOL = 0.25;
const SEAM_TOL = 0.5;
const DESIGN_LEVEL = "(design)";
export const ONE_CHECK_ISLAND_AISLE_IN = 42;
export const ONE_CHECK_ISLAND_AISLE_ADA_IN = 48;
/** A filler this close to a run end that meets another wall is a corner filler. */
export const ONE_CHECK_CORNER_ZONE_IN = 6;
const MIN_REASON_CHARS = 6;

const round = (value: number) => Math.round(value * 100) / 100;
const inch = (value: number) => `${round(value)}″`;
const num = (value: unknown, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

/** Stable fingerprint of a problem, used for the baseline. */
export function oneCheckProblemKey(problem: Pick<OneCheckProblem, "check" | "code" | "cabinetCode" | "wallId"> & { at?: number | null }): string {
  return [problem.check, problem.code, problem.cabinetCode ?? "-", problem.wallId ?? "-", problem.at == null ? "-" : String(round(problem.at))].join("|");
}

/** The baseline for a result: feed `oneCheckBaselineKeys(resultOnMain)` back in as `baseline`. */
export function oneCheckBaselineKeys(result: Pick<OneCheckResult, "problems" | "known">): string[] {
  return Array.from(new Set([...result.problems, ...result.known].map((problem) => problem.key))).sort();
}

type Wall = string;
type Span = { start: number; end: number };

function wallOf(item: PlacedCabinet, room: RoomData): Wall | null {
  if (item.islandFace || !item.wallId) return null;
  return cabinetWall(item, room);
}

function span(item: PlacedCabinet, wall: Wall, room: RoomData): Span {
  const start = wallRunOffset(item, wall, room);
  return { start, end: start + wallRunSpan(item, wall, room) };
}

function merge(spans: Span[], tol = TOL): Span[] {
  const sorted = spans.filter((s) => s.end - s.start > 0.01).sort((a, b) => a.start - b.start);
  const out: Span[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.start <= last.end + tol) last.end = Math.max(last.end, s.end);
    else out.push({ ...s });
  }
  return out;
}

const isFloorLayer = (item: PlacedCabinet) => item.placement === "base" || item.placement === "appliance" || item.placement === "tall";

/** Floor coverage on one wall, corner legs included, fillers and panels included. */
function floorSpans(placed: readonly PlacedCabinet[], room: RoomData, wall: Wall): Span[] {
  const spans: Span[] = [];
  for (const item of placed) {
    if (!isFloorLayer(item) || item.islandFace) continue;
    if (item.placement === "appliance" && item.applianceRole === "countertop-opening") continue; // microwave over the range
    const leg = cornerLegSpanOnWall(item, wall, room);
    if (leg) { spans.push(leg); continue; }
    if (wallOf(item, room) !== wall) continue;
    spans.push(span(item, wall, room));
  }
  return merge(spans);
}

function doorLikeOpenings(openings: readonly WallOpening[] | undefined, wall: Wall): Span[] {
  return (openings ?? [])
    .filter((o) => o.side === wall && (o.kind === "door" || o.kind === "opening"))
    .map((o) => ({ start: num(o.offset), end: num(o.offset) + num(o.width) }));
}

type Collector = {
  add(problem: Omit<OneCheckProblem, "key" | "severity"> & { severity?: OneCheckSeverity; at?: number | null }): void;
};

/* 1 ------------------------------------------------------------------------------------------ */
function checkBasesPresent(o: OneCheckOptions, out: Collector) {
  const { placed, room } = o;
  const walls = Array.from(new Set(placed.filter(isFloorLayer).map((item) => wallOf(item, room)).filter((w): w is Wall => Boolean(w))));
  for (const wall of walls) {
    const frame = wallRunFrame(wall, room);
    if (!frame) continue;
    const spans = floorSpans(placed, room, wall);
    if (!spans.length) continue;
    const doors = doorLikeOpenings(o.openings, wall);
    const overDoor = (s: Span) => doors.some((d) => s.start >= d.start - 1 && s.end <= d.end + 1);
    const report = (s: Span, where: "between" | "start" | "end") => {
      const width = s.end - s.start;
      if (width <= TOL || overDoor(s)) return;
      if (where !== "between" && width < 3) return;
      const missing = width >= 6;
      out.add({
        check: "bases-present",
        code: missing ? "base-spot-missing" : "base-gap-unfilled",
        severity: where === "between" || missing ? "error" : "warning",
        cabinetUid: null, cabinetCode: null, wallId: wall, at: s.start,
        message: missing
          ? `${wall} wall: no base cabinet for the ${inch(width)} spot at ${inch(s.start)}–${inch(s.end)}${where === "between" ? "" : " at the run " + where}.`
          : `${wall} wall: ${inch(width)} left open at ${inch(s.start)}–${inch(s.end)}, under 6″ and with no filler on it.`,
      });
    };
    for (let i = 1; i < spans.length; i += 1) report({ start: spans[i - 1].end, end: spans[i].start }, "between");
    // Run ends: the perpendicular run's own depth covers its corner square.
    const first = spans[0];
    const last = spans[spans.length - 1];
    const startCover = Math.max(0, ...placed.filter((p) => isFloorLayer(p) && wallOf(p, room) !== wall && !p.islandFace && wallOf(p, room) && nearEnd(p, wall, room, "start")).map((p) => num(p.depth)));
    const endCover = Math.max(0, ...placed.filter((p) => isFloorLayer(p) && wallOf(p, room) !== wall && !p.islandFace && wallOf(p, room) && nearEnd(p, wall, room, "end")).map((p) => num(p.depth)));
    if (first.start - frame.runStart - startCover > TOL) report({ start: frame.runStart + startCover, end: first.start }, "start");
    if (frame.runEnd - last.end - endCover > TOL) report({ start: last.end, end: frame.runEnd - endCover }, "end");
  }
}

/** True when the cabinet's footprint touches the given end vertex of the wall run. */
function nearEnd(item: PlacedCabinet, wall: Wall, room: RoomData, at: "start" | "end"): boolean {
  const frame = wallRunFrame(wall, room);
  if (!frame) return false;
  const vertex = at === "start" ? frame.start : frame.end;
  const foot = placedFootprint(item);
  const dx = Math.max(item.x - vertex.x, 0, vertex.x - (item.x + foot.w));
  const dy = Math.max(item.y - vertex.y, 0, vertex.y - (item.y + foot.d));
  return Math.hypot(dx, dy) <= 1;
}

/* helpers for uppers ------------------------------------------------------------------------- */
const isBlindCornerWall = (item: Pick<PlacedCabinet, "masterCode" | "description" | "subCategory">) =>
  /^WBC/.test(String(item.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")) || /blind/i.test(`${item.subCategory ?? ""} ${item.description ?? ""}`);

function isRegularUpperCandidate(item: PlacedCabinet): boolean {
  return item.placement === "wall" && !item.islandFace && !isFillerItem(item) && !isPanelItem(item) && !isStacker(item) && item.noDoor !== true;
}

const isBridgeLike = (item: PlacedCabinet) =>
  item.refrigeratorAssemblyRole != null || item.overRangeMicrowaveBridge === true || /hood|microwave|bridge/i.test(`${item.description ?? ""} ${item.subCategory ?? ""}`);

function upperTop(item: PlacedCabinet, room: RoomData): number {
  const box = elevationBox(item, room);
  return box.bottom + box.height;
}

function designUpperHeight(o: OneCheckOptions): number | null {
  if (o.upperHeightIn != null) return o.upperHeightIn;
  const counts = new Map<number, number>();
  for (const item of o.placed) {
    if (!isRegularUpperCandidate(item) || isBridgeLike(item)) continue;
    const h = round(num(item.height));
    if (h >= 24) counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestCount = 0;
  Array.from(counts.entries()).forEach(([h, c]) => { if (c > bestCount) { best = h; bestCount = c; } });
  return best;
}

function parentsAtDesignHeight(o: OneCheckOptions): PlacedCabinet[] {
  const height = designUpperHeight(o);
  if (height == null) return [];
  return o.placed.filter((item) => isRegularUpperCandidate(item) && !isBridgeLike(item) && Math.abs(num(item.height) - height) <= 0.5);
}

function glassIsRequested(o: OneCheckOptions): boolean {
  if (o.glassUppers != null) return o.glassUppers;
  return o.placed.some((item) => isStacker(item));
}

/* 2 ------------------------------------------------------------------------------------------ */
function checkGlassStackers(o: OneCheckOptions, out: Collector): string | null {
  if (!glassIsRequested(o)) return "no glass uppers requested and none in the plan";
  if (!o.wallCatalog) return "no wall catalog given, so \"glass offered\" cannot be decided";
  const { placed, room } = o;
  const catalog = autoDesignGlassStackerCatalog(o.wallCatalog);
  const ceiling = num(room.ceilingHeight, 96);
  const parents = parentsAtDesignHeight(o);
  const stackerOn = new Map<string, PlacedCabinet>();
  for (const item of placed) if (item.stackedOnCabinetUid && isStacker(item)) stackerOn.set(item.stackedOnCabinetUid, item);
  const offered = (parent: PlacedCabinet): boolean => {
    if (isBlindCornerWall(parent)) return false;
    const top = upperTop(parent, room);
    return AUTO_DESIGN_GLASS_STACKER_HEIGHTS_IN.some((h) => glassStackerRowFor(parent, h, catalog) != null && top + h <= ceiling + 0.01);
  };
  for (const run of autoDesignUpperRuns(placed, parents, room)) {
    const withStacker = run.uppers.filter((u) => stackerOn.has(u.uid));
    const allOffered = run.uppers.every(offered);
    if (allOffered && withStacker.length < run.uppers.length) {
      for (const parent of run.uppers.filter((u) => !stackerOn.has(u.uid))) {
        out.add({ check: "glass-stackers", code: "glass-stacker-missing", cabinetUid: parent.uid, cabinetCode: parent.masterCode, wallId: run.wallId, at: wallRunOffset(parent, run.wallId, room),
          message: `${parent.masterCode} on the ${run.wallId} wall has no glass stacker, but this line sells one that fits.` });
      }
    } else if (!allOffered && withStacker.length > 0) {
      out.add({ check: "glass-stackers", code: "glass-partial-run", cabinetUid: null, cabinetCode: null, wallId: run.wallId, at: run.start,
        message: `The ${run.wallId} wall run ${inch(run.start)}–${inch(run.end)} has glass on ${withStacker.length} of ${run.uppers.length} uppers; a run is all glass or none.` });
    }
  }
  for (const stacker of placed.filter((item) => isStacker(item))) {
    const parent = placed.find((item) => item.uid === stacker.stackedOnCabinetUid);
    const wall = wallOf(stacker, room);
    if (!parent) {
      out.add({ check: "glass-stackers", code: "glass-stacker-orphan", cabinetUid: stacker.uid, cabinetCode: stacker.masterCode, wallId: wall, message: `${stacker.masterCode} is a glass stacker with no cabinet under it.` });
      continue;
    }
    const sBox = elevationBox(stacker, room);
    const widthOff = Math.abs(num(stacker.width) - num(parent.width));
    const seatOff = Math.abs(sBox.bottom - upperTop(parent, room));
    if (widthOff > 0.05 || seatOff > 0.3 || sBox.bottom + sBox.height > ceiling + 0.01) {
      out.add({ check: "glass-stackers", code: "glass-stacker-misfit", cabinetUid: stacker.uid, cabinetCode: stacker.masterCode, wallId: wall,
        message: `${stacker.masterCode} does not sit square on ${parent.masterCode}: width off ${inch(widthOff)}, seat off ${inch(seatOff)}${sBox.bottom + sBox.height > ceiling + 0.01 ? ", runs past the ceiling" : ""}.` });
    }
  }
  return null;
}

/* 3 ------------------------------------------------------------------------------------------ */
function checkUppers(o: OneCheckOptions, out: Collector, note: { no39?: string }) {
  const { placed, room } = o;
  // 3a: no 39 wall cabinet where glass is offered.
  const glassOffered = glassIsRequested(o) && (o.wallCatalog ? autoDesignGlassStackerCatalog(o.wallCatalog).length > 0 : placed.some((item) => isStacker(item)));
  if (!glassIsRequested(o)) note.no39 = "no glass uppers requested and none in the plan";
  if (glassOffered) {
    for (const item of placed) {
      if (item.placement !== "wall" || isStacker(item) || isFillerItem(item) || isPanelItem(item) || item.islandFace) continue;
      if (Math.abs(num(item.width) - 39) > 0.05) continue;
      out.add({ check: "no-39-where-glass", code: "wall-39-where-glass", cabinetUid: item.uid, cabinetCode: item.masterCode, wallId: wallOf(item, room),
        at: wallOf(item, room) ? wallRunOffset(item, wallOf(item, room)!, room) : null,
        message: `${item.masterCode} is a 39″ wall cabinet and no 39″ glass exists; size it from the base below to a width that comes in glass.` });
    }
  }
  // 3b: uppers square over the base below, sized base-first.
  const walls = Array.from(new Set(placed.filter((i) => i.placement === "wall").map((i) => wallOf(i, room)).filter((w): w is Wall => Boolean(w))));
  for (const wall of walls) {
    const frame = wallRunFrame(wall, room);
    if (!frame) continue;
    const floor = floorSpans(placed, room, wall);
    if (!floor.length) continue;
    const seams: number[] = [frame.runStart, frame.runEnd];
    const boxes: Span[] = [];
    for (const item of placed) {
      // A corner cabinet in ANY layer owns a leg on this wall; its edge is a seam.
      const leg = cornerLegSpanOnWall(item, wall, room);
      if (leg) { seams.push(leg.start, leg.end); boxes.push(leg); continue; }
      if (!isFloorLayer(item) || item.islandFace || (item.placement === "appliance" && item.applianceRole === "countertop-opening")) continue;
      if (wallOf(item, room) !== wall) continue;
      const s = span(item, wall, room);
      seams.push(s.start, s.end);
      boxes.push(s);
    }
    for (const op of o.openings ?? []) if (op.side === wall) seams.push(num(op.offset), num(op.offset) + num(op.width));
    const onSeamAt = (x: number) => seams.some((seam) => Math.abs(seam - x) <= SEAM_TOL);
    const layer = placed.filter((i) => i.placement === "wall" && wallOf(i, room) === wall && !isStacker(i));
    const baseRot = frame.facingRotation;
    for (const upper of layer) {
      if (isFillerItem(upper) || isPanelItem(upper)) continue;
      if (isCornerCabinet(upper.masterCode, upper.description, upper.cornerType ?? null) || upper.turnedSideways || isBlindCornerWall(upper)) continue;
      const s = span(upper, wall, room);
      const rot = (((Math.round(num(upper.rotation)) % 360) + 360) % 360);
      const want = (((Math.round(baseRot) % 360) + 360) % 360);
      if (rot !== want && !upper.refrigeratorAssemblyRole) {
        out.add({ check: "uppers-square-over-bases", code: "upper-not-square", cabinetUid: upper.uid, cabinetCode: upper.masterCode, wallId: wall, at: s.start,
          message: `${upper.masterCode} on the ${wall} wall is turned ${rot}° where the wall faces ${want}°; an upper sits square to its wall and the base below.` });
      }
      // Over bare wall: part of the span with no floor box under it (and no opening there).
      const covered = floor.reduce((sum, f) => sum + Math.max(0, Math.min(f.end, s.end) - Math.max(f.start, s.start)), 0);
      const overhang = (s.end - s.start) - covered;
      const openingUnder = (o.openings ?? []).some((op) => op.side === wall && s.start >= num(op.offset) - 1 && s.end <= num(op.offset) + num(op.width) + 1);
      if (overhang > SEAM_TOL && !openingUnder) {
        out.add({ check: "uppers-square-over-bases", code: "upper-over-bare-wall", cabinetUid: upper.uid, cabinetCode: upper.masterCode, wallId: wall, at: s.start,
          message: `${upper.masterCode} on the ${wall} wall hangs ${inch(overhang)} of its ${inch(s.end - s.start)} over bare wall with no base below.` });
        continue;
      }
      // Edges: each upper edge lands on a base seam, a wall end, a window edge, or the edge of the upper beside it.
      const neighbours = layer.filter((n) => n.uid !== upper.uid).map((n) => ({ item: n, ...span(n, wall, room) }));
      for (const [label, edge] of [["start", s.start], ["end", s.end]] as const) {
        if (onSeamAt(edge)) continue;
        const touching = neighbours.find((n) => Math.abs((label === "start" ? n.end : n.start) - edge) <= TOL);
        if (touching) {
          const regular = !isFillerItem(touching.item) && !isPanelItem(touching.item);
          const farEdge = label === "start" ? touching.start : touching.end;
          const insideOneBox = boxes.some((b) => edge > b.start + SEAM_TOL && edge < b.end - SEAM_TOL);
          // A pair that tiles one base (21 + 21 over a 42), or a filler/panel whose far edge is on a seam.
          if (regular ? insideOneBox : onSeamAt(farEdge)) continue;
        }
        out.add({ check: "uppers-square-over-bases", code: "upper-edge-off-base-seam", cabinetUid: upper.uid, cabinetCode: upper.masterCode, wallId: wall, at: s.start,
          message: `${upper.masterCode} on the ${wall} wall ${label === "start" ? "starts" : "ends"} at ${inch(edge)}, which is not on a base seam; size the upper from the base below so it lines up.` });
        break;
      }
    }
  }
}

/* 4 ------------------------------------------------------------------------------------------ */
function checkFillersOutsidePanels(o: OneCheckOptions, out: Collector) {
  for (const hit of fillersOutsideExposedPanels({ placed: o.placed, room: o.room, openings: o.openings })) {
    out.add({ check: "no-filler-outside-panel", code: "filler-outside-panel", cabinetUid: hit.filler.uid, cabinetCode: hit.filler.masterCode, wallId: hit.wallId,
      at: wallRunOffset(hit.filler, hit.wallId, o.room),
      message: `${hit.filler.masterCode} filler (${inch(num(hit.filler.width))}) sits on the outside of the ${hit.panel.masterCode} panel (${hit.farSide} beyond); a filler never goes past an exposed or fridge panel.` });
  }
}

/* 5 ------------------------------------------------------------------------------------------ */
const hasReason = (item: PlacedCabinet) => `${item.autoPlacedReason ?? ""}`.trim().length >= MIN_REASON_CHARS || `${item.fieldModificationNote ?? ""}`.trim().length >= MIN_REASON_CHARS;

function isStructuralCornerFiller(item: PlacedCabinet): boolean {
  return item.integratedWallBlindFiller === true || isRequiredBlindCornerFillerGroupId(item.fillerPieceGroupId) || item.fillerTransitionKind != null || item.fillerMiterAngle != null;
}

/** A filler at a room corner: tagged by the engine, or inside the corner zone of a run end that meets a wall. */
function isCornerFiller(item: PlacedCabinet, room: RoomData): boolean {
  if (isStructuralCornerFiller(item)) return true;
  const wall = wallOf(item, room);
  if (!wall) return false;
  const frame = wallRunFrame(wall, room);
  if (!frame) return false;
  const s = span(item, wall, room);
  return s.start - frame.runStart <= ONE_CHECK_CORNER_ZONE_IN || frame.runEnd - s.end <= ONE_CHECK_CORNER_ZONE_IN;
}

function checkCornerFillers(o: OneCheckOptions, out: Collector) {
  for (const item of o.placed) {
    if (!isFillerItem(item) || item.islandFace) continue;
    if (!isCornerFiller(item, o.room)) continue;
    const wall = wallOf(item, o.room);
    const at = wall ? wallRunOffset(item, wall, o.room) : null;
    const vertical = item.fillerContinuousVertical === true || (item.placement === "base" && num(item.height) > 40);
    // Required engine fillers (3″ blind, 45° miter, wedge) are structural: they may be tall boards,
    // but they still carry a reason. A plain strip at a corner must be a horizontal clearance filler.
    if (vertical && !isStructuralCornerFiller(item)) {
      out.add({ check: "corner-filler", code: "corner-filler-vertical", cabinetUid: item.uid, cabinetCode: item.masterCode, wallId: wall, at,
        message: `${item.masterCode} filler at the ${wall ?? "room"} corner is a vertical decorative strip; a corner filler is a horizontal clearance filler (door swing), not a cover for a gap.` });
    }
    if (!hasReason(item)) {
      out.add({ check: "corner-filler", code: "corner-filler-no-reason", cabinetUid: item.uid, cabinetCode: item.masterCode, wallId: wall, at,
        message: `${item.masterCode} filler (${inch(num(item.width))}) at the ${wall ?? "room"} corner has no written reason on the plan (door swing clearance, blind corner, miter).` });
    }
  }
}

/* 6 ------------------------------------------------------------------------------------------ */
function checkDoorStyle(o: OneCheckOptions, out: Collector) {
  const cabinets = o.placed.filter((item) => item.placement === "base" || item.placement === "wall" || item.placement === "tall");
  const styleOf = (item: PlacedCabinet) => effectiveStyleId(item, o.defaultStyleId ?? null);
  const styles = Array.from(new Set(cabinets.map(styleOf)));
  const expected = o.expectedStyleId ?? null;
  if (expected != null) {
    for (const item of cabinets) {
      if (styleOf(item) === expected) continue;
      out.add({ check: "one-door-style", code: "door-style-mismatch", cabinetUid: item.uid, cabinetCode: item.masterCode, wallId: wallOf(item, o.room),
        message: `${item.masterCode} is on door style ${styleOf(item) ?? "none"}, not ${expected}.` });
    }
    return;
  }
  if (styles.length <= 1) return;
  const tally = new Map<number | null, number>();
  for (const item of cabinets) tally.set(styleOf(item), (tally.get(styleOf(item)) ?? 0) + 1);
  const main = Array.from(tally.entries()).sort((a, b) => b[1] - a[1])[0][0];
  for (const item of cabinets.filter((c) => styleOf(c) !== main)) {
    out.add({ check: "one-door-style", code: "door-style-mixed", cabinetUid: item.uid, cabinetCode: item.masterCode, wallId: wallOf(item, o.room),
      message: `${item.masterCode} is on door style ${styleOf(item) ?? "none"} while the kitchen is ${main ?? "unstyled"}; one door style per design.` });
  }
}

/* 7 ------------------------------------------------------------------------------------------ */
function checkCrown(o: OneCheckOptions, out: Collector) {
  const { placed, room } = o;
  const stackerOf = new Map<string, PlacedCabinet>();
  for (const item of placed) if (item.stackedOnCabinetUid && isStacker(item)) stackerOf.set(item.stackedOnCabinetUid, item);
  const columnTop = (item: PlacedCabinet) => {
    const stacker = stackerOf.get(item.uid);
    return stacker ? Math.max(upperTop(item, room), upperTop(stacker, room)) : upperTop(item, room);
  };
  const isCorner = (item: PlacedCabinet) => isCornerCabinet(item.masterCode, item.description, item.cornerType ?? null);
  const regular = placed.filter((item) => isRegularUpperCandidate(item) && !isBridgeLike(item) && !isCorner(item));
  if (regular.length < 2) return;
  const tally = new Map<number, number>();
  for (const item of regular) tally.set(round(columnTop(item)), (tally.get(round(columnTop(item))) ?? 0) + 1);
  const line = Array.from(tally.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
  for (const item of regular) {
    const top = columnTop(item);
    if (Math.abs(top - line) <= TOL) continue;
    const wall = wallOf(item, room);
    out.add({ check: "one-crown-height", code: "crown-height-split", cabinetUid: item.uid, cabinetCode: item.masterCode, wallId: wall, at: wall ? wallRunOffset(item, wall, room) : null,
      message: `${item.masterCode} tops out at ${inch(top)} but the crown line is ${inch(line)}; one crown height for the whole design.` });
  }
  // Over-appliance cabinets (range bridge, fridge cap) follow their own heights, but a bridge that
  // stops below the crown line while its neighbours run to it breaks the line: warn, never fail.
  for (const item of placed.filter((p) => isRegularUpperCandidate(p) && isBridgeLike(p) && !/microwave|hood/i.test(`${p.description ?? ""}`))) {
    const top = columnTop(item);
    if (top < line - TOL) {
      const wall = wallOf(item, room);
      out.add({ check: "one-crown-height", code: "bridge-below-crown-line", severity: "warning", cabinetUid: item.uid, cabinetCode: item.masterCode, wallId: wall, at: wall ? wallRunOffset(item, wall, room) : null,
        message: `${item.masterCode} (over an appliance) tops out at ${inch(top)}, ${inch(line - top)} under the crown line of ${inch(line)}.` });
    }
  }
}

/* 8 ------------------------------------------------------------------------------------------ */
const DRAWER_BANK = /^(?:ADA-?)?\d?V?DB\d/i;
function checkDrawerBanks(o: OneCheckOptions, out: Collector) {
  const { placed, room } = o;
  for (const item of placed.filter((p) => p.placement === "wall" && !p.islandFace && ((num(p.numberOfDrawers) > 0) || /^WD\d/i.test(p.masterCode ?? "")))) {
    out.add({ check: "drawer-banks", code: "drawer-in-upper-run", cabinetUid: item.uid, cabinetCode: item.masterCode, wallId: wallOf(item, room),
      message: `${item.masterCode} puts drawers in an upper run; drawer banks belong in the base layer.` });
  }
  const ranges = placed.filter((p) => p.placement === "appliance" && isRangeOrOven(p.masterCode, p.description));
  const banks = placed.filter((p) => p.placement === "base" && !p.islandFace && !isFillerItem(p) && DRAWER_BANK.test((p.masterCode ?? "").trim()));
  for (const bank of banks) {
    const wall = wallOf(bank, room);
    if (!wall) continue;
    const s = span(bank, wall, room);
    const beside = ranges.some((range) => {
      if (wallOf(range, room) !== wall) return false;
      const r = span(range, wall, room);
      // Beside the range: touching, or across a filler / panel of up to 3″.
      const gapAfter = s.start - r.end;
      const gapBefore = r.start - s.end;
      return (gapAfter >= -TOL && gapAfter <= 3 + TOL) || (gapBefore >= -TOL && gapBefore <= 3 + TOL);
    });
    if (!beside) {
      out.add({ check: "drawer-banks", code: "drawer-bank-not-by-range", cabinetUid: bank.uid, cabinetCode: bank.masterCode, wallId: wall, at: s.start,
        message: ranges.length
          ? `${bank.masterCode} is a drawer bank that is not beside the range; drawer banks go beside the range.`
          : `${bank.masterCode} is a drawer bank but the design has no range for it to stand beside.` });
    }
  }
}

/* 9 ------------------------------------------------------------------------------------------ */
type Rect = { x: number; y: number; w: number; d: number };
const rectOf = (p: PlacedCabinet): Rect => { const f = placedFootprint(p); return { x: num(p.x), y: num(p.y), w: f.w, d: f.d }; };

function checkIsland(o: OneCheckOptions, out: Collector): string | null {
  const { placed, room } = o;
  const islandItems = placed.filter((p) => p.placement === "base" && !p.floorOccupancyObstacle && (p.islandFace != null || (!p.wallId && !p.peninsulaWizardId)));
  if (!islandItems.length) {
    if (o.islandExpected) {
      out.add({ check: "island-aisle", code: "island-missing", severity: "warning", cabinetUid: null, cabinetCode: null, wallId: null, message: "An island was requested but the design has none, so its aisle cannot be checked." });
      return null;
    }
    return "no island in the design";
  }
  const rects = islandItems.map(rectOf);
  const box = {
    x1: Math.min(...rects.map((r) => r.x)), y1: Math.min(...rects.map((r) => r.y)),
    x2: Math.max(...rects.map((r) => r.x + r.w)), y2: Math.max(...rects.map((r) => r.y + r.d)),
  };
  const need = o.ada ? ONE_CHECK_ISLAND_AISLE_ADA_IN : ONE_CHECK_ISLAND_AISLE_IN;
  const islandUids = new Set(islandItems.map((p) => p.uid));
  const obstacles = placed.filter((p) => isFloorLayer(p) && !islandUids.has(p.uid) && !p.islandFace && p.wallId && !(p.placement === "appliance" && p.applianceRole === "countertop-opening")).map(rectOf);
  const overlap = (a1: number, a2: number, b1: number, b2: number) => Math.min(a2, b2) - Math.max(a1, b1) > 0.5;
  const sides = [
    { name: "north", gap: () => { const hits = obstacles.filter((r) => overlap(r.x, r.x + r.w, box.x1, box.x2) && r.y + r.d <= box.y1 + TOL); const edge = Math.max(0, ...hits.map((r) => r.y + r.d)); return { gap: box.y1 - edge, cabinets: hits.length > 0 }; } },
    { name: "south", gap: () => { const hits = obstacles.filter((r) => overlap(r.x, r.x + r.w, box.x1, box.x2) && r.y >= box.y2 - TOL); const edge = Math.min(num(room.depth), ...hits.map((r) => r.y)); return { gap: edge - box.y2, cabinets: hits.length > 0 }; } },
    { name: "west", gap: () => { const hits = obstacles.filter((r) => overlap(r.y, r.y + r.d, box.y1, box.y2) && r.x + r.w <= box.x1 + TOL); const edge = Math.max(0, ...hits.map((r) => r.x + r.w)); return { gap: box.x1 - edge, cabinets: hits.length > 0 }; } },
    { name: "east", gap: () => { const hits = obstacles.filter((r) => overlap(r.y, r.y + r.d, box.y1, box.y2) && r.x >= box.x2 - TOL); const edge = Math.min(num(room.width), ...hits.map((r) => r.x)); return { gap: edge - box.x2, cabinets: hits.length > 0 }; } },
  ];
  for (const side of sides) {
    const { gap, cabinets } = side.gap();
    if (gap >= need - TOL) continue;
    out.add({ check: "island-aisle", code: cabinets ? "island-aisle-short" : "island-wall-clearance-short", severity: cabinets ? "error" : "warning",
      cabinetUid: islandItems[0].uid, cabinetCode: islandItems[0].masterCode, wallId: side.name,
      message: `Island ${side.name} side has ${inch(gap)} of aisle${cabinets ? " to the cabinets" : " to the wall"}; ${o.ada ? "ADA needs" : "the rule is"} ${need}″.` });
  }
  return null;
}

/* 10 ----------------------------------------------------------------------------------------- */
function checkAda(o: OneCheckOptions, out: Collector): string | null {
  const hook = o.adaHook ?? catalogAdaHook;
  const { placed, room } = o;
  const counterBases = placed.filter((p) => p.placement === "base" && !isFillerItem(p) && !isPanelItem(p) && !/accessory/i.test(String(p.category ?? "")));
  if (!counterBases.length) return null;
  const offered = (o.baseCatalog ?? []).filter((row) => hook.isAdaCabinet(row));
  if (o.baseCatalog && offered.length === 0) {
    out.add({ check: "ada-styles-offered", code: "ada-line-offers-none", cabinetUid: null, cabinetCode: null, wallId: null,
      message: "The design is set to ADA but this line's catalog offers no ADA-compliant cabinets (none marked ADA), so an ADA design cannot pass on this line." });
    return null;
  }
  const normalized = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const offeredCores = new Set(offered.map((row) => hook.adaCoreCode(row)).filter((c): c is string => Boolean(c)).map(normalized));
  for (const item of counterBases) {
    if (hook.isAdaCabinet(item)) continue;
    const twin = o.baseCatalog ? offeredCores.has(normalized(item.masterCode ?? "")) : null;
    const wall = wallOf(item, room);
    out.add({ check: "ada-styles-offered", code: twin === false ? "ada-no-version-offered" : "ada-base-not-ada", cabinetUid: item.uid, cabinetCode: item.masterCode, wallId: wall,
      at: wall ? wallRunOffset(item, wall, room) : null,
      message: twin === false
        ? `${item.masterCode} is not ADA and the line offers no ADA version of it; pick a cabinet the line sells in ADA.`
        : twin === true
          ? `${item.masterCode} is not ADA but the line sells an ADA version; use it.`
          : `${item.masterCode} is not an ADA cabinet.` });
  }
  return null;
}

/* run ---------------------------------------------------------------------------------------- */
export function runOneCheck(options: OneCheckOptions): OneCheckResult {
  const kind: OneCheckKind = options.kind ?? "kitchen";
  const ada = options.ada === true;
  const raw: OneCheckProblem[] = [];
  const collector: Collector = {
    add(problem) {
      raw.push({
        severity: problem.severity ?? "error",
        check: problem.check, code: problem.code, cabinetUid: problem.cabinetUid, cabinetCode: problem.cabinetCode, wallId: problem.wallId, message: problem.message,
        key: oneCheckProblemKey({ check: problem.check, code: problem.code, cabinetCode: problem.cabinetCode, wallId: problem.wallId, at: problem.at ?? null }),
      });
    },
  };
  const run: OneCheckId[] = [];
  const skipped: { check: OneCheckId; reason: string }[] = [];
  const kitchenOnly = (id: OneCheckId, fn: () => string | null | void) => {
    if (kind !== "kitchen") { skipped.push({ check: id, reason: "kitchen-only check, skipped for a bathroom" }); return; }
    const why = fn();
    if (why) skipped.push({ check: id, reason: why }); else run.push(id);
  };
  const both = (id: OneCheckId, fn: () => string | null | void) => {
    const why = fn();
    if (why) skipped.push({ check: id, reason: why }); else run.push(id);
  };

  kitchenOnly("bases-present", () => { checkBasesPresent(options, collector); });
  kitchenOnly("glass-stackers", () => checkGlassStackers(options, collector));
  const note: { no39?: string } = {};
  if (kind === "kitchen") {
    checkUppers(options, collector, note);
    run.push("uppers-square-over-bases");
    if (note.no39) skipped.push({ check: "no-39-where-glass", reason: note.no39 }); else run.push("no-39-where-glass");
  } else {
    skipped.push({ check: "no-39-where-glass", reason: "kitchen-only check, skipped for a bathroom" });
    skipped.push({ check: "uppers-square-over-bases", reason: "kitchen-only check, skipped for a bathroom" });
  }
  both("no-filler-outside-panel", () => { checkFillersOutsidePanels(options, collector); });
  both("corner-filler", () => { checkCornerFillers(options, collector); });
  both("one-door-style", () => { checkDoorStyle(options, collector); });
  both("one-crown-height", () => { checkCrown(options, collector); });
  kitchenOnly("drawer-banks", () => { checkDrawerBanks(options, collector); });
  kitchenOnly("island-aisle", () => checkIsland(options, collector));
  if (ada) both("ada-styles-offered", () => checkAda(options, collector));
  else skipped.push({ check: "ada-styles-offered", reason: "design is not set to ADA" });

  const baseline = new Set(options.baseline ?? []);
  const problems = raw.filter((p) => !baseline.has(p.key));
  const known = raw.filter((p) => baseline.has(p.key));
  const byCabinet: Record<string, OneCheckProblem[]> = {};
  for (const problem of problems) (byCabinet[problem.cabinetUid ?? DESIGN_LEVEL] ??= []).push(problem);
  const errors = problems.filter((p) => p.severity === "error");
  const cabinetsChecked = options.placed.filter((p) => p.placement === "base" || p.placement === "wall" || p.placement === "tall" || p.placement === "appliance").length;
  const warnings = problems.length - errors.length;
  return {
    ok: errors.length === 0, kind, ada, problems, known, byCabinet, checksRun: run, checksSkipped: skipped, cabinetsChecked,
    summary: errors.length === 0
      ? `PASS: ${cabinetsChecked} pieces checked, no new errors${warnings ? `, ${warnings} warning${warnings === 1 ? "" : "s"}` : ""}${known.length ? `, ${known.length} known problem${known.length === 1 ? "" : "s"} ignored` : ""}.`
      : `FAIL: ${errors.length} new error${errors.length === 1 ? "" : "s"} across ${new Set(errors.map((e) => e.cabinetUid ?? DESIGN_LEVEL)).size} cabinet${new Set(errors.map((e) => e.cabinetUid ?? DESIGN_LEVEL)).size === 1 ? "" : "s"}${warnings ? `, ${warnings} warning${warnings === 1 ? "" : "s"}` : ""}${known.length ? `, ${known.length} known ignored` : ""}.`,
  };
}

/** Readable report: one line per problem, grouped by check. */
export function formatOneCheckReport(result: OneCheckResult): string {
  const lines = [result.summary];
  for (const id of ONE_CHECK_IDS) {
    const mine = result.problems.filter((p) => p.check === id);
    if (!mine.length) continue;
    lines.push(`[${id}]`);
    for (const p of mine) lines.push(`  ${p.severity.toUpperCase()} ${p.cabinetCode ?? "(design)"}${p.wallId ? ` @${p.wallId}` : ""}: ${p.message}`);
  }
  return lines.join("\n");
}
