/**
 * Budget-friendly Auto Design must include at least one drawer base when the
 * line sells a priced same-width SKU. Non-budget runs keep the existing
 * convert-or-warn path and are not changed.
 */
import { describe, expect, it } from "vitest";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import { emptyAutoDesignIntake, togglePreference } from "./autoDesignFifteenRules";
import { BUDGET_FRIENDLY_DRAWER_BASE_MISSING_WARNING } from "./autoDesignDrawerRule";
import { isThreeDrawerBaseCatalog } from "./kitchenUsage";
import { runAutoDesignLayout } from "./autoDesignLayout";
import type { AutoDesignInputs } from "./autoDesignAutoBuild";
import { applianceAsDesignCabinet, type DesignCabinet, type RoomData } from "./design";

type Pack = { base: unknown[]; wall: unknown[]; accessory: unknown[] };
const STYLE = "330011";
const REAL = realCatalog as unknown as Record<string, Pack>;
const ALL_BASES = REAL[STYLE]!.base as DesignCabinet[];
const WALLS = REAL[STYLE]!.wall as DesignCabinet[];
const FILLERS = (REAL[STYLE]!.accessory as DesignCabinet[]).filter((row) => /filler/i.test(`${row.masterCode} ${row.description}`));

/** Narrow door bases only, so the existing split rule cannot invent a drawer pair, plus the 3DB24 SKU. */
function narrowDoorCatalog(includeDrawer: boolean): DesignCabinet[] {
  return ALL_BASES.filter((row) => {
    const code = row.masterCode.toUpperCase();
    if (/^SB/.test(code)) return true;
    if (includeDrawer && /^3DB(12|15|18|21|24)$/.test(code)) return true;
    if (/^B(12|15|18|21|24)$/.test(code)) return true;
    return false;
  });
}

const APPLIANCES = [
  { id: 0, masterCode: "RANGE-30", description: '30" Range', category: "Appliance", subCategory: "Appliance", width: "30", height: "36", depth: "25", placement: "appliance" } as DesignCabinet,
  { id: 0, masterCode: "DW-24", description: '24" Dishwasher', category: "Appliance", subCategory: "Appliance", width: "24", height: "34.5", depth: "24", placement: "appliance" } as DesignCabinet,
  { id: 0, masterCode: "FRIDGE-36", description: '36" Refrigerator', category: "Appliance", subCategory: "Appliance", width: "36", height: "70", depth: "30", placement: "appliance" } as DesignCabinet,
].map(applianceAsDesignCabinet);

function budgetIntake() {
  return togglePreference({ ...emptyAutoDesignIntake(), construction: "old" }, "budget-friendly", true);
}

function inputs(overrides: Partial<AutoDesignInputs> = {}): AutoDesignInputs {
  return {
    layoutType: "single-wall",
    originCorner: "left",
    runDirection: "right",
    wallCabinetHeightIn: 30,
    sink: { wallLabel: "Wall 1", centerOffsetIn: 72 },
    sinkBaseWidthIn: 36,
    sinkBaseKind: "regular",
    stove: null,
    skipDishwasher: true,
    dishwasher: null,
    refrigerator: null,
    kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
    ...overrides,
  };
}

function build(catalog: DesignCabinet[], intake: AutoDesignInputs["intake"]) {
  let uid = 0;
  return runAutoDesignLayout({
    input: inputs({ intake }),
    room: { width: 144, depth: 120, ceilingHeight: 96, openWallPath: false } as RoomData,
    openings: [],
    baseCatalog: catalog,
    wallCatalog: WALLS,
    fillers: FILLERS,
    appliancePalette: APPLIANCES,
    refrigeratorCaps: [],
    refrigeratorEndPanels: [],
    styleId: Number(STYLE),
    makeUid: () => `db-${++uid}`,
  });
}

describe("budget-friendly layouts include a same-width drawer base", () => {
  it("swaps in a priced 3DB24 when the layout would otherwise have only narrow door bases", () => {
    const result = build(narrowDoorCatalog(true), budgetIntake());
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;
    const drawers = result.placed.filter((item) => isThreeDrawerBaseCatalog(item));
    expect(drawers.length).toBeGreaterThan(0);
    expect(drawers.every((item) => /^3DB(12|15|18|21|24)$/.test(item.masterCode))).toBe(true);
    expect(result.notes.some((note) => /swapped for the same-width drawer base 3DB/.test(note))).toBe(true);
    expect(result.warnings).not.toContain(BUDGET_FRIENDLY_DRAWER_BASE_MISSING_WARNING);
  });

  it("adds a note and still succeeds when no priced drawer-base SKU is available", () => {
    const result = build(narrowDoorCatalog(false), budgetIntake());
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;
    expect(result.placed.some((item) => isThreeDrawerBaseCatalog(item))).toBe(false);
    expect(result.warnings).toContain(BUDGET_FRIENDLY_DRAWER_BASE_MISSING_WARNING);
  });

  it("does not apply the same-width swap on a non-budget run", () => {
    const result = build(narrowDoorCatalog(true), emptyAutoDesignIntake());
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;
    expect(result.placed.some((item) => item.masterCode === "3DB24")).toBe(false);
    expect(result.notes.some((note) => /swapped for the same-width drawer base/.test(note))).toBe(false);
    expect(result.warnings).not.toContain(BUDGET_FRIENDLY_DRAWER_BASE_MISSING_WARNING);
  });
});
