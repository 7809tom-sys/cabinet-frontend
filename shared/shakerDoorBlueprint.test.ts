import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import catalog from "./fixtures/doorStyleSideCatalog.json";
import { designerFacePlan } from "../client/src/lib/designerFacePlan";
import { findDlcFinishForStyle } from "./dlcFr26Mapping";
import { resolveDoorColor } from "./doorColorResolve";
import {
  SHAKER_BRAND_DOOR_SURFACE_PALETTE,
  STANDARD_DL_SHAKER_SLUGS,
  brandDoorSurfaceHex,
  effectiveShakerRailIn,
  isHickoryDoor,
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

  it("keeps the DL template and paints the door's own color, not a snapped brand swatch", () => {
    const source = readFileSync(new URL("./shakerDoorBlueprint.ts", import.meta.url), "utf8");
    expect(source).toContain("HARD RULE (Tom, Nov 1 2026)");
    expect(source).not.toContain("const surfaceColor = brandDoorSurfaceHex");
    const brandSurface = new Set<string>(SHAKER_BRAND_DOOR_SURFACE_PALETTE.map((hex) => hex.toLowerCase()));
    const standard = styles.filter((style) => shakerDoorFamily(style.doorStyle) === "shaker");
    expect(standard.length).toBeGreaterThan(0);
    for (const style of standard) {
      expect(effectiveShakerRailIn(style)).toBe(3);
      const native = findDlcFinishForStyle(style);
      const throughDesigner = designerFacePlan({ ...style, doorSampleImageUrl: "/uploads/framed-door.jpg" }, "base");
      if (isHickoryDoor(style)) {
        expect(matchStandardShakerToDl(style).adopted, style.ourName ?? "").toBe(false);
        expect(throughDesigner?.doorUrl, style.ourName ?? "").toBe("/uploads/framed-door.jpg");
        expect(throughDesigner?.dlcCrop, style.ourName ?? "").toBeUndefined();
        continue;
      }
      expect(throughDesigner?.doorUrl, style.ourName ?? "").not.toBe("/uploads/framed-door.jpg");
      if (native) {
        expect(standardShakerDlFacePlan(style, "base")).toBeNull();
        expect(throughDesigner?.dlcCrop?.slug).toBe(native.slug);
        continue;
      }
      const plan = standardShakerDlFacePlan(style, "base");
      const match = matchStandardShakerToDl(style);
      const decision = resolveDoorColor(style);
      expect(match.adopted, style.ourName ?? "").toBe(true);
      if (!match.adopted) continue;
      expect(plan?.dlcCrop?.slug, style.ourName ?? "").toBe(match.reference.slug);
      const surface = plan?.dlcCrop?.solidColor?.toLowerCase() ?? "";
      expect(surface, style.ourName ?? "").toBe(decision.appliedHex);
      expect(surface).toBe(match.surfaceColor.toLowerCase());
      expect(throughDesigner?.dlcCrop?.solidColor?.toLowerCase(), style.ourName ?? "").toBe(surface);
      expect(throughDesigner?.doorUrl, style.ourName ?? "").toBe(plan?.doorUrl);
      const snapped = brandDoorSurfaceHex(surface);
      if (!brandSurface.has(surface)) expect(surface).not.toBe(snapped);
    }

    for (const style of styles.filter((item) => shakerDoorFamily(item.doorStyle) === "slim-shaker" || shakerDoorFamily(item.doorStyle) === "double-shaker")) {
      expect(standardShakerDlFacePlan(style, "base"), style.ourName ?? "").toBeNull();
    }
    expect(standardShakerDlFacePlan({ doorStyle: "Shaker", railWidth: 2.25, color: "#f4f1ea" }, "base")).toBeNull();
    const stone = styles.find((style) => style.id === 360001);
    expect(stone).toBeTruthy();
    expect(standardShakerDlFacePlan(stone, "base")?.dlcCrop?.solidColor).toBe("#8d8f92");
    expect(brandDoorSurfaceHex("#8d8f92")).not.toBe("#8d8f92");
    // A stored gray hex with no gray name stays that hex. Slate Rift's name
    // estimates gray and must not become brand green.
    expect(standardShakerDlFacePlan({ doorStyle: "Shaker", railWidth: 3, ourName: "Stored Hex", color: "#555553" }, "base")?.dlcCrop?.solidColor).toBe("#555553");
    const slate = standardShakerDlFacePlan({ doorStyle: "Shaker", railWidth: 3, ourName: "Slate Rift", color: "#555553" }, "base");
    expect(slate?.dlcCrop?.solidColor).not.toBe("#244338");
    expect(["#555553", "#8d8f92"]).toContain(slate?.dlcCrop?.solidColor);
    // Switching door styles changes the painted color.
    const sage = styles.find((style) => style.id === 330005);
    expect(standardShakerDlFacePlan(sage, "base")?.dlcCrop?.solidColor).not.toBe(
      standardShakerDlFacePlan(stone, "base")?.dlcCrop?.solidColor,
    );
    // The door editor's render hex wins over the swatch and is not snapped.
    const edited = standardShakerDlFacePlan({ ...stone, renderHex: "#555553" }, "base");
    expect(edited?.dlcCrop?.solidColor).toBe("#555553");
    for (const color of ["#1f4e8c", "#2a8c8c", "#5a8f3a"]) {
      const plan = standardShakerDlFacePlan({ doorStyle: "Shaker", railWidth: 3, ourName: "Off Brand", color }, "base");
      expect(plan?.dlcCrop?.solidColor, color).toBe(color);
      expect(brandSurface.has(plan?.dlcCrop?.solidColor ?? "")).toBe(false);
    }
  });
});
