import { describe, expect, it } from "vitest";
import catalog from "./fixtures/doorStyleSideCatalog.json";
import { resolveDoorColor, type DoorColorInput } from "./doorColorResolve";
import { isSlabDoor } from "./slabGrainApply";
import {
  framelessGrains,
  grainByCode,
  matchSavePatch,
  previewRotationDegrees,
  sortDoorsForReplicate,
  suggestWizardMatch,
} from "./wizardDoorMatch";

const styles = catalog as DoorColorInput[];
const BRAND = ["#dedac6", "#fffdf9", "#f6f3ed", "#244338", "#d7a46c"];

describe("wizard door match", () => {
  it("suggests Stone Gray as paint #8d8f92 and does not pick a grain", () => {
    const stone = styles.find((style) => style.id === 360001)!;
    const suggestion = suggestWizardMatch(stone);
    expect(suggestion.finish).toBe("paint");
    expect(suggestion.hex).toBe("#8d8f92");
    expect(suggestion.note).toMatch(/Not applied/);
    expect(BRAND).not.toContain(suggestion.hex);
    expect(resolveDoorColor({ ...stone, renderHex: "#555553" }).appliedHex).toBe("#555553");
  });

  it("keeps a hickory door on its photo and does not brand-snap the suggestion", () => {
    const hickory = styles.find((style) => style.id === 330007)!;
    const suggestion = suggestWizardMatch({ ...hickory, doorSampleImageUrl: "/uploads/hickory-door.jpg" });
    expect(suggestion.hickoryPhoto).toBe(true);
    expect(suggestion.finish).toBe("stain");
    expect(suggestion.note).toMatch(/door photo/);
    expect(BRAND).not.toContain(suggestion.hex);
  });

  it("lists frameless grains with their real orientation and photos, including Dark Wood", () => {
    const grains = framelessGrains();
    expect(grains.length).toBe(49);
    expect(grainByCode("TWP")).toMatchObject({ orientation: "horizontal", hasGrain: true });
    expect(grainByCode("TGW")).toMatchObject({ orientation: "horizontal", photoUrl: "/walzcraft/doors/altaeuro-tgw.webp" });
    expect(grainByCode("TDW")).toMatchObject({ orientation: "horizontal", photoUrl: "/walzcraft/doors/altaeuro-tdw.webp" });
    expect(grainByCode("LSR")).toMatchObject({ orientation: "vertical", hasGrain: true });
    expect(grainByCode("LSP")?.orientation).toBe("vertical");
    expect(grainByCode("ZCC")).toMatchObject({ hasGrain: false, orientation: null });
    expect(grainByCode("PGW")?.hasGrain).toBe(false);
    expect(isSlabDoor({ ourName: "Dark Wood", styleCode: "TDW", doorStyle: "Slab" })).toBe(true);
    expect(previewRotationDegrees("horizontal", null)).toBe(0);
    expect(previewRotationDegrees("horizontal", "horizontal")).toBe(0);
    expect(previewRotationDegrees("horizontal", "vertical")).toBe(90);
  });

  it("flags a disagreed swatch and lets the owner hex override a wrong Slim Cava reading", () => {
    const versa = styles.find((style) => style.id === 600004)!;
    const flagged = suggestWizardMatch(versa);
    expect(flagged.needsColorReview).toBe(true);
    const slim = styles.find((style) => style.id === 540040)!;
    expect(suggestWizardMatch(slim).hex).toBe("#f2f0ea");
    const patch = matchSavePatch({ hex: "#5a4632", grainCode: "TGW", orientation: "horizontal" });
    expect(patch).toEqual({ renderHex: "#5a4632", woodSpecies: "Grey Wood", grainDirection: "horizontal" });
    expect(patch).not.toHaveProperty("finishCategory");
    expect(patch).not.toHaveProperty("grainLightHex");
  });

  it("sorts other doors with the same distributor first and copies the same patch", () => {
    const doors = [
      { id: 2, distributorId: 9, ourName: "Other line" },
      { id: 3, distributorId: 4, ourName: "Zebra" },
      { id: 1, distributorId: 4, ourName: "Alpha" },
      { id: 8, distributorId: 4, ourName: "Current" },
    ];
    expect(sortDoorsForReplicate(doors, 8, 4).map((door) => door.id)).toEqual([1, 3, 2]);
    const patch = matchSavePatch({ hex: "#8d8f92", grainCode: "ZCC", orientation: "vertical" });
    expect(patch).toEqual({ renderHex: "#8d8f92", woodSpecies: null, grainDirection: "none" });
  });
});
