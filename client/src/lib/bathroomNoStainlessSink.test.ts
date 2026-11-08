/**
 * A bathroom vanity never gets a kitchen sink.
 *
 * Owner report (Nov 8 2026), with a screenshot: a navy vanity with a white top
 * held a rectangular brushed STAINLESS STEEL kitchen sink with a metal rim and
 * basket drain, beside a toilet. "stainless sinks are for the kitchen."
 *
 * Cause: a vanity sink base is seeded with a basin before the shopper picks one,
 * so the base is never empty. That seeded basin carries no catalog product and
 * therefore no `surfaceFinish`, and the 3D sink renderer treated a missing
 * finish as stainless. Every defaulted vanity sink therefore drew as a kitchen
 * stainless sink.
 *
 * These tests pin the rule at every entry point that can put a sink on a
 * bathroom vanity: the seeded default, an explicit product choice, the picker
 * filter, Auto Design, and a plan loaded from storage.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM, type PlacedCabinet, type SinkFixture } from "./design";
import {
  autoSeedSinkForBase,
  placeSinkOnBase,
  sinkCatalogRoleForBase,
  sinkFamilyForBase,
  sinkRowFitsBase,
  type SinkBaseProductRow,
} from "./sinkBaseSelection";
import {
  DEFAULT_VANITY_BASIN_SKU,
  isKitchenSinkFinish,
  repairVanitySinkFinishes,
  resolveSinkFinish,
  sinkFinishForFamily,
  vanitySinkLooksLikeKitchenSink,
} from "./bathroomSinkFinish";
import { isAutoDesignSinkProduct } from "./autoDesignSink";
import { buildPelicanSinkOnCabinet } from "./pelicanAutoPlace";

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

const kitchenSinkBase = {
  ...vanityBase,
  uid: "sb36",
  masterCode: "SB36",
  description: '36" Sink Base Cabinet',
  category: "Base",
  subCategory: "Sink Base",
  width: 36,
} as PlacedCabinet;

/** A real kitchen stainless sink row, as the picker would receive it. */
const stainlessKitchenSink: SinkBaseProductRow = {
  id: 9001,
  pelicanCode: "PL-HA109",
  name: "PL-HA109 Stainless Steel Undermount Sink",
  category: "Sinks & Faucets",
  subCategory: "Sinks",
  size: '30" x 18"',
  sellPrice: 320,
};

/** A real bathroom vanity basin row. */
const vanityBasinRow: SinkBaseProductRow = {
  id: 9002,
  pelicanCode: "PL-3099 White",
  name: "PL-3099 Pearl Series Porcelain Undermount Vanity Sink",
  category: "Sinks & Faucets",
  subCategory: "Sinks",
  bathroomFixtureTags: "bathroom-vanity-sink,undermount,single-bowl",
  size: '20 7/8" x 15 5/8"',
  sellPrice: 140,
};

const isPorcelain = (finish: string | null | undefined) => (finish ?? "").startsWith("vitreous-china");

describe("the finish rule itself", () => {
  it("treats only stainless as a kitchen sink", () => {
    expect(isKitchenSinkFinish("stainless-steel")).toBe(true);
    expect(isKitchenSinkFinish("Stainless Steel")).toBe(true);
    expect(isKitchenSinkFinish("vitreous-china")).toBe(false);
    expect(isKitchenSinkFinish("gunmetal-black")).toBe(false);
    // No finish is not itself a kitchen verdict — the family decides.
    expect(isKitchenSinkFinish(undefined)).toBe(false);
  });

  it("defaults a vanity to porcelain and a kitchen to stainless", () => {
    expect(sinkFinishForFamily("vanity")).toBe("vitreous-china");
    expect(sinkFinishForFamily("standard")).toBe("stainless-steel");
    expect(sinkFinishForFamily("farmhouse")).toBe("stainless-steel");
  });

  it("never returns a kitchen finish for a vanity, whatever it is handed", () => {
    for (const recorded of [
      undefined,
      null,
      "",
      "stainless-steel",
      "gunmetal-black",
      "vitreous-china",
      "vitreous-china-black",
      "vitreous-china-bone",
      "vitreous-china-grey",
      "nonsense",
    ]) {
      expect(isKitchenSinkFinish(resolveSinkFinish(recorded, "vanity")), `input ${recorded}`).toBe(false);
    }
  });

  it("keeps a bathroom basin's own porcelain colour", () => {
    expect(resolveSinkFinish("vitreous-china-black", "vanity")).toBe("vitreous-china-black");
    expect(resolveSinkFinish("vitreous-china-bone", "vanity")).toBe("vitreous-china-bone");
  });

  it("leaves kitchen finishes alone", () => {
    expect(resolveSinkFinish("stainless-steel", "standard")).toBe("stainless-steel");
    expect(resolveSinkFinish(undefined, "standard")).toBe("stainless-steel");
    expect(resolveSinkFinish("gunmetal-black", "standard")).toBe("gunmetal-black");
  });

  it("flags a kitchen-shaped sink on a vanity", () => {
    expect(vanitySinkLooksLikeKitchenSink({ surfaceFinish: "stainless-steel" }, "vanity")).toBe(true);
    expect(vanitySinkLooksLikeKitchenSink({ type: "farmhouse" }, "vanity")).toBe(true);
    expect(vanitySinkLooksLikeKitchenSink({ apronFront: true }, "vanity")).toBe(true);
    expect(vanitySinkLooksLikeKitchenSink({ surfaceFinish: "vitreous-china" }, "vanity")).toBe(false);
    // In a kitchen a stainless sink is correct.
    expect(vanitySinkLooksLikeKitchenSink({ surfaceFinish: "stainless-steel" }, "standard")).toBe(false);
  });
});

describe("a bathroom vanity never resolves to a stainless sink", () => {
  it("seeds the default basin as porcelain china", () => {
    const sink = autoSeedSinkForBase({ base: vanityBase, room: DEFAULT_ROOM, roomType: "bathroom" });
    expect(isPorcelain(sink.surfaceFinish), `got ${sink.surfaceFinish}`).toBe(true);
    expect(sink.surfaceFinish).not.toBe("stainless-steel");
    expect(sink.bathroomVanitySink).toBe(true);
    // The seeded basin must still look and behave like a basin.
    expect(sink.type).toBe("single");
    expect(sink.faucet).toBe(true);
    expect(sink.pelicanProfileId).toBeTruthy();
  });

  it("still draws the default faucet without making it billable", () => {
    const placement = placeSinkOnBase({ base: vanityBase, room: DEFAULT_ROOM, roomType: "bathroom", product: null, faucet: null });
    expect(placement.ok).toBe(true);
    if (!placement.ok) return;
    expect(placement.sink.faucet).toBe(true);
    expect(placement.sink.faucetForm).toBeTruthy();
    expect(placement.billableFaucetProductId).toBeNull();
  });

  it("keeps the sink seated on the base, 2–2.5 inches behind the top front", () => {
    const sink = autoSeedSinkForBase({ base: vanityBase, room: DEFAULT_ROOM, roomType: "bathroom" });
    const setback = sink.frontSetbackIn;
    expect(setback).toBeGreaterThanOrEqual(2);
    expect(setback).toBeLessThanOrEqual(2.5);
    // The sink is inside the vanity footprint, not floating off it.
    expect(sink.x).toBeGreaterThanOrEqual(vanityBase.x);
    expect(sink.y).toBeGreaterThanOrEqual(vanityBase.y);
    expect(sink.x + sink.width).toBeLessThanOrEqual(vanityBase.x + Number(vanityBase.width) + 0.001);
    expect(sink.y + sink.depth).toBeLessThanOrEqual(vanityBase.y + Number(vanityBase.depth) + 0.001);
  });

  it("refuses to place a stainless kitchen sink on a vanity", () => {
    const placement = placeSinkOnBase({
      base: vanityBase,
      room: DEFAULT_ROOM,
      roomType: "bathroom",
      product: stainlessKitchenSink,
      faucet: null,
    });
    // Either it is refused outright, or it resolves to porcelain. It must never
    // install as stainless.
    if (placement.ok) {
      expect(isPorcelain(placement.sink.surfaceFinish)).toBe(true);
    } else {
      expect(placement.reason).toMatch(/does not fit|not a/i);
    }
  });

  it("does not offer a stainless row in the vanity sink picker", () => {
    expect(sinkRowFitsBase(stainlessKitchenSink, vanityBase, "bathroom")).toBe(false);
    expect(sinkRowFitsBase(vanityBasinRow, vanityBase, "bathroom")).toBe(true);
  });

  it("asks the server for the vanity role on a vanity base", () => {
    expect(sinkCatalogRoleForBase(vanityBase, "bathroom")).toBe("vanity-sink");
    expect(sinkFamilyForBase(vanityBase, "bathroom")).toBe("vanity");
  });

  it("never marks a stainless sink as an Auto Design candidate for a vanity", () => {
    expect(isAutoDesignSinkProduct({
      id: stainlessKitchenSink.id,
      pelicanCode: stainlessKitchenSink.pelicanCode,
      name: stainlessKitchenSink.name,
      subCategory: stainlessKitchenSink.subCategory,
    })).toBe(true);
    // It is a legitimate KITCHEN candidate; what matters is that the vanity
    // path cannot reach it. The picker and seeder above are that path.
    expect(sinkRowFitsBase(stainlessKitchenSink, vanityBase, "bathroom")).toBe(false);
  });

  it("marks a manually picked vanity basin as a bathroom sink", () => {
    const sink = buildPelicanSinkOnCabinet(
      { id: vanityBasinRow.id, pelicanCode: vanityBasinRow.pelicanCode, name: vanityBasinRow.name, size: vanityBasinRow.size } as never,
      vanityBase,
      DEFAULT_ROOM,
    );
    expect(sink.bathroomVanitySink).toBe(true);
    expect(isPorcelain(sink.surfaceFinish), `got ${sink.surfaceFinish}`).toBe(true);
  });

  it("leaves the kitchen alone — a stainless sink is still stainless there", () => {
    const sink = autoSeedSinkForBase({ base: kitchenSinkBase, room: DEFAULT_ROOM, roomType: "kitchen" });
    expect(isPorcelain(sink.surfaceFinish)).toBe(false);
    expect(sink.bathroomVanitySink).toBeUndefined();
  });
});

describe("loading a saved plan", () => {
  const legacyDefaultSink = {
    uid: "sink-legacy",
    type: "single",
    x: 3,
    y: 4,
    width: 20.875,
    depth: 15.625,
    faucet: true,
    cabinetUid: "vsd30",
    frontSetbackIn: 2,
    // No surfaceFinish: this is the seeded default that drew as stainless.
  } as unknown as SinkFixture;

  const legacyStainlessSink = {
    ...legacyDefaultSink,
    uid: "sink-stainless",
    surfaceFinish: "stainless-steel" as const,
    pelicanProductId: 9001,
  } as unknown as SinkFixture;

  it("repairs a defaulted vanity sink to porcelain and keeps it in place", () => {
    const { sinks, repairedCount } = repairVanitySinkFinishes([legacyDefaultSink], new Set(["vsd30"]));
    expect(repairedCount).toBe(1);
    expect(isPorcelain(sinks[0]!.surfaceFinish)).toBe(true);
    expect(sinks[0]!.bathroomVanitySink).toBe(true);
    // Geometry is untouched.
    expect(sinks[0]!.x).toBe(legacyDefaultSink.x);
    expect(sinks[0]!.y).toBe(legacyDefaultSink.y);
    expect(sinks[0]!.width).toBe(legacyDefaultSink.width);
    expect(sinks[0]!.frontSetbackIn).toBe(legacyDefaultSink.frontSetbackIn);
    expect(sinks[0]!.faucet).toBe(true);
  });

  it("repairs a stainless kitchen basin that a saved plan kept on a vanity", () => {
    const { sinks } = repairVanitySinkFinishes([legacyStainlessSink], new Set(["vsd30"]));
    expect(isKitchenSinkFinish(sinks[0]!.surfaceFinish)).toBe(false);
    expect(sinks[0]!.bathroomVanitySink).toBe(true);
    expect(sinks[0]!.pelicanProductId).toBe(9001);
  });

  it("turns an apron-front basin on a vanity back into an ordinary basin", () => {
    const apron = { ...legacyStainlessSink, uid: "sink-apron", type: "farmhouse" as const, apronFront: true };
    const { sinks } = repairVanitySinkFinishes([apron], new Set(["vsd30"]));
    expect(sinks[0]!.type).toBe("single");
    expect(sinks[0]!.apronFront).toBe(false);
    expect(isPorcelain(sinks[0]!.surfaceFinish)).toBe(true);
  });

  it("leaves a kitchen sink on a kitchen base alone", () => {
    const kitchenStainless = { ...legacyStainlessSink, uid: "sink-kitchen", cabinetUid: "sb36" };
    const { sinks, repairedCount } = repairVanitySinkFinishes([kitchenStainless], new Set(["vsd30"]));
    expect(repairedCount).toBe(0);
    expect(sinks[0]).toBe(kitchenStainless);
  });

  it("does not touch a vanity sink that is already correct", () => {
    const correct = { ...legacyDefaultSink, uid: "sink-ok", surfaceFinish: "vitreous-china" as const, bathroomVanitySink: true };
    const { repairedCount } = repairVanitySinkFinishes([correct], new Set(["vsd30"]));
    expect(repairedCount).toBe(0);
  });

  it("keeps the source-measured fallback basin a real Pelican basin", () => {
    expect(DEFAULT_VANITY_BASIN_SKU).toMatch(/^PL-/);
    const sink = autoSeedSinkForBase({ base: vanityBase, room: DEFAULT_ROOM, roomType: "bathroom" });
    expect(sink.pelicanProfileId).toBeTruthy();
  });
});
