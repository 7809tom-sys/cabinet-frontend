// Shared by the 3D scene and the 2D elevation so both draw the same dividers.

// Face frame around a plate rack opening, in inches.
export const PLATE_RACK_FRAME_IN = 1.5;

// Vertical dowel dividers for a plate rack opening (inches, centred on the
// opening). Each slot holds one plate on edge, about 2½in apart, so a PR30
// (30in wide, 27in inside the frame) gets 10 dividers holding 11 plates.
export function plateRackDividerLayout(openingWidthIn: number, slotPitchIn = 2.5) {
  const width = Math.max(0, openingWidthIn);
  const plates = Math.max(2, Math.round(width / slotPitchIn));
  const pitch = width / plates;
  const dividers = Array.from({ length: plates - 1 }, (_, index) => -width / 2 + pitch * (index + 1));
  return { plates, pitch, dividers };
}
