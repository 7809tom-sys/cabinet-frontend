import { describe, expect, it } from "vitest";
import { addStudioBay, addStudioConnectedCorner, createStudioDesign, removeStudioBay, snapStudioBasketPlacement, STUDIO_BASKET_REFERENCE_OPTIONS, studioBasketPlacements, studioBays, studioCornerShelves } from "./vendorClosetStudio";

const twoBays = () => { const r = addStudioBay(createStudioDesign(), 24); if (!r.ok) throw new Error(r.reason); return r.design; };

describe("removeStudioBay", () => {
  it("removes the selected tower with its items and selects a neighbour", () => {
    const design = twoBays();
    const removedId = design.bays[0].id;
    const result = removeStudioBay(design, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.design.bays).toHaveLength(1);
    expect(result.design.bays.some((b) => b.id === removedId)).toBe(false);
    expect(studioBays(result.design, "back")).toHaveLength(1);
    expect(result.nextSelectedBay).toBe(0);
    const last = removeStudioBay(design, 1);
    expect(last.ok && last.nextSelectedBay).toBe(0);
  });

  it("returns -1 selection when the last tower is removed and rejects a missing tower", () => {
    const result = removeStudioBay(createStudioDesign(), 0);
    expect(result.ok && result.nextSelectedBay).toBe(-1);
    expect(result.ok && result.design.bays).toEqual([]);
    expect(removeStudioBay(createStudioDesign(), 5).ok).toBe(false);
  });

  it("drops baskets placed in the removed tower only", () => {
    const sku = STUDIO_BASKET_REFERENCE_OPTIONS.find((o) => o.nominalWidthIn === 24)!.sku;
    const a = snapStudioBasketPlacement(twoBays(), 0, sku, undefined, "b0");
    if (!a.ok) throw new Error(a.reason);
    const b = snapStudioBasketPlacement(a.design, 1, sku, undefined, "b1");
    if (!b.ok) throw new Error(b.reason);
    const result = removeStudioBay(b.design, 0);
    if (!result.ok) throw new Error(result.reason);
    expect(result.removedBasketIds).toEqual(["b0"]);
    expect(studioBasketPlacements(result.design).map((p) => p.id)).toEqual(["b1"]);
  });

  it("removes a connected corner shelf when its wall loses its last tower", () => {
    const base = { ...createStudioDesign(), wallWidthIn: 144, roomDepthIn: 120 };
    const connected = addStudioConnectedCorner(base, "back-right", "adjustable", 36, "pie");
    if (!connected.ok) throw new Error(connected.reason);
    let design = connected.design;
    while (design.bays.length > 1) { const r = removeStudioBay(design, 0); if (!r.ok) throw new Error(r.reason); expect(studioCornerShelves(r.design)).toHaveLength(1); design = r.design; }
    const result = removeStudioBay(design, 0);
    if (!result.ok) throw new Error(result.reason);
    expect(result.removedCornerIds).toEqual(["pie"]);
    expect(studioCornerShelves(result.design)).toEqual([]);
  });
});
