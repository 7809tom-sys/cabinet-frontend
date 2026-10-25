import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./CabinetDrawing.tsx", import.meta.url), "utf8");

describe("CabinetDrawing flat panel library", () => {
  it("draws a panel as a flat structural elevation without cabinet fronts", () => {
    expect(source).toContain('case "panel":');
    expect(source).toContain("FlatPanelFront");
    expect(source).toContain('data-cabinet-drawing="flat-panel"');
  });
});
