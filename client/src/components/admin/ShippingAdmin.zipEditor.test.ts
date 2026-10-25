import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/components/admin/ShippingAdmin.tsx"), "utf8");

describe("ShippingAdmin multi-ZIP zone editor", () => {
  it("provides an Add ZIP control, per-ZIP removal, and persists normalized comma-delimited values", () => {
    expect(source).toContain("Add ZIP");
    expect(source).toContain("Remove ZIP code");
    expect(source).toContain("serializeZipPrefixes(parseZipPrefixes(z.zipPrefixes))");
    expect(source).toContain("most specific matching entry still wins");
  });

  it("saves a successful ZIP addition or removal immediately instead of requiring a second Save zones action", () => {
    expect(source).toContain("function persistZones(nextZones: ZoneRow[], successMessage: string)");
    expect(source).toContain("persistZones(nextZones, `${zip} added and saved.`);");
    expect(source).toContain("persistZones(nextZones, `${zip} removed and saved.`);");
    expect(source).toContain("Each successful Add ZIP or remove action saves immediately.");
  });
});
