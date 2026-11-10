/**
 * Auto Design follows the door selected in the designer.
 *
 * The build used to stamp Color 1 (`designStyleId`), a separate default that
 * stays put while the highlighted door changes. Uppers, bases, talls, and the
 * island then disagreed with that door, or with each other. Every generated
 * cabinet now carries the selected door's style id, so the resolved finish is
 * that door's finish.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import matrixCatalog from "@/lib/__fixtures__/autoDesignMatrixCatalog.json";
import { runAutoDesignLayout, stampAutoDesignSingleFinish, uniformCabinetStyleId } from "@/lib/autoDesignLayout";
import type { AutoDesignInputs } from "@/lib/autoDesignAutoBuild";
import { designerThreeDAssignments, type DesignerStyleRow } from "@/lib/designerThreeDStyles";
import { doorStyleFinishColors } from "@/lib/doorStyleAppearance";
import type { DesignCabinet, PlacedCabinet, RoomData } from "@/lib/design";

/** Color 1, the old Auto Design default. Not the door the designer has selected. */
const COLOR_ONE: DesignerStyleRow = {
  id: 111,
  ourName: "Color One Oak",
  aliasName: "Color One Oak",
  color: "#8B6914",
  finish: "Color One Oak",
  doorStyle: "Shaker",
  woodSpecies: "Oak",
};

/** The door approved and selected in the designer. */
const SELECTED: DesignerStyleRow = {
  id: 222,
  ourName: "Approved Maple",
  aliasName: "Approved Maple",
  color: "#C4A574",
  finish: "Approved Maple",
  doorStyle: "Raised Panel",
  woodSpecies: "Maple",
};

type Pack = { base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[]; surround?: { deepAbove?: DesignCabinet[]; endPanels?: DesignCabinet[] } };
const pack = (matrixCatalog as unknown as Record<string, Pack>)["330002"]!;

const ROOM: RoomData = { width: 144, depth: 144, ceilingHeight: 96 };

const PANTRY: DesignCabinet = {
  id: 88001,
  masterCode: "P2484",
  description: "Pantry cabinet",
  category: "Tall",
  subCategory: "Pantry",
  width: "18",
  depth: "24",
  height: "84",
  placement: "tall",
} as DesignCabinet;

function appliance(code: string, width: number, depth: number, height: number): DesignCabinet {
  return {
    id: 0, masterCode: code, description: code, category: "Appliance", subCategory: "Appliance",
    width: String(width), depth: String(depth), height: String(height), placement: "appliance",
  } as DesignCabinet;
}

const APPLIANCES = [
  appliance("RANGE-30", 30, 25, 36),
  appliance("DW-24", 24, 24, 34.5),
  appliance("FRIDGE-36", 36, 30, 70),
  appliance("HOOD-30", 30, 18, 18),
];

function input(): AutoDesignInputs {
  return {
    layoutType: "l-shape",
    originCorner: "left",
    runDirection: "right",
    wallCabinetHeightIn: 30,
    sink: { wallLabel: "Wall 2", centerOffsetIn: 72 },
    sinkBaseWidthIn: 36,
    sinkBaseKind: "regular",
    stove: { wallLabel: "Wall 1", centerOffsetIn: 44 },
    dishwasher: null,
    dishwasherSide: "right",
    refrigerator: null,
    kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
    // A second id the build must not keep once the designer has selected a door.
    designQuestionDoorStyleId: COLOR_ONE.id,
    tallCabinets: [{ cabinetId: PANTRY.id, masterCode: PANTRY.masterCode, widthIn: 18, heightIn: 84 }],
  } as AutoDesignInputs;
}

function build() {
  let uid = 0;
  const run = runAutoDesignLayout({
    input: input(),
    room: ROOM,
    openings: [],
    baseCatalog: pack.base,
    wallCatalog: pack.wall,
    fillers: pack.accessory,
    appliancePalette: APPLIANCES,
    refrigeratorCaps: [],
    refrigeratorEndPanels: [],
    tallCatalog: [PANTRY],
    styleId: SELECTED.id,
    peninsula: { side: "left", lengthIn: 60, front: "straight", appliance: "none" },
    makeUid: () => `one-color-${++uid}`,
  });
  if (!run.ok) throw new Error(run.message);
  return run;
}

describe("stampAutoDesignSingleFinish", () => {
  it("replaces a second finish and a missing finish with the selected door", () => {
    const mixed = [
      { uid: "b", placement: "base", styleId: COLOR_ONE.id },
      { uid: "w", placement: "wall", styleId: 999 },
      { uid: "t", placement: "tall", styleId: null },
      { uid: "island", placement: "base", wallId: "auto-peninsula", styleId: COLOR_ONE.id },
      { uid: "range", placement: "appliance", styleId: null },
    ] as PlacedCabinet[];
    const stamped = stampAutoDesignSingleFinish(mixed, SELECTED.id);
    expect(stamped.filter((item) => item.placement !== "appliance").every((item) => item.styleId === SELECTED.id)).toBe(true);
    expect(stamped.find((item) => item.uid === "range")?.styleId ?? null).toBeNull();
    expect(uniformCabinetStyleId(stamped)).toBe(SELECTED.id);
  });
});

describe("an Auto Design layout uses the designer's selected door", () => {
  it("gives uppers, bases, talls, and the island that door's style and finish", () => {
    const run = build();
    const bases = run.placed.filter((item) => item.placement === "base");
    const uppers = run.placed.filter((item) => item.placement === "wall");
    const talls = run.placed.filter((item) => item.placement === "tall");
    const island = run.placed.filter((item) => item.wallId === "auto-peninsula" || item.wallId === "auto-peninsula-45");
    expect(bases.length).toBeGreaterThan(0);
    expect(uppers.length).toBeGreaterThan(0);
    expect(talls.length).toBeGreaterThan(0);
    expect(island.length).toBeGreaterThan(0);

    const cabinets = [...bases, ...uppers, ...talls];
    expect(new Set(cabinets.map((item) => item.styleId))).toEqual(new Set([SELECTED.id]));
    expect(uniformCabinetStyleId(run.placed)).toBe(SELECTED.id);

    const selectedFinish = doorStyleFinishColors(SELECTED).face;
    const colorOneFinish = doorStyleFinishColors(COLOR_ONE).face;
    expect(selectedFinish.toLowerCase()).not.toBe(colorOneFinish.toLowerCase());

    // Color 1 is the default a cabinet would inherit. The selected door is
    // stored on the cabinet, so the 3D finish is the selected door.
    const assignments = designerThreeDAssignments({
      placed: cabinets,
      defaultStyleId: COLOR_ONE.id,
      doorStyles: [COLOR_ONE, SELECTED],
      acceptedRows: [],
    });
    expect(assignments.length).toBe(cabinets.length);
    for (const assignment of assignments) {
      expect(assignment.styleId).toBe(SELECTED.id);
      expect(assignment.style?.doorStyle).toBe(SELECTED.doorStyle);
      expect(doorStyleFinishColors(assignment.style).face.toLowerCase()).toBe(selectedFinish.toLowerCase());
    }
  });

  it("reads the selected door in the Auto Design builders, not Color 1", () => {
    const source = readFileSync(new URL("../pages/DesignTool.tsx", import.meta.url), "utf8");
    const build = source.slice(
      source.indexOf("const buildAutoDesignLayout = useCallback("),
      source.indexOf("const completeAutoDesignLayout = useCallback("),
    );
    const completion = source.slice(
      source.indexOf("const completeAutoDesignLayout = useCallback("),
      source.indexOf("finishAutoDesignLayoutRef.current = completeAutoDesignLayout"),
    );
    expect(build).toContain("styleId: styleIdRef.current ?? null");
    expect(build).not.toContain("designStyleIdRef");
    expect(completion).toContain("stampAutoDesignSingleFinish(working, styleIdRef.current ?? null)");
    expect(completion).not.toContain("designStyleIdRef");
  });
});
