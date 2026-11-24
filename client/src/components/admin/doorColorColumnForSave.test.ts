import { describe, expect, it } from "vitest";
import { doorColorColumnForSave } from "./doorColorColumnForSave";

describe("doorColorColumnForSave", () => {
  it("replaces a stale hex with the resolved paint-brand hex", () => {
    expect(doorColorColumnForSave({ saved: "#2d333f", confirmedSource: true, resolvedHex: "#353E47" })).toBe("#353e47");
  });
  it("fills a blank color from the resolved hex", () => {
    expect(doorColorColumnForSave({ saved: "", confirmedSource: true, resolvedHex: "#353e47" })).toBe("#353e47");
  });
  it("keeps a color name", () => {
    expect(doorColorColumnForSave({ saved: "Navy Blue", confirmedSource: true, resolvedHex: "#353e47" })).toBe("Navy Blue");
  });
  it("leaves the saved value alone with no confirmed source", () => {
    expect(doorColorColumnForSave({ saved: "#2d333f", confirmedSource: false, resolvedHex: "#353e47" })).toBe("#2d333f");
    expect(doorColorColumnForSave({ saved: "  ", confirmedSource: false, resolvedHex: "#353e47" })).toBeNull();
  });
});
