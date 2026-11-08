import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isBathroomVanityCabinet } from "./bathroomVanityCatalog";
import {
  bathroomVanityFaucetMatchNote,
  bathroomVanityFaucetOptions,
  bathroomVanitySinkOptions,
  isBathroomVanityFaucetRow,
  isBathroomVanitySinkRow,
  isDoubleBowlVanitySinkRow,
  vanitySinkFitsVanityWidth,
} from "./bathroomVanityCatalog";

const designTool = readFileSync(new URL("../pages/DesignTool.tsx", import.meta.url), "utf8");

type Row = { pelicanCode: string; name: string; bathroomFixtureTags?: string | null };

const row = (pelicanCode: string, bathroomFixtureTags?: string | null): Row => ({ pelicanCode, name: pelicanCode, bathroomFixtureTags });

describe("Bathroom Designer reads the Pelican vanity tags", () => {
  it("accepts a row on its tag even when the SKU list would not have matched", () => {
    expect(isBathroomVanitySinkRow(row("PL-NEW MODEL", "bathroom-vanity-sink,mount-vessel,bowl-single"))).toBe(true);
    expect(isBathroomVanityFaucetRow(row("PL-NEW TAP", "bathroom-vanity-faucet,faucet-holes-1"))).toBe(true);
  });

  it("falls back to the exact SKU when the tag column is absent, so an un-migrated API still works", () => {
    expect(isBathroomVanitySinkRow(row("PL-3099 White"))).toBe(true);
    expect(isBathroomVanityFaucetRow(row("PL-8330 BN"))).toBe(true);
  });

  it("never accepts a kitchen sink or kitchen faucet on its category or name", () => {
    expect(isBathroomVanitySinkRow({ pelicanCode: "PL-HA109 R0 16g", name: "Undermount Kitchen Sink", bathroomFixtureTags: null })).toBe(false);
    expect(isBathroomVanityFaucetRow({ pelicanCode: "PL-8237 BN", name: "Kitchen Faucet", bathroomFixtureTags: "sink" })).toBe(false);
  });

  it("offers every vanity sink for an ordinary vanity width, and drops a double-bowl basin from a narrow vanity", () => {
    const rows = [
      row("PL-3099 White", "bathroom-vanity-sink,mount-undermount,bowl-single"),
      row("PL-R4922W", "bathroom-vanity-sink,mount-integrated,bowl-single,faucet-holes-3"),
      row("PL-WIDE DOUBLE", "bathroom-vanity-sink,mount-undermount,bowl-double"),
      row("PL-HA109 R0 16g"),
    ];
    expect(bathroomVanitySinkOptions(rows, 30).map((item) => item.pelicanCode)).toEqual(["PL-3099 White", "PL-R4922W"]);
    expect(bathroomVanitySinkOptions(rows, 60).map((item) => item.pelicanCode)).toEqual(["PL-3099 White", "PL-R4922W", "PL-WIDE DOUBLE"]);
    expect(isDoubleBowlVanitySinkRow(row("PL-WIDE DOUBLE", "bowl-double"))).toBe(true);
    expect(vanitySinkFitsVanityWidth(row("PL-WIDE DOUBLE", "bowl-double"), 47)).toBe(false);
    expect(vanitySinkFitsVanityWidth(row("PL-WIDE DOUBLE", "bowl-double"), 48)).toBe(true);
    // A single-bowl basin has no width gate at all.
    expect(vanitySinkFitsVanityWidth(row("PL-3099 White", "bowl-single"), 18)).toBe(true);
  });

  it("offers every category of vanity faucet when no basin is chosen yet", () => {
    const rows = [
      row("PL-8107 BN", "bathroom-vanity-faucet,faucet-holes-1"),
      row("PL-8330 BN", "bathroom-vanity-faucet,faucet-holes-3,faucet-spread-4"),
      row("PL-8312 BN", "bathroom-vanity-faucet,faucet-holes-3,faucet-spread-8"),
      row("PL-8207 BN"),
    ];
    expect(bathroomVanityFaucetOptions(rows).map((item) => item.pelicanCode)).toEqual(["PL-8107 BN", "PL-8330 BN", "PL-8312 BN"]);
    expect(bathroomVanityFaucetOptions(rows).length).toBeGreaterThan(1);
  });

  it("narrows the faucets to the chosen basin's drilling", () => {
    const rows = [
      row("PL-8107 BN"),
      row("PL-8330 BN"),
      row("PL-8312 BN"),
    ];
    // PL-1011 Spread 4" publishes a 4" spread, so only the centerset survives.
    expect(bathroomVanityFaucetOptions(rows, 'PL-1011 Spread 4"').map((item) => item.pelicanCode)).toEqual(["PL-8330 BN"]);
    // PL-1011 Spread 8" publishes an 8" spread.
    expect(bathroomVanityFaucetOptions(rows, 'PL-1011 Spread 8"').map((item) => item.pelicanCode)).toEqual(["PL-8312 BN"]);
    // A single-hole basin takes only a single-hole faucet.
    expect(bathroomVanityFaucetOptions(rows, "PL-5053-1").map((item) => item.pelicanCode)).toEqual(["PL-8107 BN"]);
    // An undermount basin is drilled in the counter, so all three stay available.
    expect(bathroomVanityFaucetOptions(rows, "PL-3099 White")).toHaveLength(3);
  });

  it("says out loud when the basin's hole spacing is not published", () => {
    expect(bathroomVanityFaucetMatchNote("PL-R4922W")).toContain("does not publish the hole spacing");
    expect(bathroomVanityFaucetMatchNote('PL-1011 Spread 4"')).toContain("4″ centers");
    expect(bathroomVanityFaucetMatchNote("PL-3099 White")).toContain("drilled in the countertop");
    expect(bathroomVanityFaucetMatchNote(null)).toBeNull();
  });

  it("wires both pickers to the tags instead of the old three-SKU predicates", () => {
    // What fits a base is decided in one module the picker also filters with, so
    // the bathroom tags stay the authority for a vanity, and an apron-front base
    // in the same bathroom still reads its own family.
    const selection = readFileSync(new URL("./sinkBaseSelection.ts", import.meta.url), "utf8");
    expect(designTool).toContain("isBathroomVanitySinkRow");
    expect(designTool).toContain("sinkRowFitsBase");
    expect(designTool).toContain("faucetRowFitsBase");
    expect(designTool).toContain("bathroomVanityFaucetOptions([product], pendingSinkProduct?.pelicanCode)");
    expect(designTool).toContain("bathroomVanityFaucetMatchNote(pendingSinkProduct?.pelicanCode)");
    expect(selection).toContain("isBathroomVanitySinkRow");
    expect(selection).toContain("isBathroomVanityFaucetRow");
    expect(selection).toContain("vanitySinkFitsVanityWidth");
    expect(designTool).not.toContain("? isVerifiedPelicanVanitySink(product.pelicanCode)");
    expect(designTool).not.toContain("? isVerifiedPelicanVanityFaucet(product.pelicanCode)");
  });
});

// Kept from the original file: the Vanity tab still selects source-categorized,
// placeable vanity cabinets, and this change does not touch that rule.
const cabinet = (category: string | null, description: string, placement: "base" | "wall" | "accessory", subCategory: string | null = null) => ({
  category, description, placement, subCategory,
});

describe("Bathroom Vanity cabinet catalog", () => {
  it("includes source-category vanity bases, sink bases, drawer bases and combos", () => {
    for (const description of ["Vanity Sink Base", "Vanity Drawer Base", "Vanity Combo Base", "ADA Vanity Base"]) {
      expect(isBathroomVanityCabinet(cabinet("Vanity", description, "base"))).toBe(true);
    }
  });

  it("never includes a kitchen base, vanity-described accessory, wall item or decorative valance", () => {
    expect(isBathroomVanityCabinet(cabinet("Base", "Vanity-style kitchen base", "base"))).toBe(false);
    expect(isBathroomVanityCabinet(cabinet("Accessory", "For use with vanity", "accessory"))).toBe(false);
    expect(isBathroomVanityCabinet(cabinet("Vanity", "Wall cabinet", "wall"))).toBe(false);
    expect(isBathroomVanityCabinet(cabinet("Vanity", "Arched valance", "base"))).toBe(false);
  });
});
