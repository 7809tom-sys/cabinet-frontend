/**
 * Returns the visible appliance opening inside an oven cabinet face. A single
 * oven always receives a three-inch total reduction from its surrounding
 * enclosure, centered as 1.5-inch reveals on both sides. Therefore a 30-inch
 * cabinet receives the required 27-inch opening. Double ovens retain the full
 * cabinet-face width unless a future Cabinet Config override is supplied.
 */
export function ovenOpeningGeometry(cabinetWidthIn: number, ovenType?: "single" | "double" | null) {
  const cabinetWidth = Math.max(0, Number.isFinite(cabinetWidthIn) ? cabinetWidthIn : 0);
  const reduction = ovenType === "single" ? Math.min(3, cabinetWidth) : 0;
  const width = Math.max(0, cabinetWidth - reduction);
  return {
    width,
    horizontalInset: (cabinetWidth - width) / 2,
  };
}
