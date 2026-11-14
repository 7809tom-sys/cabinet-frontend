// Pure logic for the Auto Design 15-rule spec (no React, no network).
// Used by runAutoDesignLayout and the Auto Design dialog.
//
// Hard rules honored here:
//  - Downsizes (sink base 36->33->30, fridge 36->30) are SUGGESTIONS ONLY.
//    Nothing in this file mutates a placed cabinet's width or SKU.
//  - Never invent a SKU/master code; only reference rows that exist in the line.

import {
  dim,
  wallRunOffset,
  wallRunSpan,
  isSinkBaseCabinet,
  isRefrigerator,
  isRangeOrOven,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "./design";
import {
  pickAutoDesignSinkBase,
  autoBuildStraightBaseCatalog,
  type AutoDesignKind,
  type WallLabel,
} from "./autoDesignAutoBuild";
import type { DesignerReviewFinding } from "./designerReviewFindings";
import { isTallOvenPantryBox } from "./pelicanBoxCoverage";

// ---------------------------------------------------------------------------
// Shared private helpers
// ---------------------------------------------------------------------------

const WALL_SIDES: readonly WallSide[] = ["top", "right", "bottom", "left"];

function isWallSide(id: string | null | undefined): id is WallSide {
  return id === "top" || id === "right" || id === "bottom" || id === "left";
}

/** Filler detection per spec: masterCode like F12 / BF12 / WF12 / TF12 / FILLER, or description mentions filler. */
function isFillerCabinet(c: { masterCode?: string | null; description?: string | null }): boolean {
  const code = c.masterCode ?? "";
  if (/^(?:B|W|T)?F\d|FILLER/i.test(code)) return true;
  if (/filler/i.test(c.description ?? "")) return true;
  return false;
}

function isCornerBaseCode(masterCode: string | null | undefined): boolean {
  return /^(?:BBC|BLS|LS|LSB|CB)/i.test(masterCode ?? "");
}

function isOvenCabinet(c: PlacedCabinet): boolean {
  // isTallOvenPantryBox covers tall oven OR pantry; narrow to oven.
  const row = {
    id: c.cabinetId,
    masterCode: c.masterCode,
    description: c.description,
    category: c.category ?? null,
    subCategory: c.subCategory ?? null,
    width: null,
    height: null,
    depth: null,
    placement: c.placement,
  } as DesignCabinet;
  if (!isTallOvenPantryBox(row)) return false;
  if (/oven/i.test(c.description ?? "")) return true;
  return /^(?:UOC|TOS|TOD|O3)/i.test(c.masterCode ?? "");
}

/** Format inches with at most one decimal, dropping ".0". */
function fmtIn(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function roleLabel(role: "sink" | "refrigerator" | "range"): string {
  if (role === "sink") return "sink";
  if (role === "refrigerator") return "refrigerator";
  return "range";
}

// ---------------------------------------------------------------------------
// Rule 11, 2, 12: the intake asked before any layout math
// ---------------------------------------------------------------------------

export type ConstructionType = "new" | "old";
export type UtilityId = "electrical" | "plumbing" | "rangeHookup" | "sinkBase";

export const UTILITY_QUESTIONS: readonly { id: UtilityId; label: string; question: string }[] = [
  {
    id: "electrical",
    label: "Electrical",
    question: "Can the electrical (refrigerator outlet) move three inches one way or the other?",
  },
  {
    id: "plumbing",
    label: "Plumbing",
    question: "Can the plumbing move three inches one way or the other?",
  },
  {
    id: "rangeHookup",
    label: "Range hookup",
    question: "Can I move my range three inches one way or the other?",
  },
  {
    id: "sinkBase",
    label: "Sink base",
    question: "Can the sink base move three inches one way or the other?",
  },
];

export type PreferenceId =
  | "budget-friendly"
  | "lots-of-drawers"
  | "blind-corner"
  | "lazy-susan"
  | "glass-uppers"
  | "crown-molding"
  | "dishwasher";

export const PREFERENCE_OPTIONS: readonly { id: PreferenceId; label: string; hint: string }[] = [
  {
    id: "budget-friendly",
    label: "Budget friendly",
    hint: "Build the kitchen the most inexpensive way possible",
  },
  {
    id: "lots-of-drawers",
    label: "A lot of drawers",
    hint: "Prefer drawer bases over door bases wherever it makes sense",
  },
  {
    id: "blind-corner",
    label: "Blind corner cabinet",
    hint: "Use a blind corner base at the corner",
  },
  {
    id: "lazy-susan",
    label: "Lazy Susan",
    hint: "The layout finds the corner and plans around it",
  },
  {
    id: "glass-uppers",
    label: "Glass cabinets above",
    hint: "Glass-door wall cabinets above the counter",
  },
  {
    id: "crown-molding",
    label: "Crown molding",
    hint: "Crown molding along the top of the wall cabinets",
  },
  {
    id: "dishwasher",
    label: "Dishwasher",
    hint: "Plan a dishwasher into the run",
  },
];

export type IslandOrPeninsula = "none" | "island" | "peninsula";

export type AutoDesignIntake = {
  construction: ConstructionType | null;
  canMove: Record<UtilityId, boolean | null>;
  preferences: PreferenceId[];
  islandOrPeninsula: IslandOrPeninsula;
  peninsulaSide: "left" | "right" | null;
};

export function emptyAutoDesignIntake(): AutoDesignIntake {
  return {
    construction: null,
    canMove: {
      electrical: null,
      plumbing: null,
      rangeHookup: null,
      sinkBase: null,
    },
    preferences: [],
    islandOrPeninsula: "none",
    peninsulaSide: null,
  };
}

/** Rule 12: multi-select, but blind-corner and lazy-susan are mutually exclusive. */
export function togglePreference(
  intake: AutoDesignIntake,
  id: PreferenceId,
  on: boolean,
): AutoDesignIntake {
  const set = new Set<PreferenceId>(intake.preferences);
  if (on) {
    set.add(id);
    if (id === "blind-corner") set.delete("lazy-susan");
    if (id === "lazy-susan") set.delete("blind-corner");
  } else {
    set.delete(id);
  }
  const ordered = PREFERENCE_OPTIONS.map((o) => o.id).filter((pid) => set.has(pid));
  return { ...intake, preferences: ordered };
}

/** What still must be answered before the build can start. */
export function intakeMissing(intake: AutoDesignIntake | null | undefined): string[] {
  const missing: string[] = [];
  if (!intake || intake.construction == null) {
    missing.push("Pick new construction or old construction before the layout math starts.");
  }
  if (intake && intake.islandOrPeninsula === "peninsula" && intake.peninsulaSide == null) {
    missing.push("Pick which wall the peninsula goes on.");
  }
  return missing;
}

export function hasPreference(
  intake: AutoDesignIntake | null | undefined,
  id: PreferenceId,
): boolean {
  if (!intake) return false;
  return intake.preferences.includes(id);
}

/**
 * Rule 2: anchor kinds the build must NOT wiggle.
 * sinkBase "no" or plumbing "no" -> sink and dishwasher.
 * rangeHookup "no" -> stove. electrical "no" -> refrigerator.
 * Old construction does NOT by itself lock anything.
 */
export function lockedAnchorKinds(intake: AutoDesignIntake | null | undefined): AutoDesignKind[] {
  if (!intake) return [];
  const locked = new Set<AutoDesignKind>();
  const cm = intake.canMove;
  if (cm.sinkBase === false || cm.plumbing === false) {
    locked.add("sink");
    locked.add("dishwasher");
  }
  if (cm.rangeHookup === false) locked.add("stove");
  if (cm.electrical === false) locked.add("refrigerator");
  const order: AutoDesignKind[] = ["sink", "stove", "dishwasher", "refrigerator"];
  return order.filter((k) => locked.has(k));
}

/** Rule 2 wiggle in inches for one anchor kind: 0 when locked, else 3. */
export function anchorWiggleIn(
  intake: AutoDesignIntake | null | undefined,
  kind: AutoDesignKind,
): number {
  return lockedAnchorKinds(intake).includes(kind) ? 0 : 3;
}

// ---------------------------------------------------------------------------
// Rule 13: 15-to-18 inch landing between sink, refrigerator and other appliances
// ---------------------------------------------------------------------------

export const LANDING_MIN_IN = 15;
export const LANDING_PREFERRED_IN = 18;

export type LandingGap = {
  wallId: string;
  from: { uid: string; code: string; role: "sink" | "refrigerator" | "range" };
  to: { uid: string; code: string; role: "sink" | "refrigerator" | "range" };
  gapIn: number;
  status: "ok" | "tight" | "short";
};

type AnchorRole = "sink" | "refrigerator" | "range";

function anchorRoleOf(c: PlacedCabinet): AnchorRole | null {
  if (c.placement === "base" && isSinkBaseCabinet(c)) return "sink";
  if (isRefrigerator(c)) return "refrigerator";
  if (c.placement === "appliance" && isRangeOrOven(c.masterCode, c.description)) return "range";
  return null;
}

function landingStatus(gapIn: number): "ok" | "tight" | "short" {
  if (gapIn >= LANDING_PREFERRED_IN) return "ok";
  if (gapIn >= LANDING_MIN_IN) return "tight";
  return "short";
}

/**
 * Rule 13: for each wall, sort sink base(s), refrigerator(s) and range(s) by
 * along-wall start and measure the clear distance between adjacent pairs.
 * Island/peninsula cabinets (wallId not a WallSide) are skipped.
 */
export function landingGaps(placed: readonly PlacedCabinet[], room: RoomData): LandingGap[] {
  const byWall = new Map<string, { c: PlacedCabinet; role: AnchorRole; start: number; end: number }[]>();

  for (const c of placed) {
    const wallId = c.wallId ?? null;
    if (!isWallSide(wallId)) continue;
    const role = anchorRoleOf(c);
    if (!role) continue;
    const start = wallRunOffset(c, wallId, room);
    const span = wallRunSpan(c, wallId, room);
    const list = byWall.get(wallId) ?? [];
    list.push({ c, role, start, end: start + span });
    byWall.set(wallId, list);
  }

  const gaps: LandingGap[] = [];
  const wallOrder: string[] = [...WALL_SIDES];
  for (const wallId of wallOrder) {
    const list = byWall.get(wallId);
    if (!list || list.length < 2) continue;
    list.sort((a, b) => a.start - b.start);
    for (let i = 0; i < list.length - 1; i++) {
      const left = list[i];
      const right = list[i + 1];
      const gapIn = right.start - left.end;
      gaps.push({
        wallId,
        from: { uid: left.c.uid, code: left.c.masterCode, role: left.role },
        to: { uid: right.c.uid, code: right.c.masterCode, role: right.role },
        gapIn,
        status: landingStatus(gapIn),
      });
    }
  }
  return gaps;
}

// ---------------------------------------------------------------------------
// Rule 7, 8, 14: downsizes are SUGGESTIONS ONLY
// ---------------------------------------------------------------------------

export type SinkBaseDownsizeStep = {
  widthIn: 33 | 30;
  masterCode: string;
  substitute: boolean;
  note: string;
};

/**
 * Rule 7 + addendum: list the next smaller sink base sizes (33 then 30) that
 * are smaller than the current width. Never invents a code.
 */
export function sinkBaseDownsizeSteps(
  currentWidthIn: number,
  baseCatalog: readonly DesignCabinet[],
): SinkBaseDownsizeStep[] {
  const steps: SinkBaseDownsizeStep[] = [];

  // 33 in step: real SB33, else a regular 33 in base cabinet stands in.
  if (currentWidthIn > 33) {
    const sb33 = pickAutoDesignSinkBase(baseCatalog, 33, "regular");
    if (sb33) {
      steps.push({
        widthIn: 33,
        masterCode: sb33.masterCode,
        substitute: false,
        note: "Use the 33 in sink base.",
      });
    } else {
      const straight = autoBuildStraightBaseCatalog(baseCatalog);
      const nonSink = straight.filter((row) => !isSinkBaseCabinet(row));
      const exact = nonSink.find((row) => /^B33$/i.test(row.masterCode));
      const any33 = exact ?? nonSink.find((row) => dim(row.width, 0) === 33);
      if (any33) {
        steps.push({
          widthIn: 33,
          masterCode: any33.masterCode,
          substitute: true,
          note: "No 33 in sink base in this line, so a regular 33 in base cabinet (B33) stands in for it.",
        });
      }
    }
  }

  // 30 in step: real SB30 only.
  if (currentWidthIn > 30) {
    const sb30 = pickAutoDesignSinkBase(baseCatalog, 30, "regular");
    if (sb30) {
      steps.push({
        widthIn: 30,
        masterCode: sb30.masterCode,
        substitute: false,
        note: "Use the 30 in sink base.",
      });
    }
  }

  return steps;
}

export type FridgeWording = "ask" | "recommend";

/** Rule 14: designer's call by tightness. */
export function fridgeWording(tightestGapIn: number | null): FridgeWording {
  if (tightestGapIn == null) return "ask";
  if (tightestGapIn < LANDING_MIN_IN) return "recommend";
  return "ask";
}

export const FRIDGE_ASK_TEXT = "Is it okay if we did a 30 inch refrigerator?";
export const FRIDGE_RECOMMEND_TEXT =
  "I strongly recommend a 30 inch refrigerator to optimize your area.";

// ---------------------------------------------------------------------------
// Rule 3: continuous wall cabinets (visual only)
// ---------------------------------------------------------------------------

export type ContinuousWallRun = {
  wallId: string;
  startIn: number;
  endIn: number;
  bottomIn: number;
  topIn: number;
  uids: string[];
};

const CONTINUOUS_GAP_IN = 1.5;
const DEFAULT_WALL_MOUNT_BOTTOM = 54;

/**
 * Rule 3: group wall cabinets on each WallSide into continuous runs.
 * A cabinet joins the current run when the gap to the previous end is <= 1.5 in
 * and its vertical span overlaps the run's. Visual only.
 */
export function continuousWallRuns(
  placed: readonly PlacedCabinet[],
  room: RoomData,
): ContinuousWallRun[] {
  const byWall = new Map<string, { c: PlacedCabinet; start: number; end: number; bottom: number; top: number }[]>();

  for (const c of placed) {
    if (c.placement !== "wall") continue;
    const wallId = c.wallId ?? null;
    if (!isWallSide(wallId)) continue;
    const start = wallRunOffset(c, wallId, room);
    const span = wallRunSpan(c, wallId, room);
    const bottom = c.mountBottom ?? DEFAULT_WALL_MOUNT_BOTTOM;
    const top = bottom + (c.height ?? 30);
    const list = byWall.get(wallId) ?? [];
    list.push({ c, start, end: start + span, bottom, top });
    byWall.set(wallId, list);
  }

  const runs: ContinuousWallRun[] = [];
  const wallOrder: string[] = [...WALL_SIDES];
  for (const wallId of wallOrder) {
    const list = byWall.get(wallId);
    if (!list || list.length === 0) continue;
    list.sort((a, b) => a.start - b.start);

    let current: ContinuousWallRun | null = null;
    for (const item of list) {
      if (
        current &&
        item.start - current.endIn <= CONTINUOUS_GAP_IN &&
        item.bottom < current.topIn &&
        item.top > current.bottomIn
      ) {
        current.endIn = Math.max(current.endIn, item.end);
        current.bottomIn = Math.min(current.bottomIn, item.bottom);
        current.topIn = Math.max(current.topIn, item.top);
        current.uids.push(item.c.uid);
      } else {
        if (current) runs.push(current);
        current = {
          wallId,
          startIn: item.start,
          endIn: item.end,
          bottomIn: item.bottom,
          topIn: item.top,
          uids: [item.c.uid],
        };
      }
    }
    if (current) runs.push(current);
  }

  runs.sort((a, b) => {
    if (a.wallId !== b.wallId) return a.wallId < b.wallId ? -1 : 1;
    return a.startIn - b.startIn;
  });
  return runs;
}

// ---------------------------------------------------------------------------
// Rule 9 + 10 audit helpers
// ---------------------------------------------------------------------------

/** Count filler pieces in a plan. */
export function fillerCount(placed: readonly PlacedCabinet[]): number {
  let n = 0;
  for (const c of placed) {
    if (isFillerCabinet(c)) n++;
  }
  return n;
}

/**
 * Rule 9 check: on each wall, among ordinary base cabinets, report walls where
 * a cabinet of width < 15 was used while two adjacent small cabinets could have
 * been one bigger one (sum of two adjacent small widths <= 36 and both < 18).
 */
export function smallerFirstViolations(
  placed: readonly PlacedCabinet[],
  room: RoomData,
): { wallId: string; uids: string[]; widths: number[] }[] {
  const byWall = new Map<string, { c: PlacedCabinet; start: number; width: number }[]>();

  for (const c of placed) {
    if (c.placement !== "base") continue;
    if (isSinkBaseCabinet(c)) continue;
    if (isFillerCabinet(c)) continue;
    if (isCornerBaseCode(c.masterCode)) continue;
    const wallId = c.wallId ?? null;
    if (!isWallSide(wallId)) continue;
    const start = wallRunOffset(c, wallId, room);
    const width = wallRunSpan(c, wallId, room);
    const list = byWall.get(wallId) ?? [];
    list.push({ c, start, width });
    byWall.set(wallId, list);
  }

  const violations: { wallId: string; uids: string[]; widths: number[] }[] = [];
  const wallOrder: string[] = [...WALL_SIDES];
  for (const wallId of wallOrder) {
    const list = byWall.get(wallId);
    if (!list || list.length < 2) continue;
    list.sort((a, b) => a.start - b.start);

    let hasSmall = false;
    for (const item of list) {
      if (item.width < 15) {
        hasSmall = true;
        break;
      }
    }
    if (!hasSmall) continue;

    let flagged = false;
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i];
      const b = list[i + 1];
      if (a.width < 18 && b.width < 18 && a.width + b.width <= 36) {
        flagged = true;
        break;
      }
    }
    if (flagged) {
      violations.push({
        wallId,
        uids: list.map((item) => item.c.uid),
        widths: list.map((item) => item.width),
      });
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Rule 15: oven cabinet pairing
// ---------------------------------------------------------------------------

/**
 * Rule 15: return oven cabinets that have no sink base on the same wall or on
 * an island/peninsula run (wallId not one of the four WallSides).
 */
export function unpairedOvenCabinets(placed: readonly PlacedCabinet[]): PlacedCabinet[] {
  const ovens = placed.filter((c) => isOvenCabinet(c));
  if (ovens.length === 0) return [];

  const sinkBases = placed.filter((c) => c.placement === "base" && isSinkBaseCabinet(c));
  const islandSink = sinkBases.some((c) => !isWallSide(c.wallId ?? null));

  const unpaired: PlacedCabinet[] = [];
  for (const oven of ovens) {
    const ovenWall = oven.wallId ?? null;
    const sameWall = sinkBases.some((sb) => (sb.wallId ?? null) === ovenWall);
    if (!sameWall && !islandSink) unpaired.push(oven);
  }
  return unpaired;
}

export type WallFitAnchor = { wallLabel: WallLabel; kind: AutoDesignKind; widthIn: number };
/**
 * Rules 7, 8, 14 on a wall that is too short for what was asked. Sums the requested
 * anchor widths per wall (a refrigerator also needs 1.5 in for its two end panels) and,
 * when a wall is over, returns ONE plain sentence block with suggestions only (never applied):
 * "Wall 1 is 100 in, but the refrigerator, sink base, dishwasher and range need 127.5 in.
 *  Suggestion only, not applied: <FRIDGE_RECOMMEND_TEXT or FRIDGE_ASK_TEXT>, and try SB33 (33 in), then SB30 (30 in) for the sink base (saves up to 12 in). The customer decides."
 * Use FRIDGE_RECOMMEND_TEXT when the wall is short by more than 6 in, else FRIDGE_ASK_TEXT. Only mention the fridge when one is on that wall and wider than 30; only mention the sink base when it is on that wall and sinkBaseDownsizeSteps returns steps (include the substitute note when a step is a substitute).
 * When the wall is still short after every suggestion, add: "Even with both, the wall is still <n> in short, so one appliance has to move to another wall or come out."
 * Returns null when every wall fits or no wall length is known. Inch formatting: at most one decimal, drop ".0" (reuse the file's fmtIn helper). Kind names: sink -> "sink base", stove -> "range", dishwasher -> "dishwasher", refrigerator -> "refrigerator"; list in the order given, joined with ", " and " and " before the last.
 */
export function wallFitSuggestion(input: {
  anchors: readonly WallFitAnchor[];
  wallLengthOf: (label: WallLabel) => number | null;
  baseCatalog: readonly DesignCabinet[];
}): string | null {
  const byWall = new Map<WallLabel, WallFitAnchor[]>();
  for (const anchor of input.anchors) {
    const list = byWall.get(anchor.wallLabel);
    if (list) list.push(anchor);
    else byWall.set(anchor.wallLabel, [anchor]);
  }
  for (const [wallLabel, anchors] of Array.from(byWall.entries())) {
    const wallLength = input.wallLengthOf(wallLabel);
    if (wallLength === null) continue;
    let needed = 0;
    for (const anchor of anchors) {
      needed += anchor.widthIn;
      if (anchor.kind === "refrigerator") needed += 1.5;
    }
    if (needed <= wallLength) continue;
    const kindName = (kind: AutoDesignKind): string =>
      kind === "sink" ? "sink base" : kind === "stove" ? "range" : kind === "dishwasher" ? "dishwasher" : "refrigerator";
    const names = anchors.map((a) => kindName(a.kind));
    const joined =
      names.length <= 1
        ? names.join("")
        : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    const parts: string[] = [];
    const fridge = anchors.find((a) => a.kind === "refrigerator");
    if (fridge && fridge.widthIn > 30) {
      parts.push((wallLength - needed < -6 ? FRIDGE_RECOMMEND_TEXT : FRIDGE_ASK_TEXT).replace(/[.?]\s*$/, ""));
    }
    const sink = anchors.find((a) => a.kind === "sink");
    let sinkSavings = 0;
    if (sink) {
      const steps = sinkBaseDownsizeSteps(sink.widthIn, input.baseCatalog);
      if (steps.length > 0) {
        const stepText = steps
          .map((step) => `${step.masterCode} (${fmtIn(step.widthIn)} in)`)
          .join(", then ");
        sinkSavings = sink.widthIn - steps[steps.length - 1]!.widthIn;
        const substituteNote = steps.filter((step) => step.substitute).map((step) => ` (${step.note})`).join("");
        parts.push(`try ${stepText} for the sink base${substituteNote} (saves up to ${fmtIn(sinkSavings)} in)`);
      }
    }
    let sentence = `${wallLabel} is ${fmtIn(wallLength)} in, but the ${joined} need ${fmtIn(needed)} in.`;
    if (parts.length > 0) {
      sentence += ` Suggestion only, not applied: ${parts.join(", and ")}. The customer decides.`;
    }
    const stillShort = needed - sinkSavings - (fridge && fridge.widthIn > 30 ? fridge.widthIn - 30 : 0) - wallLength;
    if (stillShort > 0) {
      sentence += ` Even with both, the wall is still ${fmtIn(stillShort)} in short, so one appliance has to move to another wall or come out.`;
    }
    return sentence;
  }
  return null;
}

// ---------------------------------------------------------------------------
// All rule findings for the review list (nothing is applied)
// ---------------------------------------------------------------------------

export function fifteenRuleFindings(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  baseCatalog: readonly DesignCabinet[];
  intake: AutoDesignIntake | null | undefined;
  wallLabelOf: (wallId: string) => WallLabel | null;
  peninsulaBuilt: boolean;
}): DesignerReviewFinding[] {
  const { placed, room, baseCatalog, intake, wallLabelOf, peninsulaBuilt } = input;
  const findings: DesignerReviewFinding[] = [];

  const gaps = landingGaps(placed, room);

  // Rule 13: landing gaps.
  for (const gap of gaps) {
    if (gap.status === "ok") continue;
    const fromLabel = roleLabel(gap.from.role);
    const toLabel = roleLabel(gap.to.role);
    const wallLabel = wallLabelOf(gap.wallId);
    if (gap.status === "short") {
      findings.push({
        ruleId: "auto-design-rule-13",
        code: "landing-under-15",
        severity: "warning",
        title: `Under 15 in between ${fromLabel} and ${toLabel}`,
        detail: `Only ${fmtIn(gap.gapIn)} in of counter; 15 in is the minimum and 18 in is better so a full plate or platter fits. Suggestions below are optional.`,
        wallLabel,
        cabinetUid: null,
        cabinetCode: null,
      });
    } else {
      findings.push({
        ruleId: "auto-design-rule-13",
        code: "landing-under-18",
        severity: "info",
        title: `Under 18 in between ${fromLabel} and ${toLabel}`,
        detail: `${fmtIn(gap.gapIn)} in clears the 15 in minimum; 18 in is better.`,
        wallLabel,
        cabinetUid: null,
        cabinetCode: null,
      });
    }
  }

  // Rule 7: sink base downsize suggestion.
  const sinkGaps = gaps.filter(
    (g) => (g.from.role === "sink" || g.to.role === "sink") && g.status !== "ok",
  );
  if (sinkGaps.length > 0) {
    const sinkBase = placed.find((c) => c.placement === "base" && isSinkBaseCabinet(c));
    if (sinkBase) {
      const currentWidth = sinkBase.width;
      if (currentWidth > 30) {
        const steps = sinkBaseDownsizeSteps(currentWidth, baseCatalog);
        if (steps.length > 0) {
          const stepText = steps
            .map((s) => `${s.masterCode} (${s.widthIn} in)`)
            .join(", then ");
          const substituteNote = steps.filter((s) => s.substitute).map((s) => ` ${s.note}`).join("");
          findings.push({
            ruleId: "auto-design-rule-7",
            code: "suggest-sink-base-downsize",
            severity: "info",
            title: "Suggestion: smaller sink base",
            detail: `Suggestion only, not applied: try ${stepText}. The customer decides; some customers need the ${currentWidth} in sink base.${substituteNote}`,
            wallLabel: isWallSide(sinkBase.wallId ?? null) ? wallLabelOf(sinkBase.wallId as string) : null,
            cabinetUid: sinkBase.uid,
            cabinetCode: sinkBase.masterCode,
          });
        }
      }
    }
  }

  // Rule 8 + 14: refrigerator downsize suggestion.
  const fridgeGaps = gaps.filter(
    (g) => (g.from.role === "refrigerator" || g.to.role === "refrigerator") && g.status !== "ok",
  );
  if (fridgeGaps.length > 0) {
    const fridge = placed.find((c) => isRefrigerator(c));
    if (fridge && fridge.width > 30) {
      const tightest = fridgeGaps.reduce(
        (min, g) => (g.gapIn < min ? g.gapIn : min),
        Number.POSITIVE_INFINITY,
      );
      const wording = fridgeWording(Number.isFinite(tightest) ? tightest : null);
      const lead = wording === "ask" ? FRIDGE_ASK_TEXT : FRIDGE_RECOMMEND_TEXT;
      findings.push({
        ruleId: "auto-design-rule-8",
        code: "suggest-fridge-30",
        severity: "info",
        title: "Suggestion: 30 in refrigerator",
        detail: `${lead} Suggestion only, not applied; the customer decides.`,
        wallLabel: isWallSide(fridge.wallId ?? null) ? wallLabelOf(fridge.wallId as string) : null,
        cabinetUid: fridge.uid,
        cabinetCode: fridge.masterCode,
      });
    }
  }

  // Rule 15: oven cabinet pairing.
  for (const oven of unpairedOvenCabinets(placed)) {
    findings.push({
      ruleId: "auto-design-rule-15",
      code: "oven-needs-sink-base",
      severity: "warning",
      title: "Oven cabinet without a nearby sink base",
      detail:
        "A customer with an oven cabinet usually wants a sink base on the same run or in the island. Suggest adding one.",
      wallLabel: isWallSide(oven.wallId ?? null) ? wallLabelOf(oven.wallId as string) : null,
      cabinetUid: oven.uid,
      cabinetCode: oven.masterCode,
    });
  }

  if (
    intake &&
    intake.islandOrPeninsula === "peninsula" &&
    !peninsulaBuilt &&
    intake.peninsulaSide == null
  ) {
    findings.push({
      ruleId: "auto-design-rule-15",
      code: "peninsula-wall-unknown",
      severity: "warning",
      title: "Which wall does the peninsula go on?",
      detail: "The customer picked a peninsula; ask which wall it attaches to.",
      wallLabel: null,
      cabinetUid: null,
      cabinetCode: null,
    });
  }

  // Rule 11: construction type.
  if (intake && intake.construction === "old") {
    const locked = lockedAnchorKinds(intake);
    findings.push({
      ruleId: "auto-design-rule-11",
      code: "old-construction",
      severity: "info",
      title: "Old construction",
      detail: `Existing walls and openings were kept; locked utilities: ${
        locked.length > 0 ? locked.join(", ") : "none"
      }.`,
      wallLabel: null,
      cabinetUid: null,
      cabinetCode: null,
    });
  } else if (intake && intake.construction === "new") {
    findings.push({
      ruleId: "auto-design-rule-11",
      code: "new-construction",
      severity: "info",
      title: "New construction",
      detail: "Dimensions were free to adjust within the room.",
      wallLabel: null,
      cabinetUid: null,
      cabinetCode: null,
    });
  }

  // Rule 12: preferences the build does not place automatically.
  if (intake) {
    const prefFindings: { id: PreferenceId; label: string; detail: string }[] = [];
    if (hasPreference(intake, "glass-uppers")) {
      prefFindings.push({
        id: "glass-uppers",
        label: "Glass cabinets above",
        detail: "Glass cabinets above: pick glass-door uppers on the review; not placed automatically.",
      });
    }
    if (hasPreference(intake, "crown-molding")) {
      prefFindings.push({
        id: "crown-molding",
        label: "Crown molding",
        detail:
          "Crown molding: add crown molding along the continuous wall runs; not placed automatically.",
      });
    }
    if (hasPreference(intake, "budget-friendly")) {
      prefFindings.push({
        id: "budget-friendly",
        label: "Budget friendly",
        detail:
          "Budget friendly: the build already prefers standard boxes; check the cart for lower-cost swaps.",
      });
    }
    if (intake.islandOrPeninsula === "island") {
      prefFindings.push({
        id: "island" as PreferenceId,
        label: "Island",
        detail: "Island: Auto Design does not build islands yet; add it from the island tool.",
      });
    }
    for (const pf of prefFindings) {
      findings.push({
        ruleId: "auto-design-rule-12",
        code: `preference-${pf.id}`,
        severity: "info",
        title: `Customer pick: ${pf.label}`,
        detail: pf.detail,
        wallLabel: null,
        cabinetUid: null,
        cabinetCode: null,
      });
    }
  }

  return findings;
}
