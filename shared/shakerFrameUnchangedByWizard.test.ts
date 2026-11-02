import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { standardShakerDlFacePlan } from "./shakerDoorBlueprint";
import { designerFacePlan } from "../client/src/lib/designerFacePlan";

/**
 * PR 209's DL shaker rule is unchanged by the WalzCraft wizard.
 *
 * The wizard adds one lookup at the top of designerFacePlan for doors it made; every other
 * door must still take exactly the path it took before. These assertions pin the DL
 * blueprint's own geometry and the 2.75/3 inch adoption so a future edit cannot drift it.
 */

const adminSource = readFileSync(resolve(process.cwd(), "client/src/components/admin/FeaturedStylesAdmin.tsx"), "utf8");
const blueprintSource = readFileSync(resolve(process.cwd(), "shared/shakerDoorBlueprint.ts"), "utf8");
const facePlanSource = readFileSync(resolve(process.cwd(), "client/src/lib/designerFacePlan.ts"), "utf8");

describe("PR 209 DL shaker frame stays unchanged", () => {
  it("keeps the shared DL geometry constants", () => {
    expect(blueprintSource).toContain('corners: "square"');
    expect(blueprintSource).toContain('center: "flat-slab"');
    expect(blueprintSource).toContain('notch: "shared-shaker-notch"');
    expect(blueprintSource).toContain("export const STANDARD_SHAKER_RAIL_IN = 3");
    expect(blueprintSource).toContain("export const SHAKER_BRAND_UI_PALETTE");
  });

  it("still adopts a 2.75 or 3 inch shaker onto the DL template", () => {
    const adopted = standardShakerDlFacePlan({ ourName: "White Shaker", doorStyle: "Shaker", railWidth: 3, color: "#e7eaef" }, "base");
    expect(adopted).not.toBeNull();
    expect(adopted!.dlcCrop?.slug).toBe("white-shaker");
    // A painted DL shaker is the blueprint's opaque solid, and the sides take the DL grain patch.
    expect(adopted!.doorUrl).toBeNull();
    expect(adopted!.drawerUrl).toBeNull();
    expect(adopted!.dlcCrop?.solidColor).toMatch(/^#[0-9a-f]{6}$/);
    const narrow = standardShakerDlFacePlan({ ourName: "White Shaker", doorStyle: "Shaker", railWidth: 2.75, color: "#e7eaef" }, "base");
    expect(narrow).not.toBeNull();
    expect(narrow!.dlcCrop?.slug).toBe("white-shaker");
    // Slim shaker is not the 2.75/3 inch blueprint and stays on its own path.
    expect(standardShakerDlFacePlan({ ourName: "Slim Cava", doorStyle: "Slim Shaker", railWidth: 2.25 }, "base")).toBeNull();
  });

  it("routes an untouched shaker through the blueprint, not the wizard", () => {
    const shaker = { id: 900001, ourName: "White Shaker", doorStyle: "Shaker", railWidth: 3, color: "#e7eaef" };
    const plan = designerFacePlan(shaker, "base");
    expect(plan).toEqual(standardShakerDlFacePlan(shaker, "base"));
    expect(plan!.dlcCrop?.slug).not.toBe("wizard-paint");
  });

  it("keeps the wizard lookup ahead of, and separate from, the DL blueprint", () => {
    // The wizard path runs first and returns null for a door it did not make, so the DL
    // blueprint below it is reached exactly as before.
    const wizardIndex = facePlanSource.indexOf("wizardDoorFacePlan(style, placement)");
    const dlcIndex = facePlanSource.indexOf("standardShakerDlFacePlan(style, placement)");
    expect(wizardIndex).toBeGreaterThan(-1);
    expect(dlcIndex).toBeGreaterThan(wizardIndex);
    expect(facePlanSource).toContain("const wizard = wizardDoorFacePlan(style, placement);");
    expect(facePlanSource).toContain("if (wizard) return wizard;");
  });

  it("leaves the door editor's existing brand-tinted UI alone", () => {
    // Brand colors are still used for UI chrome only; the wizard never snaps a door color to them.
    expect(adminSource).toContain("#244338");
    expect(adminSource).toContain("#fffdf9");
    const wizardSource = readFileSync(resolve(process.cwd(), "client/src/components/admin/DoorEditorWalzAudit.tsx"), "utf8");
    expect(wizardSource).not.toContain("brandDoorSurfaceHex");
    expect(wizardSource).not.toContain("SHAKER_BRAND_DOOR_SURFACE_PALETTE");
    // Nothing in the wizard writes a brand hex into the save.
    expect(wizardSource).not.toContain("#dedac6");
  });
});
