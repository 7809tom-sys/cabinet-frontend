/**
 * Dev-only audit scenarios for the Auto Design 15-rule spec (Nov 13 2026).
 * Each scenario runs the real instant designer (runAutoDesignLayout) on a fixture
 * line and reports, in plain numbers, how the rules held. Imported by the audit
 * harness page (/dev/auto-design-15-audit.html) only; nothing in the app uses it.
 */
import matrixCatalog from "@/lib/__fixtures__/autoDesignMatrixCatalog.json";
import { mergeAutoDesignRefrigeratorCaps, runAutoDesignLayout, type AutoDesignLayoutResult } from "@/lib/autoDesignLayout";
import type { AutoDesignInputs } from "@/lib/autoDesignAutoBuild";
import type { DesignCabinet, PlacedCabinet, RoomData } from "@/lib/design";
import {
  continuousWallRuns, emptyAutoDesignIntake, fillerCount, landingGaps, smallerFirstViolations,
  type AutoDesignIntake,
} from "@/lib/autoDesignFifteenRules";

type Pack = { base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[]; surround?: { deepAbove?: DesignCabinet[]; endPanels?: DesignCabinet[] } };
const CATALOG = matrixCatalog as unknown as Record<string, Pack>;

function appliance(code: string, width: number, depth: number, height: number): DesignCabinet {
  return { id: 0, masterCode: code, description: code, category: "Appliance", subCategory: "Appliance", width: String(width), depth: String(depth), height: String(height), placement: "appliance" } as DesignCabinet;
}
const PALETTE = [
  appliance("RANGE-30", 30, 25, 36), appliance("DW-24", 24, 24, 34.5), appliance("FRIDGE-36", 36, 30, 70),
  appliance("HOOD-30", 30, 18, 18), appliance("HOOD-36", 36, 18, 18),
];

export type AuditScenario = {
  id: string;
  title: string;
  styleId: string;
  room: RoomData;
  input: AutoDesignInputs;
  intake: AutoDesignIntake;
  dropSb33?: boolean;
};

const base = (patch: Partial<AutoDesignInputs>): AutoDesignInputs => ({
  layoutType: "single-wall", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
  sink: { wallLabel: "Wall 1", centerOffsetIn: 72 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
  stove: null, dishwasher: null, dishwasherSide: "right", refrigerator: null, refrigeratorWidthIn: 36,
  refrigeratorPanels: "both", refrigeratorEnclosure: "cabinet-above",
  kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] }, ...patch,
} as AutoDesignInputs);

const intake = (patch: Partial<AutoDesignIntake>): AutoDesignIntake => ({ ...emptyAutoDesignIntake(), construction: "new", ...patch });

export const AUDIT_SCENARIOS: AuditScenario[] = [
  {
    id: "01-single-100", title: "100 in single wall: sink, dishwasher, range, 36 in fridge", styleId: "330014",
    room: { width: 100, depth: 120, ceilingHeight: 96 },
    input: base({ sink: { wallLabel: "Wall 1", centerOffsetIn: 52 }, stove: { wallLabel: "Wall 1", centerOffsetIn: 85 }, refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 } }),
    intake: intake({ preferences: ["dishwasher"] }),
  },
  {
    id: "01b-single-100-no-dw", title: "100 in single wall after the customer accepts the suggestions: SB30, 30 in fridge, no dishwasher", styleId: "330014",
    room: { width: 100, depth: 120, ceilingHeight: 96 },
    input: base({ sinkBaseWidthIn: 30, refrigeratorWidthIn: 30, sink: { wallLabel: "Wall 1", centerOffsetIn: 52 }, stove: { wallLabel: "Wall 1", centerOffsetIn: 85 }, refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 15.75 }, dishwasherSide: "none", skipDishwasher: true }),
    intake: intake({}),
  },
  {
    id: "02-single-144", title: "144 in single wall: fridge, sink + dishwasher, range", styleId: "330014",
    room: { width: 144, depth: 120, ceilingHeight: 96 },
    input: base({ sink: { wallLabel: "Wall 1", centerOffsetIn: 72 }, stove: { wallLabel: "Wall 1", centerOffsetIn: 129 }, refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18.75 } }),
    intake: intake({ preferences: ["dishwasher", "crown-molding"] }),
  },
  {
    id: "03-l-144x120-blind", title: "L-shape 144 x 120, customer picked a blind corner", styleId: "540005",
    room: { width: 144, depth: 120, ceilingHeight: 96 },
    input: base({ layoutType: "l-shape", sink: { wallLabel: "Wall 2", centerOffsetIn: 66 }, stove: { wallLabel: "Wall 1", centerOffsetIn: 60 }, refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 } }),
    intake: intake({ preferences: ["blind-corner", "dishwasher"] }),
  },
  {
    id: "04-l-144x120-lazy-susan", title: "L-shape 144 x 120, customer picked a lazy Susan", styleId: "330014",
    room: { width: 144, depth: 120, ceilingHeight: 96 },
    input: base({ layoutType: "l-shape", sink: { wallLabel: "Wall 2", centerOffsetIn: 66 }, stove: { wallLabel: "Wall 1", centerOffsetIn: 60 }, refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 } }),
    intake: intake({ preferences: ["lazy-susan", "dishwasher", "lots-of-drawers"] }),
  },
  {
    id: "05-l-peninsula", title: "L-shape 144 x 120 with a peninsula (Auto Design has no island builder)", styleId: "540005",
    room: { width: 144, depth: 120, ceilingHeight: 96 },
    input: base({ layoutType: "l-shape", sink: { wallLabel: "Wall 3", centerOffsetIn: 72 }, stove: { wallLabel: "Wall 2", centerOffsetIn: 60 }, refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 72 } }),
    intake: intake({ islandOrPeninsula: "peninsula", peninsulaSide: "left", preferences: ["dishwasher"] }),
  },
  {
    id: "06-old-construction-locked", title: "Old construction, 144 in wall, utilities cannot move", styleId: "330014",
    room: { width: 144, depth: 120, ceilingHeight: 96 },
    input: base({ sink: { wallLabel: "Wall 1", centerOffsetIn: 60 }, stove: { wallLabel: "Wall 1", centerOffsetIn: 129 }, refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18.75 } }),
    intake: { ...emptyAutoDesignIntake(), construction: "old", canMove: { electrical: false, plumbing: false, rangeHookup: false, sinkBase: false }, preferences: ["dishwasher", "glass-uppers"], islandOrPeninsula: "none", peninsulaSide: null },
  },
  {
    id: "07-single-144-no-sb33", title: "144 in wall, tight sink landing, line without SB33 (B33 stands in)", styleId: "330014", dropSb33: true,
    room: { width: 144, depth: 120, ceilingHeight: 96 },
    input: base({ sink: { wallLabel: "Wall 1", centerOffsetIn: 60 }, stove: { wallLabel: "Wall 1", centerOffsetIn: 129 }, refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18.75 } }),
    intake: intake({ preferences: ["dishwasher", "budget-friendly"] }),
  },
];

export type AuditResult = {
  scenario: AuditScenario;
  ok: boolean;
  message?: string;
  placed: PlacedCabinet[];
  notes: string[];
  findings: { ruleId: string; code: string; severity: string; title: string; detail: string }[];
  landing: ReturnType<typeof landingGaps>;
  fillers: number;
  fillerCodes: string[];
  smallerFirst: ReturnType<typeof smallerFirstViolations>;
  wallRuns: ReturnType<typeof continuousWallRuns>;
  sinkBaseCode: string | null;
  fridgeWidth: number | null;
  corners: string[];
  peninsula: boolean;
  wiggleMoves: { kind: string; deltaAlongIn: number }[];
};

export function runAuditScenario(scenario: AuditScenario): AuditResult {
  const pack = CATALOG[scenario.styleId]!;
  const baseCatalog = scenario.dropSb33 ? pack.base.filter((row) => !/^SB33/i.test(row.masterCode)) : pack.base;
  let uid = 0;
  const run: AutoDesignLayoutResult = runAutoDesignLayout({
    input: { ...scenario.input, intake: scenario.intake },
    room: scenario.room,
    openings: [],
    baseCatalog,
    wallCatalog: pack.wall,
    fillers: pack.accessory,
    appliancePalette: PALETTE,
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround?.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround?.endPanels ?? [],
    styleId: Number(scenario.styleId),
    makeUid: () => `a-${++uid}`,
  });
  if (!run.ok) {
    return { scenario, ok: false, message: run.message, placed: [], notes: [], findings: [], landing: [], fillers: 0, fillerCodes: [], smallerFirst: [], wallRuns: [], sinkBaseCode: null, fridgeWidth: null, corners: [], peninsula: false, wiggleMoves: [] };
  }
  const isFiller = (item: PlacedCabinet) => /^(?:B|W|T)?F\d|FILLER/i.test(item.masterCode) || /filler/i.test(item.description ?? "");
  return {
    scenario,
    ok: true,
    placed: run.placed,
    notes: run.notes,
    findings: run.reviewFindings.map(({ ruleId, code, severity, title, detail }) => ({ ruleId, code, severity, title, detail })),
    landing: landingGaps(run.placed, scenario.room),
    fillers: fillerCount(run.placed),
    fillerCodes: run.placed.filter(isFiller).map((item) => `${item.masterCode}${item.width ? ` (${item.width}″)` : ""}`),
    smallerFirst: smallerFirstViolations(run.placed, scenario.room),
    wallRuns: continuousWallRuns(run.placed, scenario.room),
    sinkBaseCode: run.placed.find((item) => item.placement === "base" && /sink base/i.test(`${item.description} ${item.subCategory ?? ""}`))?.masterCode ?? null,
    fridgeWidth: run.placed.find((item) => /^FRIDGE-/.test(item.masterCode))?.width ?? null,
    corners: run.seatedCorners.map((corner) => `${corner.label}: ${corner.masterCode} (${corner.family})`),
    peninsula: run.peninsula != null,
    wiggleMoves: run.wiggleMoves.map((move) => ({ kind: move.kind, deltaAlongIn: move.deltaAlongIn })),
  };
}
