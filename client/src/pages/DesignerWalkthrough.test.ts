import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/DesignerWalkthrough.tsx"), "utf8");

describe("DesignerWalkthrough", () => {
  it("provides the complete kitchen workflow from room size through saving", () => {
    expect(source).toContain('number: "01"');
    expect(source).toContain('number: "08"');
    expect(source).toContain("Set your room size");
    expect(source).toContain("Build each wall run");
    expect(source).toContain("Review the complete plan");
    expect(source).toContain("Save and continue later");
  });

  it("publishes a public HowTo schema and links customers into the Designer", () => {
    expect(source).toContain('"@type": "HowTo"');
    expect(source).toContain('canonical = `${publicOrigin()}/designer-guide`');
    expect(source).toContain('actionHref: "/design"');
    expect(source).toContain('aria-label="Designer walkthrough steps"');
  });
});
