import { describe, expect, it } from "vitest";
import live from "./__fixtures__/aeroSolsticeLive390019.json";
import matrixCatalog from "./__fixtures__/autoDesignMatrixCatalog.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import { emptyAutoDesignIntake, type AutoDesignIntake } from "./autoDesignFifteenRules";
import {
  ADA_BASE_BOX_HEIGHT_IN,
  adaVersionOf,
  applyAdaKitchenPreference,
  isAdaCatalogRow,
  isAdaKitchen,
} from "./autoDesignAda";
import { appliancesForRoom, applianceAsDesignCabinet, type DesignCabinet, type PlacedCabinet, type RoomData, type WallOpening } from "./design";

// "Is this an ADA kitchen?" (Tom, Nov 17 2026, voice 12:18 PM CT).
type Pack = { base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[]; tall?: DesignCabinet[]; surround?: { deepAbove?: DesignCabinet[]; endPanels?: DesignCabinet[] } };
const LIVE = live as unknown as Required<Pack> & { surround: { deepAbove: DesignCabinet[]; endPanels: DesignCabinet[] } };
const SHAKER = (matrixCatalog as unknown as Record<string, Pack>)["330014"]!;

const demoWindow = { uid: "demo-sink-window", kind: "window", label: "Window 36\"", side: "top", offset: 67, width: 36, height: 42, sill: 42 } as WallOpening;
const demoIntake = (patch: Partial<AutoDesignIntake> = {}): AutoDesignIntake => ({
  ...emptyAutoDesignIntake(),
  construction: "new",
  preferences: ["glass-uppers", "crown-molding", "dishwasher"],
  islandOrPeninsula: "island",
  ...patch,
});

/** The 170 x 170 L Aero Solstice demo kitchen (108 in ceiling). */
function runDemo(intake: AutoDesignIntake, pack: Pack = LIVE, styleId = 390019): AutoDesignLayoutSuccess {
  const room = { width: 170, depth: 170, ceilingHeight: 108, openWallPath: false } as RoomData;
  let uid = 0;
  const result = runAutoDesignLayout({
    input: {
      layoutType: "l-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
      sink: { wallLabel: "Wall 1", centerOffsetIn: 85 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
      stove: { wallLabel: "Wall 2", centerOffsetIn: 54 },
      refrigerator: { wallLabel: "Wall 2", centerOffsetIn: 100 }, refrigeratorWidthIn: 36,
      dishwasherSide: "right", skipDishwasher: false, tallCabinets: null, overRangeAnswer: "microwave-bridge",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      designQuestionDoorStyleId: styleId, intake,
    },
    room,
    openings: [demoWindow],
    baseCatalog: pack.base,
    wallCatalog: pack.wall,
    fillers: pack.accessory,
    appliancePalette: appliancesForRoom("kitchen" as never).map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround?.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround?.endPanels ?? [],
    tallCatalog: pack.tall ?? [],
    panelCatalog: [...pack.accessory, ...(pack.surround?.endPanels ?? [])],
    styleId,
    makeUid: () => `ada-${++uid}`,
  } as never) as AutoDesignLayoutSuccess;
  if (!result.ok) throw new Error((result as unknown as { message: string }).message);
  return result;
}

const shakerRow = (code: string) => {
  const row = SHAKER.base.find((item) => item.masterCode === code);
  if (!row) throw new Error(`fixture has no ${code}`);
  return row;
};
function base(code: string, x: number, y: number, wallId: "top" | "bottom" | "left" | "right", uid: string, rotation = 0, row: DesignCabinet = shakerRow(code)): PlacedCabinet {
  return {
    uid, cabinetId: row.id, masterCode: row.masterCode, description: row.description ?? "",
    category: row.category ?? null, subCategory: row.subCategory ?? null,
    placement: "base", x, y, rotation, wallId,
    width: Number(row.width), depth: Number(row.depth), height: Number(row.height),
  } as PlacedCabinet;
}
const ADA_ON = demoIntake({ ada: true });

describe("ADA kitchen toggle", () => {
  it("is off by default and on only when checked", () => {
    expect(isAdaKitchen(emptyAutoDesignIntake())).toBe(false);
    expect(isAdaKitchen({ ...emptyAutoDesignIntake(), ada: false })).toBe(false);
    expect(isAdaKitchen(null)).toBe(false);
    expect(isAdaKitchen(ADA_ON)).toBe(true);
  });

  it("toggle off: the 170 x 170 Aero Solstice demo builds exactly as before", () => {
    const before = runDemo(demoIntake());
    const off = runDemo(demoIntake({ ada: false }));
    expect(off.placed).toEqual(before.placed);
    expect(off.reviewFindings).toEqual(before.reviewFindings);
    expect(off.notes).toEqual(before.notes);
    expect(before.reviewFindings.some((finding) => finding.ruleId === "auto-design-ada")).toBe(false);
  });

  it("toggle off: the Shaker White (330014) demo builds exactly as before", () => {
    const before = runDemo(demoIntake(), SHAKER, 330014);
    const off = runDemo(demoIntake({ ada: false }), SHAKER, 330014);
    expect(off.placed).toEqual(before.placed);
    expect(off.reviewFindings).toEqual(before.reviewFindings);
  });

  it("matches only same-width, same-family ADA rows the line really sells", () => {
    const ada = SHAKER.base.filter(isAdaCatalogRow);
    expect(ada.map((row) => row.masterCode)).not.toContain("3VDB15ADA"); // vanity, 21 in deep
    const pick = (code: string, width: number) => adaVersionOf({ masterCode: code, width }, ada)?.row.masterCode ?? null;
    expect(pick("B24", 24)).toBe("B24ADA");
    expect(pick("3DB15", 15)).toBe("3DB15ADA");
    expect(pick("SB36", 36)).toBe("SB36ADA");
    expect(pick("SB30S", 30)).toBe("SB30SADA");
    expect(pick("B181RS", 18)).toBe("B18ADA1RS");
    expect(pick("B30", 30)).toBe("B30SADA");
    expect(adaVersionOf({ masterCode: "B30", width: 30 }, ada)?.exact).toBe(false);
    expect(pick("BER36", 36)).toBe("BER36ADA");
    expect(pick("B27", 27)).toBeNull();
    expect(pick("BBC36", 36)).toBeNull();
    expect(pick("3DB24", 24)).toBeNull();
  });

  it("toggle on, Shaker White: bases switch to real ADA rows, sink base to SB36ADA, and every switch is listed", () => {
    const run = runDemo(ADA_ON, SHAKER, 330014);
    const before = runDemo(demoIntake(), SHAKER, 330014);
    const byId = new Map(SHAKER.base.map((row) => [row.id, row]));
    const sink = run.placed.find((item) => /^SB/.test(item.masterCode));
    expect(sink?.masterCode).toBe("SB36ADA");
    const adaPlaced = run.placed.filter((item) => item.placement === "base" && item.masterCode.includes("ADA"));
    expect(adaPlaced.length).toBeGreaterThan(0);
    for (const item of adaPlaced) {
      const row = byId.get(item.cabinetId);
      expect(row?.masterCode).toBe(item.masterCode); // real catalog row, never invented
      expect(Number(item.height)).toBeCloseTo(ADA_BASE_BOX_HEIGHT_IN, 2);
      const was = before.placed.find((other) => other.uid === item.uid)!;
      expect(Number(item.width)).toBe(Number(was.width)); // same spot, same width
      expect(item.x).toBe(was.x);
      expect(item.y).toBe(was.y);
    }
    const switched = run.reviewFindings.find((finding) => finding.code === "ada-cabinets-switched");
    expect(switched?.detail).toMatch(/SB36 -> SB36ADA/);
    // Uppers, stackers and appliances are untouched.
    const others = (placed: readonly PlacedCabinet[]) => placed.filter((item) => item.placement !== "base").map((item) => item.masterCode);
    expect(others(run.placed)).toEqual(others(before.placed));
    // Anything without an ADA version is named, not invented.
    const kept = run.reviewFindings.find((finding) => finding.code === "ada-cabinets-no-ada-version");
    if (kept) expect(kept.severity).toBe("warning");
  });

  it("toggle on, Aero Solstice: the line sells no ADA cabinets, so standard SKUs stay and the report says so", () => {
    const run = runDemo(ADA_ON);
    const before = runDemo(demoIntake());
    expect(run.placed.map((item) => item.masterCode)).toEqual(before.placed.map((item) => item.masterCode));
    const codes = run.reviewFindings.filter((finding) => finding.ruleId === "auto-design-ada").map((finding) => finding.code);
    expect(codes).toContain("ada-line-has-no-ada-cabinets");
    expect(codes).toContain("ada-counter-over-34");
    expect(codes).toContain("ada-knee-space-sink-missing");
    expect(codes).toContain("ada-knee-space-cooktop");
    // 170 x 170 L: plenty of floor, so aisles and the turning circle pass.
    expect(codes).toContain("ada-aisle-ok");
    expect(codes).not.toContain("ada-aisle-under-48");
    expect(codes).toContain("ada-turning-circle-ok");
    expect(run.reviewAllHonored).toBe(false);
  });

  it("48 in aisle: a 90 in deep galley leaves 42 in and is flagged", () => {
    const room = { width: 120, depth: 90, ceilingHeight: 96 } as RoomData;
    const placed = [
      base("B24", 0, 0, "top", "t1"), base("B36", 24, 0, "top", "t2"),
      base("B24", 0, 66, "bottom", "b1", 180), base("B36", 24, 66, "bottom", "b2", 180),
    ];
    const result = applyAdaKitchenPreference({ placed, baseCatalog: SHAKER.base, intake: ADA_ON, room });
    const aisle = result.findings.filter((finding) => finding.code === "ada-aisle-under-48");
    expect(aisle.length).toBeGreaterThan(0);
    expect(aisle[0]!.severity).toBe("warning");
    expect(aisle[0]!.detail).toMatch(/Only 42 in/);
    // 42 in across also cannot hold a 60 in turning circle in the galley; the open end can.
    expect(result.findings.some((finding) => finding.code.startsWith("ada-turning-circle"))).toBe(true);
  });

  it("60 in turning circle: a 56 in square room is flagged", () => {
    const room = { width: 56, depth: 56, ceilingHeight: 96 } as RoomData;
    const result = applyAdaKitchenPreference({ placed: [base("B24", 0, 0, "top", "t1")], baseCatalog: SHAKER.base, intake: ADA_ON, room });
    expect(result.findings.find((finding) => finding.code === "ada-turning-circle-missing")?.severity).toBe("warning");
  });

  it("34 in counter when every base has an ADA version; knee space credited at a removable-front sink base", () => {
    const room = { width: 144, depth: 144, ceilingHeight: 96 } as RoomData;
    const removable = { ...shakerRow("SB36ADA"), id: 990001, masterCode: "SB36ADA", description: "36 in. ADA Sink Base — removable front for knee space" } as DesignCabinet;
    const catalog = [...SHAKER.base.filter((row) => row.masterCode !== "SB36ADA"), removable];
    const placed = [base("B24", 0, 0, "top", "t1"), base("SB36", 24, 0, "top", "sink"), base("B15", 60, 0, "top", "t3")];
    const result = applyAdaKitchenPreference({ placed, baseCatalog: catalog, intake: ADA_ON, room });
    expect(result.placed.map((item) => item.masterCode)).toEqual(["B24ADA", "SB36ADA", "B15ADA"]);
    expect(result.placed.find((item) => item.uid === "sink")?.cabinetId).toBe(990001);
    const codes = result.findings.map((finding) => finding.code);
    expect(codes).toContain("ada-counter-34");
    expect(codes).not.toContain("ada-counter-over-34");
    expect(result.findings.find((finding) => finding.code === "ada-knee-space-sink")?.severity).toBe("info");
  });

  it("toggle off returns the plan untouched with no findings", () => {
    const placed = [base("B24", 0, 0, "top", "t1"), base("SB36", 24, 0, "top", "sink")];
    const result = applyAdaKitchenPreference({ placed, baseCatalog: SHAKER.base, intake: demoIntake(), room: { width: 144, depth: 144 } as RoomData });
    expect(result.placed).toEqual(placed);
    expect(result.findings).toEqual([]);
    expect(result.swaps).toEqual([]);
  });
});
