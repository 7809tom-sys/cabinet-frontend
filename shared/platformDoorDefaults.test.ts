/** PLATFORM DEFAULT DOOR STYLE (Tom, voice, Nov 21 2026, 1:54 PM CT). */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PLATFORM_APPROVED_DOOR_STYLES, PLATFORM_DEFAULT_DOOR_STYLE, starterDoorStyleFor } from "./platformDoorDefaults";
import * as boxes from "./doorBoxBlueprint";
import { libraryDoorFacePlan } from "./doorLibraryProfiles";
import { STANDARD_DL_SHAKER_SLUGS, shakerDoorFamily } from "./shakerDoorBlueprint";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("platform default door style", () => {
  it("is DL Shaker, listed first, with the other approved styles alongside", () => {
    expect(PLATFORM_DEFAULT_DOOR_STYLE).toMatchObject({ id: "dl-shaker", label: "DL Shaker", doorStyle: "Shaker", blueprint: "dlShakerDoorBox" });
    expect(PLATFORM_APPROVED_DOOR_STYLES[0]).toBe(PLATFORM_DEFAULT_DOOR_STYLE);
    expect(PLATFORM_APPROVED_DOOR_STYLES.map((s) => s.id)).toEqual(["dl-shaker", "raised-panel", "slim-shaker", "slab"]);
    for (const style of PLATFORM_APPROVED_DOOR_STYLES) expect(typeof (boxes as Record<string, unknown>)[style.blueprint]).toBe("function");
  });

  it("the default resolves to the DL shaker blueprint", () => {
    expect(shakerDoorFamily(PLATFORM_DEFAULT_DOOR_STYLE.doorStyle)).toBe("shaker");
    const plan = libraryDoorFacePlan({ doorStyle: PLATFORM_DEFAULT_DOOR_STYLE.doorStyle, color: "#ffffff" }, "base");
    expect((STANDARD_DL_SHAKER_SLUGS as readonly string[]).includes(plan?.dlcCrop?.slug ?? "")).toBe(true);
  });

  it("falls back only when nothing is saved and never overrides a saved style", () => {
    expect(starterDoorStyleFor(null)).toBe("Shaker");
    expect(starterDoorStyleFor(undefined)).toBe("Shaker");
    expect(starterDoorStyleFor("   ")).toBe("Shaker");
    expect(starterDoorStyleFor("Raised Panel")).toBe("Raised Panel");
    expect(starterDoorStyleFor("Slab")).toBe("Slab");
    expect(starterDoorStyleFor("Double Shaker")).toBe("Double Shaker");
  });

  it("new records start on the default; existing edit forms keep their saved value", () => {
    const featured = read("client/src/components/admin/FeaturedStylesAdmin.tsx");
    expect(featured).toContain("useState<string>(PLATFORM_DEFAULT_DOOR_STYLE.doorStyle)");
    expect(featured).toContain('useState(style.doorStyle ?? "")');
    const vendor = read("client/src/pages/VendorPortal.tsx");
    expect(vendor).toContain("useState<string>(PLATFORM_DEFAULT_DOOR_STYLE.doorStyle)");
    expect(vendor).toContain('useState(style.doorStyle ?? "")');
    expect(read("docs/rules/SHAKER_DOOR_RULE.md")).toContain("PLATFORM_DEFAULT_DOOR_STYLE");
  });
});
