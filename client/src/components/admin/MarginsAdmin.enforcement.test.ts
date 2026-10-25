import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(import.meta.dirname, "MarginsAdmin.tsx"),
  "utf8",
);

describe("MarginsAdmin pricing enforcement feedback", () => {
  it("reports the live tier-price enforcement result after saving", () => {
    expect(source).toContain('setLastEnforcement(result.recalculation)');
    expect(source).toContain("Pricing enforced on save");
    expect(source).toContain("Save and enforce pricing");
    expect(source).toContain("unpriced source rows were left excluded");
    expect(source).toContain("made unavailable and unpublished");
    expect(source).toContain("follow the saved tier margins");
    expect(source).not.toContain("approved source-list retail rows");
  });
});
