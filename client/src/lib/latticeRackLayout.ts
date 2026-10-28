// Shared by the 3D scene and the 2D elevation so both draw the same diamonds.
export type ThreeDLatticeSlat = { family: "rising" | "falling"; x: number; y: number; length: number };

// Diagonal slat layout for a wine/lattice rack opening (all values in feet,
// centred on the opening). Slats run at 45 degrees in both directions and are
// clipped to the opening so nothing pokes through the frame.
//
// The diamond size comes from the SHORT side: it holds a whole number of
// diamond rows (about 6in each), so the top and bottom rows of bottles sit
// fully inside the opening, and the diamonds are centred along the long side.
// Laying the rack on its side or standing it upright therefore gives the same
// diamonds and the same bottle count. A 30 x 15 wall rack (about 28.9 x 13.9in
// inside) gets two rows: 4 + 3 + 4 = 11 bottle cells, matching LWR3015.
export function threeDLatticeRackLayout(openingWidth: number, openingHeight: number, targetDiamondIn = 6) {
  const width = Math.max(0, openingWidth);
  const height = Math.max(0, openingHeight);
  const hw = width / 2;
  const hh = height / 2;
  const longSide = Math.max(width, height);
  const shortSide = Math.min(width, height);
  const rowsAcrossShortSide = Math.max(1, Math.round(shortSide / (targetDiamondIn * (1 / 12))));
  const pitch = shortSide / rowsAcrossShortSide;
  const diamondsAlongLongSide = pitch > 0 ? Math.max(1, Math.floor(longSide / pitch + 1e-9)) : 0;
  const slats: ThreeDLatticeSlat[] = [];
  const bottleCells: Array<{ x: number; y: number }> = [];
  if (hw <= 0 || hh <= 0 || pitch <= 0) return { pitch, diamondsAlongLongSide, slats, bottleCells };
  const half = pitch / 2;
  // Work in (u along the long side, v along the short side) from the corner.
  // Swapping the axes mirrors across y = x, which keeps rising slats rising.
  const widthIsLong = width >= height;
  const toX = (u: number, v: number) => (widthIsLong ? u : v) - hw;
  const toY = (u: number, v: number) => (widthIsLong ? v : u) - hh;
  const u0 = (longSide - diamondsAlongLongSide * pitch) / 2;
  // Slats lie on u ± v = u0 + (odd) * half, clipped to [0, long] x [0, short].
  const reach = Math.ceil((longSide + shortSide) / half) + 1;
  for (let k = -reach; k <= reach; k++) {
    if (Math.abs(k % 2) !== 1) continue;
    const c = u0 + k * half;
    for (const lineFamily of ["rising", "falling"] as const) {
      const lo = lineFamily === "rising" ? Math.max(0, c) : Math.max(0, c - shortSide);
      const hi = lineFamily === "rising" ? Math.min(longSide, c + shortSide) : Math.min(longSide, c);
      if (hi - lo < 0.02) continue;
      const mid = (lo + hi) / 2;
      const v = lineFamily === "rising" ? mid - c : c - mid;
      // A line rising in (u, v) still rises in (x, y) after the swap above.
      slats.push({ family: lineFamily, x: toX(mid, v), y: toY(mid, v), length: (hi - lo) * Math.SQRT2 });
    }
  }
  // Every whole diamond is one bottle: centres at (u0 + i·half, j·half) with
  // i + j even, kept clear of the opening on all sides.
  for (let j = 1; j <= 2 * rowsAcrossShortSide - 1; j++) {
    for (let i = j % 2 ? 1 : 2; i <= 2 * diamondsAlongLongSide - 1; i += 2) {
      bottleCells.push({ x: toX(u0 + i * half, j * half), y: toY(u0 + i * half, j * half) });
    }
  }
  return { pitch, diamondsAlongLongSide, slats, bottleCells };
}
