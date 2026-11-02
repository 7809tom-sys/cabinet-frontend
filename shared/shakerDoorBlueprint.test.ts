import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import catalog from "./fixtures/doorStyleSideCatalog.json";
import { designerFacePlan } from "../client/src/lib/designerFacePlan";
import { findDlcFinishForStyle } from "./dlcFr26Mapping";
import {
  SHAKER_BRAND_DOOR_SURFACE_PALETTE,
  SHAKER_BRAND_UI_PALETTE,
  STANDARD_DL_SHAKER_SLUGS,
  effectiveShakerRailIn,
  matchStandardShakerToDl,
  shakerDoorFamily,
  standardDlShakerReferences,
  standardShakerDlFacePlan,
  type ShakerStyleInput,
} from "./shakerDoorBlueprint";

const styles = catalog as ShakerStyleInput[];
const dlStyles = styles.filter((style) => style.distributorId === 450001);

describe("DL shaker blueprint", () => {
  it("finds the named standard DL shakers and does not treat slim, raised, or traditional as that template", () => {
    const references = standardDlShakerReferences();
    expect(references.map((reference) => reference.slug)).toEqual([...STANDARD_DL_SHAKER_SLUGS]);
    expect(dlStyles).toHaveLength(11);
    const byName = new Map(dlStyles.map((style) => [style.ourName, style.doorStyle ?? ""]));
    expect(byName.get("White Shaker")).toBe("Shaker");
    expect(byName.get("Versa Shaker")).toBe("Shaker");
    expect(byName.get("Slim Shaker Alabaster")).toBe("Slim Shaker");
    expect(byName.get("Slim Shaker Ebony")).toBe("Slim Shaker");
    expect(byName.get("Pearl White")).toBe("Raised Panel");
    expect(byName.get("Dark Caramel")).toBe("Raised Panel");
    expect(byName.get("European White Oak")).toBe("Traditional Panel");
    for (const name of ["Glacier White", "Driftwood", "Dove Grey", "Cyber Grey"]) {
      expect(byName.get(name) ?? "").toBe("");
    }
    expect(references.find((reference) => reference.slug === "white-shaker")?.family).toBe("painted");
    expect(references.find((reference) => reference.slug === "expresso-shaker")?.family).toBe("wood");
  });

  it("fails if a 2.75 or 3 inch shaker bypasses the DL template or renders a door surface color outside the brand palette/sample", () => {
    const source = readFileSync(new URL("./shakerDoorBlueprint.ts", import.meta.url), "utf8");
    const hexes = source.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    const allowed = new Set<string>(SHAKER_BRAND_DOOR_SURFACE_PALETTE.map((hex) => hex.toLowerCase()));
    for (const hex of hexes) {
      expect(allowed.has(hex.toLowerCase()), hex).toBe(true);
    }
    expect(source).toContain("HARD RULE (Tom, Nov 1 2026)");

    const brandSurface = new Set<string>(SHAKER_BRAND_DOOR_SURFACE_PALETTE.map((hex) => hex.toLowerCase()));
    expect(SHAKER_BRAND_UI_PALETTE.every((hex) => brandSurface.has(hex))).toBe(true);
    const standard = styles.filter((style) => shakerDoorFamily(style.doorStyle) === "shaker");
    expect(standard.length).toBeGreaterThan(0);
    for (const style of standard) {
      expect(effectiveShakerRailIn(style)).toBe(3);
      const native = findDlcFinishForStyle(style);
      const throughDesigner = designerFacePlan({ ...style, doorSampleImageUrl: "/uploads/framed-door.jpg" }, "base");
      expect(throughDesigner?.doorUrl, style.ourName ?? "").not.toBe("/uploads/framed-door.jpg");
      if (native) {
        expect(standardShakerDlFacePlan(style, "base")).toBeNull();
        expect(throughDesigner?.dlcCrop?.slug).toBe(native.slug);
        continue;
      }
      const plan = standardShakerDlFacePlan(style, "base");
      const match = matchStandardShakerToDl(style);
      expect(match.adopted, style.ourName ?? "").toBe(true);
      if (!match.adopted) continue;
      expect(plan?.dlcCrop?.slug, style.ourName ?? "").toBe(match.reference.slug);
      const surface = plan?.dlcCrop?.solidColor?.toLowerCase() ?? "";
      expect(brandSurface.has(surface), `${style.ourName}: ${surface}`).toBe(true);
      expect(surface).toBe(match.surfaceColor);
      expect(throughDesigner?.doorUrl, style.ourName ?? "").toBe(plan?.doorUrl);
    }

    for (const style of styles.filter((item) => shakerDoorFamily(item.doorStyle) === "slim-shaker" || shakerDoorFamily(item.doorStyle) === "double-shaker")) {
      expect(standardShakerDlFacePlan(style, "base"), style.ourName ?? "").toBeNull();
    }
    expect(standardShakerDlFacePlan({ doorStyle: "Shaker", railWidth: 2.25, color: "#f4f1ea" }, "base")).toBeNull();
    const cream = standardShakerDlFacePlan({ doorStyle: "Shaker", railWidth: 2.75, color: "#f2e8d0" }, "wall");
    expect(cream?.dlcCrop?.slug).toBeTruthy();
    expect(brandSurface.has(cream?.dlcCrop?.solidColor ?? "")).toBe(true);
    // Off-brand blue / teal never reach a door surface.
    for (const color of ["#1f4e8c", "#2a8c8c", "#5a8f3a"]) {
      const plan = standardShakerDlFacePlan({ doorStyle: "Shaker", railWidth: 3, color }, "base");
      expect(brandSurface.has(plan?.dlcCrop?.solidColor ?? ""), color).toBe(true);
    }
    // Classic Cream photo color snaps to the uploaded sample.
    expect(standardShakerDlFacePlan({ doorStyle: "Shaker", railWidth: 3, color: "#dcd7c2" }, "base")?.dlcCrop?.solidColor).toBe("#dedac6");
  });
});
