import { describe, expect, it } from "vitest";
import matrixCatalog from "@/lib/__fixtures__/autoDesignMatrixCatalog.json";
import { mergeAutoDesignRefrigeratorCaps, runAutoDesignLayout } from "./autoDesignLayout";
import { emptyAutoDesignIntake, type AutoDesignIntake, type PreferenceId } from "./autoDesignFifteenRules";
import type { AutoDesignInputs } from "./autoDesignAutoBuild";
import { autoDesignTrimFromIntake } from "./autoDesignFormOptions";
import type { DesignCabinet, PlacedCabinet, RoomData } from "./design";

// Tom, Nov 14 2026: picks in the Auto Design form (glass doors, crown molding)
// never reached the generated kitchen. Built on a recorded catalog line that
// sells 12/15/18" glass stackers (and 30" GD boxes, which glass must NOT use).
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
  it("Glass cabinets above: uppers stay solid and the line's own glass stackers go on top (Tom, Nov 17 2026)", () => {
    const solid = build([]);
    expect(solid.placed.some((item) => item.stackedOnCabinetUid)).toBe(false);
    const glass = build(["glass-uppers"]);
    const byCode = new Map(PACK.wall.map((row) => [row.masterCode, row]));
    // Glass never means a GD version of the 30 in upper itself.
    expect(fullUppers(glass.placed).every((item) => item.glassDoor !== true)).toBe(true);
    const stackers = glass.placed.filter((item) => item.stackedOnCabinetUid);
    expect(stackers.length).toBeGreaterThan(0);
    for (const stacker of stackers) {
      const parent = glass.placed.find((item) => item.uid === stacker.stackedOnCabinetUid)!;
      // 96 in ceiling over 30 in uppers at the 84 in line: 12 in stackers, real catalog rows.
      expect(Number(stacker.height)).toBe(12);
      expect(byCode.get(stacker.masterCode)?.id).toBe(stacker.cabinetId);
      expect(Math.abs(Number(stacker.width) - Number(parent.width))).toBeLessThanOrEqual(0.05);
    }
    expect(glass.reviewFindings.some((finding) => /not placed automatically/.test(finding.detail))).toBe(false);
  });

  it("Glass cabinets above on a line with no glass stackers: no stacker and one warning names the uppers", () => {
    const run = build(["glass-uppers"], CATALOG["540005"]!, 540005);
    expect(run.placed.some((item) => item.glassDoor === true || item.stackedOnCabinetUid)).toBe(false);
    // No partial glass (rule 1b, Tom, Nov 18 2026): every run stays plain, one warning names the blockers.
    const warning = run.reviewFindings.filter((finding) => finding.code === "preference-glass-run-plain");
    expect(warning).toHaveLength(1);
    expect(warning[0]!.detail).toMatch(/stays plain because of W\S+ \(this line sells no 12″, 15″ or 18″ glass stacker/);
  });

  it("Crown molding turns on the designer's crown trim", () => {
    expect(autoDesignTrimFromIntake({ ...emptyAutoDesignIntake(), preferences: ["crown-molding"] }).crown).toBe(true);
    expect(autoDesignTrimFromIntake({ ...emptyAutoDesignIntake(), preferences: [] }).crown).toBe(false);
    const run = build(["crown-molding"]);
    // Placed for real by the designer's crown trim, so no review line at all.
    expect(run.reviewFindings.some((finding) => /crown/i.test(`${finding.title} ${finding.detail}`))).toBe(false);
  });
});
