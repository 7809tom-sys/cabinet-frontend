import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM, paletteActiveWallPlacementBlocker, type PlacedCabinet } from "@/lib/design";

const room = { ...DEFAULT_ROOM, width: 120, depth: 120 };
const base = (overrides: Partial<PlacedCabinet>): PlacedCabinet => ({
  uid: "x", cabinetId: 1, masterCode: "B24", description: "Base", placement: "base",
  x: 0, y: 0, width: 24, depth: 24, height: 34.5, rotation: 0, ...overrides,
});

describe("palette add blocker diagnostic", () => {
  it("names the item in the way when a free span is wide enough but the cabinet would still overlap it", () => {
    // An ordinary base on the LEFT wall sitting in the top-left corner does not
    // shorten the top wall's free span, but it is a real body at that corner.
    const leftWallCorner = base({ uid: "left-b24", masterCode: "B24", x: 0, y: 0, rotation: 90 });
    const result = paletteActiveWallPlacementBlocker("top", room, [leftWallCorner], [], 36, 24, "base");
    expect(result?.spanStartIn).toBe(0);
    expect(result?.blocker.cabinet.masterCode).toBe("B24");
    expect(result!.blocker.penetration).toBeGreaterThan(0);
  });

  it("returns nothing when there is simply no wide enough opening, or nothing is in the way", () => {
    const full = base({ uid: "b120", masterCode: "B96", width: 96 });
    expect(paletteActiveWallPlacementBlocker("top", room, [full], [], 36, 24, "base")).toBeNull();
    expect(paletteActiveWallPlacementBlocker("top", room, [], [], 36, 24, "base")).toBeNull();
  });
});

describe("Designer palette add error", () => {
  it("names the blocker instead of saying there is no opening when the span is wide enough", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("../pages/DesignTool.tsx", import.meta.url), "utf8");
    expect(source).toContain("const spanBlocker = paletteActiveWallPlacementBlocker(");
    expect(source).toContain("is wide enough, but ${c.masterCode} would overlap ${spanBlocker.blocker.cabinet.masterCode}");
  });
});
