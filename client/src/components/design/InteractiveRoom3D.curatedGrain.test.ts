import { describe, expect, it } from "vitest";
import { isCuratedCabinetGrainSample } from "./InteractiveRoom3D";

describe("curated wood-grain samples", () => {
  it("recognises the existing rustic hickory grain file", () => {
    expect(isCuratedCabinetGrainSample("https://cdn.example/rustic_hickory_vertical_grain.jpg")).toBe(true);
    expect(isCuratedCabinetGrainSample("/manus-storage/media-library/123_rustic_hickory_vertical_grain")).toBe(true);
  });

  it("recognises any other wood's grain file, so new species work without a code change", () => {
    expect(isCuratedCabinetGrainSample("/uploads/hickory_vertical_grain.jpg")).toBe(true);
    expect(isCuratedCabinetGrainSample("/uploads/oak_horizontal_grain.png")).toBe(true);
    expect(isCuratedCabinetGrainSample("/uploads/grain_vertical_walnut.jpg")).toBe(true);
  });

  it("never treats a framed-door photo as grain", () => {
    expect(isCuratedCabinetGrainSample("/manus-storage/media-library/1785509155920_platinum_shaker_door_95fb6af8")).toBe(false);
    expect(isCuratedCabinetGrainSample("/manus-storage/media-library/hickory_shaker_door")).toBe(false);
    expect(isCuratedCabinetGrainSample("")).toBe(false);
    expect(isCuratedCabinetGrainSample(null)).toBe(false);
    expect(isCuratedCabinetGrainSample(undefined)).toBe(false);
  });
});
