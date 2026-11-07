/**
 * Bathroom sink placement and the faucet cart rule.
 *
 * Owner report (Nov 7 2026): the bathroom designer stopped placing sinks
 * entirely, in manual placement and in Auto Design, and the "Farmer"
 * (farmhouse / apron-front) sink base showed no sink option at all.
 *
 * Root cause: the sink step and the seeded default decided the fixture family
 * from the ROOM TYPE (`roomType === "bathroom"`), not from the base. Inside a
 * bathroom that meant the vanity-only catalog filter ran over an apron-front
 * base too, so every row was removed, `filteredSinks` was empty, and
 * `applySink` refused with "Choose a source-verified Pelican sink". Commit
 * 82bfb0e (#314) then made a faucet-less sink unsatisfied, so a sink that could
 * not be completed was also never seeded.
 *
 * These tests pin the corrected rule:
 *   - every sink base takes a sink, in a bathroom and in a kitchen;
 *   - a farmhouse base takes an apron-front sink and offers it in the picker;
 *   - a vanity base takes a vanity basin;
 *   - a faucet the shopper chose is billed, a filled-in default never is.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROOM,
  isSinkBaseCabinet,
  type PlacedCabinet,
} from "./design";
import {
  autoSeedSinkForBase,
  faucetCartQuantities,
  faucetRowFitsBase,
  placeSinkOnBase,
  sinkBaseConfig,
  sinkCatalogRoleForBase,
  sinkFamilyForBase,
  sinkRowFitsBase,
  sinkRowsForBase,
  type SinkBaseProductRow,
} from "./sinkBaseSelection";
import { buildSurfaceCartLines } from "./surfaceCartLines";
import type { SinkFixture } from "./design";

const vanityBase = {
  uid: "vsd30",
  cabinetId: 2,
  masterCode: "VSD30",
  description: '30" W x 34-1/2" H x 21" D Vanity Sink Base — 2 Doors, False Drawer Front',
  category: "Vanity",
  subCategory: "Vanity Sink Base",
  placement: "base",
  x: 0,
  y: 0,
  width: 30,
  depth: 21,
  height: 34.5,
  rotation: 0,
} as unknown as PlacedCabinet;

const farmBase = {
  uid: "fsb36",
  cabinetId: 3,
  masterCode: "FSB36",
  description: '36" W x 34-1/2" H x 24" D Farm Sink Base',
  category: "Base",
  subCategory: "Farm Sink Base",
  placement: "base",
  x: 0,
  y: 0,
  width: 36,
  depth: 24,
  height: 34.5,
  rotation: 0,
} as unknown as PlacedCabinet;

const kitchenBase = {
  uid: "sb36",
  cabinetId: 4,
  masterCode: "SB36",
  description: '36" W x 34-1/2" H x 24" D Sink Base Cabinet',
  category: "Base",
  subCategory: "Sink Base",
  placement: "base",
  x: 0,
  y: 0,
  width: 36,
  depth: 24,
  height: 34.5,
  rotation: 0,
} as unknown as PlacedCabinet;

const row = (overrides: Partial<SinkBaseProductRow> & { id: number; pelicanCode: string; name: string }): SinkBaseProductRow => ({
  category: "Sinks & Faucets",
  subCategory: "Sinks",
  size: null,
  imageUrl: null,
  sellPrice: 20000,
  slug: overrides.pelicanCode.toLowerCase().replace(/\s+/g, "-"),
  ...overrides,
});

/** A real apron-front Pelican sink (HA135, 33" apron on a 36" base). */
const APRON_SINK = row({ id: 9101, pelicanCode: "PL-HA135 R0", name: "PL-HA135 R0 Farmhouse Apron Sink" });
/** A real Pearl Series vanity basin. */
const VANITY_SINK = row({ id: 9102, pelicanCode: "PL-3099 White", name: "PL-3099 White Pearl Series Vanity Sink" });
/** A real stainless kitchen sink. */
const KITCHEN_SINK = row({ id: 9103, pelicanCode: "PL-VS3018 18g", name: "PL-VS3018 Stainless Undermount Sink" });

const VANITY_FAUCET = row({ id: 9201, pelicanCode: "PL-8112 BN", name: "PL-8112 BN Cascade Series Vanity Faucet" });
const KITCHEN_FAUCET = row({ id: 9202, pelicanCode: "PL-8237 BN", name: "PL-8237 BN Fountain Series Kitchen Faucet" });

describe("the sink family comes from the base, not the room", () => {
  it("treats a farmhouse base as a farmhouse base in a bathroom", () => {
    expect(sinkFamilyForBase(farmBase, "bathroom")).toBe("farmhouse");
    expect(sinkFamilyForBase(farmBase, "kitchen")).toBe("farmhouse");
    // The old rule answered "vanity" for everything in a bathroom, which is what
    // filtered every apron-front sink out of the step.
    expect(sinkCatalogRoleForBase(farmBase, "bathroom")).toBe("sink");
    expect(sinkCatalogRoleForBase(vanityBase, "bathroom")).toBe("vanity-sink");
  });

  it("keeps a kitchen sink base on the kitchen family", () => {
    expect(sinkFamilyForBase(kitchenBase, "kitchen")).toBe("standard");
    expect(sinkCatalogRoleForBase(kitchenBase, "kitchen")).toBe("sink");
  });
});

describe("a farmhouse sink base offers and places its apron-front sink", () => {
  it("offers the apron-front sink and refuses a vanity basin", () => {
    expect(sinkRowFitsBase(APRON_SINK, farmBase, "bathroom")).toBe(true);
    expect(sinkRowFitsBase(VANITY_SINK, farmBase, "bathroom")).toBe(false);
    expect(sinkRowsForBase([APRON_SINK, VANITY_SINK, KITCHEN_SINK], farmBase, "bathroom").map((item) => item.id))
      .toEqual([APRON_SINK.id]);
  });

  it("places the sink on the base with an apron-front fixture", () => {
    const placed = placeSinkOnBase({ base: farmBase, room: DEFAULT_ROOM, roomType: "bathroom", product: APRON_SINK, faucet: null });
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    expect(placed.sink.cabinetUid).toBe(farmBase.uid);
    expect(placed.sink.type).toBe("farmhouse");
    expect(placed.sink.apronFront).toBe(true);
    expect(placed.sink.pelicanProductId).toBe(APRON_SINK.id);
    // Centered in its own base, on the countertop.
    expect(placed.sink.x).toBeGreaterThanOrEqual(farmBase.x);
    expect(placed.sink.x + placed.sink.width).toBeLessThanOrEqual(farmBase.x + farmBase.width + 0.001);
  });

  it("offers kitchen faucets, never vanity faucets, on the apron base", () => {
    expect(faucetRowFitsBase(KITCHEN_FAUCET, farmBase, "bathroom")).toBe(true);
    expect(faucetRowFitsBase(VANITY_FAUCET, farmBase, "bathroom")).toBe(false);
  });
});

describe("a vanity sink base places a vanity basin", () => {
  it("offers the vanity basin and refuses an apron-front sink", () => {
    expect(sinkRowFitsBase(VANITY_SINK, vanityBase, "bathroom")).toBe(true);
    expect(sinkRowFitsBase(APRON_SINK, vanityBase, "bathroom")).toBe(false);
  });

  it("places the basin centered on the vanity", () => {
    const placed = placeSinkOnBase({ base: vanityBase, room: DEFAULT_ROOM, roomType: "bathroom", product: VANITY_SINK, faucet: null });
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    expect(placed.sink.cabinetUid).toBe(vanityBase.uid);
    expect(placed.sink.pelicanProductId).toBe(VANITY_SINK.id);
    expect(placed.sink.type).not.toBe("farmhouse");
  });

  it("offers vanity faucets, never kitchen faucets", () => {
    expect(faucetRowFitsBase(VANITY_FAUCET, vanityBase, "bathroom")).toBe(true);
    expect(faucetRowFitsBase(KITCHEN_FAUCET, vanityBase, "bathroom")).toBe(false);
  });
});

describe("a freshly placed sink base is seeded with a sink, never left bare", () => {
  for (const [label, base, roomType] of [
    ["vanity in a bathroom", vanityBase, "bathroom"],
    ["farmhouse in a bathroom", farmBase, "bathroom"],
    ["kitchen sink base", kitchenBase, "kitchen"],
  ] as const) {
    it(`seeds one on a ${label}`, () => {
      const seeded = autoSeedSinkForBase({ base: base as PlacedCabinet, room: DEFAULT_ROOM, roomType });
      expect(seeded.cabinetUid).toBe(base.uid);
      expect(seeded.faucet).toBe(true);
      // The seeded faucet is drawn, and marked as filled in.
      expect(seeded.faucetAutoFilled).toBe(true);
      expect(isSinkBaseCabinet(base)).toBe(true);
    });
  }

  it("seeds an apron-front apron zone on a farmhouse base", () => {
    const seeded = autoSeedSinkForBase({ base: farmBase, room: DEFAULT_ROOM, roomType: "bathroom" });
    expect(seeded.type).toBe("farmhouse");
  });
});

describe("HARD RULE: a default faucet is drawn but never billed", () => {
  const faucetSurface = {
    id: KITCHEN_FAUCET.id,
    name: KITCHEN_FAUCET.name,
    category: "Sinks & Faucets",
    subCategory: "Faucets",
    size: null,
    sellPrice: 28900,
  };
  const vanityFaucetSurface = {
    id: VANITY_FAUCET.id,
    name: VANITY_FAUCET.name,
    category: "Sinks & Faucets",
    subCategory: "Faucets",
    size: null,
    sellPrice: 14029,
  };

  it("keeps the filled-in default out of the cart", () => {
    const placed = placeSinkOnBase({ base: vanityBase, room: DEFAULT_ROOM, roomType: "bathroom", product: VANITY_SINK, faucet: null });
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    expect(placed.sink.faucet).toBe(true);
    // The filled-in default is drawn from its published profile and carries no
    // cart product id at all, so there is nothing for the cart to bill.
    expect(placed.sink.faucetAutoFilled).toBe(true);
    expect(placed.sink.pelicanFaucetProductId).toBeUndefined();
    expect(placed.billableFaucetProductId).toBeNull();
    const quantities = faucetCartQuantities([placed.sink]);
    expect(quantities.size).toBe(0);
    // With no catalog row there is nothing to select in the first place, so the
    // cart has no faucet line to build.
    const selectedSurfaceIds = new Set<number>();
    quantities.forEach((_quantity, productId) => selectedSurfaceIds.add(productId));
    expect([...selectedSurfaceIds]).toEqual([]);
  });

  it("never bills a catalog faucet that was filled in rather than chosen", () => {
    // The mandatory pass can fill a sink from a catalog row, which does have an
    // id. That id must be seeded at zero so a stale surface row cannot charge it.
    const filled = {
      uid: "filled",
      type: "single",
      x: 0,
      y: 0,
      width: 30,
      depth: 18,
      faucet: true,
      autoDesignFaucet: true,
      faucetAutoFilled: true,
      pelicanFaucetProductId: VANITY_FAUCET.id,
      faucetForm: "standard-arc",
      faucetOverallHeight: 12,
      faucetSpoutLength: 4,
      faucetSpoutHeight: 6,
    } as SinkFixture;
    const quantities = faucetCartQuantities([filled]);
    expect(quantities.get(VANITY_FAUCET.id)).toBe(0);
    expect(buildSurfaceCartLines([vanityFaucetSurface], "homeowner", null, quantities)).toHaveLength(0);
  });

  it("bills a faucet the shopper chose", () => {
    const placed = placeSinkOnBase({ base: vanityBase, room: DEFAULT_ROOM, roomType: "bathroom", product: VANITY_SINK, faucet: VANITY_FAUCET });
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    expect(placed.sink.faucet).toBe(true);
    expect(placed.sink.faucetAutoFilled).toBeUndefined();
    expect(placed.billableFaucetProductId).toBe(VANITY_FAUCET.id);
    const quantities = faucetCartQuantities([placed.sink]);
    const lines = buildSurfaceCartLines([vanityFaucetSurface], "homeowner", null, quantities);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.qty).toBe(1);
  });

  it("bills the kitchen faucet chosen on an apron base", () => {
    const placed = placeSinkOnBase({ base: farmBase, room: DEFAULT_ROOM, roomType: "bathroom", product: APRON_SINK, faucet: KITCHEN_FAUCET });
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    const lines = buildSurfaceCartLines([faucetSurface], "homeowner", null, faucetCartQuantities([placed.sink]));
    expect(lines).toHaveLength(1);
  });

  it("seeds the filled-in faucet at zero so a stale surface row cannot charge it", () => {
    const seeded = autoSeedSinkForBase({ base: vanityBase, room: DEFAULT_ROOM, roomType: "bathroom" });
    const quantities = faucetCartQuantities([seeded]);
    const filledId = seeded.pelicanFaucetProductId ?? 0;
    // Either nothing is recorded, or it is recorded at zero — never one.
    expect(quantities.get(filledId) ?? 0).toBe(0);
  });

  it("counts only the chosen faucet when one sink defaults and another is chosen", () => {
    const defaulted = autoSeedSinkForBase({ base: vanityBase, room: DEFAULT_ROOM, roomType: "bathroom" });
    const withKitchenPick = placeSinkOnBase({ base: kitchenBase, room: DEFAULT_ROOM, roomType: "kitchen", product: KITCHEN_SINK, faucet: KITCHEN_FAUCET });
    expect(withKitchenPick.ok).toBe(true);
    if (!withKitchenPick.ok) return;
    const quantities = faucetCartQuantities([defaulted, withKitchenPick.sink]);
    expect(quantities.get(KITCHEN_FAUCET.id)).toBe(1);
    const filledId = defaulted.pelicanFaucetProductId;
    if (filledId != null) expect(quantities.get(filledId) ?? 0).toBe(0);
  });
});

describe("a farmhouse sink base has the same configuration surface as a regular sink base", () => {
  it("is selectable and exposes the identical option set", () => {
    const regular = sinkBaseConfig(kitchenBase, "kitchen");
    const vanity = sinkBaseConfig(vanityBase, "bathroom");
    const farmhouse = sinkBaseConfig(farmBase, "bathroom");
    expect(regular.selectable).toBe(true);
    expect(vanity.selectable).toBe(true);
    expect(farmhouse.selectable).toBe(true);
    expect(farmhouse.options).toEqual(regular.options);
    expect(farmhouse.options).toEqual(vanity.options);
    // Select, open its config, choose sink, choose faucet, door/finish, delete.
    for (const option of ["select", "attributes", "sink", "faucet", "door-finish", "delete"]) {
      expect(farmhouse.options).toContain(option);
    }
  });

  it("differs from a regular base only in the product family", () => {
    const regular = sinkBaseConfig(kitchenBase, "kitchen");
    const farmhouse = sinkBaseConfig(farmBase, "bathroom");
    expect(farmhouse.sinkFamily).toBe("farmhouse");
    expect(regular.sinkFamily).toBe("standard");
    // An FSB is never offered a swap to another FSB.
    expect(farmhouse.swapToFarmSinkBase).toBe(false);
    expect(regular.swapToFarmSinkBase).toBe(true);
  });
});

describe("the faucet rule holds for a sink fixture that was already filled in", () => {
  it("does not bill a legacy defaultFaucet sink", () => {
    const legacy = {
      uid: "legacy",
      type: "single",
      x: 0,
      y: 0,
      width: 30,
      depth: 18,
      faucet: true,
      defaultFaucet: true,
      pelicanFaucetProductId: KITCHEN_FAUCET.id,
    } as SinkFixture;
    expect(faucetCartQuantities([legacy]).get(KITCHEN_FAUCET.id) ?? 0).toBe(0);
  });
});
