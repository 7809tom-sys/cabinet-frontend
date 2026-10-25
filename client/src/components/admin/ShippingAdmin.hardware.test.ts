import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./ShippingAdmin.tsx", import.meta.url), "utf8");
const hardwareProfile = source.slice(
  source.indexOf("function HardwareResourcesShippingProfile"),
  source.indexOf("interface SettingsForm"),
);

describe("hardware one-package shipping editor", () => {
  it("shows the vendor-profile ZIP as the immutable shipment origin and does not collect a per-handle package limit", () => {
    expect(hardwareProfile).toContain("Vendor profile ZIP");
    expect(hardwareProfile).toContain("one consolidated package regardless of handle count");
    expect(hardwareProfile).toContain("profileQuery.data?.vendorOriginZip");
    expect(hardwareProfile).not.toContain("Origin ZIP</Label><Input");
    expect(hardwareProfile).not.toContain("One-package item limit");
    expect(hardwareProfile).not.toContain("maxUnitsPerPackage");
  });
});
