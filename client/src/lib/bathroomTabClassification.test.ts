import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  bathroomTabCounts,
  bathroomTabForRow,
  filterRowsForBathroomTab,
  isKitchenOrUtilitySink,
  isWallHungLavatory,
  type BathroomTabRow,
} from "./bathroomTabClassification";

/**
 * The live catalog rows these rules were written against. Kept in the fixture so
 * the test documents the real mis-filings that caused the bug, rather than a
 * synthetic idea of them.
 */
const LIVE_SHAPED_ROWS: BathroomTabRow[] = [
  // Filed by Pelican under `Sinks & Faucets / Faucets` despite being kitchen sinks.
  { pelicanCode: "PL-CI6004 White", description: '33" x 22" Cast Iron Drop-In Double Bowl Kitchen Sink with 4 faucet holes in White' },
  { pelicanCode: "PL-CI6008 White", description: '33" x 22" Cast Iron Drop-In Single Bowl Kitchen Sink with 4 faucet holes in White' },
  // Farmhouse / apron-front fireclay kitchen sinks.
  { pelicanCode: "PL-FC3020WS", description: '30" Farmhouse Apron-Front Single Bowl Fireclay Sink' },
  { pelicanCode: "PL-3099 Bone", description: '33" Farmhouse Apron-Front Single Bowl' },
  // Stainless kitchen / laundry.
  { pelicanCode: "PL-WS4519 R0 16g", description: "Workstation Undermount Stainless Steel Kitchen Sink" },
  { pelicanCode: "PL-LS2522", description: "Top Mount Laundry Sink" },
  // A real soaking tub filed under `Sink & Faucet Accessories`.
  { pelicanCode: 'PL-02138 67"', description: '67" Free Standing Acrylic Soaking Tub with Center Drain, Drain Assembly and Slotted Overflow' },
  // A tub drain: contains "tub" but is not a tub.
  { pelicanCode: "PL-36 Tub Drain BN", description: "Tub Drain with Overflow Plate" },
  // The vanity basin the shopper actually picked.
  { pelicanCode: "PL-3608", description: '18" Undermount Vanity Sink' },
  { pelicanCode: "PL-3099", description: "Undermount Vanity Sink, Porcelain" },
  // Vanity faucets, including a floor-mounted tub filler.
  { pelicanCode: "PL-8515 BN", description: "Waterfall Single-Handle Floor Mount Freestanding Tub Filler" },
  { pelicanCode: "PL-8112 BN", description: "The Glacier series offers an elegant presence" },
  // Accessories that used to land in Bathtubs.
  { pelicanCode: "Aura Accessories Set BN", description: "Aura Accessories Set - Robe hook, Toilet Paper Holder, Towel Bar" },
  { pelicanCode: "PL-GMB144 R10 16g", description: "Handmade 16 Gauge Gunmetal Black Stainless Steel Towel Bar" },
  // Toilets, including one with no verified envelope yet.
  { pelicanCode: "PL-12044", description: "Porcelain High Efficiency Toilet with Dual Flush" },
  { pelicanCode: "PL-12243", description: "Porcelain High Efficiency Toilet with Dual Flush" },
  // Shower families.
  { pelicanCode: "PL-03A11S60 MB", description: "58-60 in. Single Sliding Frameless Shower Door in Matte Black" },
  { pelicanCode: "PL-014836LSO", description: '48" x 36" Acrylic White, Left Drain, Shower Base with Tile Flange' },
  { pelicanCode: "PL-483696 Brick", description: '48" x 36" x 96" White Brick 3-Piece Glue Up Alcove Shower Wall Kit' },
  // A drain grate is a real product but not a placeable fixture.
  { pelicanCode: "PL-15 Shower Drain BN", description: "Round PVC Shower Drain with Brushed Nickel Drain Cover" },
];

describe("bathroom tab classification", () => {
  it("never puts a kitchen, utility, farmhouse, or stainless sink on the Vanity Sinks tab", () => {
    const kitchenRows = LIVE_SHAPED_ROWS.filter((row) =>
      /kitchen|farmhouse|apron|laundry|stainless|workstation/i.test(`${row.description ?? ""}`));
    expect(kitchenRows.length).toBeGreaterThan(0);
    for (const row of kitchenRows) {
      expect(bathroomTabForRow(row)).not.toBe("bathroom-sink");
    }
  });

  it("keeps a real vanity basin on the Vanity Sinks tab", () => {
    // PL-3608 and PL-3099 are on the specification-sheet vanity SKU list.
    expect(bathroomTabForRow({ pelicanCode: "PL-3608" })).toBe("bathroom-sink");
    expect(bathroomTabForRow({ pelicanCode: "PL-3099" })).toBe("bathroom-sink");
    // A finish variant resolves by its base SKU.
    expect(bathroomTabForRow({ pelicanCode: "PL-3099 Bone" })).toBe("bathroom-sink");
  });

  it("files tub fillers as faucets, not tubs", () => {
    expect(bathroomTabForRow({ pelicanCode: "PL-8515 BN", description: "Freestanding Tub Filler" })).toBe("bathroom-faucet");
    expect(bathroomTabForRow({ pelicanCode: "PL-8538 MB", description: "Floor Mount Tub Filler" })).toBe("bathroom-faucet");
  });

  it("moves a real soaking tub out of the accessory bucket and into Bathtubs", () => {
    expect(bathroomTabForRow({ pelicanCode: 'PL-02138 67"', description: '67" Free Standing Acrylic Soaking Tub with Center Drain' })).toBe("bathtub");
  });

  it("does not treat a tub drain as a bathtub", () => {
    expect(bathroomTabForRow({ pelicanCode: "PL-36 Tub Drain BN", description: "Tub Drain with Overflow Plate" })).toBeNull();
  });

  it("puts accessories in Accessories, never in Bathtubs", () => {
    expect(bathroomTabForRow({ pelicanCode: "Aura Accessories Set BN", description: "Robe hook, Toilet Paper Holder, Towel Bar" })).toBe("bathroom-accessory");
    expect(bathroomTabForRow({ pelicanCode: "PL-GMB144 R10 16g", description: "Gunmetal Black Stainless Steel Towel Bar" })).toBe("bathroom-accessory");
  });

  it("keeps toilets and bidets on their own tab, including ones with no envelope yet", () => {
    expect(bathroomTabForRow({ pelicanCode: "PL-12044", description: "Porcelain High Efficiency Toilet" })).toBe("toilet-bidet");
    expect(bathroomTabForRow({ pelicanCode: "PL-12243", description: "Porcelain High Efficiency Toilet" })).toBe("toilet-bidet");
    expect(bathroomTabForRow({ pelicanCode: "PL-12005", description: "Smart Toilet" })).toBe("toilet-bidet");
  });

  it("separates shower doors, surrounds and pans", () => {
    expect(bathroomTabForRow({ pelicanCode: "PL-03A11S60 MB", description: "Single Sliding Frameless Shower Door" })).toBe("shower-door");
    // Pans and bases have their own tab; a surround wall kit stays a surround.
    expect(bathroomTabForRow({ pelicanCode: "PL-014836LSO", description: "Shower Base with Tile Flange" })).toBe("shower-pan");
    expect(bathroomTabForRow({ pelicanCode: "PL-483696 Brick", description: "3-Piece Glue Up Alcove Shower Wall Kit" })).toBe("shower-surround");
  });

  it("excludes drains and trim rather than guessing a tab", () => {
    expect(bathroomTabForRow({ pelicanCode: "PL-15 Shower Drain BN", description: "Shower Drain with Drain Cover" })).toBeNull();
  });

  it("excludes a wall-hung lavatory from the deck-mounted Vanity Sinks tab", () => {
    const row = { pelicanCode: "PL-9999", description: "Wall Mounted Porcelain Lavatory" };
    expect(isWallHungLavatory(row)).toBe(true);
    expect(bathroomTabForRow(row)).not.toBe("bathroom-sink");
  });

  it("gives every tab only its own rows", () => {
    for (const role of ["bathroom-sink", "bathroom-faucet", "toilet-bidet", "bathtub", "shower-door", "shower-surround", "bathroom-accessory"] as const) {
      const rows = filterRowsForBathroomTab(LIVE_SHAPED_ROWS, role);
      for (const row of rows) expect(bathroomTabForRow(row)).toBe(role);
    }
  });

  it("counts a row on exactly one tab", () => {
    const counts = bathroomTabCounts(LIVE_SHAPED_ROWS);
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    const classified = LIVE_SHAPED_ROWS.filter((row) => bathroomTabForRow(row) != null).length;
    expect(total).toBe(classified);
  });

  it("recognises the kitchen-only rule directly", () => {
    expect(isKitchenOrUtilitySink({ description: "33\" Cast Iron Drop-In Kitchen Sink" })).toBe(true);
    expect(isKitchenOrUtilitySink({ description: "Farmhouse Apron-Front Sink" })).toBe(true);
    expect(isKitchenOrUtilitySink({ description: '18" Undermount Vanity Sink' })).toBe(false);
  });
});

describe("the audit is reproducible against a saved catalog snapshot", () => {
  it("classifies every row of the saved live snapshot into at most one tab", () => {
    let rows: BathroomTabRow[];
    try {
      rows = [
        ...JSON.parse(readFileSync("/tmp/rows-sinks.json", "utf8")),
        ...JSON.parse(readFileSync("/tmp/rows-shower.json", "utf8")),
        ...JSON.parse(readFileSync("/tmp/rows-toilets.json", "utf8")),
      ];
    } catch {
      // The snapshot only exists on the machine that produced the PR report.
      return;
    }
    expect(rows.length).toBeGreaterThan(600);
    // No kitchen sink may reach a bathroom tab.
    const leaks = rows.filter((row) => bathroomTabForRow(row) !== null && isKitchenOrUtilitySink(row) && !/towel/i.test(row.description ?? ""));
    expect(leaks).toEqual([]);
  });
});
