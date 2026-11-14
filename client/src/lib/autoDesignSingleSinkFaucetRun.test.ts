/**
 * A full Auto Design run, including a budget-friendly one, must finish with
 * exactly one sink and one faucet. The layout already seats them at the start;
 * an end-of-run pass must not add a second copy.
 */
import { describe, expect, it } from "vitest";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import { emptyAutoDesignIntake, togglePreference } from "./autoDesignFifteenRules";
import { everySinkHasFaucet } from "./autoDesignFaucet";
import { runAutoDesignLayout } from "./autoDesignLayout";
import { keepExistingAutoDesignSinkAndFaucet, sinkAlreadyPlacedOnBase } from "./autoDesignOpeningFixturePick";
import type { AutoDesignInputs } from "./autoDesignAutoBuild";
import { applianceAsDesignCabinet, type DesignCabinet, type RoomData } from "./design";

type Pack = { base: unknown[]; wall: unknown[]; accessory: unknown[] };
const STYLE = "330011";
const REAL = realCatalog as unknown as Record<string, Pack>;
const BASES = REAL[STYLE]!.base as DesignCabinet[];
const WALLS = REAL[STYLE]!.wall as DesignCabinet[];
const FILLERS = (REAL[STYLE]!.accessory as DesignCabinet[]).filter((row) => /filler/i.test(`${row.masterCode} ${row.description}`));

const APPLIANCES = [
  { id: 0, masterCode: "RANGE-30", description: '30" Range', category: "Appliance", subCategory: "Appliance", width: "30", height: "36", depth: "25", placement: "appliance" } as DesignCabinet,
  { id: 0, masterCode: "DW-24", description: '24" Dishwasher', category: "Appliance", subCategory: "Appliance", width: "24", height: "34.5", depth: "24", placement: "appliance" } as DesignCabinet,
  { id: 0, masterCode: "FRIDGE-36", description: '36" Refrigerator', category: "Appliance", subCategory: "Appliance", width: "36", height: "70", depth: "30", placement: "appliance" } as DesignCabinet,
].map(applianceAsDesignCabinet);

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

function build(overrides: Partial<AutoDesignInputs> = {}) {
  let uid = 0;
  return runAutoDesignLayout({
    input: inputs(overrides),
    room: { width: 144, depth: 120, ceilingHeight: 96, openWallPath: false } as RoomData,
    openings: [],
    baseCatalog: BASES,
    wallCatalog: WALLS,
    fillers: FILLERS,
    appliancePalette: APPLIANCES,
    refrigeratorCaps: [],
    refrigeratorEndPanels: [],
    styleId: Number(STYLE),
    makeUid: () => `sf-${++uid}`,
  });
}

function expectSingleSinkAndFaucet(result: ReturnType<typeof build>) {
  expect(result.ok, result.ok ? "" : result.message).toBe(true);
  if (!result.ok) return null;
  expect(result.sinks).toHaveLength(1);
  expect(everySinkHasFaucet(result.sinks)).toBe(true);
  const baseUid = result.sinks[0]?.cabinetUid ?? null;
  expect(baseUid).toBeTruthy();
  expect(sinkAlreadyPlacedOnBase(result.sinks, baseUid)).toBe(true);
  const duplicate = { ...result.sinks[0]!, uid: `${result.sinks[0]!.uid}-again` };
  expect(keepExistingAutoDesignSinkAndFaucet([...result.sinks, duplicate], baseUid)).toHaveLength(1);
  return result;
}

describe("a full Auto Design run keeps a single sink and faucet", () => {
  it("seats one sink with one faucet and will not append a second copy at the end", () => {
    expectSingleSinkAndFaucet(build());
  });

  it("does the same on a budget-friendly run", () => {
    const intake = togglePreference({ ...emptyAutoDesignIntake(), construction: "old" }, "budget-friendly", true);
    expectSingleSinkAndFaucet(build({ intake }));
  });
});
