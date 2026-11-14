/**
 * NKBA planning checks the Designer did not encode (Tom, Nov 13 2026: "learn in
 * the internet").
 *
 * The landings we already enforce (fridge 15", sink 24/18, cooking 12/15,
 * dishwasher 36" and 21") are unchanged. These are the guidelines that were
 * missing, so a kitchen could satisfy every existing rule and still be short of
 * usable counter or have an appliance with nowhere to set anything down.
 *
 * Pure: it reads the placed plan and returns review findings. It never moves,
 * adds or removes a cabinet.
 */
import {
  bearsCountertop,
  cabinetWall,
  isCornerCabinet,
  isFillerItem,
  isPanelItem,
  isRangeOrOven,
  isRefrigerator,
  isSinkBaseCabinet,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import { kitchenRuleNumber } from "./kitchenRuleParameters";

export type NkbaFinding = {
  ruleId: string;
  code: string;
  severity: "warning" | "attention";
  title: string;
  detail: string;
  cabinetUid?: string;
  cabinetCode?: string;
};

const EPS = 0.05;

/** A counter-bearing base that a person can actually stand at. */
function usableCounterItem(item: PlacedCabinet): boolean {
  if (!bearsCountertop(item)) return false;
  if (isCornerCabinet(item.masterCode, item.description)) return false;
  if (isFillerItem(item) || isPanelItem(item)) return false;
  if (isSinkBaseCabinet(item)) return false;
  if (isRefrigerator(item) || isRangeOrOven(item.masterCode, item.description)) return false;
  return Number(item.depth) >= 16 - EPS;
}

/** Counter frontage along one wall, in inches, ignoring corner space. */
export function countertopFrontageOnWall(placed: readonly PlacedCabinet[], room: RoomData, wall: string): number {
  return placed
    .filter((item) => cabinetWall(item, room) === wall && usableCounterItem(item))
    .reduce((sum, item) => sum + wallRunSpan(item, wall, room), 0);
}

/** Every wall's usable counter frontage. */
export function countertopFrontageIn(placed: readonly PlacedCabinet[], room: RoomData): number {
  const walls = new Set(placed.map((item) => cabinetWall(item, room)));
  let total = 0;
  for (const wall of walls) total += countertopFrontageOnWall(placed, room, wall as string);
  return Math.round(total * 100) / 100;
}

/**
 * The widest continuous run of usable counter beside the sink base on the same
 * wall. NKBA asks for a 36" x 24" prep area next to the sink.
 */
export function prepAreaBesideSinkIn(placed: readonly PlacedCabinet[], room: RoomData): number {
  let best = 0;
  for (const sink of placed.filter((item) => item.placement === "base" && isSinkBaseCabinet(item))) {
    const wall = cabinetWall(sink, room);
    if (!wall) continue;
    const from = wallRunOffset(sink, wall, room);
    const to = from + wallRunSpan(sink, wall, room);
    const neighbours = placed
      .filter((item) => item !== sink && cabinetWall(item, room) === wall && usableCounterItem(item))
      .map((item) => {
        const start = wallRunOffset(item, wall, room);
        return { start, end: start + wallRunSpan(item, wall, room) };
      })
      .sort((a, b) => a.start - b.start);
    let run = 0;
    let cursor = to;
    for (const span of neighbours) {
      if (span.start > cursor + EPS) break;
      if (span.start >= cursor - EPS) {
        run += span.end - span.start;
        cursor = span.end;
      }
    }
    best = Math.max(best, run);
    run = 0;
    cursor = from;
    for (const span of [...neighbours].reverse()) {
      if (span.end < cursor - EPS) break;
      if (span.end <= cursor + EPS) {
        run += span.end - span.start;
        cursor = span.start;
      }
    }
    best = Math.max(best, run);
  }
  return Math.round(best * 100) / 100;
}

/** Counter beside an appliance on its own wall, in inches (either side). */
export function landingBesideApplianceIn(appliance: PlacedCabinet, placed: readonly PlacedCabinet[], room: RoomData): number {
  const wall = cabinetWall(appliance, room);
  if (!wall) return 0;
  const from = wallRunOffset(appliance, wall, room);
  const to = from + wallRunSpan(appliance, wall, room);
  let left = 0;
  let right = 0;
  for (const item of placed) {
    if (item === appliance || cabinetWall(item, room) !== wall) continue;
    if (!usableCounterItem(item)) continue;
    const start = wallRunOffset(item, wall, room);
    const end = start + wallRunSpan(item, wall, room);
    if (Math.abs(end - from) <= EPS) left += end - start;
    if (Math.abs(start - to) <= EPS) right += end - start;
  }
  return Math.round(Math.max(left, right) * 100) / 100;
}

const MICROWAVE = /^(?:MW|MC|MICRO)|microwave/i;
const OVEN = /^(?:OV|WO|BOV|SOV)|wall\s*oven|single\s*oven|double\s*oven/i;

/** True for an appliance that needs its own landing (microwave or wall oven). */
export function applianceNeedsLanding(item: PlacedCabinet): "microwave" | "oven" | null {
  if (item.placement !== "appliance") return null;
  const hay = `${item.masterCode ?? ""} ${item.description ?? ""}`;
  if (/range|freestanding|cooktop/i.test(hay)) return null;
  if (MICROWAVE.test(hay)) return "microwave";
  if (OVEN.test(hay)) return "oven";
  return null;
}

/**
 * The three checks that were missing entirely. Each returns one finding when the
 * plan falls short, so the review list names the number instead of staying silent.
 */
export function reviewNkbaPlan(input: { placed: readonly PlacedCabinet[]; room: RoomData }): NkbaFinding[] {
  const findings: NkbaFinding[] = [];
  const frontageRule = kitchenRuleNumber("countertop_frontage_min_in");
  const frontage = countertopFrontageIn(input.placed, input.room);
  if (frontageRule > 0 && frontage + EPS < frontageRule) {
    findings.push({
      ruleId: "countertop-frontage",
      code: "countertop-frontage-short",
      severity: "warning",
      title: `Usable countertop frontage is under ${frontageRule} inches`,
      detail: `This plan has ${Math.round(frontage)}" of counter frontage at 16" deep or more, excluding corner space. NKBA asks for at least ${frontageRule}".`,
    });
  }

  const prepRule = kitchenRuleNumber("prep_work_area_min_in");
  const prep = prepAreaBesideSinkIn(input.placed, input.room);
  if (prepRule > 0 && prep + EPS < prepRule) {
    findings.push({
      ruleId: "prep-work-area",
      code: "prep-work-area-short",
      severity: "warning",
      title: `No ${prepRule}" preparation area beside the sink`,
      detail: `The widest continuous counter beside the sink base is ${Math.round(prep)}". NKBA asks for ${prepRule}" x 24" of continuous counter next to the sink.`,
    });
  }

  for (const item of input.placed) {
    const kind = applianceNeedsLanding(item);
    if (!kind) continue;
    const ruleKey = kind === "microwave" ? "microwave_landing_in" as const : "oven_landing_in" as const;
    const rule = kitchenRuleNumber(ruleKey);
    if (rule <= 0) continue;
    const landing = landingBesideApplianceIn(item, input.placed, input.room);
    if (landing + EPS >= rule) continue;
    findings.push({
      ruleId: `${kind}-landing`,
      code: `${kind}-landing-short`,
      severity: "attention",
      title: `${kind === "microwave" ? "Microwave" : "Oven"} landing is under ${rule} inches`,
      detail: `${item.masterCode} has ${Math.round(landing)}" of counter beside it. NKBA asks for ${rule}" next to, above or within 48" of the ${kind}.`,
      cabinetUid: item.uid,
      cabinetCode: item.masterCode,
    });
  }
  return findings;
}
