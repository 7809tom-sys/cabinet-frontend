import { describe, it, expect } from "vitest";
import { doorFamilyPhoto } from "./doorFamilyPhotos";

describe("doorFamilyPhoto", () => {
  it("returns a CDN url for each major panel family", () => {
    for (const ds of ["Shaker", "Raised Panel", "Slab", "Beaded", "Inset"]) {
      const url = doorFamilyPhoto({ doorStyle: ds });
      expect(url, ds).toBeTruthy();
      expect(url, ds).toMatch(/^https:\/\/.+\.(webp|png)$/);
    }
  });

  it("maps double-shaker style to the shaker photo", () => {
    const dbl = doorFamilyPhoto({ doorStyle: "Double Shaker" });
    const single = doorFamilyPhoto({ doorStyle: "Shaker" });
    expect(dbl).toBe(single);
  });

  it("falls back to a family (never throws) for unknown/empty style", () => {
    expect(() => doorFamilyPhoto({ doorStyle: null })).not.toThrow();
    expect(() => doorFamilyPhoto({})).not.toThrow();
    // unknown style still resolves to some family photo (doorPanelKind has a default)
    expect(doorFamilyPhoto({ doorStyle: "Mystery" })).toBeTruthy();
  });
});

import { kitchenSceneFor, KITCHEN_SCENES } from "./doorFamilyPhotos";

describe("kitchenSceneFor", () => {
  it("always returns a known kitchen scene URL (never null)", () => {
    const scenes = new Set(Object.values(KITCHEN_SCENES));
    for (const ds of ["Shaker White", "Raised Panel", "Slab", "Mystery", "", null]) {
      const url = kitchenSceneFor({ doorStyle: ds });
      expect(url, String(ds)).toBeTruthy();
      expect(scenes.has(url), String(ds)).toBe(true);
    }
  });

  it("resolves slab/contemporary styles to the natural slab scene", () => {
    expect(kitchenSceneFor({ doorStyle: "Contemporary Slab" })).toBe(
      KITCHEN_SCENES["slab-natural"]
    );
  });

  it("matches finish keywords to the right scene", () => {
    expect(kitchenSceneFor({ doorStyle: "Snow White Shaker" })).toBe(KITCHEN_SCENES["shaker-white"]);
    expect(kitchenSceneFor({ doorStyle: "Stone Gray Shaker" })).toBe(KITCHEN_SCENES["shaker-gray"]);
    expect(kitchenSceneFor({ doorStyle: "Espresso Shaker" })).toBe(KITCHEN_SCENES["shaker-espresso"]);
    expect(kitchenSceneFor({ doorStyle: "Cherry Raised Panel" })).toBe(KITCHEN_SCENES["raised-cherry"]);
  });

  it("keeps white/gray raised-panel styles in the bright shaker rooms", () => {
    expect(kitchenSceneFor({ doorStyle: "Pearl White Raised Panel" })).toBe(KITCHEN_SCENES["shaker-white"]);
    expect(kitchenSceneFor({ doorStyle: "Slate Gray Raised Panel" })).toBe(KITCHEN_SCENES["shaker-gray"]);
  });

  // Regression: a WHITE paint named on a wood species (maple/birch/oak) must read
  // as a white kitchen, NEVER the cherry/lightwood scene. (paint color wins)
  it("a white paint on a wood species shows a white kitchen, never cherry", () => {
    const whiteScene = KITCHEN_SCENES["shaker-white"];
    for (const ds of [
      "Maple · SW 7006 Extra White",
      "Solid Birch · Snowbound",
      "Oak Shaker · Alabaster",
      "Hickory · Pure White",
      "Maple Raised Panel · Chantilly Lace",
    ]) {
      const url = kitchenSceneFor({ doorStyle: ds });
      expect(url, ds).toBe(whiteScene);
      expect(url, ds).not.toBe(KITCHEN_SCENES["raised-cherry"]);
    }
  });

  // Regression: an explicit dark/gray paint on a wood species wins over the species.
  it("dark/gray paint on a wood species wins over the species", () => {
    expect(kitchenSceneFor({ doorStyle: "Solid Birch · SW 6258 Tricorn Black Shaker" })).toBe(
      KITCHEN_SCENES["shaker-espresso"],
    );
    expect(kitchenSceneFor({ doorStyle: "Maple Shaker · Dorian Gray" })).toBe(
      KITCHEN_SCENES["shaker-gray"],
    );
  });

  // A true wood-stain (no paint color named) still routes by species.
  it("a true cherry stain (no paint color) still gets the cherry scene", () => {
    expect(kitchenSceneFor({ doorStyle: "Cherry Raised Panel" })).toBe(KITCHEN_SCENES["raised-cherry"]);
    expect(kitchenSceneFor({ doorStyle: "Natural Maple Shaker" })).toBe(KITCHEN_SCENES["slab-natural"]);
  });
});

import { cabinetProductPhoto, kitchenSceneWithCopy } from "./doorFamilyPhotos";

describe("cabinetProductPhoto", () => {
  it("returns a base render for base/sink/drawer categories", () => {
    expect(cabinetProductPhoto({ category: "Base Cabinets", doorStyle: "Snow White Shaker" })).toContain("prod-base");
    expect(cabinetProductPhoto({ category: "Sink Base", doorStyle: "White" })).toContain("prod-base");
    expect(cabinetProductPhoto({ category: "Drawer Base", doorStyle: "Dove Gray" })).toContain("prod-base");
  });

  it("matches finish bucket within a category", () => {
    expect(cabinetProductPhoto({ category: "Base", doorStyle: "Stone Gray Shaker" })).toContain("prod-base-shaker-gray");
    expect(cabinetProductPhoto({ category: "Base", doorStyle: "Cherry Raised Panel" })).toContain("prod-base-cherry");
    expect(cabinetProductPhoto({ category: "Base", doorStyle: "Espresso Shaker" })).toContain("prod-base-espresso");
  });

  it("maps wall/upper categories to a wall render", () => {
    expect(cabinetProductPhoto({ category: "Wall Cabinets", doorStyle: "White" })).toContain("prod-wall");
    expect(cabinetProductPhoto({ category: "Upper", doorStyle: "Gray" })).toContain("prod-wall");
  });

  it("maps tall / vanity categories to their renders", () => {
    expect(cabinetProductPhoto({ category: "Tall Pantry", doorStyle: "White" })).toContain("prod-tall");
    expect(cabinetProductPhoto({ category: "Vanity", doorStyle: "White" })).toContain("prod-vanity");
  });

  it("returns null for accessories so the UI shows the accurate to-scale drawing", () => {
    // Trim/molding, fronts, panels, shelves, inserts are too varied for one render.
    expect(cabinetProductPhoto({ category: "Accessory", doorStyle: "White" })).toBeNull();
    expect(cabinetProductPhoto({ category: "Crown Molding", doorStyle: "Espresso" })).toBeNull();
    expect(cabinetProductPhoto({ category: "Filler", doorStyle: "Cherry" })).toBeNull();
    expect(cabinetProductPhoto({ category: "Decorative End Panel", doorStyle: "Gray" })).toBeNull();
  });

  it("now has full finish coverage for wall (incl. espresso/dark)", () => {
    expect(cabinetProductPhoto({ category: "Wall", doorStyle: "Espresso" })).toContain("prod-wall-espresso");
    expect(cabinetProductPhoto({ category: "Wall", doorStyle: "Stone Gray" })).toContain("prod-wall-shaker-gray");
    expect(cabinetProductPhoto({ category: "Wall", doorStyle: "Cherry" })).toContain("prod-wall-cherry");
  });

  it("now has gray/cherry/espresso renders for tall and vanity", () => {
    expect(cabinetProductPhoto({ category: "Tall", doorStyle: "Stone Gray" })).toContain("prod-tall-gray");
    expect(cabinetProductPhoto({ category: "Tall", doorStyle: "Cherry" })).toContain("prod-tall-cherry");
    expect(cabinetProductPhoto({ category: "Tall", doorStyle: "Espresso" })).toContain("prod-tall-espresso");
    expect(cabinetProductPhoto({ category: "Vanity", doorStyle: "Stone Gray" })).toContain("prod-vanity-gray");
    expect(cabinetProductPhoto({ category: "Vanity", doorStyle: "Cherry" })).toContain("prod-vanity-cherry");
    expect(cabinetProductPhoto({ category: "Vanity", doorStyle: "Espresso" })).toContain("prod-vanity-espresso");
  });

  it("returns a base render (never null) for real cabinet boxes even with empty inputs", () => {
    expect(cabinetProductPhoto({ category: null, doorStyle: null })).toContain("prod-base");
  });
});

describe("kitchenSceneWithCopy", () => {
  it("returns an image plus a title and blurb", () => {
    const r = kitchenSceneWithCopy({ doorStyle: "Snow White Shaker" });
    expect(r.image).toMatch(/^https:\/\//);
    expect(r.title.length).toBeGreaterThan(0);
    expect(r.blurb.length).toBeGreaterThan(0);
  });

  it("gives the white-shaker copy for white styles and cherry copy for cherry", () => {
    expect(kitchenSceneWithCopy({ doorStyle: "Arctic White Shaker" }).title).toMatch(/White Shaker/i);
    expect(kitchenSceneWithCopy({ doorStyle: "Cherry Raised Panel" }).title).toMatch(/Cherry/i);
  });

  it("never throws on null door style", () => {
    expect(() => kitchenSceneWithCopy({ doorStyle: null })).not.toThrow();
  });
});

import { realImageUrl } from "./doorFamilyPhotos";

describe("realImageUrl (strict one-family-one-color guard)", () => {
  it("rejects the seeded relative placeholder paths so they never render", () => {
    expect(realImageUrl("/room-scenes/aspen-white-room-scene.jpg")).toBeNull();
    expect(realImageUrl("/door-samples/lumina-white-door.jpg")).toBeNull();
    expect(realImageUrl("/thumbnails/oxford-sage-door-thumb.jpg")).toBeNull();
  });

  it("rejects empty / null / whitespace", () => {
    expect(realImageUrl(null)).toBeNull();
    expect(realImageUrl(undefined)).toBeNull();
    expect(realImageUrl("")).toBeNull();
    expect(realImageUrl("   ")).toBeNull();
  });

  it("accepts absolute http(s) CDN URLs and data URIs", () => {
    expect(realImageUrl("https://cdn.example.com/scene.webp")).toBe(
      "https://cdn.example.com/scene.webp",
    );
    expect(realImageUrl("http://example.com/x.jpg")).toBe("http://example.com/x.jpg");
    expect(realImageUrl("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
  });

  it("trims surrounding whitespace on a valid URL", () => {
    expect(realImageUrl("  https://cdn.example.com/a.webp  ")).toBe(
      "https://cdn.example.com/a.webp",
    );
  });
});
