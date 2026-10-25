import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { shipToLines, totalPieces } from "@/lib/vendorShippingDocs";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Vendor portal Fulfillment wiring", () => {
  const portal = read("client/src/pages/VendorPortal.tsx");

  it("adds a Fulfillment page to the portal navigation", () => {
    expect(portal).toContain('"fulfillment"');
    expect(portal).toContain('{ id: "fulfillment", label: "Fulfillment", icon: PackageCheck }');
    expect(portal).toContain("<VendorFulfillmentQueue");
  });

  it("limits a Pelican vendor to the five pages that apply to surfaces and fixtures", () => {
    expect(portal).toContain('new Set<VendorPage>(["overview", "supplier-profile", "catalog", "shipping", "fulfillment"])');
    expect(portal).toContain("NAV_ITEMS.filter((item) => PELICAN_NAV_IDS.has(item.id))");
  });

  it("does not trap a Pelican vendor on the profile-only page, and sends cabinet-only deep links home", () => {
    expect(portal).toContain("!isPelicanVendor");
    expect(portal).toContain('isPelicanVendor && !PELICAN_NAV_IDS.has(page) ? "overview" : page');
  });

  it("decides Pelican identity on the server, never from a display name", () => {
    expect(portal).toContain('option.scope === "pelican"');
  });
});

describe("Print documents", () => {
  const docs = read("client/src/lib/vendorShippingDocs.ts");

  it("builds the ship-to block from the order, skipping blanks", () => {
    expect(
      shipToLines({
        customerName: "Sample Customer",
        shipTo: { line1: "100 Example Street", line2: null, city: "Tampa", state: "FL", zip: "33602" },
      }),
    ).toEqual(["Sample Customer", "100 Example Street", "Tampa, FL 33602"]);
    expect(shipToLines({ customerName: null, shipTo: { line1: null, line2: null, city: null, state: null, zip: null } })).toEqual([]);
  });

  it("counts pieces across lines", () => {
    expect(totalPieces([{ sku: "A", description: "", qty: 2, doorStyle: null }, { sku: "B", description: "", qty: 3, doorStyle: null }])).toBe(5);
  });

  it("never prints prices and keeps the print tab openable", () => {
    expect(docs).not.toMatch(/unitPrice|linePrice|totalAmount|\$\{.*price/i);
    expect(docs).toContain('window.open("", "_blank")');
    expect(docs).not.toContain("noopener,noreferrer");
  });
});
