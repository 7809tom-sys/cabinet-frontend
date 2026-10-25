import { describe, expect, it } from "vitest";
import { buildPhotoCartItems } from "./photoToCartItems";

describe("buildPhotoCartItems", () => {
  it("builds selected-style cart items with handwritten-order quantities", () => {
    const items = buildPhotoCartItems(
      [
        { masterCode: "B-12", description: "Base 12", matched: true, quantity: 3 },
        { masterCode: "B-24", description: "Base 24", matched: true, quantity: 4 },
        { masterCode: "SB-36", description: "Sink Base 36", matched: true, quantity: 2 },
        { masterCode: "W-2142", description: "Wall 21 x 42", matched: true, quantity: 1 },
        { masterCode: null, description: null, matched: false, quantity: 9 },
      ],
      { id: 330005, label: "Zenith Sage (Ashford)" },
      "contractor",
    );

    expect(items).toEqual([
      expect.objectContaining({ masterCode: "B-12", qty: 3, styleId: 330005 }),
      expect.objectContaining({ masterCode: "B-24", qty: 4, styleId: 330005 }),
      expect.objectContaining({ masterCode: "SB-36", qty: 2, styleId: 330005 }),
      expect.objectContaining({ masterCode: "W-2142", qty: 1, styleId: 330005 }),
    ]);
  });
});
