import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { mergedElevationTrimRuns } from "./ElevationView";
import { addCabinet, addThreeDCrownMolding, crownMiterEndpointTrims, diagonalCornerCrownSegments, threeDCrownMiterJoints, threeDCrownPerimeterSegments } from "./InteractiveRoom3D";
import { crownLinearInches, isCrownEligibleCabinet } from "@/lib/design";
import { crownTakeoffFromExposedSegments } from "@/lib/crownTakeoff";

describe("continuous cabinet trim", () => {
  it("merges edge-touching crown and toe-kick intervals but preserves true openings", () => {
    expect(mergedElevationTrimRuns([
      { start: 0, end: 24, level: 96, uid: "a" },
      { start: 24, end: 54, level: 96, uid: "b" },
      { start: 60, end: 84, level: 96, uid: "c" },
    ])).toEqual([
      { start: 0, end: 54, level: 96, anchorUid: "a" },
      { start: 60, end: 84, level: 96, anchorUid: "c" },
    ]);
  });

  it("keeps separately elevated upper runs separate", () => {
    expect(mergedElevationTrimRuns([
      { start: 0, end: 24, level: 96, uid: "a" },
      { start: 24, end: 48, level: 84, uid: "b" },
    ])).toHaveLength(2);
  });

		it("keeps touching same-depth cabinet fronts continuous and returns only at the two run ends", () => {
	  const root = new THREE.Group();
	  const cabinets = [
	    { uid: "w24", cabinetId: 1, masterCode: "W-24-42", description: "Wall", placement: "wall", x: 0, y: 0, width: 24, height: 42, depth: 12, rotation: 0, mountBottom: 54 },
	    { uid: "w30", cabinetId: 2, masterCode: "W-30-42", description: "Wall", placement: "wall", x: 24, y: 0, width: 30, height: 42, depth: 12, rotation: 0, mountBottom: 54 },
	  ] as never[];
	  const room = { width: 120, depth: 96, ceilingHeight: 96 };
	  const segments = threeDCrownPerimeterSegments(cabinets, room);
	  addThreeDCrownMolding(root, cabinets, room, undefined, "#ffffff");

	  expect(segments.filter((segment) => segment.kind === "front")).toHaveLength(2);
	  expect(segments.filter((segment) => segment.kind.endsWith("return"))).toHaveLength(2);
	  expect(segments.some((segment) => segment.kind.endsWith("return") && Math.abs(segment.center.x - 24) < 0.01)).toBe(false);
		  expect(root.children).toHaveLength(4);
		    expect(root.children.every((rail) => rail.userData.crownMolding === true)).toBe(true);
		    expect(root.children.every((rail) => rail.userData.angledCrownProfile === true && rail.userData.crownProfileAngleDegrees === 45 && rail.userData.isUprightCrownProfile === false)).toBe(true);
			    for (const rail of root.children) {
			      const positions = (rail as THREE.Mesh).geometry.getAttribute("position");
			      const lowerInner = new THREE.Vector3().fromBufferAttribute(positions, 0);
			      const upperInner = new THREE.Vector3().fromBufferAttribute(positions, 1);
			      const lowerFarEnd = new THREE.Vector3().fromBufferAttribute(positions, 4);
			      const alongRail = lowerFarEnd.sub(lowerInner).normalize();
			      const rawProfile = upperInner.sub(lowerInner);
			      const profileVector = rawProfile.clone().sub(alongRail.multiplyScalar(rawProfile.dot(alongRail)));
			      expect(profileVector.y).toBeCloseTo(Math.hypot(profileVector.x, profileVector.z), 6);
			    }
		    expect(threeDCrownMiterJoints(segments)).toHaveLength(2);
		    expect(root.children.some((piece) => piece.userData.crownMiterReturn === true || piece.userData.crownMiterSeam === true)).toBe(false);
		  });

		  it("uses the exposed W1230 crown perimeter for a 16-20-16 mitered takeoff", () => {
	    const room = { width: 120, depth: 96, ceilingHeight: 96 };
	    const segments = threeDCrownPerimeterSegments([
	      { uid: "w1230", cabinetId: 1, masterCode: "W-12-30", description: "Wall", placement: "wall", x: 0, y: 0, width: 12, height: 30, depth: 12, rotation: 0, mountBottom: 54 },
	    ] as never[], room);
	    const takeoff = crownTakeoffFromExposedSegments(segments);

	    expect(segments.map((segment) => segment.length)).toEqual([12, 12, 12]);
	    expect(takeoff.rawLinearInches).toBe(36);
	    expect(takeoff.exposedMiterCornerCount).toBe(2);
		  expect(takeoff.miterAllowanceInches).toBe(16);
			  expect(takeoff.totalLinearInches).toBe(52);
			  expect(threeDCrownMiterJoints(segments)).toEqual([
			    expect.objectContaining({ miterAngleDegrees: 45 }),
			    expect.objectContaining({ miterAngleDegrees: 45 }),
			  ]);
			  const trims = crownMiterEndpointTrims(segments, 3);
			  expect(trims.flatMap((trim) => [trim.startTopShift, trim.endTopShift]).filter((shift) => Math.abs(shift) > 1e-6)).toHaveLength(4);
			  expect(segments.map((segment) => segment.length)).toEqual([12, 12, 12]);
		  });

		  it.each([0, 90, 180, 270])("terminates each rotated W1230 outside miter at one raised apex without changing its measured base edge", (rotation) => {
		    const room = { width: 120, depth: 96, ceilingHeight: 96 };
		    const cabinets = [
		      { uid: `w1230-${rotation}`, cabinetId: 1, masterCode: "W-12-30", description: "Wall", placement: "wall", x: 60, y: 48, width: 12, height: 30, depth: 12, rotation, mountBottom: 54 },
		    ] as never[];
		    const segments = threeDCrownPerimeterSegments(cabinets, room);
		    const root = new THREE.Group();
		    addThreeDCrownMolding(root, cabinets, room, undefined, "#ffffff");

		    expect(crownTakeoffFromExposedSegments(segments).totalLinearInches).toBe(52);
		    for (const joint of threeDCrownMiterJoints(segments)) {
		      const endpoints = segments.flatMap((segment, segmentIndex) => [
		        { segment, segmentIndex, atStart: true, point: segment.start },
		        { segment, segmentIndex, atStart: false, point: segment.end },
		      ]).filter((endpoint) => Math.hypot(endpoint.point.x - joint.point.x, endpoint.point.z - joint.point.z) <= 0.25);
		      expect(endpoints).toHaveLength(2);
		      const [first, second] = endpoints;
		      const readVertex = (endpoint: NonNullable<typeof first>, elevated: boolean) => {
		        const positions = ((root.children[endpoint.segmentIndex] as THREE.Mesh).geometry.getAttribute("position"));
		        const index = endpoint.atStart ? (elevated ? 1 : 0) : (elevated ? 5 : 4);
		        return new THREE.Vector3().fromBufferAttribute(positions, index);
		      };
		      const firstRaisedEdge = readVertex(first!, true);
		      const secondRaisedEdge = readVertex(second!, true);
		      expect(firstRaisedEdge.distanceTo(secondRaisedEdge)).toBeLessThan(1e-6);
		      for (const endpoint of endpoints) {
		        const measuredBase = endpoint.atStart ? endpoint.segment.start : endpoint.segment.end;
		        const renderedBase = readVertex(endpoint, false);
		        expect(renderedBase.x).toBeCloseTo(measuredBase.x / 12, 6);
		        expect(renderedBase.z).toBeCloseTo(measuredBase.z / 12, 6);
		      }
		    }
		  });

		  it("excludes every island or 4½-inch floor-seated wall cabinet from 3D crown and crown ordering", () => {
    const room = { width: 144, depth: 120, ceilingHeight: 96 };
    const elevatedUpper = {
      uid: "upper", cabinetId: 1, masterCode: "W-24-42", description: "Elevated upper",
      placement: "wall", x: 0, y: 0, width: 24, height: 42, depth: 12, rotation: 0, mountBottom: 54,
    } as never;
    const floorWall = {
      uid: "floor-wall", cabinetId: 2, masterCode: "W-24-30", description: "Floor-seated wall cabinet",
      placement: "wall", x: 24, y: 0, width: 24, height: 30, depth: 12, rotation: 0, mountBottom: 4.5,
    } as never;
    const restoredIslandWall = {
      uid: "island-wall", cabinetId: 3, masterCode: "W-30-30", description: "Restored island wall cabinet",
      placement: "wall", x: 36, y: 54, width: 30, height: 30, depth: 12, rotation: 180, mountBottom: 54,
      islandFace: "Back", islandCounterHeightWallCabinet: true,
    } as never;
    const tall = {
      uid: "tall", cabinetId: 4, masterCode: "UC2496", description: "Tall pantry",
      placement: "tall", x: 48, y: 0, width: 24, height: 96, depth: 24, rotation: 0, mountBottom: 0,
    } as never;
    const cabinets = [elevatedUpper, floorWall, restoredIslandWall, tall];

    expect(isCrownEligibleCabinet(elevatedUpper, room)).toBe(true);
    expect(isCrownEligibleCabinet(tall, room)).toBe(true);
    expect(isCrownEligibleCabinet(floorWall, room)).toBe(false);
    expect(isCrownEligibleCabinet(restoredIslandWall, room)).toBe(false);
    expect(new Set(threeDCrownPerimeterSegments(cabinets, room).map((segment) => segment.ownerUid)))
      .toEqual(new Set(["upper", "tall"]));
    expect(crownLinearInches(cabinets, room)).toBeCloseTo(24 + 24 + 3, 6);
  });

		it("removes internal crown returns across one-eighth-inch legacy offsets in the final Three.js mesh", () => {
		  const root = new THREE.Group();
		  const room = { width: 120, depth: 96, ceilingHeight: 96 };
		  const cabinets = [
		    { uid: "left", cabinetId: 101, masterCode: "W-24-42", description: "Wall", placement: "wall", x: 0, y: 0, width: 24, height: 42, depth: 12, rotation: 0, mountBottom: 54 },
		    { uid: "right", cabinetId: 102, masterCode: "W-30-42", description: "Wall", placement: "wall", x: 24.125, y: 0.125, width: 30, height: 42, depth: 12, rotation: 0, mountBottom: 54.125 },
		  ] as never[];

		  const segments = threeDCrownPerimeterSegments(cabinets, room);
		  addThreeDCrownMolding(root, cabinets, room, undefined, "#ffffff");

		  expect(segments.filter((segment) => segment.kind.endsWith("return"))).toHaveLength(2);
		  expect(segments.some((segment) => segment.kind.endsWith("return") && Math.abs(segment.center.x - 24) < 0.5)).toBe(false);
		  expect(root.children.filter((rail) => rail.userData.crownMoldingReturn)).toHaveLength(2);
		});

		it.each([
		  ["back", { x: 0, y: 0, rotation: 0 }, { x: 24.125, y: 0.125, rotation: 0 }],
		  ["front", { x: 0, y: 84, rotation: 180 }, { x: 24.125, y: 83.875, rotation: 180 }],
		  ["left", { x: 0, y: 0, rotation: 90 }, { x: 0.125, y: 24.125, rotation: 90 }],
		  ["right", { x: 108, y: 0, rotation: 270 }, { x: 107.875, y: 24.125, rotation: 270 }],
		] as const)("keeps only true run-end returns on the %s wall with legacy eighth-inch offsets", (_wall, first, second) => {
		  const root = new THREE.Group();
		  const room = { width: 120, depth: 96, ceilingHeight: 96 };
		  const cabinets = [
		    { uid: "first", cabinetId: 121, masterCode: "W-24-42", description: "Wall", placement: "wall", ...first, width: 24, height: 42, depth: 12, mountBottom: 54 },
		    { uid: "second", cabinetId: 122, masterCode: "W-30-42", description: "Wall", placement: "wall", ...second, width: 30, height: 42, depth: 12, mountBottom: 54.125 },
		  ] as never[];

		  addThreeDCrownMolding(root, cabinets, room, undefined, "#ffffff");
		  expect(root.children.filter((rail) => rail.userData.crownMoldingReturn)).toHaveLength(2);
		});

		it("keeps both crown returns on each side of a true one-inch opening", () => {
		  const room = { width: 120, depth: 96, ceilingHeight: 96 };
		  const segments = threeDCrownPerimeterSegments([
		    { uid: "left", cabinetId: 111, masterCode: "W-24-42", description: "Wall", placement: "wall", x: 0, y: 0, width: 24, height: 42, depth: 12, rotation: 0, mountBottom: 54 },
		    { uid: "right", cabinetId: 112, masterCode: "W-30-42", description: "Wall", placement: "wall", x: 25, y: 0, width: 30, height: 42, depth: 12, rotation: 0, mountBottom: 54 },
		  ] as never[], room);

		  expect(segments.filter((segment) => segment.kind.endsWith("return"))).toHaveLength(4);
		});

		it("wraps the exposed 12-inch step when a 12-inch upper meets a 24-inch-deep cabinet", () => {
	  const room = { width: 120, depth: 96, ceilingHeight: 96 };
	  const segments = threeDCrownPerimeterSegments([
	    { uid: "w24", cabinetId: 21, masterCode: "W-24-42", description: "Wall", placement: "wall", x: 0, y: 0, width: 24, height: 42, depth: 12, rotation: 0, mountBottom: 54 },
	    { uid: "deep24", cabinetId: 22, masterCode: "W-24-42-D24", description: "24-inch deep wall cabinet", placement: "wall", x: 24, y: 0, width: 24, height: 42, depth: 24, rotation: 0, mountBottom: 54 },
	  ] as never[], room);
	  const transitionWrap = segments.find((segment) =>
	    segment.ownerUid === "deep24"
	    && segment.kind === "left-return"
	    && Math.abs(segment.center.x - 24) < 0.01,
	  );

	  expect(transitionWrap?.length).toBeCloseTo(12, 6);
	  expect(transitionWrap?.start.z).toBeCloseTo(24, 6);
	  expect(transitionWrap?.end.z).toBeCloseTo(12, 6);
		  expect(segments.some((segment) => segment.ownerUid === "w24" && segment.kind === "right-return")).toBe(false);
		});

		it("keeps only the exposed right-side depth-step wrap where an adjacent upper joins the refrigerator bridge", () => {
		  const room = { width: 120, depth: 96, ceilingHeight: 96 };
		  const segments = threeDCrownPerimeterSegments([
		    { uid: "fridge-bridge", cabinetId: 201, masterCode: "WR3630", description: "Refrigerator bridge cabinet", placement: "wall", x: 0, y: 0, width: 36, height: 30, depth: 24, rotation: 0, mountBottom: 66 },
		    { uid: "right-upper", cabinetId: 202, masterCode: "W-24-30", description: "Wall", placement: "wall", x: 36, y: 0, width: 24, height: 30, depth: 12, rotation: 0, mountBottom: 66 },
		  ] as never[], room);

		  const exposedWrap = segments.find((segment) => segment.ownerUid === "fridge-bridge" && segment.kind === "right-return");
		  expect(exposedWrap?.length).toBeCloseTo(12, 6);
		  expect(Math.min(exposedWrap!.start.z, exposedWrap!.end.z)).toBeCloseTo(12, 6);
		  expect(Math.max(exposedWrap!.start.z, exposedWrap!.end.z)).toBeCloseTo(24, 6);
		  expect(segments.some((segment) => segment.ownerUid === "fridge-bridge" && segment.kind === "front")).toBe(true);
		  expect(segments.filter((segment) => segment.kind.endsWith("return"))).toHaveLength(3);
		});

		it("keeps only the exposed left-side depth-step wrap where an adjacent upper joins the refrigerator bridge", () => {
		  const room = { width: 120, depth: 96, ceilingHeight: 96 };
		  const segments = threeDCrownPerimeterSegments([
		    { uid: "left-upper", cabinetId: 211, masterCode: "W-24-30", description: "Wall", placement: "wall", x: 0, y: 0, width: 24, height: 30, depth: 12, rotation: 0, mountBottom: 66 },
		    { uid: "fridge-bridge", cabinetId: 212, masterCode: "WR3630", description: "Refrigerator bridge cabinet", placement: "wall", x: 24, y: 0, width: 36, height: 30, depth: 24, rotation: 0, mountBottom: 66 },
		  ] as never[], room);

		  const exposedWrap = segments.find((segment) => segment.ownerUid === "fridge-bridge" && segment.kind === "left-return");
		  expect(exposedWrap?.length).toBeCloseTo(12, 6);
		  expect(Math.min(exposedWrap!.start.z, exposedWrap!.end.z)).toBeCloseTo(12, 6);
		  expect(Math.max(exposedWrap!.start.z, exposedWrap!.end.z)).toBeCloseTo(24, 6);
		  expect(segments.some((segment) => segment.ownerUid === "fridge-bridge" && segment.kind === "front")).toBe(true);
		  expect(segments.filter((segment) => segment.kind.endsWith("return"))).toHaveLength(3);
		});

		it("keeps a refrigerator bridge return when that side is a true exposed run end", () => {
		  const room = { width: 120, depth: 96, ceilingHeight: 96 };
		  const segments = threeDCrownPerimeterSegments([
		    { uid: "fridge-bridge", cabinetId: 221, masterCode: "WR3630", description: "Refrigerator bridge cabinet", placement: "wall", x: 0, y: 0, width: 36, height: 30, depth: 24, rotation: 0, mountBottom: 66 },
		  ] as never[], room);

		  expect(segments.filter((segment) => segment.kind.endsWith("return"))).toHaveLength(2);
		});

		it("keeps one unbroken outside crown perimeter across a shallow-deep-shallow refrigerator wall", () => {
		  const root = new THREE.Group();
		  const room = { width: 120, depth: 96, ceilingHeight: 96 };
		  const cabinets = [
		    { uid: "far-left", cabinetId: 231, masterCode: "W-24-30", description: "Wall", placement: "wall", x: 0, y: 0, width: 24, height: 30, depth: 12, rotation: 0, mountBottom: 66 },
		    { uid: "fridge-bridge", cabinetId: 232, masterCode: "WR3630", description: "Refrigerator bridge cabinet", placement: "wall", x: 24, y: 0, width: 36, height: 30, depth: 24, rotation: 0, mountBottom: 66 },
		    { uid: "far-right", cabinetId: 233, masterCode: "W-30-30", description: "Wall", placement: "wall", x: 60, y: 0, width: 30, height: 30, depth: 12, rotation: 0, mountBottom: 66 },
		  ] as never[];

		  const segments = threeDCrownPerimeterSegments(cabinets, room);
		  addThreeDCrownMolding(root, cabinets, room, undefined, "#ffffff");
		  const returns = segments.filter((segment) => segment.kind.endsWith("return"));
		  const bridgeReturns = returns.filter((segment) => segment.ownerUid === "fridge-bridge");

		  expect(returns).toHaveLength(4);
		  expect(bridgeReturns).toHaveLength(2);
		  expect(bridgeReturns.every((segment) => Math.abs(segment.length - 12) < 1e-6)).toBe(true);
		  expect(bridgeReturns.every((segment) => Math.min(segment.start.z, segment.end.z) >= 12 - 1e-6)).toBe(true);
		  expect(root.children.filter((rail) => rail.userData.crownMoldingReturn)).toHaveLength(4);
		  expect(root.children.every((rail) => rail.userData.exposedTopEdge === true)).toBe(true);
		});

		it("includes full-height tall cabinets in the refrigerator-wall footprint union", () => {
		  const root = new THREE.Group();
		  const room = { width: 120, depth: 96, ceilingHeight: 96 };
		  const cabinets = [
		    { uid: "tall-left", cabinetId: 241, masterCode: "UC2496", description: "Tall utility cabinet", placement: "tall", x: 0, y: 0, width: 24, height: 96, depth: 24, rotation: 0, mountBottom: 0 },
		    { uid: "fridge-bridge", cabinetId: 242, masterCode: "WR3630", description: "Refrigerator bridge cabinet", placement: "wall", x: 24, y: 0, width: 36, height: 30, depth: 24, rotation: 0, mountBottom: 66 },
		    { uid: "right-upper", cabinetId: 243, masterCode: "W-30-30", description: "Wall", placement: "wall", x: 60, y: 0, width: 30, height: 30, depth: 12, rotation: 0, mountBottom: 66 },
		  ] as never[];

		  const segments = threeDCrownPerimeterSegments(cabinets, room);
		  addThreeDCrownMolding(root, cabinets, room, undefined, "#ffffff");
		  const bridgeReturns = segments.filter((segment) => segment.ownerUid === "fridge-bridge" && segment.kind.endsWith("return"));

		  expect(bridgeReturns).toHaveLength(1);
		  expect(bridgeReturns[0]?.length).toBeCloseTo(12, 6);
		  expect(Math.min(bridgeReturns[0]!.start.z, bridgeReturns[0]!.end.z)).toBeCloseTo(12, 6);
		  expect(Math.max(bridgeReturns[0]!.start.z, bridgeReturns[0]!.end.z)).toBeCloseTo(24, 6);
		  expect(segments.some((segment) => segment.ownerUid === "tall-left" && segment.kind === "front")).toBe(true);
		  expect(root.children.every((rail) => rail.userData.exposedTopEdge === true)).toBe(true);
		});

		it("follows the WDC42 pentagonal top with two 12-inch returns and its 17-inch diagonal front", () => {
	  const segments = diagonalCornerCrownSegments(24, 24);
	  expect(segments.map((segment) => segment.kind)).toEqual(["right-return", "diagonal-front", "left-return"]);
	  expect(segments.map((segment) => segment.length)).toEqual([
	    12,
	    Math.hypot(12, 12),
	    12,
	  ]);
	  expect(segments.some((segment) => Math.abs(segment.length - 24) < 1e-9)).toBe(false);
	});

		it("renders the same three-piece diagonal WDC42 crown at all four room corners without a square cap", () => {
	  const root = new THREE.Group();
	  const room = { width: 120, depth: 96, ceilingHeight: 96 };
	  addThreeDCrownMolding(root, [
	    { uid: "wdc-top-left", cabinetId: 11, masterCode: "WDC2442", description: "Wall Diagonal Corner", placement: "wall", x: 0, y: 0, width: 24, height: 42, depth: 24, rotation: 0, mountBottom: 54, cornerType: "diagonal" },
	    { uid: "wdc-top-right", cabinetId: 12, masterCode: "WDC2442", description: "Wall Diagonal Corner", placement: "wall", x: 96, y: 0, width: 24, height: 42, depth: 24, rotation: 90, mountBottom: 54, cornerType: "diagonal" },
	    { uid: "wdc-bottom-right", cabinetId: 13, masterCode: "WDC2442", description: "Wall Diagonal Corner", placement: "wall", x: 96, y: 72, width: 24, height: 42, depth: 24, rotation: 180, mountBottom: 54, cornerType: "diagonal" },
	    { uid: "wdc-bottom-left", cabinetId: 14, masterCode: "WDC2442", description: "Wall Diagonal Corner", placement: "wall", x: 0, y: 72, width: 24, height: 42, depth: 24, rotation: 270, mountBottom: 54, cornerType: "diagonal" },
	  ], room, undefined, "#ffffff");

		  expect(root.children).toHaveLength(12);
		  expect(root.children.every((rail) => rail.userData.diagonalCornerCrown === true)).toBe(true);
		  expect(root.children.filter((rail) => rail.userData.crownMoldingFront)).toHaveLength(4);
		  for (const rail of root.children) {
		    const positions = (rail as THREE.Mesh).geometry.getAttribute("position");
		    expect(positions.count).toBe(8);
			  }
		});

		it("keeps the diagonal WDC42’s exposed raised corner tips flush at each angled miter", () => {
		  const room = { width: 120, depth: 96, ceilingHeight: 96 };
		  const cabinets = [
		    { uid: "wdc", cabinetId: 21, masterCode: "WDC2442", description: "Wall Diagonal Corner", placement: "wall", x: 48, y: 36, width: 24, height: 42, depth: 24, rotation: 0, mountBottom: 54, cornerType: "diagonal" },
		  ] as never[];
		  const segments = threeDCrownPerimeterSegments(cabinets, room);
		  const root = new THREE.Group();
		  addThreeDCrownMolding(root, cabinets, room, undefined, "#ffffff");

		  expect(segments).toHaveLength(3);
		  for (const joint of threeDCrownMiterJoints(segments)) {
		    const endpoints = segments.flatMap((segment, segmentIndex) => [
		      { segment, segmentIndex, atStart: true, point: segment.start },
		      { segment, segmentIndex, atStart: false, point: segment.end },
		    ]).filter((endpoint) => Math.hypot(endpoint.point.x - joint.point.x, endpoint.point.z - joint.point.z) <= 0.25);
		    expect(endpoints).toHaveLength(2);
		    const raisedVertices = endpoints.map((endpoint) => {
		      const positions = (root.children[endpoint.segmentIndex] as THREE.Mesh).geometry.getAttribute("position");
		      return new THREE.Vector3().fromBufferAttribute(positions, endpoint.atStart ? 1 : 5);
		    });
		    expect(raisedVertices[0]!.distanceTo(raisedVertices[1]!)).toBeLessThan(1e-6);
		  }
		});

		it("integrates a top-right WDC42 into 12-inch runs on both walls without crown at either hidden cabinet junction", () => {
	  const room = { width: 120, depth: 96, ceilingHeight: 96 };
	  const segments = threeDCrownPerimeterSegments([
	    { uid: "top-run", cabinetId: 31, masterCode: "W-24-42", description: "Wall", placement: "wall", x: 72, y: 0, width: 24, height: 42, depth: 12, rotation: 0, mountBottom: 54 },
	    { uid: "wdc-top-right", cabinetId: 32, masterCode: "WDC2442", description: "Wall Diagonal Corner", placement: "wall", x: 96, y: 0, width: 24, height: 42, depth: 24, rotation: 90, mountBottom: 54, cornerType: "diagonal" },
	    { uid: "right-run", cabinetId: 33, masterCode: "W-24-42", description: "Wall", placement: "wall", x: 108, y: 24, width: 24, height: 42, depth: 12, rotation: 90, mountBottom: 54 },
	  ] as never[], room);
	  const wdcSegments = segments.filter((segment) => segment.ownerUid === "wdc-top-right");

	  expect(wdcSegments.map((segment) => segment.kind)).toEqual(["diagonal-front"]);
	  expect(wdcSegments[0]?.length).toBeCloseTo(Math.hypot(12, 12), 6);
	  expect(segments.filter((segment) => segment.kind.endsWith("return"))).toHaveLength(2);
	});

		it.each([
		  ["top-left", { x: 0, y: 0, rotation: 0 }, { x: 24, y: 0, rotation: 0 }, { x: 0, y: 24, rotation: 90 }],
		  ["top-right", { x: 96, y: 0, rotation: 90 }, { x: 72, y: 0, rotation: 0 }, { x: 108, y: 24, rotation: 90 }],
		  ["bottom-right", { x: 96, y: 72, rotation: 180 }, { x: 72, y: 84, rotation: 180 }, { x: 108, y: 48, rotation: 90 }],
	  ["bottom-left", { x: 0, y: 72, rotation: 270 }, { x: 24, y: 84, rotation: 180 }, { x: 0, y: 48, rotation: 90 }],
	] as const)("keeps only the WDC42 diagonal crown when 12-inch runs join both %s wall legs", (_corner, wdc, horizontal, vertical) => {
	  const room = { width: 120, depth: 96, ceilingHeight: 96 };
	  const segments = threeDCrownPerimeterSegments([
	    { uid: "horizontal-run", cabinetId: 41, masterCode: "W-24-42", description: "Wall", placement: "wall", ...horizontal, width: 24, height: 42, depth: 12, mountBottom: 54 },
	    { uid: "wdc", cabinetId: 42, masterCode: "WDC2442", description: "Wall Diagonal Corner", placement: "wall", ...wdc, width: 24, height: 42, depth: 24, mountBottom: 54, cornerType: "diagonal" },
	    { uid: "vertical-run", cabinetId: 43, masterCode: "W-24-42", description: "Wall", placement: "wall", ...vertical, width: 24, height: 42, depth: 12, mountBottom: 54 },
	  ] as never[], room);
	  const wdcSegments = segments.filter((segment) => segment.ownerUid === "wdc");

	  expect(wdcSegments.map((segment) => segment.kind)).toEqual(["diagonal-front"]);
		  expect(wdcSegments[0]?.length).toBeCloseTo(Math.hypot(12, 12), 6);
		});

		it.each([
		  ["top-left", { x: 0, y: 0, rotation: 0 }, { x: 24, y: 0, rotation: 0 }, { x: 0, y: 24, rotation: 90 }],
		  ["top-right", { x: 96, y: 0, rotation: 90 }, { x: 72, y: 0, rotation: 0 }, { x: 108, y: 24, rotation: 90 }],
		  ["bottom-right", { x: 96, y: 72, rotation: 180 }, { x: 72, y: 84, rotation: 180 }, { x: 108, y: 48, rotation: 90 }],
		  ["bottom-left", { x: 0, y: 72, rotation: 270 }, { x: 24, y: 84, rotation: 180 }, { x: 0, y: 48, rotation: 90 }],
		] as const)("continues crown around both exposed WER2442 faces when upper runs join the %s corner", (_corner, wer, horizontal, vertical) => {
		  const room = { width: 120, depth: 96, ceilingHeight: 96 };
		  const cabinets = [
		    { uid: "horizontal-run", cabinetId: 51, masterCode: "W-24-42", description: "Wall", placement: "wall", ...horizontal, width: 24, height: 42, depth: 12, mountBottom: 54 },
		    { uid: "wer", cabinetId: 52, masterCode: "WER2442", description: "Wall Easy Reach Corner", placement: "wall", ...wer, width: 24, height: 42, depth: 12, mountBottom: 54, cornerType: "l-shape" },
		    { uid: "vertical-run", cabinetId: 53, masterCode: "W-24-42", description: "Wall", placement: "wall", ...vertical, width: 24, height: 42, depth: 12, mountBottom: 54 },
		  ] as never[];
		  const segments = threeDCrownPerimeterSegments(cabinets, room);
		  const root = new THREE.Group();
		  addThreeDCrownMolding(root, cabinets, room, undefined, "#ffffff");
		  const werSegments = segments.filter((segment) => segment.ownerUid === "wer");

		  // A wall easy-reach has two 12-inch room-facing legs. Its crown follows
		  // both legs, while the two cabinet-run junctions remain hidden.
		  expect(werSegments.map((segment) => segment.kind)).toEqual(["front", "front"]);
		  expect(werSegments.map((segment) => segment.length)).toEqual([12, 12]);
		  expect(segments.filter((segment) => segment.kind.endsWith("return"))).toHaveLength(2);
		  const lCornerMiter = threeDCrownMiterJoints(segments).find((joint) => joint.ownerUids[0] === "wer" && joint.ownerUids[1] === "wer");
		  expect(lCornerMiter).toBeDefined();
		  const miterEndpoints = segments.flatMap((segment, segmentIndex) => [
		    { segment, segmentIndex, atStart: true, point: segment.start },
		    { segment, segmentIndex, atStart: false, point: segment.end },
		  ]).filter((endpoint) => Math.hypot(endpoint.point.x - lCornerMiter!.point.x, endpoint.point.z - lCornerMiter!.point.z) <= 0.25);
		  expect(miterEndpoints).toHaveLength(2);
		  const raisedTips = miterEndpoints.map((endpoint) => {
		    const positions = (root.children[endpoint.segmentIndex] as THREE.Mesh).geometry.getAttribute("position");
		    return new THREE.Vector3().fromBufferAttribute(positions, endpoint.atStart ? 1 : 5);
		  });
		  expect(raisedTips[0]!.distanceTo(raisedTips[1]!)).toBeLessThan(1e-6);
		});

		it("does not shrink the standard 3D toe-kick width at cabinet seams", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      placementUid: "b24",
      distributorSkuId: 1,
      cabinetId: 1,
      masterCode: "B-24",
      description: "Base",
      placementType: "base",
      width: 24,
      height: 34.5,
      depth: 24,
      numberOfDoors: 2,
      numberOfDrawers: 1,
    }, null, {}, 120, 96, "#ffffff", "#eeeeee", undefined, { x: 12, z: 12, rotation: 0, bottom: 0 });
    let toeKick: THREE.Mesh | null = null;
    root.traverse((object) => {
      if (object instanceof THREE.Mesh && object.userData.baseToeKick) toeKick = object;
    });
    expect(toeKick).not.toBeNull();
    const geometry = toeKick!.geometry as THREE.BoxGeometry;
    expect(geometry.parameters.width).toBeCloseTo(24 / 12 + 0.02, 6);
  });
});
