import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dialog = readFileSync(new URL("./SurfacesPickerDialog.tsx", import.meta.url), "utf8");
const designTool = readFileSync(new URL("../../pages/DesignTool.tsx", import.meta.url), "utf8");

describe("Designer lists the whole Pelican catalog", () => {
  it("reads the full storefront catalog for the kitchen palette instead of the pre-filtered designer scope", () => {
    expect(dialog).toContain('scope: "catalog" as const');
    expect(dialog).not.toContain('scope: "designer"');
    expect(dialog).toContain("const catalogPage3Enabled");
  });

  it("pages past the 200-row endpoint cap so large categories are complete", () => {
    expect(dialog).toContain("offset: PAGE_LIMIT");
    expect(dialog).toContain("offset: PAGE_LIMIT * 2");
    expect(dialog).toContain("catalogPage3?.items");
  });

  it("merges the bathroom family catalog into each bathroom tab", () => {
    expect(dialog).toContain("const bathroomFamilyCatalog = trpc.pelican.byCategory.useQuery");
    expect(dialog).toContain("bathroomFamilyCatalogPage2.data?.items");
    expect(dialog).toContain('case "toilet-bidet": return "Toilets & Bidets"');
    expect(dialog).toContain('case "shower-door":');
  });

  it("keeps an unmeasured catalog item on the materials list without inventing a 3D body", () => {
    expect(designTool).toContain("if (!verifiedPelicanSinkProfile(item.pelicanCode))");
    expect(designTool).toContain("if (!verifiedPelicanFaucetProfile(item.pelicanCode))");
    expect(designTool).toContain("Pelican publishes no measured bowl for this model");
  });
});
