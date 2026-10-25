import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("VendorPortal new-product form", () => {
  const source = readFileSync(resolve(process.cwd(), "client/src/pages/VendorPortal.tsx"), "utf8");
  const formSource = source.slice(source.indexOf("function NewProductForm"));

  it("does not render a Cabinet ID field and sends no cabinetId from the new-product form", () => {
    expect(formSource).not.toMatch(/<label[^>]*>Cabinet ID/);
    expect(formSource).not.toContain("form.cabinetId");
    expect(formSource).not.toMatch(/cabinetId:\s*Number\(form\./);
  });

  it("uses List Price or Your Cost as the only new-product price inputs", () => {
    expect(formSource).toContain("List Price");
    expect(formSource).toContain("Your Cost");
    expect(formSource).toContain("Enter a List Price or Your Cost");
    expect(formSource).not.toContain("Wholesale Price");
    expect(formSource).not.toContain("Contractor Price");
    expect(formSource).not.toContain("Homeowner Price");
  });

  it("explains that unmatched supplier SKUs are allowed for approval", () => {
    expect(formSource).toContain("Enter any supplier SKU");
    expect(formSource).toContain("Master-cabinet matching is optional");
    expect(source).toContain("Pending master-cabinet mapping");
  });
});
