/**
 * Tom's Nov 4 2026 follow-up: for ANY distributor or account, a door style whose
 * construction says shaker (or raised panel) defaults onto the saved library
 * entries when no WalzCraft wizard record exists. The wizard always wins when it
 * does exist. There is no DL-only gate on this default.
 */
import { describe, expect, it } from "vitest";
import catalog from "./fixtures/doorStyleSideCatalog.json";
import { designerFacePlan } from "../client/src/lib/designerFacePlan";
import { resolveDoorColor } from "./doorColorResolve";
import {
  DOOR_LIBRARY_ENTRY_IDS,
  doorLibraryApplicationForStyle,
  libraryDoorFacePlan,
  libraryEntriesForStyle,
  libraryProfileAppliesToFront,
} from "./doorLibraryProfiles";
import { raisedPanelApplicationForStyle } from "./raisedPanelDoorBlueprint";
import { matchStandardShakerToDl, shakerDoorFamily, standardShakerDlFacePlan } from "./shakerDoorBlueprint";
import { resolveCabinetFaceImages } from "./doorFaceRecognition";
import { isWizardSavedDoor, WIZARD_DOOR_FINISH_STORAGE_KEY } from "./walzcraftDesignerPickup";
import type { DoorLibraryStyleInput } from "./doorLibraryProfiles";

const styles = catalog as unknown as DoorLibraryStyleInput[];

/** Distributor ids in the fixture catalogue, none of which is DL Cabinetry (450001). */
const NON_DL_DISTRIBUTORS = [180001, 210001, 210002, 270001];

/** A shaker style at a distributor that is not DL Cabinetry. */
const NON_DL_SHAKER: DoorLibraryStyleInput = {
  id: 900001,
  distributorId: 210002,
  distributorName: "Kitchen Crest",
  styleCode: "ACME-SH",
  ourName: "Acme Shaker White",
  doorStyle: "Shaker",
  woodSpecies: "Painted MDF",
  finish: "Acme Blanc",
  color: "#f2f0ea",
};

/** The same style as a raised panel, also not DL. */
const NON_DL_RAISED: DoorLibraryStyleInput = {
  id: 900002,
  distributorId: 180001,
  distributorName: "Preston",
  styleCode: "ACME-RP",
  ourName: "Acme Raised Ivory",
  doorStyle: "Raised Panel",
  woodSpecies: "Painted MDF",
  finish: "Acme Ivory",
  color: "#eeeadf",
  insideEdgeProfile: "bevel",
};

/** A browser store holding one WalzCraft wizard record, keyed by style id. */
function wizardStore(styleId: number) {
  return {
    getItem: (key: string) => (key === WIZARD_DOOR_FINISH_STORAGE_KEY
      ? JSON.stringify({
        [styleId]: {
          finish: "paint",
          code: "SW7005",
          label: "SW 7005 Pure White",
          hex: "#f1efe9",
          woodSpecies: null,
          grainDirection: "none",
          profileImageUrl: "/uploads/wizard-acme-shaker.webp",
        },
      })
      : null),
  };
}

describe("no DL-only gate on the library default", () => {
  it("applies the shaker library entry at every non-DL distributor", () => {
    for (const distributorId of NON_DL_DISTRIBUTORS) {
      expect(distributorId).not.toBe(450001);
      const style = { ...NON_DL_SHAKER, distributorId };
      const application = doorLibraryApplicationForStyle(style);
      expect(application.applied, String(distributorId)).toBe(true);
      expect(application.source, String(distributorId)).toBe("library");
      expect(application.entries.map((entry) => entry.entryId), String(distributorId))
        .toEqual([DOOR_LIBRARY_ENTRY_IDS.shaker]);
    }
  });

  it("applies the shaker entry to a style with no distributor at all", () => {
    const application = doorLibraryApplicationForStyle({ ourName: "House Brand Shaker", doorStyle: "Shaker", color: "#336699" });
    expect(application.applied).toBe(true);
    expect(application.source).toBe("library");
  });

  it("applies the raised-panel entry at a non-DL distributor", () => {
    const application = doorLibraryApplicationForStyle(NON_DL_RAISED);
    expect(application.applied).toBe(true);
    expect(application.entries.map((entry) => entry.entryId)).toEqual([DOOR_LIBRARY_ENTRY_IDS.raisedPanel]);
    expect(raisedPanelApplicationForStyle(NON_DL_RAISED).source).toBe("library");
  });

  it("does not require a DL style code, and works when the code is not DL-", () => {
    expect(NON_DL_SHAKER.styleCode).toBe("ACME-SH");
    expect(doorLibraryApplicationForStyle(NON_DL_SHAKER).applied).toBe(true);
  });
});

describe("case-insensitive shaker matching, including name variants", () => {
  it("matches Shaker / shaker / SHAKER the same way", () => {
    for (const doorStyle of ["Shaker", "shaker", "SHAKER", "sHaKeR", " Shaker "]) {
      expect(shakerDoorFamily({ doorStyle }), doorStyle).toBe("shaker");
      const application = doorLibraryApplicationForStyle({ ourName: "Acme", doorStyle, color: "#336699" });
      expect(application.applied, doorStyle).toBe(true);
      expect(application.entries.map((entry) => entry.entryId), doorStyle).toEqual([DOOR_LIBRARY_ENTRY_IDS.shaker]);
    }
  });

  it("matches a product name like Shaker Honey when doorStyle never says shaker", () => {
    for (const style of [
      { ourName: "Shaker Honey", doorStyle: null },
      { ourName: "SHAKER HONEY", doorStyle: "" },
      { ourName: "Shaker Honey", doorStyle: "   " },
      { aliasName: "Shaker Honey", doorStyle: null },
    ] as DoorLibraryStyleInput[]) {
      expect(shakerDoorFamily(style), JSON.stringify(style)).toBe("shaker");
      expect(doorLibraryApplicationForStyle({ ...style, color: "#C8A040" }).applied, JSON.stringify(style)).toBe(true);
    }
  });

  it("keeps the shaker catalogue row 'Shaker Honey' (330021) on the library default", () => {
    const honey = styles.find((style) => style.id === 330021);
    expect(honey).toBeTruthy();
    expect(honey!.ourName).toBe("Shaker Honey");
    const application = doorLibraryApplicationForStyle(honey);
    expect(application.applied).toBe(true);
    expect(application.entries.map((entry) => entry.family)).toEqual(["shaker"]);
    // The demoted paint-match hex is never the door color.
    expect(application.paintedSolidHex ?? null).not.toBe("#c8a040");
  });

  it("does not let a product name overrule an explicit slab or glass build", () => {
    for (const doorStyle of ["Slab", "Glass", "slab", "GLASS"]) {
      const style = { ourName: "Shaker Honey", doorStyle, color: "#336699" };
      expect(shakerDoorFamily(style), doorStyle).toBe("other");
      expect(doorLibraryApplicationForStyle(style).applied, doorStyle).toBe(false);
    }
  });

  it("keeps slim and double shaker on their own paths, not the 2.75/3 in entry", () => {
    for (const doorStyle of ["Slim Shaker", "slim shaker", "DOUBLE SHAKER", "Double Shaker"]) {
      expect(shakerDoorFamily({ doorStyle })).not.toBe("shaker");
      expect(doorLibraryApplicationForStyle({ ourName: doorStyle, doorStyle, color: "#ddd" }).applied, doorStyle).toBe(false);
    }
  });
});

describe("shaker without a wizard record -> library profile (non-DL)", () => {
  it("builds the library shaker face for a non-DL distributor", () => {
    const plan = designerFacePlan(NON_DL_SHAKER, "base");
    expect(plan).not.toBeNull();
    expect(plan!.sourceKind).toBe("split");
    // The blueprint's own template slug, not a fabricated one.
    expect(plan!.dlcCrop?.slug).toBeTruthy();
    // Painted: solid in its own color, with no grain and no photo.
    expect(plan!.doorUrl).toBeNull();
    expect(plan!.drawerUrl).toBeNull();
    expect(plan!.dlcCrop?.grainUrl).toBeNull();
    expect(plan!.dlcCrop?.solidColor?.toLowerCase()).toBe(resolveDoorColor(NON_DL_SHAKER).appliedHex);
  });

  it("routes through the library module and the shared shaker builder, not a distributor check", () => {
    const direct = libraryDoorFacePlan(NON_DL_SHAKER, "base");
    expect(direct).toEqual(standardShakerDlFacePlan(NON_DL_SHAKER, "base"));
    // The default 3 in rail applies even though the style stored none.
    expect(doorLibraryApplicationForStyle(NON_DL_SHAKER).railIn).toBe(3);
  });

  it("gives a non-DL raised style the raised-panel entry, painted solid", () => {
    const plan = designerFacePlan(NON_DL_RAISED, "base");
    expect(plan?.dlcCrop?.slug).toBe(DOOR_LIBRARY_ENTRY_IDS.raisedPanel);
    expect(plan?.doorUrl).toBeNull();
    expect(plan?.dlcCrop?.solidColor?.toLowerCase()).toBe(resolveDoorColor(NON_DL_RAISED).appliedHex);
  });

  it("reports no wizard record, which is what allows the default", () => {
    expect(isWizardSavedDoor(NON_DL_SHAKER as never, wizardStore(1) as never)).toBe(false);
  });
});

describe("shaker with a wizard record -> the wizard wins", () => {
  const withWizard = { ...NON_DL_SHAKER, id: 900101 };

  it("declines the library entry when the wizard saved a profile", () => {
    const application = doorLibraryApplicationForStyle(withWizard, { wizardProfile: true });
    expect(application.applied).toBe(false);
    expect(application.source).toBe("wizard");
    expect(application.reason).toContain("wizard profile wins");
    expect(libraryDoorFacePlan(withWizard, "base", { wizardProfile: true })).toBeNull();
    expect(raisedPanelApplicationForStyle({ ...NON_DL_RAISED }, { wizardProfile: true }).source).toBe("wizard");
  });

  it("still resolves the wizard record from the door editor's own store", () => {
    expect(isWizardSavedDoor(withWizard as never, wizardStore(900101) as never)).toBe(true);
  });

  it("hands the wizard's own face plan to the Designer", () => {
    // `designerFacePlan` resolves the wizard first; with a stored record it returns
    // the wizard's plan, which carries the wizard-paint slug rather than the
    // library shaker template.
    const plan = designerFacePlan(withWizard, "base");
    expect(plan?.dlcCrop?.slug).not.toBe("grey-shaker");
  });

  it("lets the same style fall back to the library when the record is gone", () => {
    expect(isWizardSavedDoor(withWizard as never, wizardStore(424242) as never)).toBe(false);
    expect(doorLibraryApplicationForStyle(withWizard, { wizardProfile: false }).applied).toBe(true);
  });
});

describe("existing rules still hold on the default", () => {
  it("puts the profile on door and drawer fronts only", () => {
    expect(libraryProfileAppliesToFront("door")).toBe(true);
    expect(libraryProfileAppliesToFront("drawer")).toBe(true);
    for (const surface of ["side", "top", "bottom", "back", "end-panel", "end-skin", "carcass", "face-frame", "toe-kick", "shelf", "interior", null]) {
      expect(libraryProfileAppliesToFront(surface), String(surface)).toBe(false);
    }
  });

  it("renders a painted shaker solid in its own color, never a brand snap", () => {
    for (const color of ["#1f4e8c", "#2a8c8c", "#336699", "#8d8f92"]) {
      const style = { ...NON_DL_SHAKER, color };
      const application = doorLibraryApplicationForStyle(style);
      expect(application.painted).toBe(true);
      expect(application.paintedSolidHex, color).toBe(resolveDoorColor(style).appliedHex);
      expect(application.paintedSolidHex, color).not.toBe("#dedac6");
      expect(application.paintedSolidHex, color).not.toBe("#244338");
    }
    expect(doorLibraryApplicationForStyle({ ...NON_DL_SHAKER, color: "#1f4e8c" }).paintedSolidHex).toBe("#1f4e8c");
  });

  it("keeps grain for a stained shaker", () => {
    const stained = { ...NON_DL_SHAKER, ourName: "Acme Oak Shaker", woodSpecies: "Oak", color: "#8a6a44" };
    const application = doorLibraryApplicationForStyle(stained);
    expect(application.painted).toBe(false);
    expect(application.paintedSolidHex).toBeNull();
    expect(libraryDoorFacePlan(stained, "base")?.doorUrl).toBeTruthy();
  });

  it("does not invent UI and keeps hickory on its own photo", () => {
    const hickory = { ...NON_DL_SHAKER, id: 900200, distributorId: 210001, ourName: "Hickory Shaker", woodSpecies: "Hickory", doorSampleImageUrl: "/uploads/hickory.jpg" };
    // Hickory is still a shaker family, so a library entry is named ...
    expect(libraryEntriesForStyle(hickory).map((entry) => entry.family)).toEqual(["shaker"]);
    // ... but its measured photo is never replaced by a substituted grain.
    expect(libraryDoorFacePlan(hickory, "base")).toBeNull();
    expect(designerFacePlan(hickory, "base")?.doorUrl).toBe("/uploads/hickory.jpg");
  });

  it("reports the same answer through both public entry points", () => {
    expect(resolveCabinetFaceImages(NON_DL_SHAKER, "base").dlcCrop?.solidColor?.toLowerCase())
      .toBe(designerFacePlan(NON_DL_SHAKER, "base")?.dlcCrop?.solidColor?.toLowerCase());
  });

  it("does not touch a DL style, which keeps its own mapped photo crop", () => {
    const dlStyle = styles.find((style) => style.distributorId === 450001 && /shaker/i.test(style.doorStyle ?? ""));
    expect(dlStyle).toBeTruthy();
    const viaDesigner = designerFacePlan(dlStyle!, "base");
    const viaRecognition = resolveCabinetFaceImages(dlStyle!, "base");
    expect(viaDesigner?.dlcCrop?.slug).toBe(viaRecognition.dlcCrop?.slug);
  });
});

describe("the wizard still wins over the raised entry", () => {
  it("declines the raised library entry when the wizard saved a profile", () => {
    const application = doorLibraryApplicationForStyle(NON_DL_RAISED, { wizardProfile: true });
    expect(application.applied).toBe(false);
    expect(application.source).toBe("wizard");
    expect(libraryDoorFacePlan(NON_DL_RAISED, "base", { wizardProfile: true })).toBeNull();
  });
});

describe("matchStandardShakerToDl accepts the wizard opt-out", () => {
  it("declines adoption when a wizard profile exists", () => {
    const adopted = matchStandardShakerToDl(NON_DL_SHAKER, { wizardProfile: true });
    expect(adopted.adopted).toBe(false);
    if (!adopted.adopted) expect(adopted.reason).toContain("wizard profile wins");
  });

  it("adopts the same style with no wizard profile", () => {
    expect(matchStandardShakerToDl(NON_DL_SHAKER).adopted).toBe(true);
  });
});
