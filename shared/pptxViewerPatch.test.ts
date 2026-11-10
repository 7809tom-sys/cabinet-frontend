import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const patch = readFileSync(resolve(process.cwd(), "docs/patches/cabinet-backend-pptx-viewer.patch"), "utf8");

describe("backend patch for in-browser PowerPoint", () => {
  it("returns the stored upload time on the affiliate library list", () => {
    expect(patch).toContain("createdAt: row.createdAt");
    expect(patch).not.toMatch(/ADD COLUMN createdAt/i);
  });

  it("gives affiliates a signed link and keeps internal decks hidden", () => {
    expect(patch).toContain("literatureSignedFile: protectedProcedure");
    expect(patch).toContain("isAffiliateLibraryDocument(row)");
    expect(patch).toContain('code: "NOT_FOUND"');
    expect(patch).toContain("storageGetSignedUrl(row.fileKey)");
  });
});
