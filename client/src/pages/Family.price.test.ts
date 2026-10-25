import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./Family.tsx", import.meta.url), "utf8");

describe("Family catalog customer pricing", () => {
  it("marks products without an approved price as quote-only rather than suggesting a price is available", () => {
    expect(source).toContain('lang === "es" ? "Cotización requerida" : "Quote required"');
    expect(source).toContain("Ask your Cabinet Dealz team for current availability and pricing.");
    expect(source).not.toContain('lang === "es" ? "Ver precio" : "View pricing"');
  });

  it("keeps quantity and Add to cart controls behind a resolved customer price", () => {
    expect(source).toContain("{unitPrice != null && (");
    expect(source).toContain('lang === "es" ? "Añadir al carrito" : "Add to cart"');
  });
});
