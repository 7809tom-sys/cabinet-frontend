import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const mobileSaveSection = source.slice(
  source.indexOf("{/* Save / open plans"),
  source.indexOf("{/* Section popup launchers"),
);

describe("mobile Kitchen Package save action", () => {
  it("offers every authorized publisher the same Kitchen Package action as desktop", () => {
    expect(mobileSaveSection).toContain("{canPublishKitchenPackage && (");
    expect(mobileSaveSection).toContain("Publish as Kitchen Package");
    expect(mobileSaveSection).toContain("setBundleDialogOpen(true)");
  });
});
