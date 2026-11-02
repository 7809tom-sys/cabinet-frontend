import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve(__dirname, "DesignTool.tsx"), "utf8");

describe("DesignTool decorative trim selection", () => {
  it("turns crown on for wall and tall runs unless the shopper turned it off", () => {
    expect(source).toContain("Crown follows wall and tall runs unless the shopper turned it off.");
    expect(source).toContain("if (trimOverride.current.crown) return;");
    expect(source).toContain('if (placed.some((item) => item.placement === "wall" || item.placement === "tall")) setCrown(true);');
    expect(source).not.toContain("if (!o.crown && hasWallCab && !crown) setCrown(true);");
  });

  it("does not restore crown from legacy automatic drafts", () => {
    expect(source).toContain('setCrown(wasManuallyChosen("crown") && d.crown === true);');
    expect(source).toContain('if (wasManuallyChosen("crown")) trimOverride.current.crown = true;');
  });
});
