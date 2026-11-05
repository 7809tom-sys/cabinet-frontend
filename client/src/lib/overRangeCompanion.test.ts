import { describe, expect, it } from "vitest";
import catalogFixture from "./__fixtures__/autoDesignRealCatalog.json";
import {
  answerWantsMicrowaveBridge,
  overRangeBridgeFor,
  overRangeCompanionPlacements,
  overRangeMicrowaveFor,
  planOverRangeCompanions,
} from "./overRangeCompanion";
import { DEFAULT_ROOM, APPLIANCES, applianceAsDesignCabinet, wallPlacementAt, wallRunOffset, wallRunSpan, type DesignCabinet, type PlacedCabinet } from "./design";

type Fixture = Record<string, { base: unknown[]; wall: unknown[]; accessory: unknown[] }>;
const REAL = catalogFixture as unknown as Fixture;
const wallRows = (style: string) => REAL[style]!.wall as DesignCabinet[];
const appliancePalette = APPLIANCES.map(applianceAsDesignCabinet);

function range(start: number, width = 30): PlacedCabinet {
  const spot = wallPlacementAt(start, width, 26, "bottom", DEFAULT_ROOM);
  return {
    uid: "range-1",
    cabinetId: 0,
    masterCode: "RANGE-30",
    description: "30 inch range",
    category: "Appliance",
    subCategory: "Appliance",
    placement: "appliance",
    ...spot,
    width,
    depth: 26,
    height: 36,
    numberOfDoors: 0,
    numberOfDrawers: 0,
  } as PlacedCabinet;
}

describe("microwave and bridge are placed during the build", () => {
  it("finds the real bridge for the approved 30 inch range and 30 inch uppers", () => {
    const bridge = overRangeBridgeFor({ rangeWidthIn: 30, wallCabinetHeightIn: 30, wallCatalog: wallRows("330011") });
    expect(bridge?.masterCode).toBe("W3012");
  });

  it("accepts a frameless bridge whose height is 15 1/8 or 17 5/8", () => {
    const bridge = overRangeBridgeFor({ rangeWidthIn: 30, wallCabinetHeightIn: 36, wallCatalog: wallRows("540005") });
    expect(bridge).not.toBeNull();
    expect(bridge!.masterCode).toBe("W3018");
  });

  it("never uses a spice cabinet as the bridge", () => {
    const withSpice = [
      ...wallRows("330011"),
      { id: 999999, masterCode: "WSC30", description: '30" Spice Cabinet', placement: "wall", width: "30", height: "12", depth: "12" } as DesignCabinet,
    ];
    const bridge = overRangeBridgeFor({ rangeWidthIn: 30, wallCabinetHeightIn: 30, wallCatalog: withSpice });
    expect(bridge?.masterCode).toBe("W3012");
  });

  it("matches the bridge to the RANGE width, not a fixed 30 inches", () => {
    // Owner rule: the bridge spans the range. A 36" range takes the 36" bridge in
    // its own line; a 30" range takes the 30" one.
    const wide = overRangeBridgeFor({ rangeWidthIn: 36, wallCabinetHeightIn: 30, wallCatalog: wallRows("330011") });
    expect(wide?.masterCode).toBe("W3612");
    expect(Number(wide?.width)).toBeCloseTo(36, 3);
    const standard = overRangeBridgeFor({ rangeWidthIn: 30, wallCabinetHeightIn: 30, wallCatalog: wallRows("330011") });
    expect(standard?.masterCode).toBe("W3012");
  });

  it("uses the nearest stock bridge width when the line sells no exact match", () => {
    // 330002 sells 30", 33" and 36" bridges and no 24", so a 24" range takes the
    // nearest one rather than failing.
    const bridge = overRangeBridgeFor({ rangeWidthIn: 24, wallCabinetHeightIn: 30, wallCatalog: wallRows("330011") });
    expect(bridge).not.toBeNull();
    expect(Number(bridge!.width)).toBeCloseTo(30, 3);
  });

  it("picks a shorter bridge that still clears a low ceiling", () => {
    // 72" datum + 24" = 96"; an 88" ceiling cannot take a 24" bridge but can take a 12".
    const bridge = overRangeBridgeFor({ rangeWidthIn: 30, wallCabinetHeightIn: 42, wallCatalog: wallRows("330011"), ceilingIn: 88 });
    expect(bridge).not.toBeNull();
    expect(Number(bridge!.height)).toBeLessThanOrEqual(16);
  });

  it("finds the over-range microwave for the range width", () => {
    const microwave = overRangeMicrowaveFor(30, appliancePalette);
    expect(microwave?.masterCode).toMatch(/^MW/);
  });

  it("plans a centered bridge and a microwave at the 72 inch datum", () => {
    const result = planOverRangeCompanions({
      answer: "microwave-bridge",
      placed: [range(60)],
      room: DEFAULT_ROOM,
      appliancePalette,
      wallCatalog: wallRows("330011"),
      wallCabinetHeightIn: 30,
    });
    expect(result.ok, result.ok ? "" : JSON.stringify(result.findings)).toBe(true);
    if (!result.ok) return;
    const center = wallRunOffset(range(60), "bottom", DEFAULT_ROOM) + wallRunSpan(range(60), "bottom", DEFAULT_ROOM) / 2;
    expect(result.plan.bridgeSpot.wallOffset).toBeCloseTo(center - 15, 5);
    expect(result.plan.bridgeMountBottom).toBe(72);
    expect(result.plan.microwaveMountBottom).toBeLessThan(72);
  });

  it("places the bridge and microwave as real placed cabinets", () => {
    const result = planOverRangeCompanions({
      answer: "microwave-bridge",
      placed: [range(60)],
      room: DEFAULT_ROOM,
      appliancePalette,
      wallCatalog: wallRows("330011"),
      wallCabinetHeightIn: 30,
    });
    if (!result.ok) throw new Error(JSON.stringify(result.findings));
    let n = 0;
    const placed = overRangeCompanionPlacements(result.plan, { makeUid: () => `uid-${++n}`, styleId: 330011 });
    expect(placed.map((item) => item.placement).sort()).toEqual(["appliance", "wall"]);
    const bridge = placed.find((item) => item.placement === "wall")!;
    expect(bridge.overRangeMicrowaveBridge).toBe(true);
    expect(bridge.mountBottom).toBe(72);
  });

  it("reports a named warning when the line sells no bridge at all", () => {
    const result = planOverRangeCompanions({
      answer: "microwave-bridge",
      placed: [range(60, 36)],
      room: DEFAULT_ROOM,
      appliancePalette,
      // A line with only full-height uppers and no short bridge family.
      wallCatalog: wallRows("540005").filter((row) => !/^W\d{2}(?:12|15|18|21|24)$/i.test((row.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, ""))),
      wallCabinetHeightIn: 30,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.some((finding) => finding.code === "no-matching-bridge")).toBe(true);
    expect(result.findings.every((finding) => finding.severity === "warning")).toBe(true);
    expect(result.findings.find((finding) => finding.code === "no-matching-bridge")!.detail).toMatch(/36″ range/);
  });

  it("does nothing unless the design questions asked for it", () => {
    // `null`/`undefined` now mean "no explicit answer", which the build treats as
    // the owner default (microwave + bridge). An explicit hood or open answer
    // still places nothing here.
    for (const answer of ["hood", "open"] as const) {
      expect(answerWantsMicrowaveBridge(answer)).toBe(false);
      const result = planOverRangeCompanions({
        answer,
        placed: [range(60)],
        room: DEFAULT_ROOM,
        appliancePalette,
        wallCatalog: wallRows("330011"),
        wallCabinetHeightIn: 30,
      });
      expect(result).toEqual({ ok: false, findings: [] });
    }
  });
});
