/**
 * Farmhouse (apron-front) sink base — the one shared definition of its face.
 *
 * A real FSB (for example the 36" x 34.5" x 24" Hampton Bay KSBD36 or the
 * American Made UFSB36) has NO top rail and NO false drawer front. The sink's
 * finished apron slab occupies the TOP of the face, hung from the underside of
 * the countertop, and TWO DOORS fill the lower face beneath it, down to the toe
 * kick. The apron sits flush with, or up to about one inch proud of, the doors.
 *
 * Before this module the 3D scene drew a tall apron box in the middle of the
 * face with a false drawer front above it and two doors BESIDE it, while the
 * elevation drew a normal 20% false front over two doors. Both are wrong, so
 * every renderer now reads these numbers.
 */

/** The apron hangs 10" below the counter top; 8.5" of that covers the cabinet face
 *  (the counter slab itself covers the top 1.5"). */
export const FARMHOUSE_SINK_APRON_DROP_IN = 8.5;
/** The installed apron projects at most about 1" past the door face. */
export const FARMHOUSE_SINK_APRON_PROUD_IN = 0.5;
/** Doors are only used from this width up as a pair; narrower bases get one door. */
export const FARMHOUSE_SINK_TWO_DOOR_MIN_WIDTH_IN = 27;

export function farmhouseSinkApronSideInsetIn(cabinetWidthIn: number): number {
  return Math.min(1.5, Math.max(0.75, cabinetWidthIn * 0.04));
}

export function farmhouseSinkBaseDoorCount(cabinetWidthIn: number, configuredDoorCount = 0): number {
  if (cabinetWidthIn >= FARMHOUSE_SINK_TWO_DOOR_MIN_WIDTH_IN) return 2;
  return Math.max(1, Math.min(2, Math.round(configuredDoorCount) || 1));
}

/**
 * Face zones measured from the TOP of the visible face downward.
 * `faceHeightIn` is the height of the face the caller draws (34.5" in a wall
 * elevation, 30" for the 3D carcass above its 4.5" toe kick).
 */
export function farmhouseSinkBaseFaceLayout(cabinetWidthIn: number, faceHeightIn: number, configuredDoorCount = 0) {
  const apronZoneIn = Math.min(FARMHOUSE_SINK_APRON_DROP_IN, Math.max(0, faceHeightIn * 0.4));
  const sideInsetIn = farmhouseSinkApronSideInsetIn(cabinetWidthIn);
  return {
    apronZoneIn,
    apronWidthIn: Math.max(0, cabinetWidthIn - sideInsetIn * 2),
    sideInsetIn,
    doorZoneIn: Math.max(0, faceHeightIn - apronZoneIn),
    doorCount: farmhouseSinkBaseDoorCount(cabinetWidthIn, configuredDoorCount),
    /** Percent of the face height taken by the apron zone (top) in a 2D elevation. */
    apronZonePct: faceHeightIn > 0 ? (apronZoneIn / faceHeightIn) * 100 : 0,
  };
}
