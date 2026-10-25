import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM, type PlacedCabinet, type RoomData } from "@/lib/design";
import { buildAttachedFillerPlacement } from "./cabinetAttachedFillerPlacement";

const room: RoomData = { ...DEFAULT_ROOM, width: 120, depth: 120 };
const stock = [
  { id: 300, masterCode: "BF3", description: "3 inch base filler", category: "Filler", subCategory: "Filler", width: 3, height: 34.5, depth: 24, catalogImageUrl: null },
  { id: 301, masterCode: "WF3", description: "3 inch wall filler", category: "Filler", subCategory: "Filler", width: 3, height: 30, depth: 12, catalogImageUrl: null },
  { id: 302, masterCode: "TF3", description: "3 inch tall filler", category: "Filler", subCategory: "Filler", width: 3, height: 96, depth: 24, catalogImageUrl: null },
];

function cabinet(overrides: Partial<PlacedCabinet> = {}): PlacedCabinet {
  return {
    uid: "b24",
    cabinetId: 24,
    masterCode: "B24",
    description: "24 inch base cabinet",
    placement: "base",
    x: 0,
    y: 0,
    width: 24,
    height: 34.5,
    depth: 24,
    rotation: 0,
    ...overrides,
  };
}

describe("buildAttachedFillerPlacement", () => {
  it("places a B24 with a 1/2-inch left cut from existing BF3 stock without inventing a short SKU", () => {
    const result = buildAttachedFillerPlacement({
      cabinet: cabinet(),
      placed: [],
      room,
      choice: { leftIn: 0.5, rightIn: 0 },
      catalogFillers: stock,
      makeUid: (() => { let index = 0; return () => `generated-${++index}`; })(),
      styleId: 7,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cabinet.x).toBe(0.5);
    expect(result.fillers).toHaveLength(1);
    expect(result.fillers[0]).toMatchObject({
      masterCode: "BF3",
      width: 0.5,
      nominalWidth: 3,
      fillerBillingRole: "primary",
      fillerAttachmentSide: "left",
      fillerForCabinetUid: "b24",
      fillerNeedsReview: false,
    });
    expect(result.fillers[0].description).toContain("field cut from this CabinetDealz stock board");
  });

  it("keeps independent physical stock identities for W3030 fillers on both sides", () => {
    const left = cabinet({ uid: "left", masterCode: "W2430", placement: "wall", width: 24, depth: 12, height: 30, x: 0 });
    const target = cabinet({ uid: "target", masterCode: "W3030", placement: "wall", width: 30, depth: 12, height: 30, x: 24 });
    const right = cabinet({ uid: "right", masterCode: "W2430", placement: "wall", width: 24, depth: 12, height: 30, x: 57 });
    const result = buildAttachedFillerPlacement({
      cabinet: target,
      placed: [left, right],
      room,
      choice: { leftIn: 1.5, rightIn: 1.5 },
      catalogFillers: stock,
      makeUid: (() => { let index = 0; return () => `generated-${++index}`; })(),
      styleId: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cabinet.x).toBe(25.5);
    expect(result.fillers.map((item) => [item.masterCode, item.width, item.fillerAttachmentSide, item.fillerPieceGroupId])).toEqual([
      ["WF3", 1.5, "left", "attached-filler-target-left-generated-1"],
      ["WF3", 1.5, "right", "attached-filler-target-right-generated-3"],
    ]);
    expect(result.fillers.every((item) => item.fillerBillingRole === "primary")).toBe(true);
  });
});
