import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DoorStyleIdentity, doorStyleCardIdentity } from "./DoorStyleIdentity";

const LONG_NAME = "Luxe Classic LSA with an extra long merchandising name that must stay fully visible on a phone";

describe("door style card identity", () => {
  it("shows the door style name, style code, and supplier line", () => {
    expect(doorStyleCardIdentity({
      ourName: "Luxe Classic LSA",
      aliasName: "Luxe Classic LSA",
      styleCode: "LSA",
      distributorName: "Luxe Classic LSA",
      supplierBrandName: "US Cabinet Depot",
    })).toEqual({
      name: "Luxe Classic LSA",
      styleCode: "LSA",
      extras: ["US Cabinet Depot"],
    });
  });

  it("keeps a distinct customer label without replacing the working name", () => {
    expect(doorStyleCardIdentity({
      ourName: "Luxe Classic LSA",
      featuredLabel: "Coastal Gloss",
      styleCode: "LSA",
      detail: "Shaker",
    })).toEqual({
      name: "Luxe Classic LSA",
      styleCode: "LSA",
      extras: ["Coastal Gloss", "Shaker"],
    });
  });

  it("does not repeat the style code when it is already the whole name", () => {
    expect(doorStyleCardIdentity({ ourName: "LSA", styleCode: " lsa " })).toEqual({
      name: "LSA",
      styleCode: null,
      extras: [],
    });
  });

  it("falls back to the style code when the name fields are blank", () => {
    expect(doorStyleCardIdentity({ ourName: "  ", styleCode: "LSA", distributorName: "Line A" })).toEqual({
      name: "LSA",
      styleCode: null,
      extras: ["Line A"],
    });
  });

  it("renders the full name and code as wrapping text", () => {
    const html = renderToStaticMarkup(
      <DoorStyleIdentity
        style={{ ourName: LONG_NAME, styleCode: "LSA", supplierName: "US Cabinet Depot" }}
      />,
    );
    expect(html).toContain(LONG_NAME);
    expect(html).toContain(">LSA<");
    expect(html).toContain("US Cabinet Depot");
    expect(html).toContain("break-words");
    expect(html).not.toContain("truncate");
    expect(html).not.toContain("line-clamp");
    expect(html).not.toContain("whitespace-nowrap");
  });
});

describe("featured and door-style cards show the identity up front", () => {
  const vendor = readFileSync(resolve(process.cwd(), "client/src/pages/VendorPortal.tsx"), "utf8");
  const admin = readFileSync(resolve(process.cwd(), "client/src/components/admin/FeaturedStylesAdmin.tsx"), "utf8");
  const doorStyles = vendor.slice(vendor.indexOf("function DoorStylesPage"), vendor.indexOf("type DoorMeasurementStyle"));
  const featured = vendor.slice(vendor.indexOf("function VendorFeaturedStylesPage"), vendor.indexOf("// ─── Shipping Page"));

  it("places a wrapping identity on vendor Door Styles and Featured Styles", () => {
    expect(doorStyles).toContain("<DoorStyleIdentity");
    expect(doorStyles).toContain('nameAs="h3"');
    expect(doorStyles).toContain("styleCode: style.styleCode");
    expect(doorStyles).not.toContain("truncate");
    expect(featured).toContain("<DoorStyleIdentity");
    expect(featured).toContain("styleCode: style.styleCode");
    expect(featured).not.toContain("truncate text-sm font-medium");
  });

  it("places a wrapping identity on every admin Featured Door Styles card", () => {
    expect(admin).toContain("<DoorStyleIdentity");
    expect(admin).not.toContain("font-medium text-sm truncate");
    const featuredList = admin.slice(admin.indexOf("Featured Door Styles ({featured.length})"), admin.indexOf("All door styles"));
    const available = admin.slice(admin.indexOf("All door styles"), admin.indexOf("Inactive styles"));
    const inactive = admin.slice(admin.indexOf("Inactive styles"), admin.indexOf("Catalog preview modal"));
    for (const section of [featuredList, available, inactive]) {
      expect(section).toContain("<DoorStyleIdentity");
      expect(section).not.toContain("truncate");
    }
  });
});
