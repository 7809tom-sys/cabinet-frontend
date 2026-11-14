/**
 * Owner report (Nov 7 2026): a "Farmer" / farmhouse sink base placed in the
 * bathroom designer could not be selected or configured, and no farmhouse sink
 * could be chosen or placed on it.
 *
 * There were two separate causes, both from routing sink bases by ROOM TYPE
 * instead of by BASE:
 *   1. Placing an FSB closed the Sink / Range Top chooser and sent the user to a
 *      side-panel guide, so the base never opened the sink step that every other
 *      sink base opens.
 *   2. The sink step asked the bathroom-only `vanity-sink` catalog role and kept
 *      only `bathroom-vanity-sink` rows, so an FSB (whose fixture is an
 *      apron-front kitchen sink) had every row filtered out.
 *
 * The farmhouse base now takes exactly the same selection and configuration path
 * as a regular sink base. Only the product family differs, which is real.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  defaultAutoDesignFaucet,
  ensureMandatorySinkFaucets,
  isAutoFilledFaucet,
} from "@/lib/autoDesignFaucet";
import { buildSurfaceCartLines } from "@/lib/surfaceCartLines";
import { farmhouseSinkApronPastCarcassIn } from "@/lib/farmhouseSinkBaseFace";
import {
  faucetCartQuantities,
  faucetRowFitsBase,
  placeSinkOnBase,
  sinkBaseConfig,
  sinkCatalogRoleForBase,
  sinkFamilyForBase,
  sinkRowFitsBase,
  sinkRowsForBase,
} from "@/lib/sinkBaseSelection";
import { DEFAULT_ROOM, isSinkBaseCabinet, type PlacedCabinet, type SinkFixture } from "@/lib/design";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

const FSB = {
  uid: "fsb36",
  cabinetId: 9360037,
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

const SB = {
  uid: "sb36",
  cabinetId: 1,
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

const apronSink = { id: 9101, pelicanCode: "PL-HA135 R0", name: "PL-HA135 R0 Farmhouse Apron Sink", category: "Sinks & Faucets", subCategory: "Sinks", size: null, imageUrl: null, sellPrice: 40000, slug: "pl-ha135-r0" };
const kitchenFaucet = { id: 9202, pelicanCode: "PL-8237 BN", name: "PL-8237 BN Fountain Series Kitchen Faucet", category: "Sinks & Faucets", subCategory: "Faucets", size: null, imageUrl: null, sellPrice: 28900, slug: "pl-8237-bn" };

describe("a farmhouse sink base takes the regular sink-base path", () => {
  it("opens the same Sink / Range Top chooser a regular sink base opens", () => {
    // Placing an FSB used to close the dialog and defer to a side-panel guide.
    expect(source).not.toContain("Farm Sink Base added. Choose a verified apron-front sink from the Sink Selection Guide in the side panel.");
    const placementBranch = source.slice(
      source.indexOf("if (isSinkBaseCabinet(finalCab)) {"),
      source.indexOf("if (isFloatingShelfItem(finalCab)) {"),
    );
    // One branch, one chooser, for every sink base.
    expect(placementBranch).toContain("setSinkBaseDialog({ cabinetUid: finalCab.uid });");
    expect(placementBranch).toContain("setRangeTopStep(\"choose\");");
    expect(placementBranch).not.toContain("} else if (isFarmSinkBasePaletteItem(finalCab)) {");
    // It still says what kind of base it is, so the copy is honest.
    expect(placementBranch).toContain("is a farmhouse / apron-front sink base. Choose its apron-front sink, then its faucet.");
  });

  it("is recognised as a sink base by the bathroom path", () => {
    expect(isSinkBaseCabinet(FSB)).toBe(true);
    expect(sinkFamilyForBase(FSB, "bathroom")).toBe("farmhouse");
    expect(sinkCatalogRoleForBase(FSB, "bathroom")).toBe("sink");
    // Before the fix this was `roomType === "bathroom"`, which made the FSB read
    // the vanity-only role and lose every apron-front row.
    expect(source).not.toContain("const isBathroomVanity = roomType === \"bathroom\";");
  });

  it("offers its matching apron-front sink in the same sink step", () => {
    const rows = [apronSink, { ...apronSink, id: 9102, pelicanCode: "PL-3099 White", name: "PL-3099 White Pearl Series Vanity Sink" }];
    expect(sinkRowsForBase(rows, FSB, "bathroom").map((row) => row.id)).toEqual([apronSink.id]);
    expect(sinkRowFitsBase(apronSink, FSB, "bathroom")).toBe(true);
  });

  it("places the sink on the base, with its apron facing the room", () => {
    const placed = placeSinkOnBase({ base: FSB, room: DEFAULT_ROOM, roomType: "bathroom", product: apronSink, faucet: null });
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    expect(placed.sink.cabinetUid).toBe(FSB.uid);
    expect(placed.sink.type).toBe("farmhouse");
    expect(placed.sink.apronFront).toBe(true);
    // The apron sits flush with the room-facing cabinet front.
    // Rule 6 (Nov 13 2026): the apron sits 0.5" past the door face, which is 0.63" past the box.
    expect(placed.sink.y + placed.sink.depth).toBeCloseTo(FSB.depth + farmhouseSinkApronPastCarcassIn(), 6);
  });

  it("shows the same option set as a regular sink base", () => {
    const regular = sinkBaseConfig(SB, "kitchen");
    const farmhouse = sinkBaseConfig(FSB, "bathroom");
    expect(farmhouse.selectable).toBe(true);
    expect(farmhouse.options).toEqual(regular.options);
    expect(farmhouse.options).toContain("attributes");
    expect(farmhouse.options).toContain("door-finish");
    expect(farmhouse.options).toContain("delete");
  });

  it("keeps the side-panel Sink & faucet dialog on one picker for every base", () => {
    // The FSB-only guide is gone, so the same <PelicanSinkPicker> serves the FSB.
    expect(source).not.toContain("<FarmhouseSinkSelectionGuide");
    expect(source).toContain("<PelicanSinkPicker");
    expect(source).toContain("role={sinkCatalogRoleForBase(selectedCab, roomType)}");
    expect(source).toContain("filter={(item) => sinkRowFitsBase(item, selectedCab, roomType)}");
    expect(source).toContain("data-testid=\"sink-options-needs-base\"");
  });
});

describe("the same faucet rule applies on a farmhouse sink base", () => {
  const kitchenFaucetSurface = {
    id: kitchenFaucet.id,
    name: kitchenFaucet.name,
    category: "Sinks & Faucets",
    subCategory: "Faucets",
    size: null,
    sellPrice: 28900,
  };

  it("offers a kitchen faucet, because an apron sink is a kitchen fixture", () => {
    expect(faucetRowFitsBase(kitchenFaucet, FSB, "bathroom")).toBe(true);
  });

  it("bills only a faucet the shopper chose", () => {
    const skipped = placeSinkOnBase({ base: FSB, room: DEFAULT_ROOM, roomType: "bathroom", product: apronSink, faucet: null });
    expect(skipped.ok).toBe(true);
    if (!skipped.ok) return;
    expect(isAutoFilledFaucet(skipped.sink)).toBe(true);
    expect(skipped.billableFaucetProductId).toBeNull();

    const picked = placeSinkOnBase({ base: FSB, room: DEFAULT_ROOM, roomType: "bathroom", product: apronSink, faucet: kitchenFaucet });
    expect(picked.ok).toBe(true);
    if (!picked.ok) return;
    const lines = buildSurfaceCartLines([kitchenFaucetSurface], "homeowner", null, faucetCartQuantities([picked.sink]));
    expect(lines).toHaveLength(1);
    expect(lines[0]!.qty).toBe(1);
  });

  it("never bills the faucet the mandatory pass filled in", () => {
    const bare = {
      uid: "fsb-sink",
      type: "farmhouse",
      x: 0,
      y: 0,
      width: 33,
      depth: 21,
      faucet: false,
    } as SinkFixture;
    const filled = ensureMandatorySinkFaucets([bare], [kitchenFaucet as never]).sinks[0]!;
    expect(filled.faucet).toBe(true);
    expect(isAutoFilledFaucet(filled)).toBe(true);
    const quantities = faucetCartQuantities([filled]);
    if (filled.pelicanFaucetProductId != null) {
      expect(quantities.get(filled.pelicanFaucetProductId)).toBe(0);
    } else {
      expect(quantities.size).toBe(0);
    }
    expect(buildSurfaceCartLines([kitchenFaucetSurface], "homeowner", null, quantities)).toHaveLength(0);
    expect(defaultAutoDesignFaucet([kitchenFaucet as never])?.id).toBe(kitchenFaucet.id);
  });
});
