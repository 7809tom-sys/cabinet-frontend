import * as THREE from "three";

/** Match InteractiveRoom3D: one scene unit is one foot. */
const INCH = 1 / 12;

/**
 * Exterior styling follows the Pelican catalog photos for the bathroom toilet
 * line (buildpelican.com product images, reviewed with the source sheets in
 * pelicanBathroomFixtureProfiles). Each mesh stays inside that sheet's
 * width, depth, and height. This is a visual model, not a plumbing guide.
 *
 * Distinct silhouettes, not one reused body:
 * - skirted one-piece (PL-12011, PL-12027, PL-12044, PL-12210, PL-12318, PL-12382)
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

type Ring = { width: number; depth: number; y: number; z: number };
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
  const sku = baseCode(code);
  return sku.startsWith("PL-12318") || sku.startsWith("PL-12382") || sku.startsWith("PL-12005");
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
function loft(rings: Ring[], shape: "ellipse" | "rounded" = "ellipse"): THREE.BufferGeometry {
  const segments = shape === "ellipse" ? 28 : 20;
  const ringPoints = rings.map((ring) => shape === "ellipse"
    ? ellipseRing(ring.width, ring.depth, ring.y, ring.z, segments)
    : roundedRectRing(ring.width, ring.depth, ring.y, ring.z, Math.min(ring.width, ring.depth) * 0.16, 5));
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

function addClosedSeatAndLid(
  group: THREE.Group,
  profile: PelicanToiletMeshProfile,
  seatMaterial: THREE.Material,
  water: THREE.Material,
  seatHeight: number,
  width: number,
  depth: number,
  squared = false,
): void {
  const round = squared || rounderBowl(profile.pelicanCode);
  const radiusX = width * (round ? 0.40 : 0.36);
  const radiusZ = depth * (round ? 0.20 : 0.26);
  const centerZ = depth * (round ? 0.06 : 0.10);
  const seat = addPart(group, profile, "toilet-seat", ovalCap(radiusX * 1.04, radiusZ * 1.04, 0.012, 0.008), seatMaterial);
  seat.position.set(0, seatHeight, centerZ);
  seat.userData.seatProfile = round ? "closed-round-oval" : "closed-elongated-oval";
  const lid = addPart(group, profile, "toilet-lid", ovalCap(radiusX, radiusZ, squared ? 0.018 : 0.045, 0.012), seatMaterial);
  lid.position.set(0, seatHeight + 0.018, centerZ);
  lid.userData.lidProfile = squared ? "flat-rounded-rectangle" : "soft-elongated-oval";

  const waterWell = addPart(group, profile, "toilet-bowl-water", new THREE.CircleGeometry(0.5, 28), water);
  waterWell.rotation.x = -Math.PI / 2;
  waterWell.scale.set(radiusX * 1.15, radiusZ * 1.05, 1);
  waterWell.position.set(0, seatHeight - 0.01, centerZ);
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
  const round = rounderBowl(profile.pelicanCode);
  const base = addPart(group, profile, "toilet-ceramic-base", ellipseLoft([
    { width: width * 0.78, depth: depth * 0.78, y: 0, z: -depth * 0.06 },
    { width: width * 0.94, depth: depth * 0.86, y: seatHeight * 0.22, z: -depth * 0.02 },
    { width: width * 0.82, depth: depth * 0.74, y: seatHeight * 0.58, z: depth * 0.02 },
    { width: width * (round ? 0.78 : 0.70), depth: depth * (round ? 0.50 : 0.58), y: seatHeight * 0.96, z: depth * 0.08 },
  ]), shell);
  base.userData.silhouette = "continuous-skirted-body";
  base.userData.bowlForm = round ? "round" : "elongated";

  const bowl = addPart(group, profile, "toilet-bowl-exterior", ellipseLoft([
    { width: width * 0.50, depth: depth * 0.30, y: seatHeight * 0.62, z: depth * 0.10 },
    { width: width * 0.72, depth: depth * (round ? 0.40 : 0.50), y: seatHeight * 0.86, z: depth * 0.10 },
    { width: width * (round ? 0.84 : 0.76), depth: depth * (round ? 0.44 : 0.56), y: seatHeight * 0.99, z: depth * 0.09 },
  ]), shell);
  bowl.userData.continuousWithCeramicBase = true;
  addClosedSeatAndLid(group, profile, seatMaterial, water, seatHeight, width, depth);

  const rear = addPart(group, profile, "toilet-integrated-rear-housing", ellipseLoft([
    { width: width * 0.72, depth: depth * 0.40, y: seatHeight * 0.42, z: -depth * 0.16 },
    { width: width * 0.78, depth: depth * 0.38, y: seatHeight * 0.95, z: -depth * 0.18 },
    { width: width * 0.74, depth: depth * 0.34, y: height * 0.92, z: -depth * 0.18 },
    { width: width * 0.70, depth: depth * 0.32, y: height - 0.02, z: -depth * 0.18 },
  ]), shell);
  rear.userData.silhouette = "integrated-soft-rear";
  addTopButtons(group, profile, chrome, height - 0.012, -depth * 0.18, width);
}

function addPedestalBowl(
  group: THREE.Group,
  profile: PelicanToiletMeshProfile,
  shell: THREE.Material,
  seatHeight: number,
  width: number,
  depth: number,
): void {
  const pedestal = addPart(group, profile, "toilet-ceramic-base", ellipseLoft([
    { width: width * 0.62, depth: depth * 0.46, y: 0, z: -depth * 0.02 },
    { width: width * 0.50, depth: depth * 0.36, y: seatHeight * 0.42, z: depth * 0.02 },
    { width: width * 0.42, depth: depth * 0.30, y: seatHeight * 0.62, z: depth * 0.04 },
  ]), shell);
  pedestal.userData.silhouette = "exposed-pedestal";
  pedestal.userData.bowlForm = "elongated";
  const bowl = addPart(group, profile, "toilet-bowl-exterior", ellipseLoft([
    { width: width * 0.46, depth: depth * 0.26, y: seatHeight * 0.50, z: depth * 0.04 },
    { width: width * 0.74, depth: depth * 0.46, y: seatHeight * 0.74, z: depth * 0.08 },
    { width: width * 0.82, depth: depth * 0.54, y: seatHeight * 0.99, z: depth * 0.08 },
  ]), shell);
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
  addClosedSeatAndLid(group, profile, seatMaterial, water, seatHeight, width, depth);
  const tankHeight = Math.max(0.35, height - seatHeight * 0.72);
  const tank = addPart(group, profile, "toilet-integrated-rear-housing", ellipseLoft([
    { width: width * 0.70, depth: depth * 0.34, y: seatHeight * 0.78, z: -depth * 0.16 },
    { width: width * 0.76, depth: depth * 0.32, y: seatHeight + tankHeight * 0.45, z: -depth * 0.16 },
    { width: width * 0.72, depth: depth * 0.30, y: height - 0.03, z: -depth * 0.16 },
  ]), shell);
  tank.userData.silhouette = "integrated-soft-rear";
  if (baseCode(profile.pelicanCode).startsWith("PL-12335")) {
    addSideLever(group, profile, chrome, width * 0.36, seatHeight + tankHeight * 0.55, -depth * 0.16);
  } else {
    addTopButtons(group, profile, chrome, height - 0.02, -depth * 0.16, width);
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

  const tankHeight = Math.min(height * 0.42, Math.max(0.42, height - seatHeight - 0.04));
  const tank = addPart(group, profile, "toilet-tank", ellipseLoft([
    { width: width * 0.72, depth: depth * 0.34, y: seatHeight * 0.92, z: -depth * 0.16 },
    { width: width * 0.78, depth: depth * 0.34, y: height - tankHeight * 0.42, z: -depth * 0.16 },
    { width: width * 0.74, depth: depth * 0.31, y: height - 0.04, z: -depth * 0.16 },
  ]), shell);
  tank.userData.silhouette = "soft-separate-tank";
  const lid = addPart(group, profile, "toilet-tank-lid", ovalCap(width * 0.40, depth * 0.16, 0.02, 0.008), seatMaterial);
  lid.position.set(0, height - 0.03, -depth * 0.16);
  addSideLever(group, profile, chrome, width * 0.38, height - tankHeight * 0.5, -depth * 0.16);
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
  const base = addPart(group, profile, "toilet-ceramic-base", ellipseLoft([
    { width: width * 0.86, depth: depth * 0.78, y: 0, z: -depth * 0.02 },
    { width: width * 0.96, depth: depth * 0.86, y: seatHeight * 0.35, z: 0 },
    { width: width * 0.88, depth: depth * 0.72, y: seatHeight * 0.95, z: depth * 0.04 },
  ]), shell);
  base.userData.silhouette = "rounded-smart-body";
  const bowl = addPart(group, profile, "toilet-bowl-exterior", ellipseLoft([
    { width: width * 0.55, depth: depth * 0.32, y: seatHeight * 0.7, z: depth * 0.08 },
    { width: width * 0.80, depth: depth * 0.48, y: seatHeight * 0.98, z: depth * 0.08 },
  ]), shell);
  bowl.userData.continuousWithCeramicBase = true;
  addClosedSeatAndLid(group, profile, seatMaterial, water, Math.min(seatHeight, height * 0.9), width, depth);
  const rear = addPart(group, profile, "toilet-smart-rear-housing", ellipseLoft([
    { width: width * 0.46, depth: depth * 0.18, y: seatHeight * 0.88, z: -depth * 0.18 },
    { width: width * 0.40, depth: depth * 0.14, y: height - 0.012, z: -depth * 0.20 },
  ]), shell);
  rear.userData.silhouette = "rounded-smart-deck";
  const part = profile.toiletFlushControl === "touchless-auto" ? "toilet-touchless-auto-top" : "toilet-touchless-top";
  const ring = addPart(group, profile, part, new THREE.TorusGeometry(width * 0.045, 0.008, 8, 18), dark);
  ring.rotation.y = Math.PI / 2;
  ring.position.set(-width * 0.42, seatHeight * 0.72, -depth * 0.02);
  ring.userData.toiletFlushControlMode = profile.toiletFlushControl ?? "touchless";
  const panel = addPart(group, profile, "toilet-smart-control-panel", ovalCap(width * 0.12, depth * 0.05, 0.008, 0.004), dark);
  panel.position.set(0, height - 0.012, -depth * 0.16);
}

/**
 * Standalone toilet in feet. Every mesh stays inside the profile envelope.
 */
export function makePelicanToiletGroup(profile: PelicanToiletMeshProfile): THREE.Group {
  const group = new THREE.Group();
  const height = profile.heightIn * INCH;
  const seatHeight = Math.min(height * 0.92, Math.max(height * 0.45, (profile.seatHeightIn ?? profile.heightIn * 0.52) * INCH));
  const black = isMatteBlack(profile.finish);
  const shell = new THREE.MeshPhysicalMaterial({
    color: black ? "#17191b" : "#f7f8f6",
    roughness: black ? 0.42 : 0.14,
    metalness: 0,
    clearcoat: black ? 0.08 : 0.62,
    clearcoatRoughness: black ? 0.4 : 0.12,
  });
  const seatMaterial = new THREE.MeshPhysicalMaterial({
    color: black ? "#101214" : "#fbfbfa",
    roughness: black ? 0.38 : 0.16,
    clearcoat: black ? 0.06 : 0.55,
    clearcoatRoughness: 0.14,
  });
  const water = new THREE.MeshPhysicalMaterial({ color: "#d5e7ee", roughness: 0.06, metalness: 0, transmission: 0.12, transparent: true, opacity: 0.9 });
  const chrome = new THREE.MeshStandardMaterial({ color: black ? "#2a2d30" : "#d5dbe0", roughness: 0.22, metalness: black ? 0.2 : 0.82 });
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
