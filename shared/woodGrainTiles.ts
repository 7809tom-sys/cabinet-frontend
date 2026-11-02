/**
 * Wood grain tile sets for woodGrain color types.
 * Draft storage only: approved sets live in this browser's localStorage (no backend yet).
 */
export type Pt = { x: number; y: number };
export type Mat3 = [number, number, number, number, number, number, number, number, number];

/** Homography mapping src[i] -> dst[i] (4 point pairs), solved by Gaussian elimination. */
export function homography(src: Pt[], dst: Pt[]): Mat3 {
  if (src.length !== 4 || dst.length !== 4) throw new Error("homography needs 4 point pairs");
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i]; const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-12) throw new Error("degenerate quadrilateral");
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k];
    }
  }
  const h = A.map((row, i) => row[8] / row[i]);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

export function applyHomography(H: Mat3, p: Pt): Pt {
  const w = H[6] * p.x + H[7] * p.y + H[8];
  return { x: (H[0] * p.x + H[1] * p.y + H[2]) / w, y: (H[3] * p.x + H[4] * p.y + H[5]) / w };
}

/** Output rectangle size from the quad's edge lengths (keeps the panel's aspect). */
export function rectSizeForQuad(q: Pt[]): { w: number; h: number } {
  const d = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
  return { w: Math.round(Math.max(d(q[0], q[1]), d(q[3], q[2]))), h: Math.round(Math.max(d(q[0], q[3]), d(q[1], q[2]))) };
}

export const MIN_TILE_LONG_SIDE = 600;
export function tileQualityNote(w: number, h: number, sharpness: number, minSharpness = 20): string | null {
  if (Math.max(w, h) < MIN_TILE_LONG_SIDE) return `Rejected: ${Math.max(w, h)}px long side is below ${MIN_TILE_LONG_SIDE}px`;
  if (sharpness < minSharpness) return `Rejected: too blurry (sharpness ${sharpness.toFixed(1)} < ${minSharpness})`;
  return null;
}

/** Variance of a 4-neighbour Laplacian on luminance: a standard blur score. */
export function laplacianVariance(lum: Float32Array, w: number, h: number): number {
  let sum = 0, sum2 = 0, n = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const l = lum[i - 1] + lum[i + 1] + lum[i - w] + lum[i + w] - 4 * lum[i];
    sum += l; sum2 += l * l; n++;
  }
  if (!n) return 0;
  const m = sum / n;
  return sum2 / n - m * m;
}

/** FNV-1a 32-bit. */
export function hashUid(uid: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < uid.length; i++) { h ^= uid.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

export interface TileAssignment { index: number; flipX: boolean; flipY: boolean; offsetU: number; offsetV: number }
/** Deterministic per-front tile: same uid → same tile/flip/offset; neighbours usually differ. */
export function assignTile(uid: string, tileCount: number): TileAssignment | null {
  if (tileCount <= 0) return null;
  const h = hashUid(uid);
  const h2 = hashUid(`${uid}#uv`);
  return {
    index: h % tileCount,
    flipX: ((h >>> 8) & 1) === 1,
    flipY: ((h >>> 9) & 1) === 1,
    offsetU: ((h2 & 0xff) / 255 - 0.5) * 0.06,
    offsetV: (((h2 >>> 8) & 0xff) / 255 - 0.5) * 0.06,
  };
}

export interface WoodGrainTile { id: string; dataUrl: string; w: number; h: number; keep: boolean; note: string | null }
export interface WoodGrainTileSet { styleId: number; colorName: string; tiles: WoodGrainTile[]; approvedAt: string | null }
const KEY = "walzcraftWoodGrainTileSets.v1";
type Store = Pick<Storage, "getItem" | "setItem">;
const ls = (): Store | null => (typeof localStorage !== "undefined" ? localStorage : null);

export function readTileSets(store: Store | null = ls()): Record<string, WoodGrainTileSet> {
  try { return JSON.parse(store?.getItem(KEY) ?? "{}"); } catch { return {}; }
}
export function saveTileSet(set: WoodGrainTileSet, store: Store | null = ls()) {
  if (!store) return;
  const all = readTileSets(store);
  all[String(set.styleId)] = set;
  store.setItem(KEY, JSON.stringify(all));
}
/** Approved, kept tiles for a style (what the Designer and the sample bake use). */
export function approvedTilesFor(styleId: number | null | undefined, store: Store | null = ls()): WoodGrainTile[] {
  if (styleId == null) return [];
  const set = readTileSets(store)[String(styleId)];
  if (!set?.approvedAt) return [];
  return set.tiles.filter((t) => t.keep && !t.note);
}
/** Designer hook: the tile (and flip/offset) a front gets, or null to keep the single door photo. */
/** Horizontal grain rotates every tile 90° (tiles are cut from vertical-grain panels). */
export function woodGrainTileForFront(styleId: number | null | undefined, uid: string, store: Store | null = ls(), opts: { horizontal?: boolean } = {}) {
  const tiles = approvedTilesFor(styleId, store);
  const a = assignTile(uid, tiles.length);
  return a ? { ...a, url: tiles[a.index].dataUrl, rotation: opts.horizontal ? Math.PI / 2 : 0 } : null;
}
