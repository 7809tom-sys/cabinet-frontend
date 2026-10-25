import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** Match InteractiveRoom3D: one scene unit is one foot. */
const INCH = 1 / 12;

/**
 * The pictured exterior styling is guided by the official Pelican catalog
 * references reviewed on 2026-10-08:
 * - PL-12044-front.jpg and PL-12044-angle.jpg
 * - PL-12011.jpg
 * - PL-12005.png
 * in /home/ubuntu/pelican-toilet-reference-2026-10-08/.
 *
 * Those images guide only the illustrative scene contours below. Every mesh is
 * constrained to the official profile's exterior width, depth, and height;
 * this is not an installation, plumbing, or internal-parts representation.
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

type Ring = {
  width: number;
  depth: number;
  y: number;
  z: number;
};

function isMatteBlack(finish: string): boolean {
  return finish.trim().toLowerCase().includes("matte-black");
}

function roundedRing(width: number, depth: number, y: number, z: number, radius: number, cornerSegments = 4): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const clampedRadius = Math.min(radius, width / 2, depth / 2);
  const corners: Array<[number, number, number]> = [
    [width / 2 - clampedRadius, depth / 2 - clampedRadius, 0],
    [-width / 2 + clampedRadius, depth / 2 - clampedRadius, Math.PI / 2],
    [-width / 2 + clampedRadius, -depth / 2 + clampedRadius, Math.PI],
    [width / 2 - clampedRadius, -depth / 2 + clampedRadius, Math.PI * 1.5],
  ];
  for (const [centerX, centerZ, start] of corners) {
    for (let step = 0; step < cornerSegments; step++) {
      const angle = start + (step / cornerSegments) * Math.PI / 2;
      points.push(new THREE.Vector3(centerX + Math.cos(angle) * clampedRadius, y, z + centerZ + Math.sin(angle) * clampedRadius));
    }
  }
  return points;
}

/** A smooth, rounded-rectangle loft for the skirt and integrated rear. */
function roundedLoft(rings: Ring[], material: THREE.Material): THREE.BufferGeometry {
  const ringPoints = rings.map(({ width, depth, y, z }) => roundedRing(width, depth, y, z, Math.min(width, depth) * 0.18));
  const vertices = ringPoints.flatMap((points) => points.flatMap((point) => [point.x, point.y, point.z]));
  const ringLength = ringPoints[0].length;
  const indices: number[] = [];
  for (let ring = 0; ring < ringPoints.length - 1; ring++) {
    for (let index = 0; index < ringLength; index++) {
      const next = (index + 1) % ringLength;
      const a = ring * ringLength + index;
      const b = ring * ringLength + next;
      const c = (ring + 1) * ringLength + next;
      const d = (ring + 1) * ringLength + index;
      indices.push(a, b, d, b, c, d);
    }
  }
  for (const ring of [0, ringPoints.length - 1]) {
    const center = vertices.length / 3;
    const sample = ringPoints[ring][0];
    vertices.push(0, sample.y, rings[ring].z);
    for (let index = 0; index < ringLength; index++) {
      const next = (index + 1) % ringLength;
      const a = ring * ringLength + index;
      const b = ring * ringLength + next;
      indices.push(ring === 0 ? center : a, ring === 0 ? b : center, ring === 0 ? a : b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  // The rounded rings wind clockwise as viewed from above. Reverse the loft
  // and cap triangles so outward porcelain faces stay visible with FrontSide.
  for (let index = 0; index < indices.length; index += 3) {
    [indices[index + 1], indices[index + 2]] = [indices[index + 2], indices[index + 1]];
  }
  geometry.setIndex(indices);
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

function roundedBox(width: number, height: number, depth: number, radius: number): THREE.BufferGeometry {
  return new RoundedBoxGeometry(width, height, depth, 5, Math.min(radius, width / 2, height / 2, depth / 2));
}

function addBowlAndClosedSeat(
  group: THREE.Group,
  profile: PelicanToiletMeshProfile,
  shell: THREE.Material,
  seatMaterial: THREE.Material,
  water: THREE.Material,
  seatHeight: number,
  squared = false,
): void {
  const width = profile.widthIn * INCH;
  const depth = profile.depthIn * INCH;
  const bowl = addPart(
    group,
    profile,
    "toilet-bowl-exterior",
    roundedLoft([
      { width: width * 0.76, depth: depth * 0.55, y: seatHeight * 0.58, z: depth * 0.13 },
      { width: width * 0.91, depth: depth * 0.68, y: seatHeight * 0.83, z: depth * 0.14 },
      { width: width * 0.94, depth: depth * 0.70, y: seatHeight * 0.975, z: depth * 0.13 },
    ], shell),
    shell,
  );
  // This overlap makes the bowl visually continuous with the skirted lower shell.
  bowl.userData.continuousWithCeramicBase = true;

  const waterWell = addPart(group, profile, "toilet-bowl-water", new THREE.CircleGeometry(0.5, 36), water);
  waterWell.rotation.x = -Math.PI / 2;
  waterWell.scale.set(width * 0.55, depth * 0.37, 1);
  waterWell.position.set(0, seatHeight * 0.978, depth * 0.13);

  const seatDepth = squared ? depth * 0.76 : depth * 0.67;
  const seatWidth = squared ? width * 0.94 : width * 0.90;
  const seat = addPart(group, profile, "toilet-seat", roundedBox(seatWidth, 0.035, seatDepth, Math.min(width, depth) * 0.045), seatMaterial);
  seat.position.set(0, seatHeight + 0.018, squared ? depth * 0.08 : depth * 0.13);

  const lid = addPart(group, profile, "toilet-lid", roundedBox(seatWidth * (squared ? 0.99 : 0.96), squared ? 0.052 : 0.042, seatDepth * 0.97, Math.min(width, depth) * (squared ? 0.06 : 0.11)), seatMaterial);
  lid.position.set(0, seatHeight + (squared ? 0.061 : 0.057), squared ? depth * 0.08 : depth * 0.13);
  lid.userData.lidProfile = squared ? "flat-rounded-rectangle" : "soft-elongated-rectangle";
}

function addDualFlushControls(
  group: THREE.Group,
  profile: PelicanToiletMeshProfile,
  dark: THREE.Material,
  height: number,
  depth: number,
  width: number,
): void {
  const thickness = 0.018;
  for (const [side, radius] of [["left", width * 0.036], ["right", width * 0.046]] as const) {
    const flushControl = addPart(group, profile, `toilet-dual-flush-${side}-button`, new THREE.CylinderGeometry(radius, radius, thickness, 20), dark);
    flushControl.position.set(side === "left" ? -width * 0.065 : width * 0.065, height - thickness / 2 - 0.001, -depth * 0.30);
    flushControl.userData.toiletFlushControlMode = "dual-button";
    flushControl.userData.illustrativeControlPosition = true;
  }
}

function addSingleFlushControl(
  group: THREE.Group,
  profile: PelicanToiletMeshProfile,
  dark: THREE.Material,
  height: number,
  depth: number,
  width: number,
): void {
  const thickness = 0.018;
  const flushControl = addPart(group, profile, "toilet-single-flush-button", new THREE.CylinderGeometry(width * 0.045, width * 0.045, thickness, 20), dark);
  flushControl.position.set(0, height - thickness / 2 - 0.001, -depth * 0.30);
  flushControl.userData.toiletFlushControlMode = "single-button";
  flushControl.userData.illustrativeControlPosition = true;
}

function addOnePiece(
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
  const ceramicBase = addPart(
    group,
    profile,
    "toilet-ceramic-base",
    roundedLoft([
      { width: width * 0.88, depth: depth * 0.94, y: 0, z: -depth * 0.02 },
      { width: width * 0.94, depth: depth * 0.91, y: seatHeight * 0.12, z: -depth * 0.01 },
      { width: width * 0.87, depth: depth * 0.84, y: seatHeight * 0.64, z: depth * 0.015 },
      { width: width * 0.77, depth: depth * 0.62, y: seatHeight * 0.89, z: depth * 0.12 },
    ], shell),
    shell,
  );
  ceramicBase.userData.silhouette = "continuous-skirted-body";
  addBowlAndClosedSeat(group, profile, shell, seatMaterial, water, seatHeight);

  const rear = addPart(
    group,
    profile,
    "toilet-integrated-rear-housing",
    roundedLoft([
      { width: width * 0.69, depth: depth * 0.37, y: seatHeight * 0.53, z: -depth * 0.305 },
      { width: width * 0.73, depth: depth * 0.38, y: seatHeight * 0.82, z: -depth * 0.305 },
      { width: width * 0.74, depth: depth * 0.36, y: height * 0.93, z: -depth * 0.31 },
      { width: width * 0.72, depth: depth * 0.34, y: height, z: -depth * 0.31 },
    ], shell),
    shell,
  );
  rear.userData.silhouette = "integrated-soft-rear";

  if (profile.toiletFlushControl === "dual-button") addDualFlushControls(group, profile, dark, height, depth, width);
  else if (profile.toiletFlushControl === "single-button") addSingleFlushControl(group, profile, dark, height, depth, width);
}

function addTwoPiece(
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
  const ceramicBase = addPart(
    group,
    profile,
    "toilet-ceramic-base",
    roundedLoft([
      { width: width * 0.85, depth: depth * 0.90, y: 0, z: depth * 0.01 },
      { width: width * 0.90, depth: depth * 0.85, y: seatHeight * 0.14, z: depth * 0.02 },
      { width: width * 0.77, depth: depth * 0.67, y: seatHeight * 0.70, z: depth * 0.11 },
    ], shell),
    shell,
  );
  ceramicBase.userData.silhouette = "separate-tank-skirted-bowl";
  addBowlAndClosedSeat(group, profile, shell, seatMaterial, water, seatHeight);

  const tankHeight = Math.max(height * 0.42, height - seatHeight * 0.50);
  const tank = addPart(group, profile, "toilet-tank", roundedBox(width * 0.76, tankHeight, depth * 0.34, Math.min(width, depth) * 0.075), shell);
  tank.position.set(0, height - tankHeight / 2 - 0.022, -depth * 0.31);
  tank.userData.silhouette = "soft-separate-tank";

  const lidThickness = 0.032;
  const tankLid = addPart(group, profile, "toilet-tank-lid", roundedBox(width * 0.70, lidThickness, depth * 0.30, Math.min(width, depth) * 0.045), seatMaterial);
  tankLid.position.set(0, height - lidThickness / 2 - 0.001, -depth * 0.31);

  if (profile.toiletFlushControl === "dual-button") addDualFlushControls(group, profile, dark, height, depth, width);
  else if (profile.toiletFlushControl === "single-button") addSingleFlushControl(group, profile, dark, height, depth, width);
}

function addSmart(
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
  const ceramicBase = addPart(
    group,
    profile,
    "toilet-ceramic-base",
    roundedLoft([
      { width: width * 0.90, depth: depth * 0.92, y: 0, z: -depth * 0.015 },
      { width: width * 0.96, depth: depth * 0.91, y: seatHeight * 0.13, z: -depth * 0.005 },
      { width: width * 0.90, depth: depth * 0.86, y: seatHeight * 0.78, z: depth * 0.01 },
      { width: width * 0.84, depth: depth * 0.75, y: seatHeight * 0.90, z: depth * 0.06 },
    ], shell),
    shell,
  );
  ceramicBase.userData.silhouette = "low-squared-smart-body";
  addBowlAndClosedSeat(group, profile, shell, seatMaterial, water, seatHeight, true);

  const rearHeight = Math.min(height * 0.33, Math.max(height * 0.24, height - seatHeight * 0.80));
  const rear = addPart(group, profile, "toilet-smart-rear-housing", roundedBox(width * 0.73, rearHeight, depth * 0.43, Math.min(width, depth) * 0.07), shell);
  rear.position.set(0, height - rearHeight / 2 - height * 0.035, -depth * 0.255);
  rear.userData.silhouette = "flat-squared-smart-rear";

  const capThickness = 0.018;
  const controlTop = addPart(group, profile, profile.toiletFlushControl === "touchless-auto" ? "toilet-touchless-auto-top" : "toilet-touchless-top", roundedBox(width * 0.42, capThickness, depth * 0.22, Math.min(width, depth) * 0.025), dark);
  controlTop.position.set(0, height - height * 0.035 + capThickness / 2, -depth * 0.255);
  controlTop.userData.toiletFlushControlMode = profile.toiletFlushControl ?? "touchless";
  controlTop.userData.illustrativeControlPosition = true;

  const sensor = addPart(group, profile, "toilet-smart-control-panel", roundedBox(width * 0.29, 0.007, depth * 0.13, Math.min(width, depth) * 0.018), dark);
  sensor.position.set(0, height - height * 0.035 + capThickness + 0.004, -depth * 0.255);
  sensor.userData.illustrativeControlPosition = true;
}

/**
 * Returns a standalone, direct-child mesh group in feet-based scene units.
 * It is intentionally illustrative, while each mesh remains inside the profile's
 * official exterior envelope.
 */
export function makePelicanToiletGroup(profile: PelicanToiletMeshProfile): THREE.Group {
  const group = new THREE.Group();
  const width = profile.widthIn * INCH;
  const depth = profile.depthIn * INCH;
  const height = profile.heightIn * INCH;
  const seatHeight = Math.min(height * 0.90, (profile.seatHeightIn ?? profile.heightIn * 0.52) * INCH);
  const black = isMatteBlack(profile.finish);
  const shell = new THREE.MeshPhysicalMaterial({
    color: black ? "#17191b" : "#f5f6f2",
    roughness: black ? 0.36 : 0.24,
    metalness: 0,
    clearcoat: black ? 0.12 : 0.28,
    clearcoatRoughness: black ? 0.28 : 0.18,
  });
  const seatMaterial = new THREE.MeshPhysicalMaterial({
    color: black ? "#08090a" : "#e4e9e9",
    roughness: black ? 0.32 : 0.20,
    clearcoat: black ? 0.10 : 0.24,
    clearcoatRoughness: black ? 0.30 : 0.16,
  });
  const water = new THREE.MeshPhysicalMaterial({ color: "#d8ebef", roughness: 0.08, metalness: 0, transmission: 0.08, transparent: true, opacity: 0.92 });
  const dark = new THREE.MeshStandardMaterial({ color: black ? "#050607" : "#c7d1d4", roughness: 0.30 });

  group.userData = {
    pelicanCode: profile.pelicanCode,
    toiletStyle: profile.toiletStyle ?? "one-piece",
    sourceEnvelopeIn: { width: profile.widthIn, depth: profile.depthIn, height: profile.heightIn },
    visualOnly: true,
    illustrativeContours: true,
  };

  if (profile.toiletStyle === "smart") addSmart(group, profile, shell, seatMaterial, water, dark, seatHeight);
  else if (profile.toiletStyle === "two-piece") addTwoPiece(group, profile, shell, seatMaterial, water, dark, seatHeight);
  else addOnePiece(group, profile, shell, seatMaterial, water, dark, seatHeight);
  return group;
}
