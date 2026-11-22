import { describe, expect, it } from "vitest";
import { DEMO_CATALOG_SOURCE_ROWS } from "./demoDistributorCatalog.generated";
import { DEFAULT_ROOM, type PlacedCabinet } from "./design";
import { placeSinkOnBase } from "./sinkBaseSelection";
import { matchRollOutTray } from "./rollOutTrayMatch";
import {
  catalogTrayHeightIn,
  isBaseCabinetAttributeAddOnEligible,
  lookupRollOutTraySku,
  maxRollOutTraysForCabinet,
  type BaseCabinetAddOnTarget,
  type CatalogTraySource,
} from "./baseCabinetAttributeAddOns";

function base(partial: Partial<BaseCabinetAddOnTarget>): BaseCabinetAddOnTarget {
  return {
    placement: "base",
    category: "Base",
    subCategory: "Single Door Base",
    masterCode: "B24",
    description: '24" Base Cabinet',
    isCornerCabinet: false,
    nominalWidth: 24,
    width: 24,
    height: 34.5,
    numberOfDrawers: 1,
    ...partial,
  };
}

function lineRows(lineId: string, source: readonly CatalogTraySource[] = DEMO_CATALOG_SOURCE_ROWS): CatalogTraySource[] {
  return source.map((row) => ({ ...row, lineId }));
}

describe("base cabinet attribute add-on eligibility", () => {
  it("includes a standard base that is 21 inches or wider", () => {
    expect(isBaseCabinetAttributeAddOnEligible(base({ masterCode: "B21", nominalWidth: 21, width: 21 }))).toBe(true);
    expect(isBaseCabinetAttributeAddOnEligible(base({ masterCode: "B24", nominalWidth: 24, width: 24 }))).toBe(true);
    expect(isBaseCabinetAttributeAddOnEligible(base({ masterCode: "B36", nominalWidth: 36, width: 36, subCategory: "Sink Base" }))).toBe(true);
  });

  it("excludes bases under 21 inches", () => {
    expect(isBaseCabinetAttributeAddOnEligible(base({ masterCode: "B18", nominalWidth: 18, width: 18 }))).toBe(false);
    expect(isBaseCabinetAttributeAddOnEligible(base({ masterCode: "B15", nominalWidth: 15, width: 15 }))).toBe(false);
    expect(isBaseCabinetAttributeAddOnEligible(base({ masterCode: "B12", nominalWidth: 12, width: 12 }))).toBe(false);
  });

  it("excludes drawer bases", () => {
    expect(isBaseCabinetAttributeAddOnEligible(base({
      masterCode: "DB24",
      subCategory: "Drawer Base",
      description: '24" Drawer Base',
      numberOfDrawers: 3,
    }))).toBe(false);
    expect(isBaseCabinetAttributeAddOnEligible(base({
      masterCode: "3DB30",
      nominalWidth: 30,
      width: 30,
      subCategory: "Drawer Base",
      description: '30" 3 Drawer Base Cabinet',
    }))).toBe(false);
    expect(isBaseCabinetAttributeAddOnEligible(base({
      masterCode: "2DB24",
      subCategory: "Drawer Base",
      description: '24" 2 Drawer Base Cabinet',
    }))).toBe(false);
    expect(isBaseCabinetAttributeAddOnEligible(base({
      masterCode: "B24",
      subCategory: "Drawer Base",
      description: '24" Drawer Base',
      numberOfDrawers: 4,
    }))).toBe(false);
  });

  it("excludes corner bases", () => {
    for (const corner of [
      { masterCode: "LSB36", subCategory: "Lazy Susan Base", nominalWidth: 36, width: 36 },
      { masterCode: "ERB36", subCategory: "Easy Reach Base", nominalWidth: 36, width: 36 },
      { masterCode: "BER33", subCategory: "Easy Reach Base", nominalWidth: 33, width: 33 },
      { masterCode: "BBC42", subCategory: "Blind Corner Base", nominalWidth: 42, width: 42 },
      { masterCode: "BCB42", subCategory: "Blind Corner", nominalWidth: 42, width: 42 },
      { masterCode: "CDB36", subCategory: "Corner Drawer Base", nominalWidth: 36, width: 36 },
      { masterCode: "LS3612", subCategory: "Lazy Susan", nominalWidth: 36, width: 36 },
    ]) {
      expect(isBaseCabinetAttributeAddOnEligible(base(corner)), corner.masterCode).toBe(false);
    }
    expect(isBaseCabinetAttributeAddOnEligible(base({
      masterCode: "EC-36",
      subCategory: "Economy Corner",
      description: "Economy corner base",
      nominalWidth: 36,
      width: 36,
    }))).toBe(false);
  });

  it("excludes walls, tall cabinets, and the tray accessory itself", () => {
    expect(isBaseCabinetAttributeAddOnEligible(base({ placement: "wall", masterCode: "W3030", subCategory: "Wall" }))).toBe(false);
    expect(isBaseCabinetAttributeAddOnEligible(base({ placement: "tall", masterCode: "U249624", subCategory: "Pantry" }))).toBe(false);
    expect(isBaseCabinetAttributeAddOnEligible(base({ masterCode: "UNIV-ROT24", category: "Accessory", subCategory: "Rollout Tray" }))).toBe(false);
  });
});

describe("roll-out tray SKU lookup", () => {
  const whiteShaker = lineRows("white-shaker");

  it("reads the published universal tray height from the catalog description", () => {
    const row = DEMO_CATALOG_SOURCE_ROWS.find((item) => item.code === "UNIV-ROT24");
    expect(row).toBeTruthy();
    expect(catalogTrayHeightIn(row)).toBeCloseTo(2.25, 2);
    const shelf = DEMO_CATALOG_SOURCE_ROWS.find((item) => item.code === "RS24-TYPEA");
    expect(shelf).toBeTruthy();
    expect(catalogTrayHeightIn(shelf)).toBeCloseTo(3.375, 2);
  });

  it("matches a 24 inch base to the universal tray SKU in that line", () => {
    const match = lookupRollOutTraySku({ nominalWidth: 24, width: 24, lineId: "white-shaker" }, whiteShaker);
    expect(match.ok).toBe(true);
    if (!match.ok) return;
    expect(match.sku).toBe("UNIV-ROT24");
    expect(DEMO_CATALOG_SOURCE_ROWS.some((row) => row.code === match.sku)).toBe(true);
    expect(match.width).toBe(24);
    expect(match.height).toBeCloseTo(2.25, 2);
  });

  it("matches a 21 inch base to UNIV-ROT21 and a 36 inch base to UNIV-ROT36", () => {
    const twentyOne = lookupRollOutTraySku({ nominalWidth: 21, width: 21, lineId: "white-shaker" }, whiteShaker);
    const thirtySix = lookupRollOutTraySku({ nominalWidth: 36, width: 36, lineId: "white-shaker" }, whiteShaker);
    expect(twentyOne.ok && twentyOne.sku).toBe("UNIV-ROT21");
    expect(thirtySix.ok && thirtySix.sku).toBe("UNIV-ROT36");
  });

  it("uses the roll-out shelf SKU when that line has no universal tray for the opening", () => {
    const shelvesOnly = whiteShaker.filter((row) => row.code === "RS21-TYPEA" || row.code === "RS24-TYPEA");
    const match = lookupRollOutTraySku({ nominalWidth: 21, width: 21, lineId: "white-shaker" }, shelvesOnly);
    expect(match).toMatchObject({ ok: true, sku: "RS21-TYPEA", width: 21 });
  });

  it("picks the largest tray that fits when the line has no exact opening", () => {
    const match = lookupRollOutTraySku(
      { nominalWidth: 22, width: 22, lineId: "white-shaker" },
      whiteShaker.filter((row) => row.code === "UNIV-ROT18" || row.code === "UNIV-ROT21" || row.code === "UNIV-ROT24"),
    );
    expect(match).toMatchObject({ ok: true, sku: "UNIV-ROT21", width: 21 });
  });

  it("does not take a tray from a different line", () => {
    const match = lookupRollOutTraySku({ nominalWidth: 24, width: 24, lineId: "raised-panel" }, whiteShaker);
    expect(match).toEqual({ ok: false, reason: "This cabinet line has no roll-out tray SKU." });
  });

  it("disables the match when the line's catalog has no tray SKU", () => {
    const noTrays = whiteShaker.filter((row) => !/ROT|RS\d|roll-?out|rollout/i.test(`${row.code ?? ""} ${row.subCategory ?? ""} ${row.description ?? ""}`));
    const match = lookupRollOutTraySku({ nominalWidth: 24, width: 24, lineId: "white-shaker" }, noTrays);
    expect(match.ok).toBe(false);
    if (match.ok) return;
    expect(match.reason).toMatch(/no roll-out tray SKU/i);
  });

  it("disables the match when every tray in the line is wider than the cabinet", () => {
    const wideOnly = whiteShaker.filter((row) => row.code === "UNIV-ROT36");
    const match = lookupRollOutTraySku({ nominalWidth: 21, width: 21, lineId: "white-shaker" }, wideOnly);
    expect(match).toEqual({ ok: false, reason: 'No roll-out tray in this line fits a 21" cabinet.' });
  });

  it("keeps a same-style shelf and ignores another style", () => {
    const rows: CatalogTraySource[] = [
      { code: "RS-24", description: "Roll-out shelf 24", kind: "accessory", subCategory: "Roll-Out Shelf", width: 24, styleId: 11 },
      { code: "RS-30", description: "Roll-out shelf 30", kind: "accessory", subCategory: "Roll-Out Shelf", width: 30, styleId: 12 },
    ];
    expect(lookupRollOutTraySku({ width: 24, nominalWidth: 24, styleId: 11 }, rows)).toMatchObject({ ok: true, sku: "RS-24" });
    expect(lookupRollOutTraySku({ width: 24, nominalWidth: 24, styleId: 99 }, rows).ok).toBe(false);
  });
});

describe("how many trays the cabinet height allows", () => {
  it("fits three universal trays in a 34.5 inch base with a top drawer", () => {
    expect(maxRollOutTraysForCabinet({ height: 34.5, numberOfDrawers: 1, trayHeightIn: 2.25 })).toBe(3);
  });

  it("fits one more tray in a full-height base with no drawer", () => {
    expect(maxRollOutTraysForCabinet({ height: 34.5, numberOfDrawers: 0, trayHeightIn: 2.25 })).toBe(4);
  });

  it("fits fewer trays when the base is shorter", () => {
    expect(maxRollOutTraysForCabinet({ height: 24, numberOfDrawers: 1, trayHeightIn: 2.25 })).toBe(2);
    expect(maxRollOutTraysForCabinet({ height: 12, numberOfDrawers: 1, trayHeightIn: 2.25 })).toBe(0);
  });
});

describe("tray matching and sink placement for an eligible base", () => {
  it("still resolves a tray for a 21 inch base that has no door count", () => {
    const match = matchRollOutTray(
      {
        placement: "base",
        category: "Base",
        subCategory: "Base",
        masterCode: "B21",
        nominalWidth: 21,
        width: 21,
        numberOfDoors: 0,
      },
      [{ cabinetId: 3, masterCode: "RS-21", width: 21 }],
    );
    expect(match?.masterCode).toBe("RS-21");
  });

  it("places a verified sink on a standard 24 inch base and keeps an apron sink on the farmhouse path", () => {
    const standard = {
      uid: "b24",
      cabinetId: 24,
      masterCode: "B24",
      description: '24" Base Cabinet',
      category: "Base",
      subCategory: "Base",
      placement: "base",
      x: 10,
      y: 20,
      width: 24,
      depth: 24,
      height: 34.5,
      rotation: 0,
    } as unknown as PlacedCabinet;
    const placed = placeSinkOnBase({
      base: standard,
      room: DEFAULT_ROOM,
      roomType: "kitchen",
      product: { id: 9104, pelicanCode: "PL-HA104 R0 16G", name: "PL-HA104 R0 Stainless Steel Undermount Sink" },
      faucet: null,
    });
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    expect(placed.sink.cabinetUid).toBe("b24");
    expect(placed.sink.type).not.toBe("farmhouse");
    expect(placed.sink.apronFront).not.toBe(true);

    const wide = { ...standard, uid: "b36", masterCode: "B36", width: 36, nominalWidth: 36 } as PlacedCabinet;
    const farm = placeSinkOnBase({
      base: wide,
      room: DEFAULT_ROOM,
      roomType: "kitchen",
      product: { id: 9105, pelicanCode: "PL-HA128 R15", name: "PL-HA128 R15 Handmade Double-Bowl Farmhouse Sink" },
      faucet: null,
    });
    expect(farm.ok).toBe(true);
    if (!farm.ok) return;
    expect(farm.sink.type).toBe("farmhouse");
    expect(farm.sink.apronFront).toBe(true);
  });

  it("still refuses a drawer base and a base under 21 inches", () => {
    const drawer = {
      uid: "db24",
      cabinetId: 25,
      masterCode: "DB24",
      description: '24" Drawer Base',
      category: "Base",
      subCategory: "Drawer Base",
      placement: "base",
      x: 0,
      y: 0,
      width: 24,
      depth: 24,
      height: 34.5,
      rotation: 0,
    } as unknown as PlacedCabinet;
    const refused = placeSinkOnBase({
      base: drawer,
      room: DEFAULT_ROOM,
      roomType: "kitchen",
      product: { id: 9104, pelicanCode: "PL-HA104 R0 16G", name: "PL-HA104" },
      faucet: null,
    });
    expect(refused.ok).toBe(false);

    const narrow = { ...drawer, uid: "b18", masterCode: "B18", description: '18" Base Cabinet', subCategory: "Base", width: 18 } as PlacedCabinet;
    const tooSmall = placeSinkOnBase({
      base: narrow,
      room: DEFAULT_ROOM,
      roomType: "kitchen",
      product: { id: 9104, pelicanCode: "PL-HA104 R0 16G", name: "PL-HA104" },
      faucet: null,
    });
    expect(tooSmall.ok).toBe(false);
  });
});
