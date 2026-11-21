/**
 * FIRM RULE (Tom, voice, Nov 21 2026, 11:59 AM CT): every shaker door uses the DL shaker style.
 * docs/rules/SHAKER_DOOR_RULE.md, DL_SHAKER_FIRM_RULE in shared/shakerDoorBlueprint.ts.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DL_SHAKER_FIRM_RULE,
  STANDARD_DL_SHAKER_SLUGS,
  matchStandardShakerToDl,
  standardShakerDlFacePlan,
} from "./shakerDoorBlueprint";
import { libraryDoorFacePlan } from "./doorLibraryProfiles";
import {
  DESIGNER_SLAB_FRONT_THICKNESS_FT,
  DL_SHAKER_SLAB_BELOW_IN,
  dlShakerDoorBox,
  dlShakerFrameIn,
  slabDoorBox,
} from "./doorBoxBlueprint";

const DL_SLUGS = new Set<string>(STANDARD_DL_SHAKER_SLUGS);

describe("FIRM RULE: every shaker door uses the DL shaker style", () => {
  it("states the rule in code", () => {
    expect(DL_SHAKER_FIRM_RULE).toBe("FIRM RULE (Tom): every shaker door uses the DL shaker style.");
    const source = readFileSync(resolve(process.cwd(), "shared/shakerDoorBlueprint.ts"), "utf8");
    expect(source).toContain("FIRM RULE (Tom, voice, Nov 21 2026");
  });

  it("gives every plain shaker a DL shaker face, whatever its rail, color, or name", () => {
    const shakers = [
      { doorStyle: "Shaker", color: "#ffffff" },
      { doorStyle: "SHAKER", color: "#2b3a4a" },
      { doorStyle: "shaker", railWidth: 2.75, color: "#8d8f92" },
      { doorStyle: "Shaker", railWidth: 3, color: "#c19a6b", finish: "Stain", woodSpecies: "Maple" },
      // Off the 2.75/3 inch standard: these used to fall back to a non-DL photo.
      { doorStyle: "Shaker", railWidth: 2.25, color: "#f4f1ea" },
      { doorStyle: "Shaker", railWidth: "3.5", color: "#244338" },
      { doorStyle: "Shaker", stileWidth: 2, color: "#d1ba8f" },
      { ourName: "Shaker Honey", doorStyle: "", color: "#d1ba8f" },
      { doorStyle: "Recessed Shaker Panel", color: "#e7eaef" },
    ];
    for (const style of shakers) {
      const adoption = matchStandardShakerToDl(style);
      expect(adoption.adopted, JSON.stringify(style)).toBe(true);
      if (adoption.adopted) expect(DL_SLUGS.has(adoption.reference.slug), JSON.stringify(style)).toBe(true);
      const plan = standardShakerDlFacePlan(style, "base");
      expect(plan, JSON.stringify(style)).not.toBeNull();
      expect(DL_SLUGS.has(plan!.dlcCrop!.slug), JSON.stringify(style)).toBe(true);
      // The library path the Designer reads gives the same DL face.
      expect(libraryDoorFacePlan(style, "base")?.dlcCrop?.slug, JSON.stringify(style)).toBe(plan!.dlcCrop!.slug);
    }
  });

  it("keeps the earlier owner exceptions", () => {
    expect(matchStandardShakerToDl({ doorStyle: "Shaker", color: "#ffffff" }, { wizardProfile: true }).adopted).toBe(false);
    expect(standardShakerDlFacePlan({ doorStyle: "Slim Shaker", railWidth: 2.25 }, "base")).toBeNull();
    expect(standardShakerDlFacePlan({ doorStyle: "Double Shaker" }, "base")).toBeNull();
    expect(standardShakerDlFacePlan({ doorStyle: "Shaker", woodSpecies: "Hickory" }, "base")).toBeNull();
    // A slab build is never a shaker, even with a shaker word in the name.
    expect(standardShakerDlFacePlan({ ourName: "Shaker Honey", doorStyle: "Slab", color: "#d1ba8f" }, "base")).toBeNull();
  });
});

describe("door box blueprint (admin screen geometry)", () => {
  it("builds the five-piece DL shaker box with full-width rails and stiles between", () => {
    const box = dlShakerDoorBox(15, 30);
    expect(box.kind).toBe("dl-shaker");
    expect(box.frameIn).toBe(3);
    expect(box.pieces.map((p) => p.id)).toEqual(["top-rail", "bottom-rail", "left-stile", "right-stile", "center-panel"]);
    const center = box.pieces.find((p) => p.id === "center-panel")!;
    expect(center.widthIn).toBe(9);
    expect(center.heightIn).toBe(24);
    expect(box.pieces.find((p) => p.id === "top-rail")!.widthIn).toBe(15);
    expect(box.pieces.find((p) => p.id === "left-stile")!.heightIn).toBe(24);
    expect(box.depthIn).toBeCloseTo(0.372, 3);
    expect(dlShakerDoorBox(15, 30, 2.75).frameIn).toBe(2.75);
  });

  it("renders a small front under 7 inches as a plain slab", () => {
    expect(DL_SHAKER_SLAB_BELOW_IN).toBe(7);
    const drawer = dlShakerDoorBox(15, 6);
    expect(drawer.kind).toBe("slab");
    expect(drawer.smallFrontSlab).toBe(true);
    expect(drawer.pieces).toHaveLength(1);
  });

  it("matches the Designer rail clamp and closet slab threshold", async () => {
    const { threeDShakerRailThickness } = await import("../client/src/lib/shakerRail");
    const { CLOSET_SLAB_BELOW_IN } = await import("../client/src/components/vendor/closetShakerFront");
    expect(DL_SHAKER_SLAB_BELOW_IN).toBe(CLOSET_SLAB_BELOW_IN);
    for (const [w, h, r] of [[15, 30, 3], [7.2, 30, 3], [15, 7.5, 2.75], [24, 42, undefined]] as const) {
      expect(dlShakerFrameIn(w, h, r)).toBeCloseTo(threeDShakerRailThickness(w / 12, h / 12, r) * 12, 6);
    }
  });

  it("canonical slab reference is one flat panel at the Designer's 0.045 ft slab thickness", () => {
    const slab = slabDoorBox(15, 30);
    expect(slab.kind).toBe("slab");
    expect(slab.pieces).toEqual([{ id: "slab", label: "Slab", xIn: 0, yIn: 0, widthIn: 15, heightIn: 30, depthIn: 0.54 }]);
    const designer = readFileSync(resolve(process.cwd(), "client/src/components/design/InteractiveRoom3D.tsx"), "utf8");
    expect(designer).toContain(`Door slab front is at half its ${DESIGNER_SLAB_FRONT_THICKNESS_FT} ft thickness`);
  });
});
