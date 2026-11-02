import { describe, expect, it } from "vitest";
import { designerFacePlan } from "../client/src/lib/designerFacePlan";
import {
  WIZARD_DOOR_FINISH_STORAGE_KEY,
  isWizardSavedDoor,
  readWizardDoorFinish,
  stainGrainSlug,
  wizardDoorFacePlan,
  wizardDoorPickup,
  writeWizardDoorFinish,
  type WizardDoorFinish,
} from "./walzcraftDesignerPickup";
import { PAINT_FINISH, STAIN_FINISH } from "./sherwinWilliamsStain";

function memory(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial };
  return {
    store,
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
  };
}

/**
 * The Designer runs in the browser, where localStorage holds the wizard's finish record.
 * These tests install the same store on globalThis so `designerFacePlan` reads it.
 */
function installBrowserStore(initial: Record<string, string> = {}) {
  const store = memory(initial);
  (globalThis as { localStorage?: unknown }).localStorage = store;
  return store;
}

const paintFinish: WizardDoorFinish = {
  finish: PAINT_FINISH,
  code: "SW7005",
  label: "SW 7005 Pure White",
  hex: "#edece6",
  woodSpecies: null,
  grainDirection: "none",
  profileImageUrl: "/uploads/s592-barrington.jpg",
};

const stainFinish: WizardDoorFinish = {
  finish: STAIN_FINISH,
  code: "MW230",
  label: "MW230 Early American",
  hex: "#9a6e51",
  woodSpecies: "Grey Wood",
  grainDirection: "horizontal",
  profileImageUrl: null,
};

/** A door made through the wizard: it carries the saved profile image and the saved hex. */
const wizardDoor = {
  id: 360001,
  ourName: "Barrington Shaker",
  styleCode: "S592",
  doorStyle: "Shaker",
  doorSampleImageUrl: "/uploads/s592-barrington.jpg",
  renderHex: "#9a6e51",
  woodSpecies: "Grey Wood",
  grainDirection: "horizontal",
};

describe("the 3D designer picks up a door saved through the WalzCraft wizard", () => {
  it("renders the wizard's profile image, grain and color without any wizard UI", () => {
    const store = installBrowserStore();
    writeWizardDoorFinish(360001, stainFinish, store);
    expect(readWizardDoorFinish(360001, store)).toEqual(stainFinish);

    const pickup = wizardDoorPickup(wizardDoor, store);
    expect(pickup).toMatchObject({ finish: STAIN_FINISH, hex: "#9a6e51", grainName: "Grey Wood", source: "browser-finish" });

    const plan = designerFacePlan(wizardDoor, "base");
    expect(plan).not.toBeNull();
    expect(plan!.dlcCrop?.solidColor).toBe("#9a6e51");
    // A stain keeps a real grain: the face tiles a grain image and tints it toward the hex.
    expect(plan!.dlcCrop?.grainUrl).toMatch(/\/textures\/dlc-fr26\/grain\//);
    expect(plan!.dlcCrop?.tintHex).toMatch(/^#[0-9a-f]{6}$/);
    expect(plan!.doorUrl).toMatch(/\/textures\/dlc-fr26\/grain\//);
    // Never the brand green, and never a blank face.
    expect(plan!.dlcCrop?.solidColor).not.toBe("#244338");
    expect(plan!.doorUrl).toBeTruthy();
  });

  it("renders a painted wizard door as an opaque solid of the published chip", () => {
    const store = installBrowserStore();
    writeWizardDoorFinish(360002, paintFinish, store);
    const painted = { ...wizardDoor, id: 360002, renderHex: "#edece6", woodSpecies: null, grainDirection: "none" as const };
    const pickup = wizardDoorPickup(painted, store);
    expect(pickup).toMatchObject({ finish: PAINT_FINISH, imageUrl: "/uploads/s592-barrington.jpg" });
    const plan = designerFacePlan(painted, "base");
    expect(plan!.dlcCrop?.solidColor).toBe("#edece6");
    expect(plan!.dlcCrop?.grainUrl).toBeNull();
    expect(plan!.dlcCrop?.tintHex).toBeNull();
    // The uploaded profile image still supplies the door shape.
    expect(plan!.doorUrl).toBe("/uploads/s592-barrington.jpg");
  });

  it("picks up a door saved on another machine from the saved fields alone", () => {
    const saved = { ...wizardDoor, id: 360003, finishCategory: PAINT_FINISH as typeof PAINT_FINISH };
    const pickup = wizardDoorPickup(saved, memory());
    expect(pickup?.finish).toBe(PAINT_FINISH);
    expect(pickup).toMatchObject({ finish: PAINT_FINISH, source: "saved-fields" });
    expect(wizardDoorFacePlan(saved, "wall")?.dlcCrop?.solidColor).toBe("#9a6e51");
  });

  it("adds no wizard UI to the designer, the wall section, or the closet", () => {
    // The pickup is resolved inside the existing face plan; nothing new is mounted.
    expect(designerFacePlan(wizardDoor, "base")).not.toBeNull();
    expect(isWizardSavedDoor(wizardDoor)).toBe(true);
    expect(isWizardSavedDoor({ id: 1, ourName: "Plain Door" })).toBe(false);
  });

  it("maps the wizard's grain name onto the grain the designer tiles", () => {
    expect(stainGrainSlug("Grey Wood")).toBe("grey-shaker");
    expect(stainGrainSlug("dark wood")).toBe("expresso-shaker");
    expect(stainGrainSlug("Light Wood")).toBe("versa-shaker");
    expect(stainGrainSlug("Oak")).toBe("versa-shaker");
    expect(stainGrainSlug(null)).toBe("versa-shaker");
  });

  it("keeps a drawer front separate from the door face", () => {
    const store = installBrowserStore();
    writeWizardDoorFinish(360001, stainFinish, store);
    const plan = designerFacePlan({ ...wizardDoor, drawerSampleImageUrl: "/uploads/s592-drawer.jpg" }, "base")!;
    expect(plan.sections).toBe(2);
    expect(plan.drawerUrl).not.toBe(plan.doorUrl);
    const wall = designerFacePlan(wizardDoor, "wall")!;
    expect(wall.sections).toBe(1);
    expect(wall.drawerUrl).toBeNull();
  });

  it("survives a corrupt finish record and still renders the door", () => {
    const corrupt = installBrowserStore({ [WIZARD_DOOR_FINISH_STORAGE_KEY]: "{not json" });
    expect(readWizardDoorFinish(360001, corrupt)).toBeNull();
    const plan = designerFacePlan(wizardDoor, "base");
    expect(plan).not.toBeNull();
    expect(plan!.doorUrl).toBeTruthy();
  });
});
