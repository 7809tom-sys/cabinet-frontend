import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./CrmBoard.tsx", import.meta.url), "utf8");

describe("CRM Quick PDF Invoice shipping UI", () => {
  it("renders shipping separately from the cabinet order and kitchen design lines", () => {
    expect(source).toContain('lineFor(shipping.enabled, label("Shipping", "Envío"), shipping.amount)');
    expect(source).toContain('title={label("Shipping", "Envío")}');
    expect(source).toContain('label("Kitchen Design", "Diseño de cocina")');
  });

  it("explains missing authoritative amounts instead of presenting a zero price", () => {
    expect(source).toContain('emptyAmountLabel={label("Not priced", "Sin precio")}');
    expect(source).toContain('emptyAmountLabel={label("Quote required", "Cotización requerida")}');
    expect(source).toContain("prefill?.shippingNote");
  });

  it("routes an unpriced linked plan back to the saved Designer plan rather than inventing an invoice value", () => {
    expect(source).toContain("This plan needs a verified cart/order subtotal before it can be invoiced.");
    expect(source).toContain("href={selectedDesign.designUrl}");
    expect(source).toContain("Open plan to prepare the order");
  });
});
