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
  if (code.startsWith("PL-12050") || code.startsWith("PL-12335")) return "pedestal-one-piece";
  return "skirted-one-piece";
}

function rounderBowl(code: string): boolean {
  // PL-12318 and PL-12382 are elongated skirted bowls in the catalog photos.
  // Only the low smart body uses the rounder seat.
  return baseCode(code).startsWith("PL-12005");
}

function roundedRectRing(width: number, depth: number, y: number, z: number, radius: number, cornerSegments = 5): THREE.Vector3[] {
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

function ellipseRing(width: number, depth: number, y: number, z: number, segments = 28): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let step = 0; step < segments; step++) {
    const angle = (step / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * width / 2, y, z + Math.sin(angle) * depth / 2));
  }
  return points;
}

/** Closed loft. Ellipse rings read as a bowl; rounded rectangles read as a tank or smart body. */
/** A ring spanning a back-to-front range, for the rounded-plan loft. */
function spanRing(width: number, y: number, back: number, front: number, radiusFraction: number): Ring {
  const depth = Math.max(0.04, front - back);
  return { width, depth, y, z: (front + back) / 2, radius: Math.min(width, depth) * radiusFraction };
}

function loft(rings: Ring[], shape: "ellipse" | "rounded" = "ellipse"): THREE.BufferGeometry {
  const segments = shape === "ellipse" ? 32 : 24;
  const ringPoints = rings.map((ring) => shape === "ellipse"
    ? ellipseRing(ring.width, ring.depth, ring.y, ring.z, segments)
    : roundedRectRing(ring.width, ring.depth, ring.y, ring.z, ring.radius ?? Math.min(ring.width, ring.depth) * 0.18, 6));
  const vertices = ringPoints.flatMap((points) => points.flatMap((point) => [point.x, point.y, point.z]));
  const ringLength = segments;
  const indices: number[] = [];
  for (let ring = 0; ring < ringPoints.length - 1; ring++) {
    for (let index = 0; index < ringLength; index++) {
      const next = (index + 1) % ringLength;
      const a = ring * ringLength + index;
      const b = ring * ringLength + next;
      const c = (ring + 1) * ringLength + next;
      const d = (ring + 1) * ringLength + index;
      indices.push(a, d, b, b, d, c);
    }
  }
  for (const ring of [0, ringPoints.length - 1]) {
    const center = vertices.length / 3;
    vertices.push(0, ringPoints[ring][0].y, rings[ring].z);
    for (let index = 0; index < ringLength; index++) {
      const next = (index + 1) % ringLength;
      const a = ring * ringLength + index;
      const b = ring * ringLength + next;
      indices.push(ring === 0 ? center : a, ring === 0 ? a : b, ring === 0 ? b : center);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function ellipseLoft(rings: Ring[]): THREE.BufferGeometry {
  return loft(rings, "ellipse");
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
  const points: THREE.Vector2[] = [new THREE.Vector2(0, rise)];
  const steps = 10;
  for (let step = 1; step <= steps; step++) {
    const angle = (step / steps) * Math.PI / 2;
    points.push(new THREE.Vector2(Math.sin(angle) * radiusX, Math.cos(angle) * rise));
  }
  points.push(new THREE.Vector2(radiusX * 0.98, -edge));
  points.push(new THREE.Vector2(0, -edge));
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

/** Glossy vitreous china. White stays white; matte black stays matte. */
function chinaMaterial(black: boolean): THREE.MeshPhysicalMaterial {
  if (black) {
    return new THREE.MeshPhysicalMaterial({
      color: "#17191b",
      roughness: 0.46,
      metalness: 0,
      clearcoat: 0.04,
      clearcoatRoughness: 0.45,
    });
  }
  return new THREE.MeshPhysicalMaterial({
    color: "#ffffff",
    emissive: "#f4f5f3",
    emissiveIntensity: 0.22,
    roughness: 0.04,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    reflectivity: 0.55,
    ior: 1.5,
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

function addClosedSeatAndLid(
  group: THREE.Group,
  profile: PelicanToiletMeshProfile,
  seatMaterial: THREE.Material,
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
  // A thin oval ring, then a low lid sitting on it. The lid covers the well
  // so the closed toilet does not read as a disc floating over a gray bowl.
  const seatRing = new THREE.TorusGeometry(0.5, 0.055, 12, 56);
  seatRing.rotateX(Math.PI / 2);
  seatRing.scale(radiusX * 1.02, 0.22, radiusZ * 1.02);
  const seat = addPart(group, profile, "toilet-seat", seatRing, seatMaterial);
  seat.position.set(0, seatHeight, centerZ);
  seat.userData.seatProfile = round ? "closed-round-oval" : "closed-elongated-oval";
  const lid = addPart(group, profile, "toilet-lid", ovalLid(radiusX * 1.04, radiusZ * 1.02, squared ? 0.016 : 0.028), seatMaterial);
  lid.position.set(0, seatHeight + 0.008, centerZ);
  lid.userData.lidProfile = squared ? "flat-rounded-rectangle" : "soft-elongated-oval";

  const waterWell = addPart(group, profile, "toilet-bowl-water", new THREE.CircleGeometry(0.5, 28), water);
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
  const lever = addPart(group, profile, "toilet-single-flush-button", new THREE.CylinderGeometry(0.012, 0.012, 0.09, 12), chrome);
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
  shape.moveTo(-halfW, back);
  shape.lineTo(-halfW, arcY);
  shape.absarc(0, arcY, radius, Math.PI, 0, true);
  shape.lineTo(halfW, back);
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

  const base = addPart(group, profile, "toilet-ceramic-base", skirtBodyGeometry(footWidth, footDepth, seatHeight), shell);
  base.userData.silhouette = "continuous-skirted-body";
  base.userData.bowlForm = "elongated";

  const rim = ovalCap(footWidth * 0.30, footDepth * 0.18, 0.008, 0.004);
  const bowl = addPart(group, profile, "toilet-bowl-exterior", rim, shell);
  bowl.position.set(0, seatHeight * 0.9, depth * 0.08);
  bowl.userData.continuousWithCeramicBase = true;
  bowl.userData.bowlForm = "elongated";

  const radiusX = width * 0.40;
  const radiusZ = Math.min(depth * 0.30, radiusX * 1.35);
  const bowlCenterZ = THREE.MathUtils.clamp(depth * 0.12, -halfD + radiusZ, halfD - radiusZ - 0.02);
  addClosedSeatAndLid(group, profile, seatMaterial, water, seatHeight, width, depth, false, {
    radiusX,
    radiusZ,
    centerZ: bowlCenterZ,
  });

  const tankHeight = Math.max(0.2, height - 0.05);
  const tank = addRoundedBox(
    group, profile, "toilet-integrated-rear-housing", shell,
    tankWidth, tankHeight, tankDepth * 0.98, Math.min(tankWidth, tankDepth) * 0.12,
    tankHeight / 2 + 0.008, tankZ,
  );
  tank.userData.silhouette = "rounded-rectangular-tank";
  const lidThickness = 0.028;
  const tankLid = addRoundedBox(
    group, profile, "toilet-tank-lid", shell,
    tankWidth * 0.98, lidThickness, tankDepth * 0.96, Math.min(tankWidth, tankDepth) * 0.14,
    height - lidThickness / 2 - 0.006, tankZ,
  );
  tankLid.userData.silhouette = "rounded-rectangular-tank-lid";
  const fillet = addPart(
    group,
    profile,
    "toilet-tank-skirt-fillet",
    new THREE.CylinderGeometry(0.055, 0.055, tankWidth * 0.86, 18, 1, false, Math.PI * 1.05, Math.PI * 0.9),
    shell,
  );
  fillet.rotation.z = Math.PI / 2;
  fillet.position.set(0, seatHeight - 0.01, tankZ + tankDepth * 0.46);
  fillet.userData.silhouette = "tank-to-skirt-blend";
  addTopButtons(group, profile, chrome, height - 0.01, tankZ + tankDepth * 0.28, tankWidth);
  addTrapwayCap(group, profile, shell, -width * 0.49, seatHeight * 0.36, -depth * 0.02);
}

function addPedestalBowl(
  group: THREE.Group,
  profile: PelicanToiletMeshProfile,
  shell: THREE.Material,
  seatHeight: number,
  width: number,
  depth: number,
): void {
  const foot = new THREE.LatheGeometry([
    new THREE.Vector2(width * 0.20, 0.004),
    new THREE.Vector2(width * 0.26, seatHeight * 0.12),
    new THREE.Vector2(width * 0.18, seatHeight * 0.48),
    new THREE.Vector2(width * 0.14, seatHeight * 0.62),
  ], 36);
  foot.scale(1, 1, 1.15);
  const pedestal = addPart(group, profile, "toilet-ceramic-base", foot, shell);
  pedestal.userData.silhouette = "exposed-pedestal";
  pedestal.userData.bowlForm = "elongated";
  const bowlGeo = new THREE.LatheGeometry([
    new THREE.Vector2(0.02, seatHeight * 0.58),
    new THREE.Vector2(width * 0.22, seatHeight * 0.66),
    new THREE.Vector2(width * 0.40, seatHeight * 0.84),
    new THREE.Vector2(width * 0.44, seatHeight * 0.98),
    new THREE.Vector2(width * 0.30, seatHeight),
    new THREE.Vector2(0.02, seatHeight),
  ], 48);
  bowlGeo.scale(1, 1, Math.min(1.45, depth / Math.max(width, 0.01)));
  bowlGeo.translate(0, 0, depth * 0.04);
  const bowl = addPart(group, profile, "toilet-bowl-exterior", bowlGeo, shell);
  bowl.userData.continuousWithCeramicBase = false;
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
  addClosedSeatAndLid(group, profile, seatMaterial, water, seatHeight, width, depth, false, {
    radiusX: width * 0.42,
    radiusZ: width * 0.50,
    centerZ: depth * 0.06,
  });
  const tankDepth = Math.min(depth * 0.30, 0.7);
  const tankWidth = width * 0.86;
  const tankZ = -depth / 2 + tankDepth / 2 + 0.02;
  const tankBottom = seatHeight * 0.55;
  const tankHeight = Math.max(0.3, height - tankBottom - 0.04);
  const tank = addRoundedBox(
    group, profile, "toilet-integrated-rear-housing", shell,
    tankWidth, tankHeight, tankDepth, Math.min(tankWidth, tankDepth) * 0.14,
    tankBottom + tankHeight / 2, tankZ,
  );
  tank.userData.silhouette = "rounded-rectangular-tank";
  addTrapwayCap(group, profile, shell, -width * 0.30, seatHeight * 0.32, depth * 0.02);
  if (baseCode(profile.pelicanCode).startsWith("PL-12335")) {
    addSideLever(group, profile, chrome, tankWidth / 2 + 0.02, tankBottom + tankHeight * 0.62, tankZ);
  } else {
    addTopButtons(group, profile, chrome, height - 0.016, tankZ + tankDepth * 0.08, width);
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
  addClosedSeatAndLid(group, profile, seatMaterial, water, seatHeight, width, depth);

  const trap = addPart(group, profile, "toilet-exposed-trapway", new THREE.TorusGeometry(depth * 0.11, width * 0.055, 10, 18, Math.PI * 1.15), shell);
  trap.rotation.set(Math.PI / 2.4, 0.4, 0.2);
  trap.position.set(-width * 0.08, seatHeight * 0.38, -depth * 0.08);
  trap.userData.silhouette = "exposed-trapway";

  const tankDepth = Math.min(depth * 0.28, 0.66);
  const tankWidth = width * 0.78;
  const tankZ = -depth / 2 + tankDepth / 2 + 0.03;
  const tankBottom = seatHeight * 0.92;
  const tankHeight = Math.max(0.36, height - tankBottom - 0.045);
  const tank = addRoundedBox(
    group, profile, "toilet-tank", shell,
    tankWidth, tankHeight, tankDepth, Math.min(tankWidth, tankDepth) * 0.16,
    tankBottom + tankHeight / 2, tankZ,
  );
  tank.userData.silhouette = "rounded-rectangular-tank";
  const lidThickness = 0.03;
  const lid = addRoundedBox(
    group, profile, "toilet-tank-lid", seatMaterial,
    tankWidth * 1.04, lidThickness, tankDepth * 1.06, Math.min(tankWidth, tankDepth) * 0.18,
    height - lidThickness / 2 - 0.008, tankZ,
  );
  lid.userData.silhouette = "rounded-rectangular-tank-lid";
  addSideLever(group, profile, chrome, tankWidth / 2 + 0.015, tankBottom + tankHeight * 0.62, tankZ);
}

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
  const base = addPart(group, profile, "toilet-ceramic-base", loft([
    { width: width * 0.94, depth: depth * 0.92, y: 0, z: -depth * 0.02 },
    { width: width * 0.88, depth: depth * 0.78, y: seatHeight * 0.48, z: -depth * 0.05 },
    { width: width * 0.80, depth: depth * 0.58, y: seatHeight * 0.96, z: -depth * 0.08 },
  ], "rounded"), shell);
  base.userData.silhouette = "low-squared-smart-body";
  const bowl = addPart(group, profile, "toilet-bowl-exterior", ellipseLoft([
    { width: width * 0.62, depth: depth * 0.36, y: seatHeight * 0.72, z: depth * 0.08 },
    { width: width * 0.78, depth: depth * 0.46, y: seatHeight * 0.98, z: depth * 0.06 },
  ]), shell);
  bowl.userData.continuousWithCeramicBase = true;
  const lidRadiusX = width * 0.42;
  const lidRadiusZ = depth * 0.30;
  const seat = addPart(group, profile, "toilet-seat", ovalCap(lidRadiusX * 1.02, lidRadiusZ * 1.02, 0.01, 0.006), seatMaterial);
  seat.position.set(0, seatHeight, -depth * 0.02);
  seat.userData.seatProfile = "closed-round-oval";
  const lid = addPart(group, profile, "toilet-lid", ovalCap(lidRadiusX, lidRadiusZ, 0.016, 0.008), seatMaterial);
  lid.position.set(0, seatHeight + 0.016, -depth * 0.02);
  lid.userData.lidProfile = "flat-rounded-rectangle";
  const waterWell = addPart(group, profile, "toilet-bowl-water", new THREE.CircleGeometry(0.5, 24), water);
  waterWell.rotation.x = -Math.PI / 2;
  waterWell.scale.set(lidRadiusX, lidRadiusZ * 0.7, 1);
  waterWell.position.set(0, seatHeight - 0.01, depth * 0.04);

  const rear = addPart(group, profile, "toilet-smart-rear-housing", loft([
    { width: width * 0.36, depth: depth * 0.16, y: seatHeight * 0.94, z: -depth * 0.28 },
    { width: width * 0.30, depth: depth * 0.13, y: height - 0.012, z: -depth * 0.28 },
  ], "rounded"), shell);
  rear.userData.silhouette = "flat-squared-smart-rear";
  const cap = addPart(
    group,
    profile,
    profile.toiletFlushControl === "touchless-auto" ? "toilet-touchless-auto-top" : "toilet-touchless-top",
    new THREE.CylinderGeometry(width * 0.055, width * 0.055, 0.012, 20),
    dark,
  );
  cap.position.set(-width * 0.22, height - 0.01, -depth * 0.22);
  cap.userData.toiletFlushControlMode = profile.toiletFlushControl ?? "touchless";
  const sensor = addPart(group, profile, "toilet-smart-control-panel", new THREE.CircleGeometry(width * 0.028, 16), dark);
  sensor.rotation.x = -Math.PI / 2;
  sensor.position.set(-width * 0.22, height - 0.002, -depth * 0.22);
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
  addClosedSeatAndLid(group, profile, seatMaterial, water, seatHeight, width, depth, false, {
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
 * Standalone toilet in feet. Every mesh stays inside the profile envelope.
 */
export function makePelicanToiletGroup(profile: PelicanToiletMeshProfile): THREE.Group {
  const group = new THREE.Group();
  const height = profile.heightIn * INCH;
  const seatHeight = Math.min(height * 0.92, Math.max(height * 0.45, (profile.seatHeightIn ?? profile.heightIn * 0.52) * INCH));
  const black = isMatteBlack(profile.finish);
  const shell = chinaMaterial(black);
  const seatMaterial = chinaMaterial(black);
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

  if (form === "smart-wedge") addSmartWedge(group, profile, shell, seatMaterial, water, dark, seatHeight);
  else if (form === "smart-egg") addSmartEgg(group, profile, shell, seatMaterial, water, dark, seatHeight);
  else if (form === "two-piece") addTwoPiece(group, profile, shell, seatMaterial, water, chrome, seatHeight);
  else if (form === "pedestal-one-piece") addPedestalOnePiece(group, profile, shell, seatMaterial, water, chrome, seatHeight);
  else addSkirtedOnePiece(group, profile, shell, seatMaterial, water, chrome, seatHeight);
  return group;
}
