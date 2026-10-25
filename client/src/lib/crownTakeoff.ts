import { CROWN_MITER_ALLOWANCE_IN } from "./design";

/**
 * Crown is cut on 45-degree miters, so an exposed outside turn consumes more
 * stock than the cabinet edge itself. Each physical outside turn joins two
 * crown pieces; both cut edges receive the owner's 4-inch takeoff allowance.
 */
export const CROWN_MITER_CUT_ALLOWANCE_IN = CROWN_MITER_ALLOWANCE_IN;

export type CrownTakeoffPoint = { x: number; z: number };

export type CrownTakeoffSegment = {
  start: CrownTakeoffPoint;
  end: CrownTakeoffPoint;
  length?: number;
};

export type CrownTakeoff = {
  rawLinearInches: number;
  exposedMiterCornerCount: number;
  miterCutEnds: number;
  miterAllowanceInches: number;
  totalLinearInches: number;
};

const ENDPOINT_TOLERANCE_IN = 0.25;
const STRAIGHT_JOIN_DOT_PRODUCT = 0.999;

type CrownEndpoint = {
  segmentIndex: number;
  vector: CrownTakeoffPoint;
};

function segmentLength(segment: CrownTakeoffSegment) {
  return segment.length ?? Math.hypot(segment.end.x - segment.start.x, segment.end.z - segment.start.z);
}

function endpointVector(segment: CrownTakeoffSegment, atStart: boolean): CrownTakeoffPoint {
  const dx = atStart ? segment.end.x - segment.start.x : segment.start.x - segment.end.x;
  const dz = atStart ? segment.end.z - segment.start.z : segment.start.z - segment.end.z;
  const length = Math.hypot(dx, dz);
  return length > 1e-9 ? { x: dx / length, z: dz / length } : { x: 0, z: 0 };
}

/**
 * Converts the actual exposed crown rails into an install takeoff. Collinear
 * cabinet-to-cabinet joins remain one straight run with no allowance. Every
 * exposed turn has two 45-degree cut ends, adding four inches to each adjacent
 * rail. A standard 12-by-12 upper therefore measures 16 + 20 + 16 = 52 inches.
 */
export function crownTakeoffFromExposedSegments(
  segments: CrownTakeoffSegment[],
  allowancePerMiterCutIn: number = CROWN_MITER_CUT_ALLOWANCE_IN,
): CrownTakeoff {
  const usable = segments.filter((segment) => segmentLength(segment) > 1e-6);
  const nodes: Array<{ point: CrownTakeoffPoint; endpoints: CrownEndpoint[] }> = [];

  const addEndpoint = (point: CrownTakeoffPoint, endpoint: CrownEndpoint) => {
    const node = nodes.find((candidate) => Math.hypot(candidate.point.x - point.x, candidate.point.z - point.z) <= ENDPOINT_TOLERANCE_IN);
    if (node) node.endpoints.push(endpoint);
    else nodes.push({ point, endpoints: [endpoint] });
  };

  usable.forEach((segment, segmentIndex) => {
    addEndpoint(segment.start, { segmentIndex, vector: endpointVector(segment, true) });
    addEndpoint(segment.end, { segmentIndex, vector: endpointVector(segment, false) });
  });

  let exposedMiterCornerCount = 0;
  for (const node of nodes) {
    // An exposed perimeter corner joins exactly two rails. More connections are
    // not an exposed two-piece miter and are deliberately left uncharged.
    if (node.endpoints.length !== 2) continue;
    const [first, second] = node.endpoints;
    if (first!.segmentIndex === second!.segmentIndex) continue;
    const dot = first!.vector.x * second!.vector.x + first!.vector.z * second!.vector.z;
    if (Math.abs(dot) < STRAIGHT_JOIN_DOT_PRODUCT) exposedMiterCornerCount += 1;
  }

  const rawLinearInches = usable.reduce((total, segment) => total + segmentLength(segment), 0);
  const miterCutEnds = exposedMiterCornerCount * 2;
  const miterAllowanceInches = miterCutEnds * allowancePerMiterCutIn;
  return {
    rawLinearInches,
    exposedMiterCornerCount,
    miterCutEnds,
    miterAllowanceInches,
    totalLinearInches: rawLinearInches + miterAllowanceInches,
  };
}
