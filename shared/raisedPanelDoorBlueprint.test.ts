import { describe, expect, it } from "vitest";
import * as THREE from "three";
import uscdCasselberry from "./fixtures/casselberryUscd.json";
import catalog from "./fixtures/doorStyleSideCatalog.json";
import { resolveDoorColor, type DoorColorInput } from "./doorColorResolve";
import { isPaintedFinish } from "./paintedFinish";
import { resolveDoorProfile } from "./doorStyleAppearance";
import {
  RAISED_PANEL_BLUEPRINT,
  RAISED_PANEL_BLUEPRINT_ID,
  RAISED_PANEL_FRONT_ROLES,
  RAISED_PANEL_NON_FRONT_SURFACES,
  effectiveRaisedBevelDepthIn,
  isRaisedPanelFrontSurface,
  isRaisedPanelStyle,
  raisedPanelApplicationForStyle,
  raisedPanelFrameGeometry,
  selectRaisedPanelBlueprint,
  type RaisedPanelStyleInput,
} from "./raisedPanelDoorBlueprint";

const styles = catalog as unknown as RaisedPanelStyleInput[];
const CASSELBERRY = uscdCasselberry as RaisedPanelStyleInput;

/** A raised style with no wizard involvement, in a plain painted finish. */
const PAINTED_RAISED: RaisedPanelStyleInput = {
  id: 330026,
  ourName: "Casselberry Antique White",
  doorStyle: "Casselberry",
  doorPanelType: "Mitered frame",
  panelConstruction: "raised",
  woodSpecies: "Painted HDF",
  finish: "Casselberry Blanc (Madison)",
  color: "#EDE0C8",
  insideEdgeProfile: "bevel",
};

/** A raised style in stained wood: grain has to stay. */
const STAINED_RAISED: RaisedPanelStyleInput = {
  id: 330027,
  ourName: "Casselberry Saddle",
  doorStyle: "Casselberry",
  doorPanelType: "Mitered frame",
  panelConstruction: "raised",
  woodSpecies: "Solid Birch frame / solid birch center panel",
  finish: "Walnut Haven (Madison)",
  color: "#8B6040",
  insideEdgeProfile: "bevel",
};

describe("raised-panel library entry", () => {
  it("is a named library entry that only door and drawer fronts use", () => {
    expect(RAISED_PANEL_BLUEPRINT.id).toBe(RAISED_PANEL_BLUEPRINT_ID);
    expect([...RAISED_PANEL_BLUEPRINT.appliesTo]).toEqual(["door", "drawer"]);
    expect([...RAISED_PANEL_FRONT_ROLES]).toEqual(["door", "drawer"]);
    for (const role of RAISED_PANEL_FRONT_ROLES) expect(isRaisedPanelFrontSurface(role)).toBe(true);
    for (const surface of RAISED_PANEL_NON_FRONT_SURFACES) {
      expect(isRaisedPanelFrontSurface(surface), surface).toBe(false);
    }
    expect(isRaisedPanelFrontSurface("left")).toBe(false);
    expect(isRaisedPanelFrontSurface("right")).toBe(false);
    expect(isRaisedPanelFrontSurface(null)).toBe(false);
  });

  it("copies today's rendered geometry: 3 in frame, 0.75 in bevel lifted to 0.45 in, raised center", () => {
    // The renderer's own defaults, restated by the entry. If these drift, the
    // kitchen on screen changes, which Tom approved as-is.
    expect(RAISED_PANEL_BLUEPRINT.frame.railIn).toBe(3);
    expect(RAISED_PANEL_BLUEPRINT.frame.stileIn).toBe(3);
    expect(RAISED_PANEL_BLUEPRINT.frame.corner).toBe("square-butt");
    expect(RAISED_PANEL_BLUEPRINT.bevel.widthIn).toBe(0.75);
    expect(RAISED_PANEL_BLUEPRINT.bevel.depthIn).toBe(0.28);
    expect(RAISED_PANEL_BLUEPRINT.bevel.readableDepthIn).toBe(0.45);
    expect(RAISED_PANEL_BLUEPRINT.groove.widthIn).toBe(0.18);
    // A shallow stored step is lifted; an already-deep one is kept.
    expect(effectiveRaisedBevelDepthIn(0.28)).toBe(0.45);
    expect(effectiveRaisedBevelDepthIn(0.45)).toBe(0.45);
    expect(effectiveRaisedBevelDepthIn(0.5)).toBe(0.5);
  });

  it("derives the same face arithmetic for a base door and a drawer front", () => {
    // 18 in door: 1.5 ft wide by 2.2 ft tall.
    const door = raisedPanelFrameGeometry({ faceWidth: 1.5, faceHeight: 2.2 });
    expect(door.rail).toBeCloseTo(0.25, 6);
    expect(door.stile).toBeCloseTo(0.25, 6);
    expect(door.openingWidth).toBeCloseTo(1.0, 6);
    expect(door.openingHeight).toBeCloseTo(1.7, 6);
    // 0.28 in would read as a slab from the front, so the readable 0.45 in is used.
    expect(door.bevelDepth).toBeCloseTo(0.45 / 12, 6);
    // The center panel sits proud of the bevel, and the bevel proud of the bed.
    expect(door.panelZ).toBeGreaterThan(door.bevelZ);
    expect(door.bevelZ).toBeGreaterThan(door.grooveZ);
    expect(door.grooveZ).toBeGreaterThan(door.recessBedZ);
    expect(door.panelWidth).toBeLessThan(door.slopeOuterWidth);
    expect(door.panelHeight).toBeLessThan(door.slopeOuterHeight);
    expect(door.insideEdgeProfile).toBe("bevel");

    // A 6 in drawer front: the 3 in frame clamps to half the height minus the
    // renderer's 0.01 ft clearance, leaving only the minimum opening. The 0.025 ft
    // bevel minimum wins over the quarter-opening clamp, exactly as it does today.
    const drawer = raisedPanelFrameGeometry({ faceWidth: 1.5, faceHeight: 0.5 });
    expect(drawer.rail).toBeCloseTo(0.25 - 0.01, 6);
    expect(drawer.openingHeight).toBeCloseTo(0.06, 6);
    expect(drawer.bevelWidth).toBeCloseTo(0.025, 6);
    expect(drawer.panelHeight).toBeGreaterThan(0);
  });

  it("marks unknown catalog dimensions as TODOs instead of guessing them", () => {
    expect(RAISED_PANEL_BLUEPRINT.todos.length).toBeGreaterThan(0);
    for (const todo of RAISED_PANEL_BLUEPRINT.todos) expect(todo.startsWith("TODO:")).toBe(true);
    // The CW sample has no stored rail or stile, so the entry must not invent one.
    expect(CASSELBERRY.railWidth ?? null).toBeNull();
    expect(CASSELBERRY.stileWidth ?? null).toBeNull();

    const source = RAISED_PANEL_BLUEPRINT.todos.join(" ");
    expect(source).toContain("Casselberry CW 330026");
  });
});

describe("selecting the raised-panel entry", () => {
  it("adopts a raised style on a door and on a drawer front", () => {
    for (const faceRole of ["door", "drawer"] as const) {
      const selection = selectRaisedPanelBlueprint(PAINTED_RAISED, { faceRole });
      expect(selection.adopted, faceRole).toBe(true);
      if (!selection.adopted) continue;
      expect(selection.entryId).toBe(RAISED_PANEL_BLUEPRINT_ID);
      expect(selection.role).toBe(faceRole);
      expect(selection.railIn).toBe(3);
      expect(selection.stileIn).toBe(3);
      expect(selection.bevelWidthIn).toBe(0.75);
      expect(selection.bevelDepthIn).toBe(0.28);
      expect(selection.insideEdgeProfile).toBe("bevel");
    }
  });

  it("refuses every surface that is not a door or drawer front", () => {
    for (const surface of [...RAISED_PANEL_NON_FRONT_SURFACES, "left", "right", "panel"]) {
      const selection = selectRaisedPanelBlueprint(PAINTED_RAISED, { faceRole: surface });
      expect(selection.adopted, surface).toBe(false);
      if (selection.adopted) continue;
      expect(selection.reason, surface).toBe("not-a-front");
    }
  });

  it("treats the CW sample's style text as raised and the shaker catalogue as not", () => {
    expect(isRaisedPanelStyle(CASSELBERRY)).toBe(true);
    expect(isRaisedPanelStyle(PAINTED_RAISED)).toBe(true);
    expect(isRaisedPanelStyle({ doorStyle: "Shaker", doorPanelType: "Recessed Panel" })).toBe(false);
    expect(isRaisedPanelStyle({ doorStyle: "Slab" })).toBe(false);
    expect(isRaisedPanelStyle(null)).toBe(false);

    const selection = selectRaisedPanelBlueprint(styles.find((style) => style.doorStyle === "Shaker"), { faceRole: "door" });
    expect(selection.adopted).toBe(false);
    if (!selection.adopted) expect(selection.reason).toBe("not-raised");
  });

  it("keeps the catalog's own rail, stile, and bevel when the style stores them", () => {
    const measured = selectRaisedPanelBlueprint({
      ...PAINTED_RAISED,
      railWidth: "2.75",
      stileWidth: 2.75,
      bevelWidth: 0.5,
      bevelDepth: 0.4,
      insideEdgeProfile: "ogee",
    }, { faceRole: "door" });
    expect(measured.adopted).toBe(true);
    if (!measured.adopted) return;
    expect(measured.railIn).toBe(2.75);
    expect(measured.stileIn).toBe(2.75);
    expect(measured.bevelWidthIn).toBe(0.5);
    expect(measured.bevelDepthIn).toBe(0.4);
    expect(measured.insideEdgeProfile).toBe("ogee");
  });

  it("does not take the color from the brand palette: it is the resolver's own hex", () => {
    const selection = selectRaisedPanelBlueprint(PAINTED_RAISED, { faceRole: "door" });
    const decision = resolveDoorColor(PAINTED_RAISED);
    expect(selection.adopted).toBe(true);
    if (!selection.adopted) return;
    expect(selection.paintedSolidHex).toBe(decision.appliedHex);
    // A blue the brand palette does not contain stays blue.
    const blue = selectRaisedPanelBlueprint({ ...PAINTED_RAISED, color: "#1f4e8c", renderHex: null }, { faceRole: "door" });
    expect(blue.adopted).toBe(true);
    if (!blue.adopted) return;
    expect(blue.paintedSolidHex?.toLowerCase()).toBe("#1f4e8c");
  });

  it("takes the accepted render's color first", () => {
    const accepted = selectRaisedPanelBlueprint({
      ...PAINTED_RAISED,
      approvedVersionId: 9001,
      renderHex: "#e9e4d6",
    }, { faceRole: "door" });
    expect(accepted.adopted).toBe(true);
    if (!accepted.adopted) return;
    expect(accepted.paintedSolidHex?.toLowerCase()).toBe("#e9e4d6");
    expect(resolveDoorColor({ ...PAINTED_RAISED, approvedVersionId: 9001, renderHex: "#e9e4d6" }).appliedSource).toBe("accepted-render");
  });
});

describe("painted-solid behavior on the raised entry", () => {
  it("reads paint from finishCategory and from a paint/HDF/MDF species", () => {
    expect(isPaintedFinish({ finishCategory: "painted" })).toBe(true);
    expect(isPaintedFinish({ finishCategory: "Paint" })).toBe(true);
    expect(isPaintedFinish({ woodSpecies: "Painted HDF" })).toBe(true);
    expect(isPaintedFinish({ woodSpecies: "MDF" })).toBe(true);
    expect(isPaintedFinish({ finish: "Satin paint" })).toBe(true);
    expect(isPaintedFinish({ woodSpecies: "Solid Birch" })).toBe(false);
    expect(isPaintedFinish({ finish: "Stained" })).toBe(false);
    expect(isPaintedFinish({})).toBe(false);
    expect(isPaintedFinish(null)).toBe(false);
  });

  it("carries a solid color and no grain or photo for a painted raised door", () => {
    const selection = selectRaisedPanelBlueprint(PAINTED_RAISED, { faceRole: "door" });
    expect(selection.adopted).toBe(true);
    if (!selection.adopted) return;
    expect(selection.painted).toBe(true);
    expect(selection.paintedSolidHex).toBe(resolveDoorColor(PAINTED_RAISED).appliedHex);
    // The paint rule from shakerDoorBlueprint: grainUrl is null when painted.
    expect(selection.grainUrl).toBeNull();
    expect(selection.reason).toContain("no grain or photo");
  });

  it("keeps the grain path for a stained raised door", () => {
    const selection = selectRaisedPanelBlueprint(STAINED_RAISED, { faceRole: "door" });
    expect(selection.adopted).toBe(true);
    if (!selection.adopted) return;
    expect(selection.painted).toBe(false);
    expect(selection.paintedSolidHex).toBeNull();
    expect(selection.grainUrl).toBeNull();
    expect(selection.reason).toContain("grain is kept");
  });

  it("keeps a painted raised style solid, using the stored row the SQL inserts", () => {
    // docs/sql/0246_add_casselberry_uscd.tidb.sql: doorStyle "Raised Panel",
    // finish "Painted", its own color #EEEADF, no rail/stile, no accepted render.
    expect(isRaisedPanelStyle(CASSELBERRY)).toBe(true);
    expect(isPaintedFinish(CASSELBERRY)).toBe(true);
    for (const faceRole of ["door", "drawer"] as const) {
      const selection = selectRaisedPanelBlueprint(CASSELBERRY, { faceRole });
      expect(selection.adopted, faceRole).toBe(true);
      if (!selection.adopted) continue;
      expect(selection.painted, faceRole).toBe(true);
      expect(selection.paintedSolidHex, faceRole).toBe("#eeeadf");
      expect(selection.grainUrl, faceRole).toBeNull();
      // Unknown frame dimensions fall back to the renderer's 3 in default and stay TODO.
      expect(selection.railIn).toBe(3);
      expect(selection.insideEdgeProfile).toBe("bevel");
    }

    // The same catalogue's stained Casselberry keeps its wood grain.
    expect(isPaintedFinish(STAINED_RAISED)).toBe(false);
  });
});

describe("wizard profile versus the library default", () => {
  it("applies the library entry automatically when the style never went through the wizard", () => {
    const application = raisedPanelApplicationForStyle(PAINTED_RAISED);
    expect(application.source).toBe("library");
    expect(application.applied).toBe(true);
    expect(application.reason).toContain(RAISED_PANEL_BLUEPRINT_ID);

    const selection = selectRaisedPanelBlueprint(PAINTED_RAISED, { faceRole: "door" });
    expect(selection.adopted).toBe(true);
  });

  it("lets the WalzCraft wizard's profile win for that style", () => {
    const application = raisedPanelApplicationForStyle(PAINTED_RAISED, { wizardProfile: true });
    expect(application.source).toBe("wizard");
    expect(application.applied).toBe(false);
    expect(application.reason).toContain("wizard profile is used");

    const selection = selectRaisedPanelBlueprint(PAINTED_RAISED, { faceRole: "door", wizardProfile: true });
    expect(selection.adopted).toBe(false);
    if (!selection.adopted) expect(selection.reason).toBe("wizard");
  });

  it("reports none for a style that is not raised", () => {
    const application = raisedPanelApplicationForStyle({ doorStyle: "Shaker" });
    expect(application.source).toBe("none");
    expect(application.applied).toBe(false);
  });

  it("hands the renderer profile both facts: painted and which raised source is in force", () => {
    const plain = resolveDoorProfile(PAINTED_RAISED);
    expect(plain.panelConstruction).toBe("raised");

    const withLibrary = raisedPanelApplicationForStyle(PAINTED_RAISED);
    const withWizard = raisedPanelApplicationForStyle(PAINTED_RAISED, { wizardProfile: true });
    expect(withLibrary.source).toBe("library");
    expect(withWizard.source).toBe("wizard");
  });
});

describe("the raised entry matches the geometry the renderer already draws", () => {
  it("is the same arithmetic as the renderer's raised branch, for a range of faces", () => {
    // Values from `addShakerFrame`'s raised branch, restated independently here so
    // a change to either side shows up as a failing test.
    const INCH = 1 / 12;
    const cases = [
      { width: 12, height: 30 },
      { width: 15, height: 22 },
      { width: 18, height: 34 },
      { width: 24, height: 6 },
    ];
    for (const face of cases) {
      const faceWidth = face.width * INCH;
      const faceHeight = face.height * INCH;
      const stile = Math.max(0, Math.min(3 * INCH, faceWidth / 2 - 0.01, faceHeight / 2 - 0.01));
      const rail = Math.max(0, Math.min(3 * INCH, faceWidth / 2 - 0.01, faceHeight / 2 - 0.01));
      const expectedOpeningWidth = Math.max(0.06, faceWidth - stile * 2);
      const expectedOpeningHeight = Math.max(0.06, faceHeight - rail * 2);
      const expectedBevelWidth = Math.max(0.025, Math.min(0.75 * INCH, expectedOpeningWidth / 4, expectedOpeningHeight / 4));
      const expectedBevelDepth = Math.max(0.012, Math.min(0.45 * INCH, 0.07));

      const geometry = raisedPanelFrameGeometry({ faceWidth, faceHeight });
      expect(geometry.stile).toBeCloseTo(stile, 10);
      expect(geometry.rail).toBeCloseTo(rail, 10);
      expect(geometry.openingWidth).toBeCloseTo(expectedOpeningWidth, 10);
      expect(geometry.openingHeight).toBeCloseTo(expectedOpeningHeight, 10);
      expect(geometry.bevelWidth).toBeCloseTo(expectedBevelWidth, 10);
      expect(geometry.bevelDepth).toBeCloseTo(expectedBevelDepth, 10);
      expect(geometry.recessBedThickness).toBeCloseTo(0.006, 10);
      expect(geometry.recessBedZ).toBeCloseTo(-0.01, 10);
    }
  });
});

describe("attach gate", () => {
  it("adds nothing to a cabinet surface that is not a door or drawer front", async () => {
    const { attachSlopedRaisedPanel } = await import("../client/src/components/design/raisedPanelBevel");
    const parent = new THREE.Group();
    const centerMaterial = new THREE.MeshStandardMaterial({ color: "#eeeadf" });
    attachSlopedRaisedPanel(parent, {
      outerWidth: 0.7,
      outerHeight: 1.2,
      bevelWidth: 0.06,
      bevelDepth: 0.45 / 12,
      faceColor: "#eeeadf",
      insideEdgeProfile: "bevel",
      centerMaterial,
      faceRole: "top",
    });
    expect(parent.children).toHaveLength(0);

    attachSlopedRaisedPanel(parent, {
      outerWidth: 0.7,
      outerHeight: 1.2,
      bevelWidth: 0.06,
      bevelDepth: 0.45 / 12,
      faceColor: "#eeeadf",
      insideEdgeProfile: "bevel",
      centerMaterial,
      faceRole: "door",
    });
    expect(parent.children.length).toBeGreaterThan(0);
    centerMaterial.dispose();
  });

  it("refuses a bevel on a non-front role even before any geometry is built", async () => {
    const { threeDFaceUsesRaisedPanelBevel } = await import("../client/src/components/design/raisedPanelBevel");
    expect(threeDFaceUsesRaisedPanelBevel({ profileKind: "raised", faceRole: "side" })).toBe(false);
    expect(threeDFaceUsesRaisedPanelBevel({ profileKind: "raised", faceRole: "end-panel" })).toBe(false);
    expect(threeDFaceUsesRaisedPanelBevel({ profileKind: "raised", faceRole: "door" })).toBe(true);
  });
});

describe("raised styles in the catalog fixture", () => {
  it("finds them by text and leaves shaker, slab, and slim styles alone", () => {
    const raised = styles.filter((style) => isRaisedPanelStyle(style));
    expect(raised.length).toBeGreaterThan(0);
    for (const style of raised) {
      const application = raisedPanelApplicationForStyle(style);
      expect(application.source, style.ourName ?? "").toBe("library");
    }
    for (const style of styles.filter((entry) => /shaker|slab|slim|cava|glass|edgeline|oxford|haven/i.test(entry.doorStyle ?? ""))) {
      expect(raisedPanelApplicationForStyle(style).source, `${style.ourName ?? ""} ${style.doorStyle}`).toBe("none");
    }
  });

  it("still resolves each raised style's own color, unsnapped", () => {
    const raised = styles.filter((style) => isRaisedPanelStyle(style));
    for (const style of raised) {
      const selection = selectRaisedPanelBlueprint(style, { faceRole: "door" });
      expect(selection.adopted, style.ourName ?? "").toBe(true);
      if (!selection.adopted) continue;
      expect(selection.paintedSolidHex ?? null, style.ourName ?? "").toBe(
        isPaintedFinish(style) ? resolveDoorColor(style as DoorColorInput).appliedHex : null,
      );
    }
  });
});
