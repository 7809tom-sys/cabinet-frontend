import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./PlanCanvas.tsx", import.meta.url), "utf8");

describe("Floor Plan side-gap bubbles", () => {
  it("does not draw the white clearance bubbles beside a selected or dragged cabinet", () => {
    expect(source).not.toContain("live-cabinet-gap-dimensions");
    expect(source).not.toContain("live-gap-dimension-bubble");
    expect(source).not.toContain("const dragTape =");
  });

  it("keeps the blue filler measurement labels", () => {
    expect(source).toContain('data-testid="bbc-filler-measurement-label"');
    expect(source).toContain('data-testid="measured-filler-measurement-label"');
  });
});
