/**
 * Toe kicks are part of the physical cabinet elevation, not an optional
 * decorative trim overlay. Every floor-standing cabinet exposes the standard
 * recessed 4.5-inch toe-kick zone. Appliances stay excluded because they do
 * not use a cabinet toe-kick construction.
 */
export function toeKickHeightForElevation(
  placement: string | null | undefined,
  rawBottom: number,
  standardHeight: number,
): number {
  const sitsOnFloor = rawBottom < standardHeight;
  const isCabinetPlacement = placement === "base" || placement === "tall" || placement === "wall";
  return sitsOnFloor && isCabinetPlacement ? standardHeight : 0;
}
