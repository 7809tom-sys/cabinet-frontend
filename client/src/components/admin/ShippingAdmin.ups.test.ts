import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/components/admin/ShippingAdmin.tsx"), "utf8");

describe("ShippingAdmin direct UPS controls", () => {
  it("offers direct UPS as a live provider and saves the complete credential set together", () => {
    expect(source).toContain('value="ups"');
    expect(source).toContain("UPS Rating API (direct parcel)");
    expect(source).toContain("saveUpsCredentials");
    expect(source).toContain("Save UPS credentials");
    expect(source).toContain("Linked UPS account number");
    expect(source).toContain("UPS CIE sandbox (test)");
    expect(source).toContain("UPS production (live rates)");
  });

  it("makes the UPS secret write-only and documents the exact-carton safeguard", () => {
    expect(source).toContain("hasUpsClientSecret");
    expect(source).toContain("secret is write-only");
    expect(source).toContain("Exact-carton rule:");
    expect(source).toContain("no label, pickup, shipment, payment, or UPS account change");
  });
});
