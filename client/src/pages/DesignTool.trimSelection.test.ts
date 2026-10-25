import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve(__dirname, "DesignTool.tsx"), "utf8");

describe("DesignTool decorative trim selection", () => {
  it("keeps crown opt-in instead of adding it when a wall cabinet exists", () => {
    expect(source).toContain("Crown, batten, and valances remain opt-in");
    expect(source).not.toContain("if (!o.crown && hasWallCab && !crown) setCrown(true);");
    expect(source).not.toMatch(/setCrown\(true\)/);
  });

  it("does not restore crown from legacy automatic drafts", () => {
    expect(source).toContain('setCrown(wasManuallyChosen("crown") && d.crown === true);');
    expect(source).toContain('if (wasManuallyChosen("crown")) trimOverride.current.crown = true;');
  });
});
