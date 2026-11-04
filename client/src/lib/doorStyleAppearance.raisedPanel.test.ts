/**
 * The Designer's door profile carries the two facts the 3D renderer needs:
 * whether the finish is paint (render solid) and which raised-panel profile is in
 * force (the WalzCraft wizard's own, or the shared library entry).
 */
import { describe, expect, it } from "vitest";
import { isWizardSavedDoor, WIZARD_DOOR_FINISH_STORAGE_KEY } from "@shared/walzcraftDesignerPickup";
import { RAISED_PANEL_BLUEPRINT_ID } from "@shared/raisedPanelDoorBlueprint";
import { resolvedThreeDDoorProfile } from "@/components/design/InteractiveRoom3D";
import { designerCatalogDoorProfile } from "./doorStyleAppearance";

const PAINTED_RAISED = {
  id: 330026,
  ourName: "Casselberry Antique White",
  doorStyle: "Raised Panel",
  doorPanelType: "Mitered frame",
  panelConstruction: "raised" as const,
  woodSpecies: "Painted HDF",
  finish: "Casselberry Blanc (Madison)",
  color: "#EEEADF",
  insideEdgeProfile: "bevel",
};

const STAINED_RAISED = {
  ...PAINTED_RAISED,
  id: 330027,
  ourName: "Casselberry Saddle",
  woodSpecies: "Solid Birch frame / solid birch center panel",
  finish: "Walnut Haven (Madison)",
  color: "#8B6040",
};

const SHAKER = {
  id: 330013,
  ourName: "White Shaker (Clark and Son)",
  doorStyle: "Shaker",
  doorPanelType: "Recessed Panel",
  woodSpecies: "Solid Birch",
  finish: "Nova White (Ashford)",
  color: "#FFFFFF",
};

/** One wizard record in a fake browser store, keyed by door style id. */
function wizardStore(styleId: number) {
  const record = {
    finish: "paint" as const,
    code: "SW7005",
    label: "SW 7005 Pure White",
    hex: "#f1efe9",
    woodSpecies: null,
    grainDirection: "none" as const,
    profileImageUrl: "/uploads/wizard-casselberry.webp",
  };
  return {
    getItem: (key: string) => (key === WIZARD_DOOR_FINISH_STORAGE_KEY ? JSON.stringify({ [styleId]: record }) : null),
  };
}

describe("designer door profile: painted and raised-panel source", () => {
  it("marks a Painted HDF raised style as a painted solid and as a library profile", () => {
    const profile = designerCatalogDoorProfile(PAINTED_RAISED, { wizardProfile: false });
    expect(profile).not.toBeNull();
    expect(profile?.paintedFinish).toBe(true);
    expect(profile?.raisedPanelSource).toBe("library");
    expect(profile?.panelConstruction).toBe("raised");
    expect(profile?.insideEdgeProfile).toBe("bevel");
  });

  it("leaves a stained raised style on its grain path", () => {
    const profile = designerCatalogDoorProfile(STAINED_RAISED, { wizardProfile: false });
    expect(profile?.paintedFinish).toBe(false);
    expect(profile?.raisedPanelSource).toBe("library");
  });

  it("reports no raised-panel source for a shaker style", () => {
    const profile = designerCatalogDoorProfile(SHAKER, { wizardProfile: false });
    expect(profile?.raisedPanelSource).toBe("none");
    expect(profile?.panelConstruction).toBe("flat");
  });

  it("lets the WalzCraft wizard's profile win when the style has one", () => {
    const profile = designerCatalogDoorProfile(PAINTED_RAISED, { wizardProfile: true });
    expect(profile?.raisedPanelSource).toBe("wizard");

    const viaStore = designerCatalogDoorProfile(PAINTED_RAISED, {
      // Reads the browser record the wizard writes, exactly as the Designer does.
      wizardProfile: isWizardSavedDoor(PAINTED_RAISED, wizardStore(330026) as never),
    });
    expect(isWizardSavedDoor(PAINTED_RAISED, wizardStore(330026) as never)).toBe(true);
    expect(viaStore?.raisedPanelSource).toBe("wizard");

    // A style with no wizard record keeps the library default.
    expect(isWizardSavedDoor(PAINTED_RAISED, wizardStore(999999) as never)).toBe(false);
    expect(designerCatalogDoorProfile(PAINTED_RAISED, { wizardProfile: false })?.raisedPanelSource).toBe("library");
  });

  it("names the library entry it is defaulting to", () => {
    // The renderer logs and tests read this id, so it has to be the shared one.
    expect(RAISED_PANEL_BLUEPRINT_ID).toBe("raised-panel-five-piece-bevel");
  });
});

describe("the 3D scene's resolved door profile", () => {
  const scene = {
    roomShape: null,
    layout: null,
    suggestions: [],
    materials: {
      cabinet: {
        publicName: "Casselberry",
        name: "Casselberry",
        color: "#EEEADF",
        finish: "Painted",
        doorStyle: "Raised Panel",
        doorPanelType: "Mitered frame",
      },
      defaults: { floor: "", countertop: "", backsplash: "", wall: "" },
    },
  } as never;

  it("carries the painted flag and the library source into the renderer", () => {
    const profile = resolvedThreeDDoorProfile(scene, {
      doorStyle: "Raised Panel",
      doorPanelType: "Mitered frame",
      panelConstruction: "raised",
    });
    expect(profile).not.toBeNull();
    expect(profile?.paintedFinish).toBe(true);
    expect(profile?.raisedPanelSource).toBe("library");
  });

  it("keeps a source the caller already resolved, including a wizard one", () => {
    const wizard = resolvedThreeDDoorProfile(scene, {
      doorStyle: "Raised Panel",
      doorPanelType: "Mitered frame",
      panelConstruction: "raised",
      paintedFinish: false,
      raisedPanelSource: "wizard",
    });
    expect(wizard?.paintedFinish).toBe(false);
    expect(wizard?.raisedPanelSource).toBe("wizard");
  });
});
