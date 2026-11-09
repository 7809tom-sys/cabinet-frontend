/**
 * Issue 353, outcome 8 (Tom, Nov 9 2026).
 *
 * In 3D a tall flat side/end panel showed on the left of a 30 × 24-inch wall
 * cabinet (a W3024 upper) and ran down well past the cabinet's bottom. Three
 * separate writers could produce a board beside an upper:
 *
 *   1. the continuous vertical-filler contract, which anchored every board at
 *      the floor and ran it to the top of the highest cabinet beside it — a
 *      wall filler beside a 24-inch bridge therefore became a 96-inch strip;
 *   2. the frameless / Hickory exposed-side panel pass (`open-end-of-run`);
 *   3. the AltaEuro spec end-panel pass and the window-break pass.
 *
 * A 24-inch-or-shorter upper is a one-face appliance surround hung on the
 * bridge datum, not the end of a 54-inch upper run. Nothing is generated beside
 * it, and nothing is billed.
 */
import { describe, expect, it } from "vitest";
import { AEF_PRINTED_GEOMETRY_MARKER } from "@shared/aefFramelessGeometry";
import {
  DEFAULT_ROOM,
  elevationBox,
  wallPlacementAt,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
} from "./design";
import { continuousVerticalFiller, normalizeContinuousVerticalFillers } from "./verticalFiller";
import { applyDesignerLayoutRules } from "./designerLayoutRules";
import { aefExposedEndRequirements } from "./aefExposedEnds";
import { aefWindowEndPanelRequirements } from "./aefWindowEndPanels";
import { exposedPanelRequirements } from "./exposedPanelRule";
import { hickorySkinSuggestions } from "./hickorySkins";
import { catalogItemToExposedPanelStock, syncExposedSidePanels, autoAddedOrderSurfaces } from "./exposedSidePanels";
import { isShortUpperCabinet } from "./shortUpper";

const ROOM: RoomData = { ...DEFAULT_ROOM, width: 168, depth: 132, ceilingHeight: 96 };

function placed(partial: {
  uid: string;
  code: string;
  offset: number;
  width: number;
  height: number;
  placement: PlacedCabinet["placement"];
  depth?: number;
  wall?: "top" | "right";
  extra?: Partial<PlacedCabinet>;
}): PlacedCabinet {
  const depth = partial.depth ?? (partial.placement === "wall" ? 12 : 24);
  const spot = wallPlacementAt(partial.offset, partial.width, depth, partial.wall ?? "top", ROOM);
  return {
    uid: partial.uid,
    cabinetId: partial.uid.length,
    masterCode: partial.code,
    description: partial.code,
    category: partial.placement === "wall" ? "Wall" : "Base",
    subCategory: partial.placement === "wall" ? "Standard Wall" : "Standard Base",
    placement: partial.placement,
    ...spot,
    width: partial.width,
    depth,
    height: partial.height,
    rotation: spot.rotation,
    numberOfDoors: 2,
    numberOfDrawers: 0,
    ...partial.extra,
  } as PlacedCabinet;
}

const panelStock = [
  { id: 201, masterCode: "WEP1523", description: "Wall end panel 15 1/4 x 22 5/8", category: "Accessory", subCategory: "End panel", width: "0.75", depth: "15.25", height: "22.625" },
  { id: 202, masterCode: "WEP1530", description: "Wall end panel 15 1/4 x 30 1/4", category: "Accessory", subCategory: "End panel", width: "0.75", depth: "15.25", height: "30.25" },
  { id: 203, masterCode: "TEP3096", description: "Tall end panel 29 7/8 x 96", category: "Accessory", subCategory: "End panel", width: "0.75", depth: "29.875", height: "96" },
];

const stock = panelStock.flatMap((item) => {
  const converted = catalogItemToExposedPanelStock(item, 120);
  return converted ? [converted] : [];
});

describe("outcome 8: no tall side/end panel beside a short (24-inch) upper", () => {
  it("recognises a W3024 / W3018 / W3012 as a short upper and a W3030 / W2436 as not", () => {
    expect(isShortUpperCabinet({ placement: "wall", height: 24, masterCode: "W3024" })).toBe(true);
    expect(isShortUpperCabinet({ placement: "wall", height: 18, masterCode: "W3018" })).toBe(true);
    expect(isShortUpperCabinet({ placement: "wall", height: 12, masterCode: "W3012" })).toBe(true);
    expect(isShortUpperCabinet({ placement: "wall", height: 30, masterCode: "W3030" })).toBe(false);
    expect(isShortUpperCabinet({ placement: "wall", height: 36, masterCode: "W2436" })).toBe(false);
    // A base box never counts, whatever its code reads.
    expect(isShortUpperCabinet({ placement: "base", height: 12, masterCode: "B3012" })).toBe(false);
    // A record with no stored height still names its height in the code.
    expect(isShortUpperCabinet({ placement: "wall", masterCode: "W3024" })).toBe(true);
  });

  it("cuts a wall-layer board to the upper band instead of running it to the floor", () => {
    const upper = placed({ uid: "upper", code: "W3030", offset: 0, width: 30, height: 30, placement: "wall" });
    const bridge = placed({
      uid: "bridge", code: "W3024", offset: 31.5, width: 30, height: 24, placement: "wall",
      extra: { mountBottom: 72, overRangeMicrowaveBridge: true },
    });
    const spec = continuousVerticalFiller({
      wallId: "top", startIn: 30, widthIn: 1.5, placed: [upper, bridge], room: ROOM, layer: "wall",
    });
    expect(spec.reason).toBe("upper-band");
    // It starts at the 54-inch upper line, not the floor, and stops at the top
    // of the tallest upper it stands beside (the 96-inch bridge top) — it is a
    // filler in the upper band, not a floor-standing 96-inch strip.
    expect(spec.bottomIn).toBeCloseTo(54, 6);
    expect(spec.topIn).toBeCloseTo(96, 6);
    expect(spec.heightIn).toBeCloseTo(42, 6);
  });

  it("normalizes an installed wall board that was saved as a floor-standing strip", () => {
    const upper = placed({ uid: "upper", code: "W3030", offset: 0, width: 30, height: 30, placement: "wall" });
    const bridge = placed({
      uid: "bridge", code: "W3024", offset: 31.5, width: 30, height: 24, placement: "wall",
      extra: { mountBottom: 72, overRangeMicrowaveBridge: true },
    });
    const board = placed({
      uid: "board", code: "WF330", offset: 30, width: 1.5, height: 96, placement: "wall",
      extra: {
        category: "Filler", subCategory: "Filler", mountBottom: 0, fillerPieceGroupId: "g1",
        fillerTotalWidth: 1.5, fillerPlacementMode: "left", fillerForCabinetUid: "upper",
      },
    });
    const normalized = normalizeContinuousVerticalFillers([upper, bridge, board], ROOM).placed
      .find((item) => item.uid === "board")!;
    const box = elevationBox(normalized, ROOM);
    expect(box.bottom).toBeGreaterThan(0);
    expect(box.bottom).toBeCloseTo(54, 6);
    expect(box.height).toBeCloseTo(42, 6);
  });

  it("never lets the built plan end up with a floor-standing board beside a short upper", () => {
    const plan = [
      placed({ uid: "a", code: "W3030", offset: 0, width: 30, height: 30, placement: "wall" }),
      placed({
        uid: "b", code: "W3024", offset: 31.5, width: 30, height: 24, placement: "wall",
        extra: { mountBottom: 72, overRangeMicrowaveBridge: true },
      }),
      placed({ uid: "r", code: "RANGE-30", offset: 31.5, width: 30, height: 36, placement: "appliance", depth: 25 }),
      placed({ uid: "b1", code: "B30", offset: 0, width: 30, height: 34.5, placement: "base" }),
      placed({ uid: "b2", code: "B24", offset: 61.5, width: 24, height: 34.5, placement: "base" }),
      placed({ uid: "c", code: "W2430", offset: 61.5, width: 24, height: 30, placement: "wall" }),
    ];
    let n = 0;
    const result = applyDesignerLayoutRules({
      placed: plan,
      room: ROOM,
      openings: [],
      fillers: [
        { id: 501, masterCode: "WF330", description: '3" Wall Filler', category: "Filler", subCategory: "Filler", width: "3", depth: "0.75", height: "30", placement: "wall" },
        { id: 502, masterCode: "BF330", description: '3" Base Filler', category: "Filler", subCategory: "Filler", width: "3", depth: "0.75", height: "34.5", placement: "base" },
      ] as never[],
      makeUid: () => `p-${++n}`,
      styleId: 11,
    });
    const wallBoards = result.placed.filter((item) => item.placement === "wall"
      && /filler|panel|skin/i.test(`${item.masterCode} ${item.subCategory ?? ""} ${item.description ?? ""}`));
    for (const board of wallBoards) {
      expect(elevationBox(board, ROOM).bottom, `${board.masterCode} starts at the floor`).toBeGreaterThan(0);
    }
  });

  it("generates no exposed-side panel for a frameless short upper", () => {
    const result = syncExposedSidePanels({
      placed: [placed({ uid: "bridge", code: "W3024", offset: 40, width: 30, height: 24, placement: "wall", extra: { mountBottom: 72 } })],
      room: ROOM,
      catalog: stock,
      qualifiedOnly: true,
      doorStyleFor: () => ({ ourName: "AltaEuro Luxe", isFrameless: true } as never),
      priceFor: () => 120,
      pricesReady: true,
    });
    expect(result.placed.filter((item) => item.autoPlacedReason)).toEqual([]);
    // The broad engine is just as strict.
    const broad = syncExposedSidePanels({
      placed: [placed({ uid: "bridge", code: "W3024", offset: 40, width: 30, height: 24, placement: "wall", extra: { mountBottom: 72 } })],
      room: ROOM,
      catalog: stock,
    });
    expect(broad.placed.filter((item) => item.autoPlacedReason)).toEqual([]);
  });

  it("still panels the 30-inch upper run beside it", () => {
    const result = syncExposedSidePanels({
      placed: [
        placed({ uid: "bridge", code: "W3024", offset: 40, width: 30, height: 24, placement: "wall", extra: { mountBottom: 72 } }),
        placed({ uid: "upper", code: "W3030", offset: 70, width: 30, height: 30, placement: "wall" }),
      ],
      room: ROOM,
      catalog: stock,
      qualifiedOnly: true,
      doorStyleFor: () => ({ ourName: "AltaEuro Luxe", isFrameless: true } as never),
      priceFor: () => 120,
      pricesReady: true,
    });
    const panels = result.placed.filter((item) => item.autoPlacedReason);
    expect(panels.map((item) => `${item.autoPlacedForUid}:${item.autoPlacedSide}`)).toEqual(["upper:end"]);
    expect(panels[0]!.masterCode).toBe("WEP1530");
  });

  it("bills nothing for a short upper's side", () => {
    const plan = [placed({ uid: "bridge", code: "W3024", offset: 40, width: 30, height: 24, placement: "wall", extra: { mountBottom: 72 } })];
    const synced = syncExposedSidePanels({
      placed: plan, room: ROOM, catalog: stock, qualifiedOnly: true,
      doorStyleFor: () => ({ ourName: "AltaEuro Luxe", isFrameless: true } as never),
      priceFor: () => 120, pricesReady: true,
    });
    const prices = new Map(stock.map((item) => [item.id, item.price]));
    const surfaces = autoAddedOrderSurfaces({
      placed: synced.placed,
      styleId: 11,
      distributorId: 7,
      tier: "homeowner",
      styleName: "Frameless White",
      unitPriceFor: (cabinet) => prices.get(cabinet.cabinetId) ?? null,
    });
    expect(surfaces.materialList).toEqual([]);
    expect(surfaces.invoice.total).toBe(0);
  });

  it("asks for no rule-10 panel, WEP panel or Hickory skin beside a short upper", () => {
    const bridge = placed({
      uid: "bridge", code: "W3024", offset: 40, width: 30, height: 24, placement: "wall",
      extra: { mountBottom: 72, constructionMethod: AEF_PRINTED_GEOMETRY_MARKER },
    });
    expect(exposedPanelRequirements({ placed: [bridge], room: ROOM })).toEqual([]);
    expect(aefExposedEndRequirements(
      [bridge], [], ROOM,
      [{ id: 201, masterCode: "WEP1523", constructionMethod: AEF_PRINTED_GEOMETRY_MARKER },
       { id: 202, masterCode: "WEP1530", constructionMethod: AEF_PRINTED_GEOMETRY_MARKER }],
    )).toEqual([]);
    const window: WallOpening = { uid: "win", kind: "window", side: "top", offset: 70, width: 36, sill: 42, height: 36 };
    expect(aefWindowEndPanelRequirements(
      [bridge], [window], ROOM,
      [{ id: 201, masterCode: "WEP1523", constructionMethod: AEF_PRINTED_GEOMETRY_MARKER }],
    )).toEqual([]);
    expect(hickorySkinSuggestions([bridge], ROOM, { woodSpecies: "Hickory", ourName: "Hickory", frameless: true } as never)).toEqual([]);
  });
});
