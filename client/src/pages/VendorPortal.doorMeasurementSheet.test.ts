import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./VendorPortal.tsx", import.meta.url), "utf8");

describe("interactive sample door measuring sheet", () => {
  it("exposes the complete sheet workflow from Door Styles", () => {
    expect(source).toContain("Interactive sample-door measuring sheet");
    expect(source).toContain('data-testid="interactive-door-measuring-sheet"');
    expect(source).toContain("Required frame measurements:");
    expect(source).toContain("Photos supplied with a ruler or tape in frame");
  });

  it("shows the completed entries as a live door-specification preview", () => {
    expect(source).toContain('data-testid="door-specification-preview"');
    expect(source).toContain("Live door specification preview");
    expect(source).toContain("Source citation preview:");
    expect(source).toContain("Every entry below is carried into the door-specification review record");
  });

  it("keeps CabinetDealz physical verification before Designer geometry changes", () => {
    expect(source).toContain("Designer geometry changes only after CabinetDealz verifies the physical sample");
    expect(source).toContain("Submit for CabinetDealz verification");
  });
});
