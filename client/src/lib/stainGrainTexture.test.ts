/**
 * Honey Core (Tom's 9:59 AM CT screenshot): the 3D doors were a flat, pale tan on the
 * borrowed Versa grain with a >1 linear multiplier under ACES. The Designer now hands 3D a
 * pre-tinted, hi-res stain texture drawn like a DL photo crop.
 */
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { designerFacePlan } from "@/lib/designerFacePlan";
import { dlcPhotoCompensationApplies } from "@shared/dlcFr26Textures";
import {
  __setStainTextureBuilderForTests,
  stainTextureKeyFor,
  withPretintedStainGrain,
  type StainTextureKey,
} from "@/lib/stainGrainTexture";

/** Honey Core (Madison) as cabinet-backend doorStyles.list answered it on Nov 20 2026. */
const HONEY_CORE = {
  id: 330021,
  distributorId: 210002,
  styleCode: "SH",
  ourName: "Shaker Honey",
  aliasName: "Honey Core (Madison)",
  doorStyle: "Shaker",
  woodSpecies: "Solid Birch frame / veneered center panel",
  finish: "Honey Core (Madison)",
  color: "#C8A040",
  renderHex: "#dbbb92",
  doorSampleImageUrl: "/manus-storage/media-library/1785512205261_shaker_honey_door_19c306bb",
  drawerSampleImageUrl: "/manus-storage/media-library/1785512216074_shaker_honey_drawer_40bc29c9",
  railWidth: "2.75",
  stileWidth: "2.75",
  grainDirection: "none",
};

afterEach(() => __setStainTextureBuilderForTests(null));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("Honey Core gets a pre-tinted stain texture in 3D and elevation", () => {
  it("before the texture is ready: the old borrowed-grain plan (no regression while it builds)", () => {
    const requested: StainTextureKey[] = [];
    __setStainTextureBuilderForTests(async (key) => { requested.push(key); return null; });
    const plan = designerFacePlan(HONEY_CORE as never, "base")!;
    expect(plan.dlcCrop?.grainSubstituted).toBe(true);
    expect(plan.dlcCrop?.slug).toBe("versa-shaker");
    expect(requested).toHaveLength(1);
    expect(requested[0]!.hex).toBe(plan.dlcCrop!.solidColor.toLowerCase());
  });

  it("once built: the stain's own texture, no multiplier, drawn on the DL photo path, with relief", async () => {
    __setStainTextureBuilderForTests(async (key) => ({ door: `blob:door-${key.slug}`, drawer: `blob:drawer-${key.slug}`, normal: "blob:normal", slug: key.slug }));
    designerFacePlan(HONEY_CORE as never, "base");
    await flush();
    const plan = designerFacePlan(HONEY_CORE as never, "base")!;
    expect(plan.doorUrl).toMatch(/^blob:door-/);
    expect(plan.drawerUrl).toMatch(/^blob:drawer-/);
    expect(plan.dlcCrop!.grainUrl).toBe(plan.doorUrl);
    expect(plan.dlcCrop!.tintLinear).toBeNull();
    expect(plan.dlcCrop!.tintHex).toBeNull();
    expect(plan.dlcCrop!.grainSubstituted).toBe(false);
    expect(plan.dlcCrop!.normalUrl).toBe("blob:normal");
    // The existing (non-frozen) gate for light compensation + tone mapping off now applies.
    expect(dlcPhotoCompensationApplies(plan.dlcCrop)).toBe(true);
    // The colour is unchanged: still the door's resolved colour.
    expect(plan.dlcCrop!.solidColor.toLowerCase()).toBe("#dbbb92");
  });

  it("a wall cabinet gets no drawer texture", async () => {
    __setStainTextureBuilderForTests(async (key) => ({ door: "blob:d", drawer: "blob:w", normal: "blob:n", slug: key.slug }));
    designerFacePlan(HONEY_CORE as never, "wall");
    await flush();
    expect(designerFacePlan(HONEY_CORE as never, "wall")!.drawerUrl).toBeNull();
  });

  it("paint, real DL photo crops and door photos are left alone", () => {
    expect(stainTextureKeyFor(null)).toBeNull();
    expect(stainTextureKeyFor({ sourceKind: "split", doorUrl: "/x.png", drawerUrl: null, sections: 1, drawerTextureApplied: false, grainRotation: 0 })).toBeNull();
    const dlPhoto = { sourceKind: "split", doorUrl: "/g.png", drawerUrl: null, sections: 1, drawerTextureApplied: false, grainRotation: 0, dlcCrop: { slug: "chestnut", doorSize: [1, 1], drawerSize: null, drawerSolidColor: null, solidColor: "#656363", grainUrl: "/g.png" } } as never;
    expect(withPretintedStainGrain(dlPhoto)).toBe(dlPhoto);
  });

  it("does not touch the frozen 3D file", () => {
    const source = readFileSync(new URL("./stainGrainTexture.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/from\s+"@\/components\/design\/InteractiveRoom3D"/);
  });
});
