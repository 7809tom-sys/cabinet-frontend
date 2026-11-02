import { describe, expect, it } from "vitest";
import { designerFacePlan } from "../client/src/lib/designerFacePlan";
import { resolveDoorColor } from "./doorColorResolve";
import { brandDoorSurfaceHex, isHickoryDoor, standardShakerDlFacePlan } from "./shakerDoorBlueprint";

const BRAND = ["#dedac6", "#fffdf9", "#f6f3ed", "#244338", "#d7a46c"];
const hickory = {
  id: 330007,
  ourName: "Hickory Shaker",
  aliasName: "Silva Shaker (Ashford)",
  color: "#8B6914",
  doorStyle: "Shaker",
  doorSampleImageUrl: "/uploads/hickory-door.jpg",
  drawerSampleImageUrl: "/uploads/hickory-drawer.jpg",
};

describe("hickory keeps its catalog door photo", () => {
  it("does not replace the photo with a DL grain, a flat swatch, a brand color, or a guessed tint", () => {
    expect(isHickoryDoor(hickory)).toBe(true);
    expect(standardShakerDlFacePlan(hickory, "base")).toBeNull();
    const plan = designerFacePlan(hickory, "base");
    expect(plan?.doorUrl).toBe("/uploads/hickory-door.jpg");
    expect(plan?.dlcCrop).toBeUndefined();
    expect(plan?.dlcCrop?.tintHex).toBeUndefined();
    expect(plan?.dlcCrop?.solidColor).toBeUndefined();
    const painted = resolveDoorColor(hickory).appliedHex;
    expect(BRAND).not.toContain(painted);
    expect(painted).not.toBe(brandDoorSurfaceHex("#8b6914"));
  });

  it("still does not invent a flat face when the hickory photo is missing", () => {
    const bare = { ourName: "Rustic Hickory", doorStyle: "Shaker", color: "#7A5C3C" };
    const plan = designerFacePlan(bare, "base");
    expect(plan?.dlcCrop).toBeUndefined();
    expect(plan?.doorUrl).toBeNull();
    expect(BRAND).not.toContain(resolveDoorColor(bare).appliedHex);
  });
});
