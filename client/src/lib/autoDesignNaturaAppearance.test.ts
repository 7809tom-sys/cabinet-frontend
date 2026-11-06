/**
 * Both Designers must render Natura Maple the same way.
 *
 * Natura Maple is the Ashford `Designer Natural` row (330004). It is reachable
 * from two entry points:
 *
 *   - the regular Designer, where cabinets are placed and the style is chosen
 *   - the INSTANT (auto) designer, where `runAutoDesignLayout` places a measured
 *     kitchen and stamps each cabinet with `styleId`
 *
 * Both feed the 3D view through `designerThreeDAssignments`, which resolves one
 * style row per cabinet and one face plan from it. So a fix in that shared path
 * has to reach an auto-designed cabinet identically — and this test proves it on
 * a real 144 × 144 inch L-shaped build rather than a hand-made cabinet list.
 */
import { describe, expect, it } from "vitest";
import matrixCatalog from "@/lib/__fixtures__/autoDesignMatrixCatalog.json";
import { mergeAutoDesignRefrigeratorCaps, runAutoDesignLayout } from "@/lib/autoDesignLayout";
import type { AutoDesignInputs } from "@/lib/autoDesignAutoBuild";
import { designerThreeDAssignments } from "@/lib/designerThreeDStyles";
import { designerFacePlan } from "@/lib/designerFacePlan";
import { dlcPhotoCompensationApplies } from "@shared/dlcFr26Textures";
import type { DesignCabinet, RoomData } from "@/lib/design";

/** Natura Maple, as the door style row the Designer holds. */
const NATURA_MAPLE = {
  id: 330004,
  distributorId: 210001,
  distributorName: "Ashford",
  styleCode: "DN",
  ourName: "Designer Natural",
  aliasName: "Natura Maple (Ashford)",
  color: "#D4B896",
  finish: "Natura Maple (Ashford)",
  doorStyle: "Shaker",
  woodSpecies: "Maple",
};

type Pack = { base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[]; surround?: { deepAbove?: DesignCabinet[]; endPanels?: DesignCabinet[] } };
// The Ashford line's source-priced cabinet pool. No priced pool for 330004 exists
// in this repo; the box pool is the line's, the door style is Natura Maple's.
const pack = (matrixCatalog as unknown as Record<string, Pack>)["330002"]!;

const ROOM: RoomData = { width: 144, depth: 144, ceilingHeight: 96 };

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
  appliance("HOOD-36", 36, 18, 18),
];

/** A measured 144 × 144 L-shape on two adjacent walls (back and right). */
function instantInput(): AutoDesignInputs {
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
    refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 112 },
    refrigeratorWidthIn: 36,
    refrigeratorPanels: "both",
    refrigeratorEnclosure: "cabinet-above",
    kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
  } as AutoDesignInputs;
}

function buildInstantL() {
  let uid = 0;
  const run = runAutoDesignLayout({
    input: instantInput(),
    room: ROOM,
    openings: [],
    baseCatalog: pack.base,
    wallCatalog: pack.wall,
    fillers: pack.accessory,
    appliancePalette: APPLIANCES,
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround?.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround?.endPanels ?? [],
    styleId: NATURA_MAPLE.id,
    makeUid: () => `instant-${++uid}`,
  });
  if (!run.ok) throw new Error(run.message);
  return run;
}

describe("the instant designer builds this kitchen with Natura Maple", () => {
  it("generates a real 144 × 144 L-shape with cabinets on two adjacent walls", () => {
    const run = buildInstantL();
    expect(run.placed.length).toBeGreaterThan(20);
    const walls = new Set(
      run.placed
        .filter((item) => item.placement === "base" || item.placement === "appliance")
        .map((item) => (item as { wallId?: string }).wallId),
    );
    // An L is two runs that meet at a corner, so exactly two walls carry cabinets.
    expect(walls.size).toBe(2);
    // Every front-bearing cabinet carries the selected style, which is how the 3D
    // view finds it. Trim pieces (end panels) carry no fronts and no style, and the
    // view resolves those from the design's default style instead.
    const fronts = run.placed.filter((item) => item.placement === "base" || item.placement === "wall" || item.placement === "tall");
    expect(fronts.length).toBeGreaterThan(15);
    for (const item of fronts.filter((entry) => entry.styleId != null)) {
      expect(item.styleId).toBe(NATURA_MAPLE.id);
    }
    // The base and wall runs carry it explicitly; a panel or a trim piece may not,
    // and the view then resolves the design's default style for it.
    expect(fronts.filter((entry) => entry.styleId === NATURA_MAPLE.id).length).toBeGreaterThan(15);
  });
});

describe("both designers resolve Natura Maple through one appearance", () => {
  it("gives every auto-placed cabinet the same face plan the regular Designer builds", () => {
    const run = buildInstantL();
    const assignments = designerThreeDAssignments({
      placed: run.placed.map((item) => ({ uid: item.uid, styleId: item.styleId, placement: item.placement })),
      defaultStyleId: NATURA_MAPLE.id,
      doorStyles: [NATURA_MAPLE],
      acceptedRows: [],
    });

    const regularPlan = designerFacePlan(NATURA_MAPLE as never, "base")!;
    expect(assignments.length).toBe(run.placed.length);
    const resolved = assignments.filter((entry) => entry.facePlan?.dlcCrop);
    expect(resolved.length).toBeGreaterThan(0);

    for (const entry of resolved) {
      const crop = entry.facePlan!.dlcCrop!;
      // Same color, same borrowed grain, same linear tint as the regular Designer.
      expect(crop.solidColor).toBe(regularPlan.dlcCrop!.solidColor);
      expect(crop.solidColor.toLowerCase()).toBe("#d4b896");
      expect(crop.slug).toBe(regularPlan.dlcCrop!.slug);
      expect(crop.grainSubstituted).toBe(true);
      expect(crop.tintLinear).toEqual(regularPlan.dlcCrop!.tintLinear);
      // And therefore the DL photo compensation is not applied to it.
      expect(dlcPhotoCompensationApplies(crop)).toBe(false);
    }
  });

  it("does not let an auto-placed cabinet fall back to the template grain's colour", () => {
    const run = buildInstantL();
    const assignments = designerThreeDAssignments({
      placed: run.placed.map((item) => ({ uid: item.uid, styleId: item.styleId, placement: item.placement })),
      defaultStyleId: NATURA_MAPLE.id,
      doorStyles: [NATURA_MAPLE],
      acceptedRows: [],
    });
    for (const entry of assignments) {
      const crop = entry.facePlan?.dlcCrop;
      if (!crop) continue;
      // Versa Shaker's own solid is #c7b695. The door must never be painted with it.
      expect(crop.solidColor.toLowerCase()).not.toBe("#c7b695");
      // A brightening multiplier: the door is lighter than the grain it borrows.
      expect(crop.tintLinear![0]).toBeGreaterThan(1);
    }
  });

  it("still resolves an unapproved style to its own record colour, never a brand swatch", () => {
    const run = buildInstantL();
    const assignments = designerThreeDAssignments({
      placed: run.placed.map((item) => ({ uid: item.uid, styleId: item.styleId, placement: item.placement })),
      defaultStyleId: NATURA_MAPLE.id,
      doorStyles: [NATURA_MAPLE],
      acceptedRows: [],
    });
    const first = assignments[0]!;
    expect(first.style?.id).toBe(NATURA_MAPLE.id);
    expect(first.raisedPanel).toBe(false);
    expect(first.profile?.doorStyle).toBe("Shaker");
    expect(first.profile?.paintedFinish).toBe(false);
    // The brand door-surface palette is not what this door renders in.
    for (const brand of ["#dedac6", "#fffdf9", "#f6f3ed", "#244338", "#d7a46c"]) {
      expect(first.facePlan!.dlcCrop!.solidColor.toLowerCase()).not.toBe(brand);
    }
  });
});
