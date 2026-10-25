import { describe, expect, it } from "vitest";
import {
  doorFamilyKey,
  familyFinishLabel,
  familyFinishKey,
  familyImageUrl,
  groupStorefrontDoorFamilies,
} from "./storefrontDoorFamilies";

const style = (overrides: Record<string, unknown> = {}) => ({
  styleId: 1,
  styleCode: "STYLE-1",
  name: "Sample",
  doorStyle: "Shaker",
  doorPanelType: "Recessed Panel",
  finish: "Painted",
  color: "White",
  roomSceneImageUrl: "/scene.jpg",
  ...overrides,
});

describe("storefront door family grouping", () => {
  it("derives profile families from metadata rather than names or SKUs", () => {
    expect(doorFamilyKey(style({ styleId: 10, name: "A completely unrelated name", styleCode: "X", doorStyle: "Slim Shaker" }))).toBe("slim-shaker");
    expect(doorFamilyKey(style({ styleId: 11, doorStyle: "Double Shaker" }))).toBe("double-shaker");
    expect(doorFamilyKey(style({ styleId: 12, doorStyle: "Flat Panel" }))).toBe("slab");
    expect(doorFamilyKey(style({ styleId: 13, doorPanelType: "Raised Panel", doorStyle: null }))).toBe("raised-panel");
  });

  it("keeps every style as a selectable family variant and leads with featured families", () => {
    const families = groupStorefrontDoorFamilies([
      style({ styleId: 1, doorStyle: "Shaker", color: "White" }),
      style({ styleId: 2, doorStyle: "Shaker", color: "Blue", featured: true, featuredSortOrder: 1 }),
      style({ styleId: 3, doorStyle: "Slim Shaker", color: "Green" }),
    ]);
    expect(families.map((family) => family.label)).toEqual(["Shaker", "Slim Shaker"]);
    expect(families[0].variants.map((variant) => variant.styleId).sort()).toEqual([1, 2]);
    expect(families[0].selected.styleId).toBe(2);
  });

  it("uses distinct style IDs in finish keys so each finish maps back to its exact style", () => {
    const whiteA = style({ styleId: 101, color: "White" });
    const whiteB = style({ styleId: 102, color: "White" });
    expect(familyFinishKey(whiteA)).not.toBe(familyFinishKey(whiteB));
  });

  it("returns standalone human finish labels and never exposes hex or placeholders", () => {
    expect(familyFinishLabel(style({ finish: "Dual Blanc (Preston)", name: "Dual Blanc" }))).toBe("Dual Blanc");
    expect(familyFinishLabel(style({ finish: "Matching", color: null, name: "Midnight Glass" }))).toBe("Matching colour");
    expect(familyFinishLabel(style({ finish: "#4f5549", color: "#4f5549", name: "Aero Sage" }))).toBe("Aero Sage");
  });

  it("uses a genuine room scene for the initial family variant and does not badge distributor-only features", () => {
    const families = groupStorefrontDoorFamilies([
      style({ styleId: 1, doorStyle: "Raised Panel", featuredDistributor: true, roomSceneImageUrl: "/screenshot_hero.jpg", name: "Screenshot Variant" }),
      style({ styleId: 2, doorStyle: "Raised Panel", roomSceneImageUrl: "/real_room_scene.jpg", name: "Room Variant" }),
    ]);
    expect(families[0].selected.styleId).toBe(2);
    expect(families[0].featured).toBe(false);
  });

  it("falls back to the real door sample instead of a screenshot when no room scene exists", () => {
    expect(familyImageUrl(style({ roomSceneImageUrl: "/screenshot_hero.jpg", doorSampleImageUrl: "/real-door.jpg" }))).toBe("/real-door.jpg");
  });
});
