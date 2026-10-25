import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./CabinetDetail.tsx", import.meta.url), "utf8");

describe("Cabinet Edit distributor override fields", () => {
  it("keeps master and distributor fields inside one scrollable edit workspace", () => {
    const scrollStart = source.indexOf('className="space-y-4 py-2 overflow-y-auto flex-1 min-h-0 pr-1"');
    const overrides = source.indexOf("Distributor Dimension Overrides");
    const footer = source.indexOf("<DialogFooter", overrides);
    expect(scrollStart).toBeGreaterThan(-1);
    expect(overrides).toBeGreaterThan(scrollStart);
    expect(overrides).toBeLessThan(footer);
  });

  it("moves the selected distributor's actual override inputs into view", () => {
    expect(source).toContain('id="distributor-override-editor"');
    expect(source).toContain('scrollIntoView({');
    expect(source).toContain("Editing dimensions for");
    expect(source).toContain("Fields below");
  });
});
