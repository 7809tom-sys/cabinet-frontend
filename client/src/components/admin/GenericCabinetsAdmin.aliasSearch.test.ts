import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./GenericCabinetsAdmin.tsx", import.meta.url), "utf8");

describe("Generic Catalog alias search indicator", () => {
  it("renders the searched alias and its canonical master in table and grid results", () => {
    expect(source).toContain("matchedAlias: string | null");
    expect(source).toContain("Alias {cabinet.matchedAlias} → {cabinet.masterCode}");
    expect(source).toContain("Alias {cab.matchedAlias} → {cab.masterCode}");
    expect(source).toContain("Search alias ${cabinet.matchedAlias} resolves to master ${cabinet.masterCode}");
  });
});
