import { describe, expect, it } from "vitest";
import pelicanRows from "./__fixtures__/pelicanCatalogRows.json";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import {
  autoDesignSinkProductsPresent,
  catalogSinkInstallation,
  isAutoDesignSinkProduct,
  planAutoDesignSinkPlacement,
  resolveAutoDesignSinkBase,
  sinkBaseForProduct,
  sinkBasePairing,
  sinkPairingTable,
  type AutoDesignSinkProduct,
} from "./autoDesignSink";
import type { DesignCabinet, PlacedCabinet, RoomData, SinkFixture } from "./design";

type Row = { id: number; pelicanCode: string; name: string; description?: string; subCategory: string; size?: string | null; imageUrl?: string | null; sellPrice?: number | null };
const rows = pelicanRows as unknown as Row[];
const sinkRows = rows.filter((row) => row.subCategory === "Sinks");
const bases = (realCatalog as unknown as Record<string, { base: unknown[] }>)["330011"]!.base as DesignCabinet[];
const framelessBases = (realCatalog as unknown as Record<string, { base: unknown[] }>)["540005"]!.base as DesignCabinet[];

function product(code: string): AutoDesignSinkProduct {
  const row = sinkRows.find((entry) => entry.pelicanCode === code);
  if (!row) throw new Error(`no fixture sink ${code}`);
  return {
    id: row.id,
    pelicanCode: row.pelicanCode,
    name: row.name,
    description: row.description ?? null,
    subCategory: row.subCategory,
    size: row.size ?? null,
    imageUrl: row.imageUrl ?? null,
    sellPrice: row.sellPrice ?? null,
  };
}

function room(): RoomData {
  return { width: 144, depth: 120, ceilingHeight: 96, openWallPath: false } as RoomData;
}

function sinkBase(width: number, wallId = "top", offset = 0): PlacedCabinet {
  return {
    uid: `sb-${width}-${offset}`, cabinetId: 10, masterCode: `SB${width}`, description: `Sink Base ${width}`,
    category: "Base", subCategory: "Sink Base", placement: "base",
    x: offset, y: 0, width, depth: 24, height: 34.5, rotation: 0, wallId, wallOffset: offset,
  } as PlacedCabinet;
}

function farmBase(width = 36): PlacedCabinet {
  return {
    ...sinkBase(width),
    uid: "fsb-36", cabinetId: 11, masterCode: `FSB${width}`, description: `Farm Sink Base ${width}`,
  } as PlacedCabinet;
}

const emptySinks: SinkFixture[] = [];

describe("the auto-designer sink list", () => {
  it("offers Pelican catalog sinks and never a faucet, accessory, or vanity top", () => {
    const products = sinkRows
      .filter((row) => isAutoDesignSinkProduct({ id: row.id, pelicanCode: row.pelicanCode, name: row.name, subCategory: row.subCategory, description: row.description ?? null }))
      .map((row) => row.pelicanCode);
    expect(products).toContain("PL-VS3018 18g");
    expect(products).toContain("PL-HA124 R0 16g");
    expect(products).not.toContain("PL-8237 BN");
    expect(products.some((code) => /Deck Plate/.test(code))).toBe(false);
    expect(products).not.toContain("PL-R1917W");
  });
});

describe("sink-to-cabinet pairing from product data", () => {
  it("pairs a farmhouse sink with the matching farmhouse base, never a standard SB", () => {
    const farm = sinkBaseForProduct(bases, product("PL-HA124 R0 16g"));
    expect(farm?.masterCode).toBe("FSB36");
    expect(farm?.masterCode).not.toMatch(/^SB\d/);
  });

  it("pairs an undermount sink with the smallest straight base that clears its minimum width", () => {
    expect(sinkBaseForProduct(bases, product("PL-VS2318 18g"))?.masterCode).toBe("SB33");
    expect(sinkBaseForProduct(framelessBases, product("PL-VS2318 18g"))?.masterCode).toBe("SB24");
    expect(sinkBaseForProduct(framelessBases, product("PL-VS5050 18g"))?.masterCode).toBe("SB33");
  });

  it("never pairs a kitchen sink with a vanity basis", () => {
    expect(sinkBasePairing(product("PL-R1917W")).kind).toBe("vanity");
    expect(sinkBaseForProduct(bases, product("PL-R1917W"))).toBeNull();
    expect(catalogSinkInstallation(product("PL-3099 Bone"))).toBe("vanity");
  });

  it("states the pairing reason and the widths the line can actually base", () => {
    const table = sinkPairingTable([product("PL-VS1815 18g"), product("PL-HA124 R0 16g")], bases);
    const small = table.find((row) => row.pelicanCode === "PL-VS1815 18g")!;
    expect(small.baseKind).toBe("regular");
    expect(small.minimumWidthIn).toBe(21);
    expect(small.baseWidthsIn[0]).toBe(21);
    const farm = table.find((row) => row.pelicanCode === "PL-HA124 R0 16g")!;
    expect(farm.baseKind).toBe("farmhouse");
    expect(farm.baseWidthsIn).toEqual([36]);
    expect(sinkBasePairing(product("PL-HA124 R0 16g")).reason).toMatch(/farmhouse/i);
  });

  it("keeps a vanity basin off the kitchen list entirely", () => {
    expect(autoDesignSinkProductsPresent([product("PL-R1917W"), product("PL-VS3018 18g")]).map((entry) => entry.pelicanCode)).toEqual(["PL-VS3018 18g"]);
  });
});

describe("what a sink pick does to the measured base", () => {
  it("switches the build to the farmhouse base when an apron-front sink is picked", () => {
    const resolved = resolveAutoDesignSinkBase({
      product: product("PL-HA124 R0 16g"),
      measuredWidthIn: 36,
      measuredKind: "regular",
      baseCatalog: bases,
    });
    expect(resolved).toMatchObject({ kind: "farmhouse", widthIn: 36, changed: true });
    expect(resolved.note).toMatch(/apron-front/i);
  });

  it("widens the measured base when the sink needs more room, and never narrows it", () => {
    const widened = resolveAutoDesignSinkBase({
      product: product("PL-VS5050 18g"),
      measuredWidthIn: 30,
      measuredKind: "regular",
      baseCatalog: framelessBases,
    });
    expect(widened.widthIn).toBe(33);
    expect(widened.changed).toBe(true);
    const unchanged = resolveAutoDesignSinkBase({
      product: product("PL-VS2318 18g"),
      measuredWidthIn: 36,
      measuredKind: "regular",
      baseCatalog: bases,
    });
    expect(unchanged).toMatchObject({ widthIn: 36, kind: "regular", changed: false });
  });

  it("leaves the measured base alone when no sink was picked", () => {
    expect(resolveAutoDesignSinkBase({ product: null, measuredWidthIn: 33, measuredKind: "regular", baseCatalog: bases }))
      .toMatchObject({ widthIn: 33, kind: "regular", changed: false });
  });
});

describe("auto-placing a picked sink (no manual step)", () => {
  it("seats the basin in the sink base that already exists", () => {
    const host = farmBase(36);
    const plan = planAutoDesignSinkPlacement({
      product: product("PL-HA124 R0 16g"),
      mode: "replace",
      room: room(),
      placed: [host],
      sinks: emptySinks,
      openings: [],
      baseCatalog: bases,
      wallIds: ["top"],
    });
    expect(plan.kind).toBe("reuse");
    if (plan.kind !== "reuse") return;
    expect(plan.hostUid).toBe(host.uid);
    expect(plan.sink.cabinetUid).toBe(host.uid);
    expect(plan.sink.apronFront).toBe(true);
  });

  it("swaps a standard base for its farmhouse base when an apron sink is picked onto it", () => {
    const host = sinkBase(36);
    const plan = planAutoDesignSinkPlacement({
      product: product("PL-HA124 R0 16g"),
      mode: "replace",
      room: room(),
      placed: [host],
      sinks: emptySinks,
      openings: [],
      baseCatalog: bases,
      wallIds: ["top"],
    });
    expect(plan.kind).toBe("swap-base");
    if (plan.kind !== "swap-base") return;
    expect(plan.toCode).toBe("FSB36");
    expect(plan.fromCode).toBe("SB36");
    expect(plan.cabinet.uid).toBe(host.uid);
    expect(plan.sink.cabinetUid).toBe(host.uid);
  });

  it("gives a second sink its own base instead of stacking it on the first", () => {
    const host = farmBase(36);
    const plan = planAutoDesignSinkPlacement({
      product: product("PL-HA124 R0 16g"),
      mode: "add",
      room: room(),
      placed: [host],
      sinks: [{ uid: "sink-1", cabinetUid: host.uid, pelicanProductId: 1 } as SinkFixture],
      openings: [],
      baseCatalog: bases,
      wallIds: ["top"],
    });
    expect(plan.kind).toBe("add-base");
    if (plan.kind !== "add-base") return;
    expect(plan.cabinet.masterCode).toBe("FSB36");
    expect(plan.alongIn).toBeGreaterThanOrEqual(36);
  });

  it("reports a blocked plan instead of placing a sink on top of a cabinet", () => {
    // Every wall of a 60 × 60 room is already full of sink bases.
    const tinyRoom = { width: 60, depth: 60, ceilingHeight: 96, openWallPath: false } as RoomData;
    const full = [
      { ...sinkBase(36, "top", 0), uid: "b-1" },
      { ...sinkBase(24, "top", 36), uid: "b-2" },
      { ...sinkBase(36, "bottom", 0), uid: "b-3" },
      { ...sinkBase(24, "bottom", 36), uid: "b-4" },
      { ...sinkBase(36, "left", 0), uid: "b-5" },
      { ...sinkBase(24, "left", 36), uid: "b-6" },
      { ...sinkBase(36, "right", 0), uid: "b-7" },
      { ...sinkBase(24, "right", 36), uid: "b-8" },
    ];
    const blocked = planAutoDesignSinkPlacement({
      product: product("PL-VS3018 18g"),
      mode: "add",
      room: tinyRoom,
      placed: full,
      sinks: [{ uid: "sink-1", cabinetUid: "b-1", pelicanProductId: 1 } as SinkFixture],
      openings: [],
      baseCatalog: bases,
      wallIds: ["top", "bottom", "left", "right"],
    });
    expect(blocked.kind).toBe("blocked");
    if (blocked.kind !== "blocked") return;
    expect(blocked.reason).toMatch(/free span/i);
  });

  it("refuses a vanity basin in the kitchen sink flow", () => {
    const plan = planAutoDesignSinkPlacement({
      product: product("PL-R1917W"),
      mode: "replace",
      room: room(),
      placed: [sinkBase(36)],
      sinks: emptySinks,
      openings: [],
      baseCatalog: bases,
      wallIds: ["top"],
    });
    expect(plan.kind).toBe("blocked");
  });
});
