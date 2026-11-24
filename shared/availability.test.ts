import { describe, it, expect } from "vitest";
import { US_ZIP3_CENTROIDS } from "./data/usZip3Centroids";
import {
  haversineMiles,
  normalizeZip,
  approxZipCentroid,
  nearestWarehouseMiles,
  pickNearestWarehouseZip,
  isWithinRadius,
  DEFAULT_SERVICE_RADIUS_MI,
  type WarehouseRef,
} from "./availability";

describe("normalizeZip", () => {
  it("extracts a 5-digit zip from various inputs", () => {
    expect(normalizeZip("75234")).toBe("75234");
    expect(normalizeZip("75234-1234")).toBe("75234");
    expect(normalizeZip("Dallas, TX 75234")).toBe("75234");
    expect(normalizeZip("  33054  ")).toBe("33054");
  });
  it("returns null for non-zip input", () => {
    expect(normalizeZip("")).toBeNull();
    expect(normalizeZip("abc")).toBeNull();
    expect(normalizeZip(null)).toBeNull();
  });
});

describe("haversineMiles", () => {
  it("is ~0 for identical points", () => {
    expect(haversineMiles({ lat: 32.8, lng: -96.8 }, { lat: 32.8, lng: -96.8 })).toBeLessThan(0.01);
  });
  it("approximates a known distance (Dallas → Houston ≈ 225 mi)", () => {
    const d = haversineMiles({ lat: 32.78, lng: -96.8 }, { lat: 29.76, lng: -95.37 });
    expect(d).toBeGreaterThan(200);
    expect(d).toBeLessThan(260);
  });
});

const FREIGHT_ORIGIN_ZIPS = [
  "60448", // Mokena IL
  "43213", // Columbus OH
  "75234", // Dallas TX
  "77064", // Houston TX
  "85043", // Phoenix AZ
  "32824", // Orlando FL
  "32822", // Orlando FL
  "30071", // Norcross GA
  "02766", // Norton MA
  "60446", // Romeoville IL
  "23005", // Ashland VA
  "33073", // Coconut Creek / Pompano Beach FL
  "92337", // Fontana CA
  "77038", // Houston TX
  "84043", // Lehi UT
  "27406", // Greensboro NC
  "95691", // West Sacramento CA
];

function placedOrigins(zips: string[]): WarehouseRef[] {
  return zips.map((zip) => ({ zip, coord: approxZipCentroid(zip) }));
}

function pickOrigin(destinationZip: string, originZips: string[]): string | null {
  return pickNearestWarehouseZip(approxZipCentroid(destinationZip), placedOrigins(originZips));
}

describe("approxZipCentroid", () => {
  it("covers every US ZIP3 prefix that has a published point", () => {
    expect(Object.keys(US_ZIP3_CENTROIDS)).toHaveLength(916);
    for (const [prefix, coord] of Object.entries(US_ZIP3_CENTROIDS)) {
      expect(prefix).toMatch(/^\d{3}$/);
      expect(coord.lat).toBeGreaterThanOrEqual(-90);
      expect(coord.lat).toBeLessThanOrEqual(90);
      expect(coord.lng).toBeGreaterThanOrEqual(-180);
      expect(coord.lng).toBeLessThanOrEqual(180);
    }
  });

  it("resolves seeded warehouse prefixes and the freight origin ZIPs", () => {
    expect(approxZipCentroid("75234")).not.toBeNull(); // Dallas
    expect(approxZipCentroid("32401")).not.toBeNull(); // Panama City
    expect(approxZipCentroid("30024")).not.toBeNull(); // Suwanee GA
    for (const zip of FREIGHT_ORIGIN_ZIPS) {
      expect(approxZipCentroid(zip), zip).not.toBeNull();
    }
    for (const zip of ["34229", "32801", "33602", "33101", "60601", "30303", "43215"]) {
      expect(approxZipCentroid(zip), zip).not.toBeNull();
    }
  });

  it("does not invent a point for a military or unassigned prefix", () => {
    expect(approxZipCentroid("09001")).toBeNull();
    expect(approxZipCentroid("96201")).toBeNull();
    expect(approxZipCentroid("34301")).toBeNull();
  });
});

describe("availability radius", () => {
  it("a Dallas customer is in range of a Dallas warehouse", () => {
    const cust = approxZipCentroid("75201"); // Dallas
    const dallasWh = approxZipCentroid("75247");
    expect(isWithinRadius(cust, [dallasWh])).toBe(true);
  });

  it("a Dallas customer is OUT of range of only a Seattle warehouse", () => {
    const cust = approxZipCentroid("75201"); // Dallas
    const seattleWh = approxZipCentroid("98032");
    expect(isWithinRadius(cust, [seattleWh])).toBe(false);
  });

  it("nearestWarehouseMiles picks the closest of several", () => {
    const cust = approxZipCentroid("75201");
    const d = nearestWarehouseMiles(cust, [
      approxZipCentroid("98032"), // Seattle (far)
      approxZipCentroid("75247"), // Dallas (near)
      approxZipCentroid("33054"), // Miami (far)
    ]);
    expect(d).not.toBeNull();
    expect(d!).toBeLessThan(50);
  });

  it("returns false when customer location can't be resolved", () => {
    expect(isWithinRadius(null, [approxZipCentroid("75247")])).toBe(false);
  });

  it("default radius is a sane positive number", () => {
    expect(DEFAULT_SERVICE_RADIUS_MI).toBeGreaterThan(0);
  });
});

describe("pickNearestWarehouseZip", () => {
  const warehouses = [
    { zip: "98032", coord: approxZipCentroid("98032") }, // Seattle
    { zip: "75247", coord: approxZipCentroid("75247") }, // Dallas
    { zip: "33054", coord: approxZipCentroid("33054") }, // Miami
  ];

  it("returns the warehouse ZIP nearest the customer", () => {
    const cust = approxZipCentroid("75201"); // Dallas
    expect(pickNearestWarehouseZip(cust, warehouses)).toBe("75247");
  });

  it("picks Seattle for a Pacific-NW customer", () => {
    const cust = approxZipCentroid("98101");
    expect(cust).not.toBeNull();
    expect(pickNearestWarehouseZip(cust, warehouses)).toBe("98032");
  });

  it("returns null when the customer cannot be placed", () => {
    expect(pickNearestWarehouseZip(null, warehouses)).toBeNull();
  });

  it("returns null for an empty warehouse list", () => {
    expect(pickNearestWarehouseZip(approxZipCentroid("75201"), [])).toBeNull();
  });

  it("returns null when no warehouse can be placed", () => {
    const noCoords = [
      { zip: "00000", coord: null },
      { zip: "11111", coord: null },
    ];
    expect(pickNearestWarehouseZip(approxZipCentroid("75201"), noCoords)).toBeNull();
  });

  it("does not let an unplaceable origin win because it is listed first", () => {
    expect(pickNearestWarehouseZip(approxZipCentroid("34229"), [
      { zip: "00000", coord: null },
      { zip: "32824", coord: approxZipCentroid("32824") },
      { zip: "60448", coord: approxZipCentroid("60448") },
    ])).toBe("32824");
  });
});

describe("freight origin selection", () => {
  const skylineOrigins = ["60448", "75234", "77064", "85043", "32824"];
  const uscdOrigins = ["30071", "02766", "60446", "23005", "33073", "92337", "77038", "84043"];

  it("ships a Sarasota 34229 delivery from Orlando when 32824 is configured", () => {
    expect(pickOrigin("34229", skylineOrigins)).toBe("32824");
  });

  it("ships Sarasota from Houston when Orlando is not configured", () => {
    const withoutOrlando = skylineOrigins.filter((zip) => zip !== "32824");
    expect(pickOrigin("34229", withoutOrlando)).toBe("77064");
  });

  it("ships other Florida deliveries from Orlando when 32824 is configured", () => {
    for (const zip of ["34236", "32801", "33602", "33101"]) {
      expect(pickOrigin(zip, skylineOrigins), zip).toBe("32824");
    }
  });

  it("ships a Chicago 60601 delivery from Mokena even when 60448 is listed last", () => {
    expect(pickOrigin("60601", ["32824", "75234", "77064", "85043", "60448"])).toBe("60448");
  });

  it("ships a US Cabinet Depot Sarasota delivery from Coconut Creek when 33073 is configured", () => {
    expect(pickOrigin("34229", uscdOrigins)).toBe("33073");
  });
});
