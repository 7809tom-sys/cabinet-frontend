/**
 * Budget-friendly Auto Design: a 36-inch refrigerator whose source-priced cabinet
 * or end panels are still loading or unavailable is optional. The run skips it,
 * leaves it unchecked, and keeps building. Other runs still fail, same as before.
 */
import { describe, expect, it } from "vitest";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import { emptyAutoDesignIntake, togglePreference } from "./autoDesignFifteenRules";
import {
  BUDGET_FRIENDLY_FRIDGE_SKIP_WARNING,
  mergeAutoDesignRefrigeratorCaps,
  runAutoDesignLayout,
  type AutoDesignLayoutResult,
} from "./autoDesignLayout";
import type { AutoDesignInputs } from "./autoDesignAutoBuild";
import { applianceAsDesignCabinet, type DesignCabinet, type RoomData } from "./design";

type Pack = { base: unknown[]; wall: unknown[]; accessory: unknown[]; surround?: { deepAbove?: DesignCabinet[]; endPanels?: DesignCabinet[] } };
const STYLE = "330011";
const REAL = realCatalog as unknown as Record<string, Pack>;
const BASES = REAL[STYLE]!.base as DesignCabinet[];
const WALLS = REAL[STYLE]!.wall as DesignCabinet[];
const ACCESSORY = REAL[STYLE]!.accessory as DesignCabinet[];
const FILLERS = ACCESSORY.filter((row) => /filler/i.test(`${row.masterCode} ${row.description}`));
const CAPS = mergeAutoDesignRefrigeratorCaps(WALLS, []);
const END_PANELS = ACCESSORY.filter((row) => /REPV|refrigerator end panel/i.test(`${row.masterCode} ${row.description}`));

function room(): RoomData {
  return { width: 150, depth: 150, ceilingHeight: 96, openWallPath: false } as RoomData;
}

function budgetIntake() {
  return togglePreference({ ...emptyAutoDesignIntake(), construction: "old" }, "budget-friendly", true);
}

function inputs(overrides: Partial<AutoDesignInputs> = {}): AutoDesignInputs {
  return {
    layoutType: "u-shape",
    originCorner: "left",
    runDirection: "right",
    wallCabinetHeightIn: 30,
    sink: { wallLabel: "Wall 1", centerOffsetIn: 75 },
    sinkBaseWidthIn: 36,
    sinkBaseKind: "regular",
    stove: { wallLabel: "Wall 2", centerOffsetIn: 75 },
    skipDishwasher: true,
    dishwasher: null,
    refrigerator: { wallLabel: "Wall 3", centerOffsetIn: 131 },
    refrigeratorWidthIn: 36,
    kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
    ...overrides,
  };
}

const APPLIANCES = [
  { id: 0, masterCode: "RANGE-30", description: '30" Range', category: "Appliance", subCategory: "Appliance", width: "30", height: "36", depth: "25", placement: "appliance" } as DesignCabinet,
  { id: 0, masterCode: "DW-24", description: '24" Dishwasher', category: "Appliance", subCategory: "Appliance", width: "24", height: "34.5", depth: "24", placement: "appliance" } as DesignCabinet,
  { id: 0, masterCode: "FRIDGE-36", description: '36" Refrigerator', category: "Appliance", subCategory: "Appliance", width: "36", height: "70", depth: "30", placement: "appliance" } as DesignCabinet,
].map(applianceAsDesignCabinet);

function build(options: {
  input?: Partial<AutoDesignInputs>;
  caps?: DesignCabinet[];
  endPanels?: DesignCabinet[];
}): AutoDesignLayoutResult {
  let uid = 0;
  return runAutoDesignLayout({
    input: inputs(options.input),
    room: room(),
    openings: [],
    baseCatalog: BASES,
    wallCatalog: WALLS,
    fillers: FILLERS,
    appliancePalette: APPLIANCES,
    refrigeratorCaps: options.caps ?? [],
    refrigeratorEndPanels: options.endPanels ?? [],
    panelCatalog: ACCESSORY,
    styleId: Number(STYLE),
    makeUid: () => `uid-${++uid}`,
  });
}

describe("budget-friendly optional refrigerator when panels are loading or unavailable", () => {
  it("still fails a non-budget run when the 36-inch fridge cabinet or end panels are missing", () => {
    const result = build({ caps: [], endPanels: [] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("source-priced 36-inch refrigerator cabinet and two end panels are still loading or unavailable");
  });

  it("skips the fridge on a budget-friendly run and keeps building the rest of the plan", () => {
    const result = build({ input: { intake: budgetIntake() }, caps: [], endPanels: [] });
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;
    expect(result.skippedRefrigerator).toBe(true);
    expect(result.placed.some((item) => item.masterCode.startsWith("FRIDGE-"))).toBe(false);
    expect(result.warnings).toContain(BUDGET_FRIENDLY_FRIDGE_SKIP_WARNING);
    // The rest of the plan still builds: sink base, range, and base cabinets use the opened wall space.
    expect(result.placed.some((item) => item.masterCode === "SB36" || /^SB/.test(item.masterCode))).toBe(true);
    expect(result.placed.some((item) => item.masterCode === "RANGE-30")).toBe(true);
    expect(result.basePieceCount).toBeGreaterThan(0);
  });

  it("still places the refrigerator on a budget-friendly run when the cabinet and end panels are available", () => {
    expect(CAPS.length).toBeGreaterThan(0);
    expect(END_PANELS.length).toBeGreaterThan(0);
    const result = build({ input: { intake: budgetIntake() }, caps: CAPS, endPanels: END_PANELS });
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;
    expect(result.skippedRefrigerator).toBe(false);
    expect(result.placed.some((item) => item.masterCode.startsWith("FRIDGE-"))).toBe(true);
    expect(result.warnings).not.toContain(BUDGET_FRIENDLY_FRIDGE_SKIP_WARNING);
  });

  it("does not skip or warn when a budget-friendly run did not ask for a refrigerator", () => {
    const result = build({ input: { intake: budgetIntake(), refrigerator: null }, caps: [], endPanels: [] });
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;
    expect(result.skippedRefrigerator).toBe(false);
    expect(result.warnings).not.toContain(BUDGET_FRIENDLY_FRIDGE_SKIP_WARNING);
    expect(result.placed.some((item) => item.masterCode.startsWith("FRIDGE-"))).toBe(false);
  });
});
