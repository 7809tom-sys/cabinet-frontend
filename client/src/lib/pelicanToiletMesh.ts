import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** Match InteractiveRoom3D: one scene unit is one foot. */
const INCH = 1 / 12;

/**
 * Exterior styling follows the Pelican catalog photos for the bathroom toilet
 * line (buildpelican.com product images, reviewed with the source sheets in
 * pelicanBathroomFixtureProfiles). Each mesh stays inside that sheet's
 * width, depth, and height. This is a visual model, not a plumbing guide.
 *
 * Distinct silhouettes, not one reused body:
 * - skirted one-piece (PL-12011, PL-12027, PL-12044, PL-12210, PL-12318, PL-12382):
 *   a low rounded-rectangle tank, a skirt that flares to the floor, an elongated
 *   oval seat and lid, and a round side trapway cap
 * - pedestal one-piece with the bowl sitting above the floor (PL-12050, PL-12335)
 * - two-piece with a separate tank and exposed trapway (PL-A249)
 * - low angular smart toilet (PL-12005)
 * - rounded smart toilet (PL-12230, PL-12305)
 */
export type PelicanToiletMeshProfile = {
  pelicanCode: string;
  widthIn: number;
  depthIn: number;
  heightIn: number;
  seatHeightIn?: number;
  finish: string;
  toiletStyle?: "one-piece" | "two-piece" | "smart";
  toiletFlushControl?: "single-button" | "dual-button" | "touchless" | "touchless-auto";
};

type Ring = { width: number; depth: number; y: number; z: number; radius?: number };
type ToiletForm = "skirted-one-piece" | "pedestal-one-piece" | "two-piece" | "smart-wedge" | "smart-egg";

function isMatteBlack(finish: string): boolean {
  return finish.trim().toLowerCase().includes("matte-black");
}

function baseCode(code: string): string {
  return code.replace(/\s+MB$/i, "").trim();
}

export function pelicanToiletForm(profile: Pick<PelicanToiletMeshProfile, "pelicanCode" | "toiletStyle">): ToiletForm {
  const code = baseCode(profile.pelicanCode);
  if (profile.toiletStyle === "two-piece" || code.startsWith("PL-A249")) return "two-piece";
  if (code.startsWith("PL-12005")) return "smart-wedge";
  if (profile.toiletStyle === "smart" || code.startsWith("PL-12305") || code.startsWith("PL-12230")) return "smart-egg";
  // PL-12027 and PL-12210 show the moulded S-shaped trapway on the side of the
  // base in their photos, so they are built on the exposed-trapway body.
  if (code.startsWith("PL-12027") || code.startsWith("PL-12210")) return "pedestal-one-piece";
  // PL-12050 and PL-12335 are skirted one-piece units in their catalog photos:
  // smooth sides to the floor, no visible trapway. Modelling them on the
  // pedestal form is exactly why the owner saw them as pedestals.
  return "skirted-one-piece";
}

function rounderBowl(code: string): boolean {
  // PL-12318 and PL-12382 are elongated skirted bowls in the catalog photos.
  // Only the low smart body uses the rounder seat.
  return baseCode(code).startsWith("PL-12005");
}

function roundedRectRing(width: number, depth: number, y: number, z: number, radius: number, cornerSegments = 18): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const clamped = Math.min(radius, width / 2, depth / 2);
  const corners: Array<[number, number, number]> = [
    [width / 2 - clamped, depth / 2 - clamped, 0],
    [-width / 2 + clamped, depth / 2 - clamped, Math.PI / 2],
    [-width / 2 + clamped, -depth / 2 + clamped, Math.PI],
    [width / 2 - clamped, -depth / 2 + clamped, Math.PI * 1.5],
  ];
  for (const [centerX, centerZ, start] of corners) {
    for (let step = 0; step < cornerSegments; step++) {
      const angle = start + (step / cornerSegments) * Math.PI / 2;
      points.push(new THREE.Vector3(centerX + Math.cos(angle) * clamped, y, z + centerZ + Math.sin(angle) * clamped));
    }
  }
  return points;
}

function ellipseRing(width: number, depth: number, y: number, z: number, segments = 96): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let step = 0; step < segments; step++) {
    const angle = (step / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * width / 2, y, z + Math.sin(angle) * depth / 2));
  }
  return points;
}

/**
 * Plan of a toilet body seen from above: a flat back that sits against the
 * wall, straight sides, and a semicircular front. Every ring of a body loft
 * uses this outline, so a skirt curves in plan the way the photos do instead of
 * reading as a rounded box.
 */
function toiletPlanPoints(width: number, depth: number, y: number, z: number, cornerSegments = 9): THREE.Vector3[] {
  const halfW = width / 2;
  const halfD = depth / 2;
  const rearCorner = Math.min(halfW * 0.45, depth * 0.16);
  const frontCenter = Math.max(0, halfD - halfW);
  const plan: Array<[number, number]> = [];
  plan.push([-halfW + rearCorner, -halfD]);
  plan.push([halfW - rearCorner, -halfD]);
  for (let step = 1; step <= cornerSegments; step += 1) {
    const angle = -Math.PI / 2 + (step / cornerSegments) * (Math.PI / 2);
    plan.push([
      halfW - rearCorner + Math.cos(angle) * rearCorner,
      -halfD + rearCorner + Math.sin(angle) * rearCorner,
    ]);
  }
  const frontSegments = cornerSegments * 5;
  for (let step = 0; step <= frontSegments; step += 1) {
    const angle = (step / frontSegments) * Math.PI;
    plan.push([Math.cos(angle) * halfW, frontCenter + Math.sin(angle) * halfW]);
  }
  for (let step = 1; step <= cornerSegments; step += 1) {
    const angle = Math.PI + (step / cornerSegments) * (Math.PI / 2);
    plan.push([
      -halfW + rearCorner + Math.cos(angle) * rearCorner,
      -halfD + rearCorner + Math.sin(angle) * rearCorner,
    ]);
  }
  return plan.map(([x, pointZ]) => new THREE.Vector3(x, y, z + pointZ));
}

/** Closed loft over explicit rings. Ring order and winding are normalised here. */
function loftRingPoints(ringPoints: THREE.Vector3[][], capTop = true, capBottom = true): THREE.BufferGeometry {
  // The two ring builders sweep opposite ways, and a Lathe or a reversed ring
  // would flip the result again. Normalise every ring to one direction, then
  // confirm the built solid encloses positive volume; if it does not, flip the
  // whole index order. That makes every lofted body face outward whichever
  // outline and ring order produced it, so nothing disappears when the camera is
  // outside a single-sided material.
  for (const points of ringPoints) {
    let area = 0;
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index]!;
      const next = points[(index + 1) % points.length]!;
      area += current.x * next.z - next.x * current.z;
    }
    if (area < 0) points.reverse();
  }
  const vertices = ringPoints.flatMap((points) => points.flatMap((point) => [point.x, point.y, point.z]));
  const ringLength = ringPoints[0]!.length;
  const indices: number[] = [];
  for (let ring = 0; ring < ringPoints.length - 1; ring++) {
    for (let index = 0; index < ringLength; index++) {
      const next = (index + 1) % ringLength;
      const a = ring * ringLength + index;
      const b = ring * ringLength + next;
      const c = (ring + 1) * ringLength + next;
      const d = (ring + 1) * ringLength + index;
      // The rings run clockwise seen from above, so this order is what makes the
      // side faces point outward. The previous order faced inward and the whole
      // body disappeared from outside under a single-sided material.
      indices.push(a, b, d, b, c, d);
    }
  }
  const capAt = (ring: number, faceUp: boolean) => {
    const center = vertices.length / 3;
    let cx = 0;
    let cz = 0;
    for (const point of ringPoints[ring]!) {
      cx += point.x;
      cz += point.z;
    }
    vertices.push(cx / ringLength, ringPoints[ring]![0]!.y, cz / ringLength);
    for (let index = 0; index < ringLength; index++) {
      const next = (index + 1) % ringLength;
      const a = ring * ringLength + index;
      const b = ring * ringLength + next;
      // The bottom cap faces down and the top cap faces up, matching the rings'
      // clockwise order so both read as solid ends.
      if (faceUp) indices.push(center, a, b);
      else indices.push(center, b, a);
    }
  };
  if (capBottom) capAt(0, false);
  if (capTop) capAt(ringPoints.length - 1, true);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  // Guarantee an outward-facing solid. If the ring order or cap order produced a
  // negative signed volume, reverse the triangles so the body is visible from
  // outside rather than culled away.
  if (signedLoftVolume(vertices, indices) < 0) {
    for (let index = 0; index < indices.length; index += 3) {
      const swap = indices[index + 1]!;
      indices[index + 1] = indices[index + 2]!;
      indices[index + 2] = swap;
    }
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
  }
  return geometry;
}

/** Signed volume of a vertex/index pair, by the divergence theorem. */
function signedLoftVolume(vertices: readonly number[], indices: readonly number[]): number {
  let volume = 0;
  const ax = [0, 0, 0];
  const bx = [0, 0, 0];
  const cx = [0, 0, 0];
  for (let index = 0; index < indices.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      ax[axis] = vertices[indices[index]! * 3 + axis]!;
      bx[axis] = vertices[indices[index + 1]! * 3 + axis]!;
      cx[axis] = vertices[indices[index + 2]! * 3 + axis]!;
    }
    volume += (
      ax[0]! * (bx[1]! * cx[2]! - cx[1]! * bx[2]!)
      - ax[1]! * (bx[0]! * cx[2]! - cx[0]! * bx[2]!)
      + ax[2]! * (bx[0]! * cx[1]! - cx[0]! * bx[1]!)
    ) / 6;
  }
  return volume;
}

/** A ring spanning a back-to-front range, for the rounded-plan loft. */
function spanRing(width: number, y: number, back: number, front: number, radiusFraction: number): Ring {
  const depth = Math.max(0.04, front - back);
  return { width, depth, y, z: (front + back) / 2, radius: Math.min(width, depth) * radiusFraction };
}

/** Closed loft. Ellipse rings read as a bowl; rounded rectangles read as a tank or smart body. */
function loft(rings: Ring[], shape: "ellipse" | "rounded" = "ellipse"): THREE.BufferGeometry {
  // Smooth silhouettes: 96 on the ellipse body, 72 on the rounded-rect plan.
  const segments = shape === "ellipse" ? 96 : 72;
  const ringPoints = rings.map((ring) => shape === "ellipse"
    ? ellipseRing(ring.width, ring.depth, ring.y, ring.z, segments)
    : roundedRectRing(ring.width, ring.depth, ring.y, ring.z, ring.radius ?? Math.min(ring.width, ring.depth) * 0.18, 18));
  return loftRingPoints(ringPoints);
}

function ellipseLoft(rings: Ring[]): THREE.BufferGeometry {
  return loft(rings, "ellipse");
}

/**
 * A body whose plan is a toilet outline: flat back, straight sides, round
 * front. The rings taper and tilt, so the finished body curves from a narrow
 * foot to the wide rim instead of standing as a prism.
 */
type BodyRing = { width: number; depth: number; y: number; z: number };

function toiletBodyLoft(rings: BodyRing[], opts: { capTop?: boolean; capBottom?: boolean } = {}): THREE.BufferGeometry {
  return loftRingPoints(
    rings.map((ring) => toiletPlanPoints(ring.width, ring.depth, ring.y, ring.z)),
    opts.capTop ?? true,
    opts.capBottom ?? true,
  );
}

/**
 * A hollow bowl: the same plan with an inner wall, so looking into the bowl
 * from above shows china rather than the room floor, and the rim reads as a
 * rounded edge. Closed on the underside by a floor at the base.
 */
function hollowBowlLoft(
  outerRings: BodyRing[],
  innerRings: BodyRing[],
  plan: (width: number, depth: number, y: number, z: number) => THREE.Vector3[] = toiletPlanPoints,
): THREE.BufferGeometry {
  const outer = outerRings.map((ring) => plan(ring.width, ring.depth, ring.y, ring.z));
  const inner = innerRings.map((ring) => plan(ring.width, ring.depth, ring.y, ring.z));
  // Outer wall up, inner wall down, then a band across the rim. Each wall is
  // its own closed-ish surface; the volume test below normalises the whole.
  const vertices: number[] = [];
  const indices: number[] = [];
  const ringLength = outer[0]!.length;
  const pushRing = (ring: THREE.Vector3[]) => {
    const base = vertices.length / 3;
    for (const point of ring) vertices.push(point.x, point.y, point.z);
    return base;
  };
  const strip = (from: number, to: number, flip: boolean) => {
    for (let index = 0; index < ringLength; index++) {
      const next = (index + 1) % ringLength;
      const a = from + index;
      const b = from + next;
      const c = to + next;
      const d = to + index;
      if (flip) indices.push(a, d, b, b, d, c);
      else indices.push(a, b, d, b, c, d);
    }
  };
  const outerBases = outer.map(pushRing);
  for (let ring = 0; ring < outerBases.length - 1; ring++) strip(outerBases[ring]!, outerBases[ring + 1]!, false);
  const innerBases = inner.map(pushRing);
  for (let ring = 0; ring < innerBases.length - 1; ring++) strip(innerBases[ring]!, innerBases[ring + 1]!, true);
  // Rim band between the outer and inner top rings.
  {
    const from = outerBases[outerBases.length - 1]!;
    const to = innerBases[innerBases.length - 1]!;
    for (let index = 0; index < ringLength; index++) {
      const next = (index + 1) % ringLength;
      indices.push(from + index, from + next, to + index, to + index, from + next, to + next);
    }
  }
  // Base: outer foot closed, and the basin floor closed just above it.
  const capAt = (base: number, ring: THREE.Vector3[], up: boolean) => {
    const center = vertices.length / 3;
    let cx = 0;
    let cz = 0;
    for (const point of ring) {
      cx += point.x;
      cz += point.z;
    }
    vertices.push(cx / ringLength, ring[0]!.y, cz / ringLength);
    for (let index = 0; index < ringLength; index++) {
      const next = (index + 1) % ringLength;
      if (up) indices.push(center, base + index, base + next);
      else indices.push(center, base + next, base + index);
    }
  };
  capAt(outerBases[0]!, outer[0]!, false);
  capAt(innerBases[0]!, inner[0]!, true);
  // Join the outer foot to the basin floor so the solid has no internal gap.
  strip(outerBases[0]!, innerBases[0]!, false);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  if (signedLoftVolume(vertices, indices) < 0) {
    for (let index = 0; index < indices.length; index += 3) {
      const swap = indices[index + 1]!;
      indices[index + 1] = indices[index + 2]!;
      indices[index + 2] = swap;
    }
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
  }
  return geometry;
}

/** Solid elongated lid. Extrude faces outward, so the closed lid stays visible. */
function ovalLid(radiusX: number, radiusZ: number, thickness: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, 1, 0, Math.PI * 2, false);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.012, thickness),
    bevelEnabled: true,
    bevelThickness: Math.max(0.006, thickness * 0.45),
    bevelSize: Math.min(radiusX, radiusZ) * 0.08,
    bevelSegments: 5,
    curveSegments: 40,
  });
  geometry.scale(radiusX, radiusZ, 1);
  geometry.rotateX(-Math.PI / 2);
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  if (bounds) geometry.translate(0, -bounds.min.y, 0);
  geometry.computeVertexNormals();
  return geometry;
}

/** Shallow elliptical china lid or seat. Lathe radius is X; Z is scaled to the bowl. */
function ovalCap(radiusX: number, radiusZ: number, rise: number, edge: number): THREE.BufferGeometry {
  // The profile must run from the rim outward and back to the axis for a Lathe
  // to face outward. Building it axis-first made the whole cap inside out, so it
  // vanished under a single-sided material.
  const points: THREE.Vector2[] = [new THREE.Vector2(0, -edge)];
  points.push(new THREE.Vector2(radiusX * 0.98, -edge));
  const steps = 10;
  for (let step = steps; step >= 1; step--) {
    const angle = (step / steps) * Math.PI / 2;
    points.push(new THREE.Vector2(Math.sin(angle) * radiusX, Math.cos(angle) * rise));
  }
  points.push(new THREE.Vector2(0, rise));
  const geometry = new THREE.LatheGeometry(points, 32);
  geometry.scale(1, 1, radiusZ / Math.max(radiusX, 0.001));
  geometry.computeVertexNormals();
  return geometry;
}

function addPart(
  group: THREE.Group,
  profile: PelicanToiletMeshProfile,
  part: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `Pelican ${profile.pelicanCode} ${part}`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = {
    pelicanBathroomFixturePart: part,
    pelicanCode: profile.pelicanCode,
    pelicanFinish: isMatteBlack(profile.finish) ? "matte-black" : "white",
    illustrativeContours: true,
  };
  group.add(mesh);
  return mesh;
}

/**
 * Vitreous china, as a glazed physical material.
 *
 * The owner's complaint was that the fixtures read as flat matte plaster. The
 * cause was two-fold: the white body carried a self-emissive tint that flattened
 * every shading gradient, and the surface had no clearcoat, so the environment
 * map produced almost no reflection. Glazed china is a thin transparent glaze
 * over a white body: a strong specular highlight, a sharp clearcoat reflection of
 * the room, and a little diffuse shading in the curves.
 *
 * White keeps a clean ceramic white with a clearcoat highlight. Matte black is
 * deliberately matte — low clearcoat, higher roughness — because the MB models
 * are matte in the supplier photos, not glossy.
 */
export function pelicanChinaMaterial(black: boolean, variant: "body" | "seat" = "body"): THREE.MeshPhysicalMaterial {
  if (black) {
    return new THREE.MeshPhysicalMaterial({
      // Matte black: no clearcoat sheen, and enough roughness to kill the
      // hard highlight while keeping the soft one.
      color: variant === "seat" ? "#1b1d20" : "#17191b",
      roughness: variant === "seat" ? 0.52 : 0.44,
      metalness: 0,
      clearcoat: 0.16,
      clearcoatRoughness: 0.55,
      envMapIntensity: 0.9,
      ior: 1.5,
      specularIntensity: 0.65,
    });
  }
  return new THREE.MeshPhysicalMaterial({
    // A faint warm-white body, no emissive: an emissive tint was what erased the
    // form. The rim, basin and skirt now shade against each other.
    // White glaze is not a perfect Lambertian white: the fired body sits near 0.80
    // albedo and the *highlight* is what makes it look bright. Painting it at 0.98
    // saturates the diffuse term under any normal room light, which is what erased
    // every gradient and made the fixtures read as plaster.
    color: variant === "seat" ? "#e9e7e2" : "#e4e2dd",
    roughness: variant === "seat" ? 0.06 : 0.055,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: variant === "seat" ? 0.03 : 0.045,
    reflectivity: 0.62,
    envMapIntensity: 1.15,
    ior: 1.52,
    // A glaze is slightly translucent at grazing angles; sheen fakes the soft
    // edge falloff without a real transmissive pass.
    sheen: 0.25,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color("#f2f6f8"),
    specularIntensity: 1,
  });
}

function addRoundedBox(
  group: THREE.Group,
  profile: PelicanToiletMeshProfile,
  part: string,
  material: THREE.Material,
  width: number,
  height: number,
  depth: number,
  radius: number,
  y: number,
  z: number,
): THREE.Mesh {
  const mesh = addPart(
    group,
    profile,
    part,
    new RoundedBoxGeometry(Math.max(0.04, width), Math.max(0.02, height), Math.max(0.04, depth), 5, Math.max(0.008, radius)),
    material,
  );
  mesh.position.set(0, y, z);
  mesh.userData.tankFootprint = "rounded-rectangle";
  return mesh;
}

/**
 * A domed oval cover — the toilet seat lid. A flat extruded disc reads as a
 * plate; the real thing is crowned, with a rounded edge that turns down over
 * the seat. Built as a closed solid of revolution and squashed to the bowl's
 * aspect, so it faces outward and never disappears.
 */
function domedOvalLid(radiusX: number, radiusZ: number, thickness: number, crown: number): THREE.BufferGeometry {
  const points: THREE.Vector2[] = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(radiusX * 0.94, 0),
    new THREE.Vector2(radiusX * 0.995, thickness * 0.42),
    new THREE.Vector2(radiusX * 0.975, thickness * 0.86),
    new THREE.Vector2(radiusX * 0.80, thickness + crown * 0.45),
    new THREE.Vector2(radiusX * 0.40, thickness + crown * 0.92),
    new THREE.Vector2(0, thickness + crown),
  ];
  const geometry = new THREE.LatheGeometry(points, 96);
  geometry.scale(1, 1, radiusZ / Math.max(radiusX, 0.001));
  geometry.computeVertexNormals();
  return geometry;
}

/** A flat oval ring with thickness and a rounded outer edge — the seat. */
function ovalSeatRing(radiusX: number, radiusZ: number, thickness: number, innerShare: number): THREE.BufferGeometry {
  const ringShare = 0.86;
  return hollowBowlLoft(
    [
      { width: radiusX * 2 * ringShare, depth: radiusZ * 2 * ringShare, y: -thickness, z: 0 },
      { width: radiusX * 2, depth: radiusZ * 2, y: -thickness * 0.55, z: 0 },
      { width: radiusX * 2 * ringShare, depth: radiusZ * 2 * ringShare, y: 0, z: 0 },
    ],
    [
      { width: radiusX * 2 * ringShare * innerShare, depth: radiusZ * 2 * ringShare * innerShare, y: -thickness + 0.004, z: 0 },
      { width: radiusX * 2 * ringShare * innerShare, depth: radiusZ * 2 * ringShare * innerShare, y: -0.004, z: 0 },
    ],
    ellipseRing,
  );
}

function addClosedSeatAndLid(
  group: THREE.Group,
  profile: PelicanToiletMeshProfile,
  seatMaterial: THREE.Material,
  chrome: THREE.Material,
  water: THREE.Material,
  seatHeight: number,
  width: number,
  depth: number,
  squared = false,
  placement?: { radiusX: number; radiusZ: number; centerZ: number },
): void {
  const round = squared || rounderBowl(profile.pelicanCode);
  const radiusX = placement?.radiusX ?? width * (round ? 0.40 : 0.36);
  const radiusZ = placement?.radiusZ ?? depth * (round ? 0.24 : 0.30);
  const centerZ = placement?.centerZ ?? depth * (round ? 0.04 : 0.08);
  // A real seat: a ring with thickness that closes over the bowl, and a crowned
  // lid on top of it. Flat discs and tori read as plates from across a room,
  // which is exactly what the owner saw.
  const seatThickness = squared ? 0.032 : 0.048;
  // The seat is the wider of the two: it is the ring that rests on the china rim.
  const seat = addPart(
    group,
    profile,
    "toilet-seat",
    ovalSeatRing(radiusX * 1.035, radiusZ * 1.035, seatThickness, 0.80),
    seatMaterial,
  );
  // The ring hangs below its own origin, so placing it at the published seat
  // height puts the seat's top surface there and its underside on the china.
  seat.position.set(0, seatHeight, centerZ);
  seat.userData.seatProfile = round ? "closed-round-oval" : "closed-elongated-oval";

  // The lid must be SMALLER than the seat, not larger. On a real closed toilet the
  // lid rests inside the seat's outer edge, so a thin band of seat is visible all
  // the way around it. Drawing the lid wider hid the seat completely and fused the
  // pair into one plate, which is exactly what the owner saw.
  const lidLift = squared ? 0.010 : 0.015;
  const lidInset = 0.955;
  const lid = addPart(
    group,
    profile,
    "toilet-lid",
    domedOvalLid(
      radiusX * 1.035 * lidInset,
      radiusZ * 1.035 * lidInset,
      squared ? 0.030 : 0.042,
      squared ? 0.010 : 0.030,
    ),
    seatMaterial,
  );
  lid.position.set(0, seatHeight + lidLift, centerZ);
  lid.userData.lidProfile = squared ? "flat-rounded-rectangle" : "soft-elongated-oval";

  // A soft-close seat has a silicone bumper pad under the lid, which holds it a
  // few millimetres proud of the seat. That gap, in shadow, is the seam line you
  // see across the top of every real closed toilet.
  const seamMaterial = new THREE.MeshPhysicalMaterial({
    color: "#5d6367",
    roughness: 0.85,
    metalness: 0,
    envMapIntensity: 0.15,
  });
  const seam = addPart(
    group,
    profile,
    "toilet-seat-lid-seam",
    ovalSeatRing(radiusX * 1.035 * 0.985, radiusZ * 1.035 * 0.985, 0.007, 0.93),
    seamMaterial,
  );
  seam.position.set(0, seatHeight + lidLift * 0.45, centerZ);

  // Hinges: two short barrels at the rear where the lid pivots, sitting in the
  // notch between the seat and the deck. Their shadow is what tells the eye that
  // the lid can lift.
  const hingeZ = centerZ - radiusZ * 0.90;
  for (const side of [-1, 1]) {
    const hinge = addPart(
      group,
      profile,
      "toilet-hinge",
      new THREE.CylinderGeometry(0.021, 0.021, radiusX * 0.26, 32),
      chrome,
    );
    hinge.rotation.z = Math.PI / 2;
    hinge.position.set(side * radiusX * 0.42, seatHeight + lidLift * 0.60, hingeZ);
  }

  // The lid is a lathe with an open underside; seen from a low angle that open rim
  // reads as a dark slot, so close it.
  if (Array.isArray(lid.material)) lid.material.forEach((m) => (m.side = THREE.DoubleSide));
  else lid.material.side = THREE.DoubleSide;

  const waterWell = addPart(group, profile, "toilet-bowl-water", new THREE.CircleGeometry(0.5, 64), water);
  waterWell.rotation.x = -Math.PI / 2;
  waterWell.scale.set(radiusX * 0.72, radiusZ * 0.62, 1);
  waterWell.position.set(0, seatHeight - 0.02, centerZ);
}

function addTrapwayCap(
  group: THREE.Group,
  profile: PelicanToiletMeshProfile,
  shell: THREE.Material,
  x: number,
  y: number,
  z: number,
): void {
  const cap = addPart(group, profile, "toilet-trapway-cap", new THREE.CylinderGeometry(0.046, 0.046, 0.012, 28), shell);
  cap.rotation.z = Math.PI / 2;
  cap.position.set(x, y, z);
  cap.userData.silhouette = "round-side-trapway-cap";
  const groove = new THREE.MeshStandardMaterial({ color: "#b7bdc2", roughness: 0.55, metalness: 0 });
  const ring = addPart(group, profile, "toilet-trapway-cap-ring", new THREE.TorusGeometry(0.05, 0.006, 8, 28), groove);
  ring.rotation.y = Math.PI / 2;
  ring.position.set(x + Math.sign(x || 1) * 0.004, y, z);
}

function addTopButtons(
  group: THREE.Group,
  profile: PelicanToiletMeshProfile,
  chrome: THREE.Material,
  y: number,
  z: number,
  width: number,
): void {
  if (profile.toiletFlushControl === "dual-button") {
    for (const [side, radius] of [["left", width * 0.028], ["right", width * 0.038]] as const) {
      const button = addPart(group, profile, `toilet-dual-flush-${side}-button`, new THREE.CylinderGeometry(radius, radius, 0.012, 20), chrome);
      button.position.set(side === "left" ? -width * 0.055 : width * 0.055, y, z);
      button.userData.toiletFlushControlMode = "dual-button";
    }
    return;
  }
  if (profile.toiletFlushControl === "single-button") {
    const button = addPart(group, profile, "toilet-single-flush-button", new THREE.CylinderGeometry(width * 0.04, width * 0.04, 0.012, 20), chrome);
    button.position.set(0, y, z);
    button.userData.toiletFlushControlMode = "single-button";
  }
}

function addSideLever(
  group: THREE.Group,
  profile: PelicanToiletMeshProfile,
  chrome: THREE.Material,
  x: number,
  y: number,
  z: number,
): void {
  const lever = addPart(group, profile, "toilet-single-flush-button", new THREE.CylinderGeometry(0.012, 0.012, 0.075, 12), chrome);
  lever.rotation.z = Math.PI / 2;
  lever.position.set(x, y, z);
  lever.userData.toiletFlushControlMode = "single-button";
  lever.userData.lever = "tank-side";
}

/** Plan of a skirted toilet: straight rear, semicircular bowl front. Shape Y is depth. */
function skirtFootprint(width: number, depth: number): THREE.Shape {
  const halfW = width / 2;
  const back = -depth / 2;
  const front = depth / 2;
  const radius = Math.min(halfW, Math.max(0.05, front - back - 0.04));
  const arcY = front - radius;
  const shape = new THREE.Shape();
  // Counter-clockwise, so the extruded body faces outward.
  shape.moveTo(-halfW, back);
  shape.lineTo(halfW, back);
  shape.lineTo(halfW, arcY);
  shape.absarc(0, arcY, radius, 0, Math.PI, false);
  shape.lineTo(-halfW, back);
  shape.closePath();
  return shape;
}

function skirtBodyGeometry(width: number, depth: number, seatHeight: number): THREE.BufferGeometry {
  const bevel = Math.min(0.11, width * 0.08, seatHeight * 0.12);
  const shape = skirtFootprint(Math.max(0.2, width - bevel * 2), Math.max(0.3, depth - bevel * 2));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.25, seatHeight - bevel * 1.4),
    bevelEnabled: true,
    bevelThickness: bevel * 0.7,
    bevelSize: bevel,
    bevelSegments: 8,
    curveSegments: 28,
  });
  geometry.rotateX(Math.PI / 2);
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  if (bounds) geometry.translate(0, -bounds.min.y, 0);
  geometry.computeVertexNormals();
  return geometry;
}

function addSkirtedOnePiece(
  group: THREE.Group,
  profile: PelicanToiletMeshProfile,
  shell: THREE.Material,
  seatMaterial: THREE.Material,
  water: THREE.Material,
  chrome: THREE.Material,
  seatHeight: number,
): void {
  const width = profile.widthIn * INCH;
  const depth = profile.depthIn * INCH;
  const height = profile.heightIn * INCH;
  const halfD = depth / 2;
  const back = -halfD + 0.015;
  const tankDepth = Math.min(depth * 0.32, 0.72);
  const tankWidth = width * 0.90;
  const tankZ = back + tankDepth / 2;
  const footWidth = width * 0.96;
  const footDepth = depth * 0.96;

  // The skirt is one curved body from the floor to the bowl rim, not an
  // extruded box: it narrows to a small foot, swells through the waist, and
  // flares out to the full rim plan, with a hollow bowl inside. That is the
  // silhouette in the Pelican photos, and it is what stops the fixture reading
  // as a rectangular block.
  // Skirt rings, back pinned to the wall so the fixture stays flush. A real
  // skirted one-piece is narrower and shallower than its bowl rim: the bowl
  // lip projects past the skirt in front and at both sides, and that overhang
  // is what makes the silhouette read as a toilet instead of a pedestal.
  const skirtRing = (widthShare: number, depthShare: number, y: number): Ring => {
    const ringDepth = footDepth * depthShare;
    return { width: footWidth * widthShare, depth: ringDepth, y, z: -depth / 2 + ringDepth / 2 };
  };
  const skirtOuter = [
    skirtRing(0.78, 0.66, 0.002),
    skirtRing(0.86, 0.73, seatHeight * 0.10),
    skirtRing(0.91, 0.80, seatHeight * 0.34),
    skirtRing(0.92, 0.84, seatHeight * 0.62),
    skirtRing(0.895, 0.865, seatHeight * 0.84),
    skirtRing(0.85, 0.865, seatHeight * 0.955),
  ];
  const skirtInner = [
    skirtRing(0.30, 0.26, seatHeight * 0.16),
    skirtRing(0.58, 0.52, seatHeight * 0.50),
    skirtRing(0.74, 0.68, seatHeight * 0.80),
    skirtRing(0.70, 0.66, seatHeight * 0.92),
    skirtRing(0.63, 0.62, seatHeight * 0.955),
  ];
  const base = addPart(
    group,
    profile,
    "toilet-ceramic-base",
    hollowBowlLoft(skirtOuter, skirtInner),
    shell,
  );
  base.userData.silhouette = "continuous-skirted-body";
  base.userData.bowlForm = "elongated";

  // The bowl mouth is the closed ring inside the rim, so looking down shows
  // china instead of the room floor.
  const rimRing = new THREE.TorusGeometry(0.5, 0.042, 14, 72);
  rimRing.rotateX(Math.PI / 2);
  rimRing.scale(width * 0.80, 1, depth * 0.60);
  const bowl = addPart(group, profile, "toilet-bowl-exterior", rimRing, shell);
  bowl.position.set(0, seatHeight - 0.050, depth * 0.10);
  bowl.userData.continuousWithCeramicBase = true;
  bowl.userData.bowlForm = "elongated";

  const radiusX = width * 0.40;
  const radiusZ = Math.min(depth * 0.30, radiusX * 1.35);
  const bowlCenterZ = THREE.MathUtils.clamp(depth * 0.12, -halfD + radiusZ, halfD - radiusZ - 0.02);
  addClosedSeatAndLid(group, profile, seatMaterial, chrome, water, seatHeight, width, depth, false, {
    radiusX,
    radiusZ,
    centerZ: bowlCenterZ,
  });

  // The tank is the upper rear block and the bowl deck is below it, as on the
  // photos. Running the tank from the floor to the top of the sheet made the
  // whole fixture one full-height column, which is what read as a box.
  const tankBottom = seatHeight * 0.88;
  const lidThickness = 0.032;
  // The lid rests on the tank, so the tank runs right up to it. A gap here is
  // what made the lid look like it hovered above a box.
  // Leave room above the lid for the flush button to stand proud of it while the
  // whole fixture still tops out at the published height.
  const tankTop = height - lidThickness - 0.014;
  const tankHeight = Math.max(0.22, tankTop - tankBottom);
  // A porcelain tank is not a box: it narrows toward its base, bulges slightly
  // at mid height, and its front face bows outward. Lofting those rings gives
  // the soft shoulder the photos show.
  const tank = addPart(
    group,
    profile,
    "toilet-integrated-rear-housing",
    loftRingPoints([
      roundedRectRing(tankWidth * 0.86, tankDepth * 0.72, tankBottom, tankZ + tankDepth * 0.06, tankWidth * 0.13),
      roundedRectRing(tankWidth * 0.95, tankDepth * 0.94, tankBottom + tankHeight * 0.22, tankZ + tankDepth * 0.02, tankWidth * 0.14),
      roundedRectRing(tankWidth, tankDepth, tankBottom + tankHeight * 0.62, tankZ, tankWidth * 0.13),
      roundedRectRing(tankWidth * 0.995, tankDepth * 0.985, tankTop - 0.006, tankZ, tankWidth * 0.13),
      roundedRectRing(tankWidth * 0.975, tankDepth * 0.965, tankTop, tankZ, tankWidth * 0.13),
    ]),
    shell,
  );
  tank.userData.silhouette = "rounded-rectangular-tank";
  tank.userData.tankFootprint = "rounded-rectangle";
  const tankLid = addPart(
    group,
    profile,
    "toilet-tank-lid",
    loftRingPoints([
      roundedRectRing(tankWidth * 0.99, tankDepth * 0.98, tankTop, tankZ, tankWidth * 0.13),
      roundedRectRing(tankWidth * 1.025, tankDepth * 1.02, tankTop + lidThickness * 0.5, tankZ, tankWidth * 0.12),
      roundedRectRing(tankWidth * 1.015, tankDepth * 1.01, tankTop + lidThickness * 0.86, tankZ, tankWidth * 0.14),
      roundedRectRing(tankWidth * 0.95, tankDepth * 0.95, tankTop + lidThickness, tankZ, tankWidth * 0.17),
    ]),
    shell,
  );
  tankLid.userData.silhouette = "rounded-rectangular-tank-lid";
  tankLid.userData.tankFootprint = "rounded-rectangle";
  // The shoulder where the tank meets the bowl, swept forward so the tank is
  // part of the bowl rather than stuck onto the back of an unrelated block.
  const deck = addPart(
    group,
    profile,
    "toilet-tank-deck",
    toiletBodyLoft([
      { width: Math.min(tankWidth * 1.06, width * 0.90), depth: tankDepth * 1.42, y: tankBottom - 0.09, z: tankZ + tankDepth * 0.24 },
      { width: Math.min(tankWidth * 1.02, width * 0.86), depth: tankDepth * 1.10, y: tankBottom + 0.004, z: tankZ + tankDepth * 0.14 },
    ]),
    shell,
  );
  deck.userData.silhouette = "tank-to-skirt-blend";

  // A visible rim overhanging the skirt. This is the single strongest cue that
  // reads as a toilet rather than a pedestal: the bowl lip projects past the
  // base, and the seat sits down inside it.
  const lipTop = seatHeight - 0.004;
  const lipThickness = 0.078;
  const lipRadiusX = width * 0.492;
  const lipRadiusZ = Math.min(depth * 0.375, lipRadiusX * 1.34);
  // The rim reaches the published front edge and overhangs the skirt all round.
  const lipCenterZ = halfD - lipRadiusZ - 0.004;
  const lip = addPart(
    group,
    profile,
    "toilet-bowl-rim",
    ovalSeatRing(lipRadiusX, lipRadiusZ, lipThickness, 0.82),
    shell,
  );
  lip.position.set(0, lipTop - lipThickness, lipCenterZ);
  lip.userData.silhouette = "overhanging-bowl-rim";
  // Flush control per the photos: PL-12335 carries a lever on the side of the
  // tank, the rest a button on the lid. Either way it sits proud of the china so
  // it is visible from the room, not buried in the lid.
  const flushedByLever = /PL-12335/i.test(profile.pelicanCode) || /PL-12382/i.test(profile.pelicanCode);
  if (flushedByLever) {
    addSideLever(group, profile, chrome, tankWidth / 2 + 0.012, tankTop - 0.10, tankZ + tankDepth * 0.30);
  } else {
    // Sit the buttons proud of the lid surface, as on the photos: sunk inside
    // the lid they were invisible from every angle.
    addTopButtons(group, profile, chrome, height - 0.008, tankZ + tankDepth * 0.20, tankWidth);
  }
  // The bolt cover sits flush in the skirt face, not proud of it: at half the
  // published width it stuck out into thin air.
  addTrapwayCap(group, profile, shell, -width * 0.455, seatHeight * 0.36, -depth * 0.02);
}

/** A Lathe profile that is guaranteed to face outward, whatever its point order. */
function outwardLathe(points: THREE.Vector2[], segments: number): THREE.BufferGeometry {
  const geometry = new THREE.LatheGeometry(points, segments);
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const vertices: number[] = [];
  for (let i = 0; i < position.count; i += 1) vertices.push(position.getX(i), position.getY(i), position.getZ(i));
  const indices: number[] = [];
  if (index) {
    for (let i = 0; i < index.count; i += 1) indices.push(index.getX(i));
  } else {
    for (let i = 0; i < position.count; i += 1) indices.push(i);
  }
  if (signedLoftVolume(vertices, indices) < 0) {
    for (let i = 0; i < indices.length; i += 3) {
      const swap = indices[i + 1]!;
      indices[i + 1] = indices[i + 2]!;
      indices[i + 2] = swap;
    }
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
  }
  return geometry;
}

/**
 * The overhanging bowl lip. A toilet's rim projects past the body beneath it,
 * and that single step in profile is what separates a toilet from a pedestal.
 * Shared by every form that is not built as one continuous skirt.
 */
function addBowlRim(
  group: THREE.Group,
  profile: PelicanToiletMeshProfile,
  shell: THREE.Material,
  seatHeight: number,
  width: number,
  depth: number,
  centreZ: number,
): THREE.Mesh {
  const thickness = 0.078;
  const radiusX = width * 0.455;
  const radiusZ = Math.min(depth * 0.345, radiusX * 1.34);
  const rim = addPart(
    group,
    profile,
    "toilet-bowl-rim",
    ovalSeatRing(radiusX, radiusZ, thickness, 0.82),
    shell,
  );
  rim.position.set(0, seatHeight - 0.006 - thickness, centreZ);
  rim.userData.silhouette = "overhanging-bowl-rim";
  return rim;
}

/**
 * A pedestal toilet body: one continuous ceramic casting from the floor to the
 * bowl rim. The trapway housing narrows over the floor, swells through the
 * bowl, and turns out into the rim. Building it as a single lathe is what keeps
 * the bowl attached to its own base — a separate cone under a separate bowl
 * left a hairline gap that read as a floating assembly.
 */
function addPedestalBowl(
  group: THREE.Group,
  profile: PelicanToiletMeshProfile,
  shell: THREE.Material,
  seatHeight: number,
  width: number,
  depth: number,
): void {
  const rimY = seatHeight - 0.02;
  // Outer silhouette, floor to rim, measured in the lathe's radius.
  // A pedestal toilet is a near-straight column with a slight waist where the
  // trapway is, widening into the bowl. Pinching it like an hourglass was what
  // made it read as a garden pedestal.
  const outer: Array<[number, number]> = [
    [width * 0.375, 0.004],
    [width * 0.375, seatHeight * 0.12],
    [width * 0.345, seatHeight * 0.34],
    [width * 0.330, seatHeight * 0.52],
    [width * 0.375, seatHeight * 0.70],
    [width * 0.430, seatHeight * 0.84],
    [width * 0.462, seatHeight * 0.95],
    [width * 0.468, rimY],
  ];
  // Inner wall, rim back down to the basin floor, then to the axis.
  const inner: Array<[number, number]> = [
    [width * 0.395, rimY - 0.004],
    [width * 0.385, seatHeight * 0.86],
    [width * 0.315, seatHeight * 0.70],
    [width * 0.225, seatHeight * 0.60],
    [width * 0.150, seatHeight * 0.555],
  ];
  const points: THREE.Vector2[] = [
    ...outer.map(([r, y]) => new THREE.Vector2(r, y)),
    ...inner.map(([r, y]) => new THREE.Vector2(r, y)),
    new THREE.Vector2(0.006, seatHeight * 0.555),
  ];
  const bodyGeo = outwardLathe(points, 48);
  // A lathe is round; a toilet is longer than it is wide. Stretch the whole
  // casting along Z so it fills the published depth, then set its front edge at
  // the sheet's front edge so the selection box hugs the bowl.
  bodyGeo.computeBoundingBox();
  const bounds = bodyGeo.boundingBox;
  if (bounds) {
    const latheDepth = bounds.max.z - bounds.min.z;
    if (latheDepth > 0.01) bodyGeo.scale(1, 1, (depth * 0.97) / latheDepth);
  }
  bodyGeo.computeBoundingBox();
  const box = bodyGeo.boundingBox;
  if (box) bodyGeo.translate(0, 0, (depth / 2 - 0.012) - box.max.z);

  const body = addPart(group, profile, "toilet-ceramic-base", bodyGeo, shell);
  body.userData.silhouette = "exposed-pedestal";
  // The bowl mouth is the same casting: a ring over the basin so looking in
  // shows china rather than straight through the fixture.
  body.userData.bowlForm = "elongated";

  const mouthRing = new THREE.TorusGeometry(0.5, 0.040, 14, 64);
  mouthRing.rotateX(Math.PI / 2);
  mouthRing.scale(width * 0.80, 1, depth * 0.72);
  const bowl = addPart(group, profile, "toilet-bowl-exterior", mouthRing, shell);
  bowl.position.set(0, rimY - 0.012, depth * 0.045);
  bowl.userData.continuousWithCeramicBase = true;
  bowl.userData.bowlForm = "elongated";
}

function addPedestalOnePiece(
  group: THREE.Group,
  profile: PelicanToiletMeshProfile,
  shell: THREE.Material,
  seatMaterial: THREE.Material,
  water: THREE.Material,
  chrome: THREE.Material,
  seatHeight: number,
): void {
  const width = profile.widthIn * INCH;
  const depth = profile.depthIn * INCH;
  const height = profile.heightIn * INCH;
  addPedestalBowl(group, profile, shell, seatHeight, width, depth);
  const pedestalCentreZ = depth * 0.06;
  addBowlRim(group, profile, shell, seatHeight, width, depth, pedestalCentreZ);
  addClosedSeatAndLid(group, profile, seatMaterial, chrome, water, seatHeight, width, depth, false, {
    radiusX: width * 0.42,
    radiusZ: width * 0.50,
    centerZ: pedestalCentreZ,
  });
  const tankDepth = Math.min(depth * 0.30, 0.7);
  const tankWidth = width * 0.86;
  const tankZ = -depth / 2 + tankDepth / 2 + 0.035;
  const tankBottom = seatHeight * 0.55;
  const tankHeight = Math.max(0.3, height - tankBottom - 0.04);
  const tank = addRoundedBox(
    group, profile, "toilet-integrated-rear-housing", shell,
    tankWidth, tankHeight, tankDepth, Math.min(tankWidth, tankDepth) * 0.14,
    tankBottom + tankHeight / 2, tankZ,
  );
  tank.userData.silhouette = "rounded-rectangular-tank";
  const tankLidThickness = 0.028;
  const tankLid = addRoundedBox(
    group, profile, "toilet-tank-lid", shell,
    tankWidth * 0.99, tankLidThickness, tankDepth * 0.98, Math.min(tankWidth, tankDepth) * 0.16,
    height - tankLidThickness / 2 - 0.004, tankZ,
  );
  tankLid.userData.silhouette = "rounded-rectangular-tank-lid";
  addTrapwayCap(group, profile, shell, -width * 0.30, seatHeight * 0.32, depth * 0.02);
  if (baseCode(profile.pelicanCode).startsWith("PL-12335")) {
    addSideLever(group, profile, chrome, tankWidth / 2 + 0.02, tankBottom + tankHeight * 0.62, tankZ);
  } else {
    addTopButtons(group, profile, chrome, height - 0.008, tankZ + tankDepth * 0.08, width);
  }
}

function addTwoPiece(
  group: THREE.Group,
  profile: PelicanToiletMeshProfile,
  shell: THREE.Material,
  seatMaterial: THREE.Material,
  water: THREE.Material,
  chrome: THREE.Material,
  seatHeight: number,
): void {
  const width = profile.widthIn * INCH;
  const depth = profile.depthIn * INCH;
  const height = profile.heightIn * INCH;
  addPedestalBowl(group, profile, shell, seatHeight, width, depth);
  const base = group.children.find((child) => child.userData.pelicanBathroomFixturePart === "toilet-ceramic-base");
  if (base) base.userData.silhouette = "exposed-trapway-pedestal";
  addBowlRim(group, profile, shell, seatHeight, width, depth, depth * 0.08);
  addClosedSeatAndLid(group, profile, seatMaterial, chrome, water, seatHeight, width, depth);

  const trap = addPart(group, profile, "toilet-exposed-trapway", new THREE.TorusGeometry(depth * 0.11, width * 0.055, 10, 18, Math.PI * 1.15), shell);
  trap.rotation.set(Math.PI / 2.4, 0.4, 0.2);
  trap.position.set(-width * 0.08, seatHeight * 0.38, -depth * 0.08);
  trap.userData.silhouette = "exposed-trapway";

  const tankDepth = Math.min(depth * 0.30, 0.70);
  // Leave the published sheet a little inboard so the side lever and the tank
  // lid still fit inside the measured width.
  const tankWidth = width * 0.86;
  const tankZ = -depth / 2 + tankDepth / 2 + 0.035;
  // The tank of a two-piece sits ON the rear of the bowl deck, not above it.
  // Floating it left a gap that read as a detached box.
  const tankBottom = seatHeight * 0.80;
  const tankHeight = Math.max(0.36, height - tankBottom - 0.048);
  const tank = addPart(
    group,
    profile,
    "toilet-tank",
    loftRingPoints([
      roundedRectRing(tankWidth * 0.90, tankDepth * 0.78, tankBottom, tankZ + tankDepth * 0.05, tankWidth * 0.15),
      roundedRectRing(tankWidth, tankDepth, tankBottom + tankHeight * 0.34, tankZ, tankWidth * 0.16),
      roundedRectRing(tankWidth, tankDepth, tankBottom + tankHeight * 0.86, tankZ, tankWidth * 0.15),
      roundedRectRing(tankWidth * 0.975, tankDepth * 0.97, height - 0.052, tankZ, tankWidth * 0.15),
    ]),
    shell,
  );
  tank.userData.silhouette = "rounded-rectangular-tank";
  tank.userData.tankFootprint = "rounded-rectangle";
  const lidThickness = 0.034;
  const lid = addPart(
    group,
    profile,
    "toilet-tank-lid",
    loftRingPoints([
      roundedRectRing(tankWidth * 1.00, tankDepth * 1.02, height - 0.052, tankZ, tankWidth * 0.15),
      roundedRectRing(tankWidth * 1.02, tankDepth * 1.045, height - 0.034, tankZ, tankWidth * 0.14),
      roundedRectRing(tankWidth * 1.01, tankDepth * 1.035, height - 0.012, tankZ, tankWidth * 0.16),
      roundedRectRing(tankWidth * 0.95, tankDepth * 0.97, height - 0.001, tankZ, tankWidth * 0.19),
    ]),
    seatMaterial,
  );
  lid.userData.silhouette = "rounded-rectangular-tank-lid";
  addSideLever(group, profile, chrome, tankWidth / 2 + 0.0375, tankBottom + tankHeight * 0.62, tankZ);
}

/**
 * PL-12005 is a low, fully skirted smart toilet with flat side panels and a
 * thick rectangular lid that covers the whole top. Its catalog photo really is
 * a tapered wedge, so the form is angular on purpose; what it must not be is a
 * plain prism with a small lid perched in the middle.
 */
function addSmartWedge(
  group: THREE.Group,
  profile: PelicanToiletMeshProfile,
  shell: THREE.Material,
  seatMaterial: THREE.Material,
  water: THREE.Material,
  dark: THREE.Material,
  seatHeight: number,
): void {
  const width = profile.widthIn * INCH;
  const depth = profile.depthIn * INCH;
  const height = profile.heightIn * INCH;
  // The published height is the top of the raised rear deck, not the lid: on
  // the catalog photo the lid sits down at seat level and the tall block behind
  // the seat carries the controls. Putting the lid at the top of the sheet left
  // it hovering four inches above the bowl.
  const lidThickness = Math.min(0.055, height * 0.05);
  // Each ring's depth is a share of the published depth, and its centre is set
  // so the ring's BACK face lands on the back face of the sheet.
  const backAligned = (depthShare: number) => -depth / 2 + (depth * depthShare) / 2;

  const base = addPart(group, profile, "toilet-ceramic-base", loftRingPoints([
    roundedRectRing(width * 0.90, depth * 0.93, 0.002, backAligned(0.93), width * 0.10),
    roundedRectRing(width * 0.97, depth * 0.985, seatHeight * 0.28, backAligned(0.985), width * 0.11),
    roundedRectRing(width * 0.98, depth * 0.99, seatHeight * 0.66, backAligned(0.99), width * 0.11),
    roundedRectRing(width * 0.955, depth * 0.965, seatHeight * 0.94, backAligned(0.965), width * 0.12),
    roundedRectRing(width * 0.90, depth * 0.92, seatHeight - 0.010, backAligned(0.92), width * 0.14),
  ]), shell);
  base.userData.silhouette = "low-squared-smart-body";

  // Bowl mouth: an oval ring sitting in the deck, so the bowl reads as china.
  const bowlRadiusX = width * 0.345;
  const bowlRadiusZ = depth * 0.30;
  const bowl = addPart(group, profile, "toilet-bowl-exterior", (() => {
    const ring = new THREE.TorusGeometry(0.5, 0.038, 14, 64);
    ring.rotateX(Math.PI / 2);
    ring.scale(bowlRadiusX * 2, 1, bowlRadiusZ * 2);
    return ring;
  })(), shell);
  bowl.position.set(0, seatHeight - 0.012, depth * 0.06);
  bowl.userData.continuousWithCeramicBase = true;
  bowl.userData.bowlForm = "elongated";

  // Seat ring and the thick flush lid that covers the whole top, as in the
  // photo.
  const seat = addPart(group, profile, "toilet-seat", ovalSeatRing(bowlRadiusX * 1.02, bowlRadiusZ * 1.02, 0.030, 0.80), seatMaterial);
  seat.position.set(0, seatHeight, depth * 0.06);
  seat.userData.seatProfile = "closed-round-oval";
  const lid = addPart(group, profile, "toilet-lid", loftRingPoints([
    roundedRectRing(width * 0.94, depth * 0.955, seatHeight, backAligned(0.955), width * 0.13),
    roundedRectRing(width * 0.985, depth * 0.99, seatHeight + lidThickness * 0.45, backAligned(0.99), width * 0.12),
    roundedRectRing(width * 0.98, depth * 0.985, seatHeight + lidThickness * 0.88, backAligned(0.985), width * 0.13),
    roundedRectRing(width * 0.93, depth * 0.945, seatHeight + lidThickness, backAligned(0.945), width * 0.16),
  ]), seatMaterial);
  lid.userData.lidProfile = "flat-rounded-rectangle";

  // The raised rear deck: the tallest part of the fixture and the carrier for
  // the control dial and the flush sensor.
  const rearTop = height - 0.030;
  // Sits at the back of the deck, with its back face on the wall.
  const rearDepthShare = 0.36;
  const rearZ = backAligned(rearDepthShare);
  const rear = addPart(group, profile, "toilet-smart-rear-housing", loftRingPoints([
    roundedRectRing(width * 0.74, depth * rearDepthShare * 0.90, seatHeight - 0.05, rearZ, width * 0.18),
    roundedRectRing(width * 0.80, depth * rearDepthShare, seatHeight + (rearTop - seatHeight) * 0.50, rearZ, width * 0.18),
    roundedRectRing(width * 0.78, depth * rearDepthShare * 0.94, rearTop, rearZ, width * 0.20),
  ]), shell);
  rear.userData.silhouette = "flat-squared-smart-rear";

  const waterWell = addPart(group, profile, "toilet-bowl-water", new THREE.CircleGeometry(0.5, 28), water);
  waterWell.rotation.x = -Math.PI / 2;
  waterWell.scale.set(bowlRadiusX * 1.5, bowlRadiusZ * 1.3, 1);
  waterWell.position.set(0, seatHeight - 0.02, depth * 0.06);

  // Control dial on the side panel near the top rear, as in the photo, plus the
  // touchless top sensor.
  const dialZ = rearZ;
  const dialY = seatHeight + (rearTop - seatHeight) * 0.55;
  const dial = addPart(group, profile, "toilet-smart-control-panel", new THREE.CylinderGeometry(width * 0.055, width * 0.055, 0.012, 24), dark);
  dial.rotation.z = Math.PI / 2;
  dial.position.set(-width * 0.398, dialY, dialZ);
  dial.userData.controlPanel = "touchless-sensor";
  const cap = addPart(
    group,
    profile,
    profile.toiletFlushControl === "touchless-auto" ? "toilet-touchless-auto-top" : "toilet-touchless-top",
    new THREE.CylinderGeometry(width * 0.050, width * 0.050, 0.010, 20),
    dark,
  );
  cap.position.set(0, rearTop + 0.014, rearZ);
  cap.userData.toiletFlushControlMode = profile.toiletFlushControl ?? "touchless";
}

function addSmartEgg(
  group: THREE.Group,
  profile: PelicanToiletMeshProfile,
  shell: THREE.Material,
  seatMaterial: THREE.Material,
  water: THREE.Material,
  dark: THREE.Material,
  seatHeight: number,
): void {
  const width = profile.widthIn * INCH;
  const depth = profile.depthIn * INCH;
  const height = profile.heightIn * INCH;
  const halfD = depth / 2;
  // PL-12230/PL-12305 are tankless smart toilets: one smooth skirted body with a
  // low moulded rear deck, a flush closed lid, and a side control panel. There is
  // no separate tall tank box. Built on the same extruded skirt as the one-piece
  // family so the sides are smooth and continuous.
  const footWidth = width * 0.97;
  const footDepth = depth * 0.97;
  const base = addPart(group, profile, "toilet-ceramic-base", skirtBodyGeometry(footWidth, footDepth, seatHeight), shell);
  base.userData.silhouette = "rounded-smart-body";
  base.userData.bowlForm = "elongated";

  // Rim cap and bowl opening, flush with the skirt top.
  const rim = ovalCap(footWidth * 0.34, footDepth * 0.20, 0.008, 0.004);
  const bowl = addPart(group, profile, "toilet-bowl-exterior", rim, shell);
  bowl.position.set(0, seatHeight * 0.995, depth * 0.06);
  bowl.userData.continuousWithCeramicBase = true;
  bowl.userData.bowlForm = "elongated";

  const radiusX = width * 0.38;
  const radiusZ = Math.min(depth * 0.29, radiusX * 1.45);
  const centerZ = THREE.MathUtils.clamp(depth * 0.10, -halfD + radiusZ, halfD - radiusZ - 0.02);
  addClosedSeatAndLid(group, profile, seatMaterial, dark, water, seatHeight, width, depth, false, {
    radiusX,
    radiusZ,
    centerZ,
  });

  // Low moulded rear deck. The sheet's overall height is measured at this
  // housing, so it rises from inside the body to the published height; the lid
  // stays flush at seat height.
  const deckDepth = Math.min(depth * 0.24, 0.52);
  const deckZ = -halfD + deckDepth / 2 + 0.02;
  const deckTop = height;
  const deckBottom = seatHeight * 0.72;
  const deck = addRoundedBox(
    group, profile, "toilet-smart-rear-housing", shell,
    width * 0.80, Math.max(0.08, deckTop - deckBottom), deckDepth,
    Math.min(width, deckDepth) * 0.28,
    deckBottom + (deckTop - deckBottom) / 2, deckZ,
  );
  deck.userData.silhouette = "low-integrated-smart-deck";

  // Touchless flush cap, recessed into the deck so nothing exceeds the envelope.
  const part = profile.toiletFlushControl === "touchless-auto" ? "toilet-touchless-auto-top" : "toilet-touchless-top";
  const cap = addPart(group, profile, part, new THREE.CylinderGeometry(width * 0.05, width * 0.05, 0.01, 24), dark);
  cap.position.set(0, deckTop - 0.006, deckZ + deckDepth * 0.1);
  cap.userData.toiletFlushControlMode = profile.toiletFlushControl ?? "touchless";

  // Side control panel, at the height the photos show it.
  const panel = addPart(
    group,
    profile,
    "toilet-smart-control-panel",
    new RoundedBoxGeometry(Math.max(0.05, height * 0.10), Math.max(0.04, height * 0.055), 0.008, 3, 0.006),
    dark,
  );
  panel.position.set(-footWidth * 0.505, seatHeight * 0.60, deckZ + deckDepth * 0.2);
  panel.rotation.y = Math.PI / 2;
  panel.userData.controlPanel = "side";
}

/**
 * The showroom details on a smart toilet: the light line under the skirt, the
 * button pad on the side, and the dark sensor window on the rear deck.
 *
 * These are what make a smart model legible at a glance in the catalogue photos,
 * so a plain white egg-shaped body reads as unfinished next to them.
 */
function attachSmartDetails(
  group: THREE.Group,
  profile: PelicanToiletMeshProfile,
  shell: THREE.Material,
  black: boolean,
): void {
  const width = profile.widthIn * INCH;
  const depth = profile.depthIn * INCH;
  const height = profile.heightIn * INCH;

  // LED status strip: a thin emissive line around the base, just above the floor.
  const led = new THREE.MeshPhysicalMaterial({
    color: black ? "#7fd4ff" : "#cfeaff",
    emissive: new THREE.Color("#63c8ff"),
    emissiveIntensity: black ? 1.15 : 0.55,
    roughness: 0.25,
    metalness: 0,
    toneMapped: false,
  });
  const strip = addPart(
    group,
    profile,
    "toilet-led-status-strip",
    new THREE.TorusGeometry(0.5, 0.012, 12, 96),
    led,
  );
  strip.rotation.x = Math.PI / 2;
  strip.scale.set(width * 0.86, depth * 0.80, 1);
  strip.position.set(0, 0.055, 0.0);
  strip.userData.emissiveDetail = true;

  // Side control pad on the right flank, angled to face out.
  const padMaterial = new THREE.MeshPhysicalMaterial({
    color: black ? "#0b0d0f" : "#2a2f34",
    roughness: 0.18,
    metalness: 0.15,
    clearcoat: 0.7,
    clearcoatRoughness: 0.15,
  });
  const pad = addPart(
    group,
    profile,
    "toilet-smart-side-keypad",
    new RoundedBoxGeometry(width * 0.16, height * 0.11, 0.016, 4, 0.006),
    padMaterial,
  );
  // The keypad must stay inside the published width: the envelope test measures
  // the finished body against the sheet, and a pad proud of the flank pushed real
  // SKUs 4-10 mm over. Sink it so the panel's outer face lands on the skirt.
  pad.position.set(width * 0.47, height * 0.52, depth * 0.02);
  pad.rotation.y = Math.PI / 2;

  // Button dots on the pad, so it does not read as a blank tile.
  const keyMaterial = new THREE.MeshStandardMaterial({ color: black ? "#3a4046" : "#8e979e", roughness: 0.5 });
  for (let i = 0; i < 3; i += 1) {
    const key = addPart(
      group,
      profile,
      `toilet-smart-keypad-button-${i}`,
      new THREE.CylinderGeometry(0.012, 0.012, 0.006, 24),
      keyMaterial,
    );
    key.rotation.z = Math.PI / 2;
    key.position.set(width * 0.478, height * (0.485 + i * 0.036), depth * 0.02);
  }

  // Sensor window on the rear deck.
  const sensor = addPart(
    group,
    profile,
    "toilet-smart-sensor-window",
    new RoundedBoxGeometry(width * 0.22, 0.008, depth * 0.07, 3, 0.004),
    new THREE.MeshPhysicalMaterial({
      color: "#0b1114",
      roughness: 0.08,
      metalness: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
    }),
  );
  sensor.position.set(0, height * 0.985, -depth * 0.31);
  sensor.userData.sensorWindow = true;
}

/**
 * Standalone toilet in feet. Every mesh stays inside the profile envelope.
 */
export function makePelicanToiletGroup(profile: PelicanToiletMeshProfile): THREE.Group {
  const group = new THREE.Group();
  const height = profile.heightIn * INCH;
  const seatHeight = Math.min(height * 0.92, Math.max(height * 0.45, (profile.seatHeightIn ?? profile.heightIn * 0.52) * INCH));
  const black = isMatteBlack(profile.finish);
  const shell = pelicanChinaMaterial(black);
  const seatMaterial = pelicanChinaMaterial(black);
  if (!black) seatMaterial.roughness = 0.05;
  const water = new THREE.MeshPhysicalMaterial({ color: "#d7eef3", roughness: 0.04, metalness: 0, transmission: 0.2, transparent: true, opacity: 0.85 });
  const chrome = new THREE.MeshPhysicalMaterial({ color: black ? "#2a2d30" : "#f4f7f8", roughness: black ? 0.35 : 0.12, metalness: black ? 0.25 : 1, clearcoat: black ? 0 : 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: black ? "#050607" : "#1c1f22", roughness: 0.35 });
  const form = pelicanToiletForm(profile);

  group.userData = {
    pelicanCode: profile.pelicanCode,
    toiletStyle: profile.toiletStyle ?? "one-piece",
    toiletForm: form,
    sourceEnvelopeIn: { width: profile.widthIn, depth: profile.depthIn, height: profile.heightIn },
    visualOnly: true,
    illustrativeContours: true,
  };

  // Smart models carry the details you actually see on the showroom photos: a
  // lit status strip at the base, a side keypad, and a rear deck panel. These are
  // surface details, not structure, so they go on after the body is built.
  if (form === "smart-wedge" || form === "smart-egg") {
    attachSmartDetails(group, profile, shell, black);
  }

  if (form === "smart-wedge") addSmartWedge(group, profile, shell, seatMaterial, water, dark, seatHeight);
  else if (form === "smart-egg") addSmartEgg(group, profile, shell, seatMaterial, water, dark, seatHeight);
  else if (form === "two-piece") addTwoPiece(group, profile, shell, seatMaterial, water, chrome, seatHeight);
  else if (form === "pedestal-one-piece") addPedestalOnePiece(group, profile, shell, seatMaterial, water, chrome, seatHeight);
  else addSkirtedOnePiece(group, profile, shell, seatMaterial, water, chrome, seatHeight);
  return group;
}

/**
 * Scale the assembled fixture to its published envelope.
 *
 * Each builder draws a plausible silhouette, but hand-tuned proportions left
 * several models short of their sheet in width or depth, so the selection box
 * floated around a smaller tub. This measures the finished body and scales it,
 * once, to fill the sheet. Height and the floor contact are preserved: the
 * fixture still sits flat, and the seat stays at its published height because
 * the scale is applied about the floor.
 */
