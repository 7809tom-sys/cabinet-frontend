import { describe, it, expect } from "vitest";
import { homography, applyHomography, assignTile, woodGrainTileForFront, saveTileSet, tileQualityNote, laplacianVariance } from "./woodGrainTiles";
const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };
describe("homography", () => {
  it("maps the 4 corners exactly and is projective in between", () => {
    const src = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 200 }, { x: 0, y: 200 }];
    const dst = [{ x: 10, y: 12 }, { x: 95, y: 20 }, { x: 90, y: 230 }, { x: 5, y: 210 }];
    const H = homography(src, dst);
    src.forEach((p, i) => { const q = applyHomography(H, p); expect(q.x).toBeCloseTo(dst[i].x, 6); expect(q.y).toBeCloseTo(dst[i].y, 6); });
  });
  it("identity for identical quads; throws on degenerate", () => {
    const sq = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    const q = applyHomography(homography(sq, sq), { x: 0.3, y: 0.7 });
    expect(q.x).toBeCloseTo(0.3); expect(q.y).toBeCloseTo(0.7);
    expect(() => homography(sq, [sq[0], sq[0], sq[0], sq[0]].map((p) => ({ ...p })))).toThrow();
  });
});
describe("tile assignment", () => {
  it("is deterministic per uid with small offsets and spreads across tiles", () => {
    expect(assignTile("cab-1", 8)).toEqual(assignTile("cab-1", 8));
    expect(assignTile("x", 0)).toBeNull();
    const used = new Set<number>(); const flips = new Set<string>();
    for (let i = 0; i < 60; i++) { const a = assignTile(`cab-${i}`, 8)!; used.add(a.index); flips.add(`${a.flipX}${a.flipY}`);
      expect(Math.abs(a.offsetU)).toBeLessThanOrEqual(0.03); expect(Math.abs(a.offsetV)).toBeLessThanOrEqual(0.03); }
    expect(used.size).toBeGreaterThanOrEqual(6); expect(flips.size).toBe(4);
  });
  it("uses only approved kept tiles, else falls back (null)", () => {
    const s = mem();
    expect(woodGrainTileForFront(5, "a", s)).toBeNull();
    saveTileSet({ styleId: 5, colorName: "Forest Rust", approvedAt: null, tiles: [{ id: "1", dataUrl: "data:a", w: 700, h: 900, keep: true, note: null }] }, s);
    expect(woodGrainTileForFront(5, "a", s)).toBeNull();
    saveTileSet({ styleId: 5, colorName: "Forest Rust", approvedAt: "now", tiles: [
      { id: "1", dataUrl: "data:a", w: 700, h: 900, keep: true, note: null },
      { id: "2", dataUrl: "data:b", w: 700, h: 900, keep: false, note: null },
      { id: "3", dataUrl: "data:c", w: 300, h: 400, keep: true, note: "Rejected" }] }, s);
    expect(woodGrainTileForFront(5, "anything", s)?.url).toBe("data:a");
    expect(woodGrainTileForFront(5, "anything", s, { horizontal: true })?.rotation).toBeCloseTo(Math.PI / 2);
    expect(woodGrainTileForFront(5, "anything", s)?.rotation).toBe(0);
  });
});
describe("tile quality", () => {
  it("rejects small or blurry tiles", () => {
    expect(tileQualityNote(500, 400, 100)).toMatch(/600px/);
    expect(tileQualityNote(800, 600, 1)).toMatch(/blurry/);
    expect(tileQualityNote(800, 600, 100)).toBeNull();
    expect(laplacianVariance(new Float32Array(100).fill(5), 10, 10)).toBe(0);
  });
});
