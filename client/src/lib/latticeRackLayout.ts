// Shared by the 3D scene and the 2D elevation so both draw the same diamonds.
export type ThreeDLatticeSlat = { family: "rising" | "falling"; x: number; y: number; length: number };

// Diagonal slat layout for a wine/lattice rack opening (all values in feet,
// centred on the opening). Slats run at 45 degrees in both directions and are
// clipped to the opening so nothing pokes through the frame. The pitch is
// derived from the LONG side, so a rack laid on its side and the same rack
// stood upright get an identical diamond size (the photo shows ~6in diamonds).
export function threeDLatticeRackLayout(openingWidth: number, openingHeight: number, targetDiamondIn = 6) {
  const hw = Math.max(0, openingWidth) / 2;
  const hh = Math.max(0, openingHeight) / 2;
  const longSide = Math.max(openingWidth, openingHeight);
  const diamondsAlongLongSide = Math.max(2, Math.round(longSide / (targetDiamondIn * (1 / 12))));
  const pitch = longSide / diamondsAlongLongSide;
  const slats: ThreeDLatticeSlat[] = [];
  if (hw <= 0 || hh <= 0 || pitch <= 0) return { pitch, diamondsAlongLongSide, slats };
  const reach = Math.ceil((hw + hh) / pitch) + 1;
  for (let k = -reach; k <= reach; k++) {
    // Offset by half a pitch so a whole diamond is centred in the opening.
    const c = (k + 0.5) * pitch;
    const lo = Math.max(-hw, c - hh);
    const hi = Math.min(hw, c + hh);
    if (hi - lo < 0.02) continue;
    const mid = (lo + hi) / 2;
    const length = (hi - lo) * Math.SQRT2;
    slats.push({ family: "rising", x: mid, y: mid - c, length });
  }
  for (let k = -reach; k <= reach; k++) {
    const c = (k + 0.5) * pitch;
    const lo = Math.max(-hw, c - hh);
    const hi = Math.min(hw, c + hh);
    if (hi - lo < 0.02) continue;
    const mid = (lo + hi) / 2;
    const length = (hi - lo) * Math.SQRT2;
    slats.push({ family: "falling", x: mid, y: c - mid, length });
  }
  return { pitch, diamondsAlongLongSide, slats };
}

