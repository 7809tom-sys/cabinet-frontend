/**
 * Door color source rule (Tom, Nov 11 2026), docs/rules/DOOR_COLOR_SOURCE_RULE.md.
 *
 * Partial revert of #240: the saved library entries keep supplying door SHAPE
 * automatically, but never an automatic COLOR. The door's own image decides.
 */
import { describe, expect, it } from "vitest";
import { designerFacePlan } from "../client/src/lib/designerFacePlan";
import { designerCatalogDoorProfile } from "../client/src/lib/doorStyleAppearance";
import { resolveCabinetFaceImages } from "./doorFaceRecognition";
import { DOOR_LIBRARY_ENTRY_IDS, libraryEntriesForStyle, type DoorLibraryStyleInput } from "./doorLibraryProfiles";
import { raisedPanelApplicationForStyle } from "./raisedPanelDoorBlueprint";
import { standardShakerDlFacePlan } from "./shakerDoorBlueprint";

const RAISED_WITH_PHOTOS: DoorLibraryStyleInput = {
  id: 910001,
  distributorId: 180001,
  distributorName: "Preston",
  styleCode: "VEND-RP",
  ourName: "Vendor Raised Sage",
  doorStyle: "Raised Panel",
  woodSpecies: "Painted MDF",
  finish: "Sage",
  color: "#9caf88",
  doorSampleImageUrl: "/uploads/vendor-raised-door.jpg",
  drawerSampleImageUrl: "/uploads/vendor-raised-drawer.jpg",
};

const NAME_ONLY_RAISED: DoorLibraryStyleInput = {
  id: 910002,
  distributorId: 270001,
  ourName: "Cathedral Raised Cherry",
  woodSpecies: "Cherry",
  color: "#7a3b2a",
  doorSampleImageUrl: "/uploads/cherry-raised.jpg",
};

const SHAKER: DoorLibraryStyleInput = {
  id: 910003,
  distributorId: 210002,
  ourName: "Vendor Shaker White",
  doorStyle: "Shaker",
  woodSpecies: "Painted MDF",
  color: "#f2f0ea",
  doorSampleImageUrl: "/uploads/vendor-shaker.jpg",
};

describe("raised panel: library shape kept, library color removed", () => {
  it("still applies the raised-panel library shape automatically", () => {
    expect(libraryEntriesForStyle(RAISED_WITH_PHOTOS).map((entry) => entry.entryId)).toEqual([DOOR_LIBRARY_ENTRY_IDS.raisedPanel]);
    expect(raisedPanelApplicationForStyle(RAISED_WITH_PHOTOS).source).toBe("library");
    expect(designerCatalogDoorProfile(RAISED_WITH_PHOTOS as never)?.raisedPanelSource).toBe("library");
  });

  it("takes the face from the vendor's door image, not a flat library solid", () => {
    const plan = designerFacePlan(RAISED_WITH_PHOTOS, "base");
    expect(plan?.doorUrl).toBe("/uploads/vendor-raised-door.jpg");
    expect(plan?.dlcCrop).toBeUndefined();
    const recognised = resolveCabinetFaceImages(RAISED_WITH_PHOTOS, "base");
    expect(recognised.doorUrl).toBe("/uploads/vendor-raised-door.jpg");
    expect(recognised.dlcCrop).toBeUndefined();
  });

  it("keeps a separate drawer image on base cabinets (two-drawer bases) and none on walls", () => {
    const base = designerFacePlan(RAISED_WITH_PHOTOS, "base");
    expect(base?.sections).toBe(2);
    expect(base?.drawerUrl).toBe("/uploads/vendor-raised-drawer.jpg");
    expect(base?.drawerTextureApplied).toBe(true);
    const wall = designerFacePlan(RAISED_WITH_PHOTOS, "wall");
    expect(wall?.drawerUrl).toBeNull();
    expect(wall?.sections).toBe(1);
  });

  it("does the same for a raised style identified only by its name", () => {
    expect(raisedPanelApplicationForStyle(NAME_ONLY_RAISED).source).toBe("library");
    expect(designerFacePlan(NAME_ONLY_RAISED, "base")?.doorUrl).toBe("/uploads/cherry-raised.jpg");
  });
});

describe("shaker blueprint is unchanged by this revert", () => {
  it("still routes a 2.75/3 in shaker through the shared shaker builder", () => {
    expect(designerFacePlan(SHAKER, "base")).toEqual(standardShakerDlFacePlan(SHAKER, "base"));
  });
});
