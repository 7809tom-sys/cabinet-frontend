import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const patch = readFileSync(resolve(process.cwd(), "docs/patches/cabinet-backend-pptx-viewer.patch"), "utf8");
const portal = readFileSync(resolve(process.cwd(), "client/src/components/affiliate/AffiliateMarketingHub.tsx"), "utf8");
const admin = readFileSync(resolve(process.cwd(), "client/src/components/admin/AffiliateLiteratureAdmin.tsx"), "utf8");

describe("backend patch for in-browser PowerPoint", () => {
  it("returns the stored upload time on publishedLiterature and adds no column", () => {
    expect(patch).toContain("affiliateResources.publishedLiterature");
    expect(patch).toContain("createdAt: row.createdAt");
    expect(patch).not.toMatch(/ADD COLUMN createdAt/i);
  });

  it("signs a short-lived URL only for a published affiliate row", () => {
    expect(patch).toContain("literatureSignedFile: protectedProcedure");
    expect(patch).toContain("isAffiliateLibraryDocument(row)");
    expect(patch).toContain('code: "NOT_FOUND"');
    expect(patch).toContain("storageGetSignedUrl(row.fileKey)");
    expect(patch).toContain("does not sign an internal document for an affiliate");
    expect(patch).toContain("does not sign a document unless visibility and isPublished both say affiliate library");
    expect(patch).toContain("caller.literatureSignedFile({ id: 5 })");
  });
});

describe("library pages call those procedures", () => {
  it("loads the affiliate portal library through publishedLiterature and literatureSignedFile", () => {
    expect(portal).toContain("trpc.affiliateResources.publishedLiterature.useQuery()");
    expect(portal).toContain("literatureSignedFile.fetch({ id })");
  });

  it("opens the admin affiliate library in the page through the admin signed link", () => {
    expect(admin).toContain("utils.affiliateResources.adminSignedFile.fetch({ id: item.id })");
    expect(admin).toContain("<PptxDeckViewer");
    expect(admin).toContain("formatUploadedLabel(item.createdAt)");
    expect(admin).not.toContain("href={item.url}");
    expect(admin).not.toContain("<a ");
  });
});
