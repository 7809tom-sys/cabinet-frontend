import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/components/design/IslandElevationView.tsx"), "utf8");

describe("IslandElevationView selected Toe Kick finish", () => {
  it("uses a visible cabinet-finish strip when selected and retains the dark recessed fallback otherwise", () => {
    expect(source).toContain('data-selected-toe-kick-finish={toeKick ? "true" : "false"}');
    expect(source).toContain("background: toeKick");
    expect(source).toContain("color-mix(in srgb, ${cabFinish.face} 88%, #ffffff)");
    expect(source).toContain("#1a1a1a 0%, #2a2a2a 60%, #1e1e1e 100%");
  });
});
