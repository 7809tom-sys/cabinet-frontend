import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/components/design/IslandAttributesDialog.tsx"), "utf8");

describe("IslandAttributesDialog waterfall prompt", () => {
  it("asks for an optional physical left or right island waterfall end", () => {
    expect(source).toContain('data-testid="island-waterfall-prompt"');
    expect(source).toContain("Add a waterfall?");
    expect(source).toContain('value="left"');
    expect(source).toContain('value="right"');
	    expect(source).toContain('value="both"');
	    expect(source).toContain('waterfallEnd: value as "none" | "left" | "right" | "both"');
  });

  it("updates the accessible island-edge preview before Apply", () => {
    expect(source).toContain('data-testid="island-waterfall-live-preview"');
    expect(source).toContain("Live island preview");
    expect(source).toContain('draft.waterfallEnd === "left"');
    expect(source).toContain('draft.waterfallEnd === "right"');
    expect(source).toContain('aria-label="Left waterfall edge"');
    expect(source).toContain('aria-label="Right waterfall edge"');
	    expect(source).toContain('draft.waterfallEnd === "both"');
  });
});
