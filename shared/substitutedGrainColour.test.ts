/**
 * A 2.75/3 inch shaker from a non-DL distributor borrows a DL finish's grain as
 * a template. Two things used to go wrong with that substitution, and both hit
 * Natura Maple (Ashford `Designer Natural`, 330004):
 *
 * 1. `retintGrain` measured the tint in sRGB and clamped at 255. A door lighter
 *    than its template grain therefore got `#ffffff` — no tint at all — so the
 *    door never reached its own recorded colour.
 * 2. The DL photo light compensation was applied to the substituted grain. That
 *    compensation is calibrated against a DL finish's own studio photo, and it
 *    darkened a door it was never measured from.
 *
 * Measured in the real Designer pipeline, those two together took Natura Maple
 * from #D4B896 to a muddy #776d5a: ΔE2000 26.7 from the door's own colour.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import catalog from "./fixtures/doorStyleSideCatalog.json";
import { deltaE2000Hex } from "./ciede2000";
import { designerFacePlan } from "../client/src/lib/designerFacePlan";
import { dlcPhotoCompensationApplies } from "./dlcFr26Textures";
import { findDlcFinishForStyle } from "./dlcFr26Mapping";
import { resolveDoorColor } from "./doorColorResolve";
import { retintGrain, standardShakerDlFacePlan } from "./shakerDoorBlueprint";

type CatalogStyle = {
  id: number;
  distributorId: number;
  styleCode?: string;
  ourName?: string;
  aliasName?: string;
  color?: string;
  finish?: string;
  doorStyle?: string;
  woodSpecies?: string;
};

const styles = catalog as CatalogStyle[];
const NATURA_MAPLE_ID = 330004;

/** A #rrggbb hex as linear light, the space a material colour multiplies in. */
function linear(hex: string): [number, number, number] {
  const channel = (i: number) => {
    const value = Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return [channel(0), channel(1), channel(2)];
}

function toHex(linearRgb: readonly number[]): string {
  const encode = (value: number) => {
    const clamped = Math.min(1, Math.max(0, value));
    const srgb = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;
    return Math.round(srgb * 255).toString(16).padStart(2, "0");
  };
  return `#${linearRgb.map(encode).join("")}`;
}

describe("a substituted grain reaches the door's own colour", () => {
  it("returns a linear-light multiplier that a hex cannot express", () => {
    // Natura Maple's colour is lighter than Versa Shaker's grain, so every sRGB
    // channel overflows and the old helper clamped to #ffffff (no tint).
    const tint = retintGrain("#c7b695", "#d4b896");
    expect(tint.tintHex).toBe("#ffffff");
    expect(tint.clamped).toBe(true);
    // The unclamped linear multiplier is above 1 on the red channel: the door
    // needs more light than the template grain carries.
    expect(tint.tintLinear[0]).toBeGreaterThan(1);
    expect(tint.tintLinear.every((value) => Number.isFinite(value) && value > 0)).toBe(true);
  });

  it("lands on the door colour when the grain is multiplied in linear light", () => {
    const reference = "#c7b695";
    const target = "#d4b896";
    const tint = retintGrain(reference, target);
    const grain = linear(reference);
    const rendered = toHex(grain.map((value, index) => value * tint.tintLinear[index]!));
    // A flat mid-grey grain becomes the door colour exactly.
    expect(rendered).toBe(target);
    expect(deltaE2000Hex(rendered, target)).toBeLessThan(0.5);
  });
});

describe("Natura Maple is never compensated against a photo it never had", () => {
  it("marks the borrowed DL grain and skips the DL photo light compensation", () => {
    const style = styles.find((entry) => entry.id === NATURA_MAPLE_ID)!;
    expect(style.aliasName).toContain("Natura Maple");
    // It is an Ashford door, so no DL finish of its own is mapped.
    expect(findDlcFinishForStyle(style)).toBeNull();

    const crop = designerFacePlan(style, "base")?.dlcCrop;
    expect(crop).toBeTruthy();
    expect(crop!.grainSubstituted).toBe(true);
    expect(crop!.tintLinear).not.toBeNull();
    expect(dlcPhotoCompensationApplies(crop)).toBe(false);
  });

  it("keeps the DL photo compensation on a real DL finish", () => {
    const versa = styles.find((entry) => entry.id === 600004)!;
    expect(findDlcFinishForStyle(versa)?.slug).toBe("versa-shaker");
    const crop = designerFacePlan(versa, "base")?.dlcCrop;
    expect(crop).toBeTruthy();
    expect(crop!.grainSubstituted).toBeUndefined();
    expect(dlcPhotoCompensationApplies(crop)).toBe(true);
  });

  it("carries the door's own recorded colour, never a brand or template swatch", () => {
    const style = styles.find((entry) => entry.id === NATURA_MAPLE_ID)!;
    const decision = resolveDoorColor(style);
    const crop = standardShakerDlFacePlan(style, "base")?.dlcCrop;
    expect(crop?.solidColor).toBe(decision.appliedHex);
    expect(crop?.solidColor.toLowerCase()).toBe("#d4b896");
    // Versa Shaker's grain template is a darker tone; it is not the door colour.
    expect(crop?.solidColor.toLowerCase()).not.toBe("#c7b695");
  });

  it("states the substitution in the renderer instead of compensating for it", () => {
    const source = readFileSync(new URL("../client/src/components/design/InteractiveRoom3D.tsx", import.meta.url), "utf8");
    // The compensation must be gated on the crop, not on the presence of a solid colour.
    expect(source).toContain("dlcPhotoCompensationApplies(surfaceTextures?.faceCrop)");
    expect(source).not.toContain("const dlcPhotoComp = dlcDoorFinish\n");
    // A borrowed grain keeps the scene tone map and takes the linear multiplier.
    expect(source).toContain("applyGrainTemplateTint(faceMaterial)");
    expect(source).toContain("applyGrainTemplateTint(trimMaterial)");
  });
});
