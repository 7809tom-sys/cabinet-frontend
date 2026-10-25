import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "client/src/components/admin/BulkDimensionsAdmin.tsx"),
  "utf8",
);

describe("BulkDimensionsAdmin parcel eligibility", () => {
  it("uses only supplier package dimensions and packaged weight for carrier screening", () => {
    expect(source).toContain('import { evaluateParcelEligibility } from "@shared/parcelEligibility"');
    expect(source).toContain("lengthIn: Number(row.pkgLength)");
    expect(source).toContain("widthIn: Number(row.pkgWidth)");
    expect(source).toContain("heightIn: Number(row.pkgHeight)");
    expect(source).toContain("weightLbs: Number(row.pkgWeight)");
    expect(source).toContain("hasAuthoritativePackage");
  });

  it("does not represent a carrier screen as a guaranteed price", () => {
    expect(source).toContain("Parcel badges are eligibility screens only");
    expect(source).toContain("checkout still requires a live UPS, FedEx, or USPS rate");
    expect(source).toContain("Carton data required");
    expect(source).toContain("Freight only");
    expect(source).toContain("USPS oversized; live rate required");
  });

  it("shows the accepted carrier set for a verified eligible carton", () => {
    expect(source).toContain("Parcel: {parcelEligibility.eligibleCarriers");
    expect(source).toContain("Carrier fit");
  });

  it("surfaces handling review without changing a parcel-eligible carton into freight-only", () => {
    expect(source).toContain("parcelEligibility.operationalWarnings.length > 0");
    expect(source).toContain("Carrier handling review required");
  });
});
