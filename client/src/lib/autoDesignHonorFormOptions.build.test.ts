import { describe, expect, it } from "vitest";
import matrixCatalog from "@/lib/__fixtures__/autoDesignMatrixCatalog.json";
import { mergeAutoDesignRefrigeratorCaps, runAutoDesignLayout } from "./autoDesignLayout";
import { emptyAutoDesignIntake, type AutoDesignIntake, type PreferenceId } from "./autoDesignFifteenRules";
import type { AutoDesignInputs } from "./autoDesignAutoBuild";
import { autoDesignTrimFromIntake } from "./autoDesignFormOptions";
import type { DesignCabinet, PlacedCabinet, RoomData } from "./design";

// Tom, Nov 14 2026: picks in the Auto Design form (glass doors, crown molding)
// never reached the generated kitchen. Built on a recorded catalog line that
// sells 30" glass-door (GD) wall cabinets.
type Pack = { base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[]; surround?: { deepAbove?: DesignCabinet[]; endPanels?: DesignCabinet[] } };
const CATALOG = matrixCatalog as unknown as Record<string, Pack>;
const PACK = CATALOG["510004"]!;
const appliance = (code: string, w: number, d: number, h: number) => ({ id: 0, masterCode: code, description: code, category: "Appliance", subCategory: "Appliance", width: String(w), depth: String(d), height: String(h), placement: "appliance" }) as DesignCabinet;
const PALETTE = [appliance("RANGE-30", 30, 25, 36), appliance("DW-24", 24, 24, 34.5), appliance("FRIDGE-36", 36, 30, 70), appliance("HOOD-30", 30, 18, 18)];
const ROOM: RoomData = { width: 132, depth: 120, ceilingHeight: 96 } as RoomData;

function build(preferences: PreferenceId[], pack: Pack = PACK, styleId = 510004) {
  let uid = 0;
  const intake: AutoDesignIntake = { ...emptyAutoDesignIntake(), construction: "new", preferences };
  const input = {
    layoutType: "l-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
    sink: { wallLabel: "Wall 2", centerOffsetIn: 60 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
    stove: { wallLabel: "Wall 1", centerOffsetIn: 93 }, dishwasher: null, dishwasherSide: "none", skipDishwasher: true,
    refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 }, refrigeratorWidthIn: 36,
    refrigeratorPanels: "both", refrigeratorEnclosure: "cabinet-above", sinkWindowCenter: null,
    kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] }, intake,
  } as AutoDesignInputs;
  const run = runAutoDesignLayout({
    input, room: ROOM, openings: [], baseCatalog: pack.base, wallCatalog: pack.wall, fillers: pack.accessory,
    appliancePalette: PALETTE, refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround?.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround?.endPanels ?? [], panelCatalog: [...pack.accessory, ...(pack.surround?.endPanels ?? [])],
    styleId, makeUid: () => `t-${++uid}`,
  });
  if (!run.ok) throw new Error(run.message);
  return run;
}
const fullUppers = (placed: readonly PlacedCabinet[]) => placed.filter((item) => item.placement === "wall" && Math.abs(Number(item.height) - 30) <= 0.5 && /^W\d{4}$/.test(item.masterCode));

describe("Auto Design honors the finish picks in the form", () => {
  it("Glass cabinets above: 30 in uppers get the line's own GD row, with no review line on success", () => {
    const solid = build([]);
    expect(fullUppers(solid.placed).some((item) => item.glassDoor === true)).toBe(false);
    const glass = build(["glass-uppers"]);
    const byCode = new Map(PACK.wall.map((row) => [row.masterCode, row]));
    const uppers = fullUppers(glass.placed);
    expect(uppers.length).toBeGreaterThan(0);
    // The Designer's glass upgrade: the solid row stays on the plan and the cart
    // orders `${code}GD`, so that GD row must be a real catalog row of this line.
    for (const item of uppers) {
      const gd = byCode.get(`${item.masterCode}GD`);
      expect(item.glassDoor === true, item.masterCode).toBe(Boolean(gd && Math.abs(Number(gd.height) - Number(item.height)) <= 0.5));
    }
    expect(uppers.some((item) => item.glassDoor === true)).toBe(true);
    // A 12 in bridge over the range or refrigerator keeps its solid door.
    expect(glass.placed.filter((item) => item.placement === "wall" && Number(item.height) < 20).every((item) => item.glassDoor !== true)).toBe(true);
    expect(glass.reviewFindings.some((finding) => /glass/i.test(`${finding.title} ${finding.detail}`) && finding.code !== "preference-glass-uppers-unavailable")).toBe(false);
    expect(glass.reviewFindings.some((finding) => /not placed automatically/.test(finding.detail))).toBe(false);
  });

  it("Glass cabinets above on a line with no 30 in glass rows: solid doors stay and one warning names them", () => {
    const run = build(["glass-uppers"], CATALOG["540005"]!, 540005);
    expect(run.placed.some((item) => item.glassDoor === true)).toBe(false);
    const warning = run.reviewFindings.filter((finding) => finding.code === "preference-glass-uppers-unavailable");
    expect(warning).toHaveLength(1);
    expect(warning[0]!.detail).toMatch(/sells no glass-door \(GD\) version of W\d{4}/);
  });

  it("Crown molding turns on the designer's crown trim", () => {
    expect(autoDesignTrimFromIntake({ ...emptyAutoDesignIntake(), preferences: ["crown-molding"] }).crown).toBe(true);
    expect(autoDesignTrimFromIntake({ ...emptyAutoDesignIntake(), preferences: [] }).crown).toBe(false);
    const run = build(["crown-molding"]);
    // Placed for real by the designer's crown trim, so no review line at all.
    expect(run.reviewFindings.some((finding) => /crown/i.test(`${finding.title} ${finding.detail}`))).toBe(false);
  });
});
