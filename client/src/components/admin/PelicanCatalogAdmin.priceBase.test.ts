import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./PelicanCatalogAdmin.tsx", import.meta.url), "utf8");

describe("Pelican catalog administration price base", () => {
  it("shows the same verified positive source base used by public price resolvers", () => {
    expect(source).toContain('from "../../../../shared/surfacePricing"');
    expect(source).toContain("authorizedSurfacePriceBasis(it)");
    expect(source).toContain(">Verified Source Price<");
    expect(source).toContain('"Verified cost"');
    expect(source).toContain('"Supplier list"');
    expect(source).not.toContain("money(it.yourCost ?? it.listPrice)");
  });

  it("exposes a dedicated source-price audit instead of making unpriced records public", () => {
    expect(source).toContain("const [unpricedOnly, setUnpricedOnly] = useState(false)");
    expect(source).toContain("unpricedOnly,");
    expect(source).toContain('aria-label="Show only items missing a verified source price"');
    expect(source).toContain("Needs source price");
    expect(source).toContain("No unpriced surface items remain in this audit scope.");
  });

  it("shows a clear admin-only note when a catalog-visible SKU still needs an authorized price", () => {
    expect(source).toContain("data-testid={`pelican-price-required-${it.id}`}");
    expect(source).toContain("Needs authorized price");
    expect(source).toContain("Public reference only — enter a verified cost or supplier list.");
    expect(source).toContain("This item remains quote-only and outside the Designer.");
  });

  it("edits only verified source cost or supplier list inputs and reports automatic unpublication", () => {
    expect(source).toContain("trpc.pelican.setPricing.useMutation");
    expect(source).toContain("Verified Source Price");
    expect(source).toContain("Verified cost for ${it.name}");
    expect(source).toContain("Supplier list price for ${it.name}");
    expect(source).toContain("No positive verified source price remains. This item is now unavailable and unpublished.");
    expect(source).toContain("Blank keeps the existing source value. Saving both fields as 0 makes the item unavailable.");
    expect(source).not.toContain("setPricing.mutate({ id: it.id, sellPrice");
  });
});
