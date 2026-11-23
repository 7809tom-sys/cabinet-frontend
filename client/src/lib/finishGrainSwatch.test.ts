/**
 * Finish -> grain swatch (Tom, Nov 23 2026). EWO is the test style: its grain, normal map and
 * tile size reach the 3D renderer through the existing dlcCrop fields, never as a photo.
 */
import { describe, expect, it } from "vitest";
import { designerFacePlan } from "./designerFacePlan";
import { FINISH_GRAIN_SWATCH_SLUGS, grainSwatchForFinish } from "@shared/finishGrainSwatches";

const EWO_DL = { id: 450100, styleCode: "DL-EWO", ourName: "EWO", doorStyle: "Shaker", distributorId: 450001, woodSpecies: "European White Oak", color: "European White Oak", finish: "Stain" };
const EWO_OTHER = { id: 777001, styleCode: "XX", ourName: "European White Oak", doorStyle: "Shaker", distributorId: 210002, woodSpecies: "White Oak", finish: "Natural" };
const HONEY = { id: 330021, styleCode: "SH", ourName: "Shaker Honey", aliasName: "Honey Core (Madison)", doorStyle: "Shaker", woodSpecies: "Solid Birch", color: "SW 3122 Honey", finish: "UV Coated Natural" };

describe("finish grain swatches", () => {
  it("gives EWO its real grain, normal map and tile through dlcCrop (no photo)", () => {
    const plan = designerFacePlan(EWO_DL, "base");
    expect(plan?.dlcCrop?.slug).toBe("ewo");
    expect(plan?.dlcCrop?.grainUrl).toBe("/textures/dlc-fr26/grain/ewo-v.jpg");
    expect(plan?.dlcCrop?.normalUrl).toBe("/textures/dlc-fr26/grain/ewo-v-nm.png");
    expect(plan?.dlcCrop?.faceTileIn).toEqual([24, 24]);
    expect(plan?.doorUrl).toBe("/textures/dlc-fr26/grain/ewo-v.jpg");
  });

  it("ties a non-DL shaker named for a catalog finish to that finish's grain", () => {
    expect(grainSwatchForFinish(EWO_OTHER as never)?.slug).toBe("ewo");
    const plan = designerFacePlan(EWO_OTHER, "base");
    expect(plan?.dlcCrop?.normalUrl).toBe("/textures/dlc-fr26/grain/ewo-v-nm.png");
  });

  it("EWO with an accepted render keeps the grain, not the framed render photo", () => {
    const photo = "/manus-storage/accepted-ewo.png";
    const plan = designerFacePlan({ ...EWO_DL, approvedVersionId: 9, approvedReferenceImageUrl: photo, renderHex: "#c9b48e" }, "base");
    expect(plan?.doorUrl).not.toBe(photo);
    expect(plan?.dlcCrop?.grainUrl ?? plan?.dlcCrop?.solidColor).toBeTruthy();
  });

  it("a finish with no swatch keeps today's behavior (DL shaker template)", () => {
    expect(grainSwatchForFinish(HONEY as never)).toBeNull();
    const plan = designerFacePlan(HONEY, "base");
    expect(plan?.dlcCrop).toBeDefined();
  });

  it("does not name-match the generic '... Shaker' finishes", () => {
    for (const slug of ["white-shaker", "grey-shaker", "versa-shaker", "expresso-shaker", "slim-shaker-ebony"]) {
      expect([...FINISH_GRAIN_SWATCH_SLUGS.values()]).not.toContain(slug);
    }
  });

  it("never lists Pecan (no frame-free grain) or MC (unmapped)", () => {
    expect([...FINISH_GRAIN_SWATCH_SLUGS.values()]).not.toContain("peccan");
    expect([...FINISH_GRAIN_SWATCH_SLUGS.values()]).not.toContain("mc");
  });

  it("slim shaker and hickory are untouched", () => {
    expect(grainSwatchForFinish({ ...EWO_OTHER, doorStyle: "Slim Shaker" } as never)).toBeNull();
    expect(grainSwatchForFinish({ ...EWO_OTHER, woodSpecies: "Hickory" } as never)).toBeNull();
  });
});
