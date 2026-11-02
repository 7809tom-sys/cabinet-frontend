import { describe, expect, it } from "vitest";
import { designerFacePlan } from "../client/src/lib/designerFacePlan";
import { resolveCabinetFaceImages } from "./doorFaceRecognition";
import { isWizardSavedDoor } from "./walzcraftDesignerPickup";
import { resolveDoorProfileImage } from "./walzcraftProfileImage";

/**
 * The fallback rule, tested from both sides.
 *
 * A door that has no WalzCraft wizard profile must keep the image it already had. This file
 * fails if such a door loses its image on any path the wizard touched.
 */

const BRAND = ["#dedac6", "#fffdf9", "#f6f3ed", "#244338", "#d7a46c"];

/** Doors that never went through the wizard. Each has an image and must keep it. */
const doorsWithoutProfile = [
  {
    label: "legacy sample photo",
    door: { id: 101, ourName: "Faircrest Maple", doorStyle: "Raised Panel", doorSampleImageUrl: "/uploads/faircrest-maple.jpg" },
    expected: "/uploads/faircrest-maple.jpg",
    source: "door-sample",
  },
  {
    label: "thumbnail only",
    door: { id: 102, ourName: "Aspen White", doorStyle: "Recessed", thumbnailImageUrl: "/uploads/aspen-white-thumb.jpg" },
    expected: "/uploads/aspen-white-thumb.jpg",
    source: "thumbnail",
  },
  {
    label: "hickory photo",
    door: { id: 103, ourName: "Hickory Shaker", doorStyle: "Shaker", color: "#8B6914", doorSampleImageUrl: "/uploads/hickory-door.jpg" },
    expected: "/uploads/hickory-door.jpg",
    source: "door-sample",
  },
  {
    label: "combined swatch",
    door: { id: 104, ourName: "Grey Wood", styleCode: "TGW", doorStyle: "Slab", doorSampleImageUrl: "/uploads/tgw-combined.jpg", drawerSampleImageUrl: "/uploads/tgw-combined.jpg" },
    expected: "/uploads/tgw-combined.jpg",
    source: "door-sample",
  },
  {
    label: "raised panel with a drawer front",
    door: { id: 105, ourName: "Proximity", styleCode: "S109", doorStyle: "Raised Panel", doorSampleImageUrl: "/uploads/s109-door.jpg", drawerSampleImageUrl: "/uploads/s109-drawer.jpg" },
    expected: "/uploads/s109-door.jpg",
    source: "door-sample",
  },
] as const;

describe("fallback rule: a door without a wizard profile keeps its image", () => {
  for (const { label, door, expected, source } of doorsWithoutProfile) {
    it(`keeps the image for the ${label} door`, () => {
      // The wizard's own resolver returns the door's image, never a blank.
      expect(resolveDoorProfileImage(door, { stored: null })).toEqual({ url: expected, source });

      // The Designer's plan keeps a face for the same door.
      const plan = designerFacePlan(door, "base");
      expect(plan, label).not.toBeNull();
      expect(plan!.doorUrl, label).toBeTruthy();
      expect(plan!.doorUrl, label).toBe(expected);

      // The plain recognition path agrees, so the wizard changed nothing for this door.
      expect(resolveCabinetFaceImages(door, "base").doorUrl, label).toBe(expected);
      expect(isWizardSavedDoor(door), label).toBe(false);
    });
  }

  it("does not turn a door without a profile into a generic grain or a brand color", () => {
    for (const { door } of doorsWithoutProfile) {
      const plan = designerFacePlan(door, "base");
      expect(plan!.dlcCrop?.slug ?? "").not.toBe("wizard-paint");
      expect(plan!.doorUrl).not.toMatch(/\/textures\/dlc-fr26\/grain\//);
      expect(BRAND).not.toContain(plan!.dlcCrop?.solidColor ?? "");
    }
  });

  it("keeps the drawer front image when the door has one", () => {
    const plan = designerFacePlan(doorsWithoutProfile[4]!.door, "base")!;
    expect(plan.sections).toBe(2);
    expect(plan.drawerUrl).toBe("/uploads/s109-drawer.jpg");
    expect(plan.drawerUrl).not.toBe(plan.doorUrl);
  });

  it("falls back to the door image when a stored profile is present but has no usable URL", () => {
    const door = doorsWithoutProfile[0]!.door;
    const emptyStored = { modelNumber: null, folder: null, fileName: "broken.jpg", url: "", inCatalog: false, catalogNote: null };
    expect(resolveDoorProfileImage(door, { stored: emptyStored })).toEqual({ url: "/uploads/faircrest-maple.jpg", source: "door-sample" });
    expect(designerFacePlan(door, "base")!.doorUrl).toBe("/uploads/faircrest-maple.jpg");
  });
});
