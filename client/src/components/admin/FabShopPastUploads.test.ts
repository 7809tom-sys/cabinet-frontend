import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { undoImportPrompt } from "./FabShopPastUploads";

describe("fabrication shop past uploads", () => {
  it("says exactly what an undo removes", () => {
    expect(undoImportPrompt({ sourceDoc: "Quartz Fabricators in Florida", shops: 562, quoteMatches: 0 }))
      .toBe('Remove 562 shops from "Quartz Fabricators in Florida" and 0 quote matches? This can\'t be undone.');
    expect(undoImportPrompt({ sourceDoc: "FL list", shops: 1, quoteMatches: 1 }))
      .toBe('Remove 1 shop from "FL list" and 1 quote match? This can\'t be undone.');
  });

  it("sends the shown count so a stale screen can't remove more", () => {
    const source = readFileSync(new URL("./FabShopPastUploads.tsx", import.meta.url), "utf8");
    expect(source).toContain("confirmCount: upload.shops");
    expect(source).toContain("utils.fabShops.imports.invalidate()");
    expect(readFileSync(new URL("./FabricationShopsAdmin.tsx", import.meta.url), "utf8")).toContain("<FabShopPastUploads />");
  });
});
