import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM, makeSinkForCabinet, wallPlacementAt, type PlacedCabinet, type SinkFixture, type WallOpening } from "./design";
import {
  applyChosenAutoDesignFaucet,
  catalogFaucetBrand,
  defaultAutoDesignFaucet,
  ensureAutoDesignFaucet,
  groupFaucetsByBrand,
  type AutoDesignFaucetProduct,
} from "./autoDesignFaucet";
import { raiseWindowsForDeckFaucet, resolveDeckFaucetPlacement } from "./faucetPlacement";

function catalogFaucet(overrides: Partial<AutoDesignFaucetProduct> & Pick<AutoDesignFaucetProduct, "id" | "name">): AutoDesignFaucetProduct {
  return {
    category: "Sinks & Faucets",
    subCategory: "Faucets",
    ...overrides,
  };
}

function sink(overrides: Partial<SinkFixture> = {}): SinkFixture {
  return {
    uid: "sink-1",
    type: "single",
    x: 10,
    y: 20,
    width: 30,
    depth: 18,
    faucet: false,
    ...overrides,
  };
}

describe("Auto-Design faucet catalog selection", () => {
  const kitchen = catalogFaucet({
    id: 8203,
    name: "PL-8203 Fountain Series Pull-Down Kitchen Faucet",
    pelicanCode: "PL-8203",
    sellPrice: 249,
    imageUrl: "https://example.test/pl-8203.png",
  });
  const vanity = catalogFaucet({
    id: 8112,
    name: "PL-8112 Cascade Series Vanity Faucet — Brushed Nickel",
    pelicanCode: "PL-8112 BN",
  });
  const wall = catalogFaucet({
    id: 8461,
    name: "PL-8461 Fountain Series Wall-Mounted Kitchen Faucet — Matte Black",
    pelicanCode: "PL-8461 MB",
  });
  const otherBrand = catalogFaucet({
    id: 42,
    name: "Bridge Kitchen Faucet Matte Black",
    brand: "Other Vendor",
    finish: "Matte Black",
    sellPrice: 180,
  });

  it("groups deck-mounted catalog faucets by brand and keeps finish and price", () => {
    const groups = groupFaucetsByBrand([kitchen, vanity, wall, otherBrand]);
    expect(groups.map((group) => group.brand)).toEqual(["Other Vendor", "Pelican"]);
    expect(groups[0]?.products.map((product) => product.id)).toEqual([42]);
    expect(groups[1]?.products.map((product) => product.id)).toEqual([8203]);
    expect(catalogFaucetBrand(kitchen)).toBe("Pelican");
  });

  it("picks the first verified single-hole kitchen faucet from the catalog rows it is given", () => {
    const chosen = defaultAutoDesignFaucet([otherBrand, vanity, wall, kitchen]);
    expect(chosen?.id).toBe(8203);
    expect(defaultAutoDesignFaucet([vanity, wall])).toBeNull();
  });

  it("adds one deck faucet and does not replace a faucet the sink already has", () => {
    const first = ensureAutoDesignFaucet(sink(), kitchen);
    expect(first.attached).toBe(true);
    expect(first.sink.faucet).toBe(true);
    expect(first.sink.autoDesignFaucet).toBe(true);
    expect(first.sink.pelicanFaucetProductId).toBe(8203);
    expect(first.sink.faucetRearDeckOffsetIn).toBe(1.25);
    expect(first.sink.faucetOverallHeight).toBeGreaterThan(0);

    const again = ensureAutoDesignFaucet(first.sink, otherBrand);
    expect(again.attached).toBe(false);
    expect(again.sink.pelicanFaucetProductId).toBe(8203);
    expect(again.sink).toBe(first.sink);
  });

  it("replaces the auto-placed faucet with the catalog product the user picks", () => {
    const placed = ensureAutoDesignFaucet(sink({ uid: "sink-2" }), kitchen).sink;
    const chosen = applyChosenAutoDesignFaucet(placed, otherBrand);
    expect(chosen.uid).toBe("sink-2");
    expect(chosen.pelicanFaucetProductId).toBe(42);
    expect(chosen.pelicanFaucetProductName).toBe(otherBrand.name);
    expect(chosen.autoDesignFaucet).toBe(true);
    expect(chosen.faucet).toBe(true);
  });

  it("re-raises the centered farmhouse window when a taller faucet is chosen", () => {
    const spot = wallPlacementAt(54, 36, 24, "top", DEFAULT_ROOM);
    const cabinet: PlacedCabinet = {
      uid: "fsb-36",
      cabinetId: 36,
      masterCode: "FSB36",
      description: "36 inch farmhouse sink base",
      placement: "base",
      x: spot!.x,
      y: spot!.y,
      width: 36,
      depth: 24,
      height: 34.5,
      rotation: spot!.rotation,
      wallId: spot!.wallId,
      wallOffset: spot!.wallOffset,
    };
    const apron = makeSinkForCabinet("farmhouse", cabinet, DEFAULT_ROOM, { width: 33, depth: 21 });
    expect(apron.faucetRearDeckOffsetIn).toBeUndefined();
    expect(apron.type).toBe("farmhouse");
    const shorter = catalogFaucet({
      id: 8213,
      name: "PL-8213 Fountain Series Pull-Down Kitchen Faucet — Brushed Nickel",
      pelicanCode: "PL-8213 BN",
    });
    const taller = catalogFaucet({
      id: 8203,
      name: "PL-8203 Fountain Series Pull-Down Kitchen Faucet",
      pelicanCode: "PL-8203",
    });
    const withShort = applyChosenAutoDesignFaucet({ ...apron, uid: "farm-sink" }, shorter);
    const along = withShort.x + withShort.width / 2;
    const window: WallOpening = {
      uid: "window-over-farm",
      kind: "window",
      label: "Over sink",
      side: "top",
      offset: along - 18,
      width: 36,
      height: 36,
      sill: 42,
    };
    const first = raiseWindowsForDeckFaucet({
      sinks: [withShort],
      room: DEFAULT_ROOM,
      openings: [window],
      wallLabels: { top: "Wall 1" },
    });
    const withTall = applyChosenAutoDesignFaucet(withShort, taller);
    expect(withTall.faucetOverallHeight!).toBeGreaterThan(withShort.faucetOverallHeight!);
    const second = raiseWindowsForDeckFaucet({
      sinks: [withTall],
      room: DEFAULT_ROOM,
      openings: first.openings,
      wallLabels: { top: "Wall 1" },
    });
    expect(second.openings[0]!.sill).toBeGreaterThan(first.openings[0]!.sill);
    expect(second.openings[0]!.sill + second.openings[0]!.height).toBeLessThanOrEqual(96);
    expect(second.openings[0]!.height).toBeLessThan(window.height);
    expect(resolveDeckFaucetPlacement(withTall, DEFAULT_ROOM, second.openings).conflict).toBeNull();
    expect(resolveDeckFaucetPlacement(withTall, DEFAULT_ROOM, second.openings).renderFaucet).toBe(true);
    expect(second.notes[0]?.text).toMatch(/Window on Wall 1 raised .+ in\. so the faucet clears the sill \(new sill height .+ in\.\)/);
    expect(second.notes[0]?.text).toMatch(/Window height reduced to .+ in\. so the top stays at the wall/);
  });
});
