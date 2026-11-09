/**
 * The accepted door render drives EVERY 3D surface.
 *
 * Reported: a Carbon Frost kitchen (Preston / Skyline, raised panel, approved
 * door hex `#34363a`) showed the dark raised door in the selected style bar while
 * the 3D view drew a light shaker door with a linen box and toe kick.
 *
 * Two causes, both fixed here:
 *
 *   1. `threeDCabinetDoorProfiles`, `threeDCabinetFaces`, the elevation face plan,
 *      the panel-kind map, the color trace, and the island cabinet all read a raw
 *      `doorStyles.find(...)` row. The approval arrives in the separate
 *      `doorStyles.acceptedAppearance` read, so those lookups fell through to the
 *      catalog color — or to the name-keyword swatch table, whose linen bucket is
 *      `#e6dcc6` — while the style bar showed the approved door.
 *   2. Raised vs shaker came from the same raw row, so an approved raised style
 *      could be drawn as a shaker.
 *
 * The rule these tests hold: the approved door render is the kitchen's color,
 * ahead of catalog colors and hardcoded swatches, and it is never snapped to a
 * brand palette.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  acceptedAppearanceRowMap,
  designerThreeDAssignments,
  styleWithAccepted,
  type DesignerStyleRow,
} from "./designerThreeDStyles";
import { doorStyleFinishColors, resolveDoorFinishHex } from "./doorStyleAppearance";
import { resolveKitchenDoorColor } from "./acceptedDoorAppearance";
import { isRaisedPanelStyle } from "@shared/raisedPanelDoorBlueprint";
import { finishColors } from "./design";

const designToolSource = readFileSync(new URL("../pages/DesignTool.tsx", import.meta.url), "utf8");

/** Carbon Frost as the catalog row stores it: a name, not a hex. */
const CARBON_FROST: DesignerStyleRow = {
  id: 390012,
  styleCode: "AC",
  ourName: "Aspen Charcoal",
  aliasName: "Carbon Frost",
  distributorId: 180001,
  distributorName: "Preston",
  distributorCode: "SK",
  color: "Espresso Brown",
  finish: "Matching",
  woodSpecies: "Solid Birch",
  doorStyle: "Raised Panel",
  doorPanelType: "Raised Panel",
  panelConstruction: "raised",
  doorSampleImageUrl: "/uploads/carbon-frost-door.jpg",
};

/** The approved render an operator accepted for that style. */
const ACCEPTED_CARBON_FROST = {
  styleId: 390012,
  colorHex: "#34363a",
  textureUrl: "/manus-storage/door-rendering-audit/carbon-frost-accepted.png",
  approvedVersionId: 4011,
};

const LINEN_KEYWORD_FACE = "#e6dcc6";

describe("the accepted render is the only color the 3D surfaces read", () => {
  it("takes the approved hex on the door, box, sides, and toe kick", () => {
    // Without the merge the raw row resolves from catalog text. Prove the merge
    // is what changes the answer, so this test cannot pass by accident.
    expect(resolveDoorFinishHex(CARBON_FROST)).not.toBe("#34363a");

    const merged = styleWithAccepted(CARBON_FROST, acceptedAppearanceRowMap([ACCEPTED_CARBON_FROST]));
    const decision = resolveKitchenDoorColor(merged as never);
    expect(decision.appliedHex).toBe("#34363a");
    expect(decision.appliedSource).toBe("accepted-render");
    // One color for every visible surface of the cabinet: fronts, carcass, sides,
    // and toe kick all receive `finishById`'s face from this same decision.
    expect(doorStyleFinishColors(merged as never).face).toBe("#34363a");
  });

  it("never falls back to the linen keyword bucket when an approval exists", () => {
    const merged = styleWithAccepted(CARBON_FROST, acceptedAppearanceRowMap([ACCEPTED_CARBON_FROST]));
    const face = doorStyleFinishColors(merged as never).face.toLowerCase();
    expect(face).toBe("#34363a");
    expect(face).not.toBe(LINEN_KEYWORD_FACE);
    // The keyword table really would have produced linen for a "linen" style, so
    // this value is what a raw-row lookup can land on.
    expect(finishColors("linen shaker").face.toLowerCase()).toBe(LINEN_KEYWORD_FACE);
  });

  it("is never snapped to the brand palette", () => {
    // An odd approved tone (not a keyword, not a swatch) must be applied verbatim.
    for (const approved of ["#34363a", "#3a3d42", "#efe7d8", "#4b3f35"]) {
      const merged = styleWithAccepted(CARBON_FROST, acceptedAppearanceRowMap([{ ...ACCEPTED_CARBON_FROST, colorHex: approved }]));
      expect(doorStyleFinishColors(merged as never).face.toLowerCase()).toBe(approved);
    }
  });

  it("draws the approved render as the door and drawer image", () => {
    const [assignment] = designerThreeDAssignments({
      placed: [{ uid: "b1", styleId: null, placement: "base" }],
      defaultStyleId: 390012,
      doorStyles: [CARBON_FROST],
      acceptedRows: [ACCEPTED_CARBON_FROST],
    });
    expect(assignment.facePlan?.doorUrl).toBe(ACCEPTED_CARBON_FROST.textureUrl);
    expect((assignment.facePlan as { acceptedColorHex?: string | null }).acceptedColorHex).toBe("#34363a");
    expect(assignment.profile?.doorStyle).toBe("Raised Panel");
    expect(assignment.raisedPanel).toBe(true);
  });

  it("keeps a per-cabinet (two-tone) override on its own accepted style", () => {
    const ISLAND_STYLE: DesignerStyleRow = {
      id: 540005,
      styleCode: "LSA",
      ourName: "Luxe Shaker",
      aliasName: "Luxe Shaker (AltaEuro)",
      doorStyle: "Shaker",
      doorPanelType: "Recessed Panel",
    };
    const assignments = designerThreeDAssignments({
      placed: [
        { uid: "perimeter", styleId: null, placement: "base" },
        { uid: "island", styleId: 540005, placement: "base" },
      ],
      defaultStyleId: 390012,
      doorStyles: [CARBON_FROST, ISLAND_STYLE],
      acceptedRows: [
        ACCEPTED_CARBON_FROST,
        { styleId: 540005, colorHex: "#dfe3e6", textureUrl: "/audit/luxe.png", approvedVersionId: 77 },
      ],
    });
    expect(assignments[0]!.styleId).toBe(390012);
    expect(assignments[0]!.raisedPanel).toBe(true);
    expect(assignments[1]!.styleId).toBe(540005);
    expect(assignments[1]!.raisedPanel).toBe(false);
    expect(doorStyleFinishColors(assignments[1]!.style as never).face.toLowerCase()).toBe("#dfe3e6");
  });

  it("leaves a style with no acceptance untouched, and invents no color", () => {
    expect(styleWithAccepted(CARBON_FROST, acceptedAppearanceRowMap(null))).toBe(CARBON_FROST);
    expect(styleWithAccepted(null, acceptedAppearanceRowMap([ACCEPTED_CARBON_FROST]))).toBeNull();
    // A row with no version id is not an acceptance.
    const notAccepted = { ...ACCEPTED_CARBON_FROST, approvedVersionId: null };
    expect(styleWithAccepted(CARBON_FROST, acceptedAppearanceRowMap([notAccepted]))).toBe(CARBON_FROST);
  });

  it("derives raised vs shaker from the accepted-merged style, not a raw row", () => {
    // Aspen White is stored with doorStyle "Shaker" but builds raised; the merged
    // row the renderer reads has to carry that.
    const aspenWhite: DesignerStyleRow = {
      id: 390013,
      styleCode: "AW",
      ourName: "Aspen White",
      aliasName: "Carbon Frost White",
      distributorName: "Preston",
      distributorCode: "SK",
      doorStyle: "Shaker",
      panelConstruction: "raised",
    };
    const merged = styleWithAccepted(aspenWhite, acceptedAppearanceRowMap([
      { styleId: 390013, colorHex: "#efece4", textureUrl: "/audit/aspen-white.png", approvedVersionId: 12 },
    ]));
    expect(isRaisedPanelStyle(merged)).toBe(true);
  });
});

describe("the Designer's 3D wiring reads the accepted style everywhere", () => {
  const assignments = designToolSource.slice(
    designToolSource.indexOf("const threeDStyleAssignments = useMemo"),
    designToolSource.indexOf("const threeDCabinetDoorSamples = useMemo"),
  );

  it("resolves the 3D profiles and faces from one accepted-merged assignment list", () => {
    expect(designToolSource).toContain("designerThreeDAssignments({");
    expect(assignments).toContain("acceptedRows: acceptedAppearance.rows");
    expect(assignments).toContain("threeDCabinetDoorProfiles");
    expect(assignments).toContain("threeDCabinetFaces");
    // No raw lookup may feed the 3D profiles or faces.
    expect(assignments).not.toMatch(/doorStyles\?\.find/);
    expect(assignments).not.toMatch(/doorStyles\.find/);
  });

  it("accepts the render in the elevation face plan, the panel-kind map, the trace, and the island", () => {
    expect(designToolSource).toContain("const facePlanForCab = useCallback");
    const facePlan = designToolSource.slice(
      designToolSource.indexOf("const facePlanForCab = useCallback"),
      designToolSource.indexOf("const doorSampleForCab = useCallback"),
    );
    expect(facePlan).toContain("withAccepted(");

    const panelKinds = designToolSource.slice(
      designToolSource.indexOf("const panelKindById = useMemo"),
      designToolSource.indexOf("const displayStyleIdForCab = useCallback"),
    );
    expect(panelKinds).toContain("withAccepted(");

    const trace = designToolSource.slice(
      designToolSource.indexOf("const recorder = createColorTraceRecorder();"),
      designToolSource.indexOf("const colorTracePanelState"),
    );
    expect(trace).toContain("withAccepted(");

    const island = designToolSource.slice(
      designToolSource.indexOf("const threeDIslandCabinet = useMemo"),
      designToolSource.indexOf("const threeDIslandCountertop ="),
    );
    expect(island).toContain("withAccepted(");
  });

  it("keeps acceptedAppearance.rows in the assignment dependency list so an approval re-renders", () => {
    // The useMemo's dependency array sits after its factory's closing "}),".
    const deps = assignments.slice(assignments.lastIndexOf("}),") + 3);
    expect(deps).toContain("acceptedAppearance.rows");
    expect(deps).toContain("doorStyles");
    expect(deps).toContain("placed");
    expect(deps).toContain("designStyleId");
  });
});
