import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./PlanCanvas.tsx", import.meta.url), "utf8");

describe("PlanCanvas filler gap preview", () => {
  it("renders non-interactive highlighted ghost filler pieces before placement", () => {
    expect(source).toContain("fillerGapPreview?: readonly PlacedCabinet[]");
    expect(source).toContain("fillerGapPreview = []");
    expect(source).toContain("data-testid=\"plan-filler-gap-preview\"");
    expect(source).toContain("Filler {formatInches(preview.width)}");
    expect(source).toContain("pointer-events-none");
    expect(source).toContain("border-dashed border-amber-500");
  });
});
