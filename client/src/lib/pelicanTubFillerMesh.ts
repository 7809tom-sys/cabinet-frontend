import * as THREE from "three";

/** Match InteractiveRoom3D: one scene unit is one foot. */
const INCH = 1 / 12;
const MAX_VISUAL_FOOTPRINT_IN = 14;

type TubFillerStyle = "gooseneck-single-column" | "telephone-double-column" | "square-single-column";

export type PelicanTubFillerProfile = {
  pelicanCode: string;
  /** Indicative plan-view occupancy supplied by the Bathroom Designer. */
  widthIn: number;
  /** Indicative plan-view occupancy supplied by the Bathroom Designer. */
  depthIn: number;
  /** Published overall fixture height. */
  heightIn: number;
  finish: string;
  tubFillerStyle?: TubFillerStyle;
  tubFillerSpoutHeightIn?: number;
  tubFillerSpoutReachIn?: number;
};

type MetalFinish = {
  color: THREE.ColorRepresentation;
  roughness: number;
};

const FINISHES: Record<"matte-black" | "brushed-nickel" | "brushed-gold" | "chrome", MetalFinish> = {
  "matte-black": { color: "#171717", roughness: 0.34 },
  "brushed-nickel": { color: "#b7b7ad", roughness: 0.42 },
  "brushed-gold": { color: "#bd8b34", roughness: 0.38 },
  chrome: { color: "#dce4e7", roughness: 0.18 },
};

const asMetres = (inches: number) => inches * INCH;
const point = (x: number, y: number, z: number) => new THREE.Vector3(asMetres(x), asMetres(y), asMetres(z));

function normalizedFinish(finish: string): keyof typeof FINISHES {
  const normalized = finish.trim().toLowerCase().replace(/[ _]+/g, "-");
  if (normalized.includes("matte") && normalized.includes("black")) return "matte-black";
  if (normalized.includes("nickel")) return "brushed-nickel";
  if (normalized.includes("gold")) return "brushed-gold";
  return "chrome";
}

function resolvedStyle(profile: PelicanTubFillerProfile): TubFillerStyle {
  if (profile.tubFillerStyle) return profile.tubFillerStyle;
  return profile.pelicanCode.trim().toUpperCase().startsWith("PL-8522")
    ? "telephone-double-column"
    : "gooseneck-single-column";
}

function metalMaterial(finish: string, darkDetail = false): THREE.MeshStandardMaterial {
  const finishKey = normalizedFinish(finish);
  const source = FINISHES[finishKey];
  const material = new THREE.MeshStandardMaterial({
    color: darkDetail ? "#0b0c0d" : source.color,
    metalness: darkDetail ? 0.7 : 0.88,
    roughness: darkDetail ? 0.3 : source.roughness,
  });
  material.name = darkDetail ? "Pelican dark metal detail" : `Pelican ${finishKey}`;
  material.userData.pelicanFinish = finishKey;
  material.userData.pelicanMetal = true;
  return material;
}

function addPart(
  group: THREE.Group,
  profile: PelicanTubFillerProfile,
  style: TubFillerStyle,
  part: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `Pelican ${profile.pelicanCode} ${part}`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.pelicanBathroomFixturePart = part;
  mesh.userData.pelicanCode = profile.pelicanCode;
  mesh.userData.pelicanFinish = normalizedFinish(profile.finish);
  mesh.userData.tubFillerStyle = style;
  group.add(mesh);
  return mesh;
}

function addCylinderBetween(
  group: THREE.Group,
  profile: PelicanTubFillerProfile,
  style: TubFillerStyle,
  part: string,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radiusIn: number,
  material: THREE.Material,
): THREE.Mesh {
  const axis = end.clone().sub(start);
  const length = axis.length();
  const mesh = addPart(
    group,
    profile,
    style,
    part,
    new THREE.CylinderGeometry(asMetres(radiusIn), asMetres(radiusIn), length, 20, 1, false),
    material,
  );
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize());
  return mesh;
}

function addTube(
  group: THREE.Group,
  profile: PelicanTubFillerProfile,
  style: TubFillerStyle,
  part: string,
  points: THREE.Vector3[],
  radiusIn: number,
  material: THREE.Material,
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
  return addPart(
    group,
    profile,
    style,
    part,
    new THREE.TubeGeometry(curve, Math.max(24, points.length * 12), asMetres(radiusIn), 12, false),
    material,
  );
}

function addCrossHandle(
  group: THREE.Group,
  profile: PelicanTubFillerProfile,
  style: TubFillerStyle,
  center: THREE.Vector3,
  material: THREE.Material,
): void {
  const hub = addPart(
    group,
    profile,
    style,
    "tub-filler-cross-handle-hub",
    new THREE.SphereGeometry(asMetres(0.48), 16, 12),
    material,
  );
  hub.position.copy(center);
  addCylinderBetween(
    group,
    profile,
    style,
    "tub-filler-cross-handle-arm",
    center.clone().add(point(-1.0, 0, 0)),
    center.clone().add(point(1.0, 0, 0)),
    0.16,
    material,
  );
  addCylinderBetween(
    group,
    profile,
    style,
    "tub-filler-cross-handle-arm",
    center.clone().add(point(0, 0, -1.0)),
    center.clone().add(point(0, 0, 1.0)),
    0.16,
    material,
  );
}

function gooseneckSingleColumn(
  group: THREE.Group,
  profile: PelicanTubFillerProfile,
  material: THREE.Material,
  darkMetal: THREE.Material,
): void {
  const style: TubFillerStyle = "gooseneck-single-column";
  const heightIn = profile.heightIn;
  const spoutHeightIn = Math.min(profile.tubFillerSpoutHeightIn ?? 40.25, heightIn - 0.45);
  const reachIn = Math.min(Math.max(profile.tubFillerSpoutReachIn ?? 7, 3), 8);
  const baseHeightIn = 0.62;
  const columnZ = 2.45;
  const tubeRadiusIn = 0.42;
  // Leave room for the centripetal spline's slight crest overshoot.
  const tubeTopIn = heightIn - tubeRadiusIn - 0.4;

  const base = addPart(
    group,
    profile,
    style,
    "tub-filler-base",
    new THREE.CylinderGeometry(asMetres(3.125), asMetres(3.125), asMetres(baseHeightIn), 32),
    material,
  );
  base.position.set(0, asMetres(baseHeightIn / 2), asMetres(columnZ));

  addCylinderBetween(group, profile, style, "tub-filler-single-column", point(0, baseHeightIn, columnZ), point(0, 34.0, columnZ), 0.62, material);
  addPart(
    group,
    profile,
    style,
    "tub-filler-column-collar",
    new THREE.CylinderGeometry(asMetres(0.79), asMetres(0.79), asMetres(0.34), 20),
    material,
  ).position.copy(point(0, 33.75, columnZ));

  const tipZ = columnZ - reachIn;
  addTube(
    group,
    profile,
    style,
    "tub-filler-gooseneck-spout",
    [
      point(0, 33.9, columnZ),
      point(0, tubeTopIn - 2.55, columnZ),
      point(0, tubeTopIn, columnZ - 1.55),
      point(0, tubeTopIn - 0.3, tipZ + 1.4),
      point(0, spoutHeightIn, tipZ),
    ],
    tubeRadiusIn,
    material,
  );

  // A dark, downward-facing disk makes the otherwise open tube end legible in 3D.
  const outlet = addPart(group, profile, style, "tub-filler-open-spout-outlet", new THREE.CircleGeometry(asMetres(0.28), 16), darkMetal);
  outlet.position.copy(point(0, spoutHeightIn, tipZ - 0.01));
  outlet.rotation.x = Math.PI / 2;

  // The reference's side lever is separate from the column rather than a second control post.
  addCylinderBetween(group, profile, style, "tub-filler-side-lever", point(0.53, 29.15, columnZ), point(1.65, 30.0, columnZ), 0.21, material);
  const leverKnob = addPart(group, profile, style, "tub-filler-side-lever-knob", new THREE.SphereGeometry(asMetres(0.31), 12, 10), material);
  leverKnob.position.copy(point(1.65, 30.0, columnZ));

  // Vertical hand shower on its own holder, with a deliberately restrained U-shaped hose.
  const wandTopIn = Math.min(42.25, heightIn - 0.08);
  const wandBottomIn = Math.max(35.0, wandTopIn - 8.0);
  addCylinderBetween(group, profile, style, "tub-filler-handshower", point(-1.35, wandBottomIn, columnZ + 0.2), point(-1.35, wandTopIn, columnZ + 0.2), 0.43, material);
  const showerFace = addPart(group, profile, style, "tub-filler-handshower-face", new THREE.CylinderGeometry(asMetres(0.56), asMetres(0.43), asMetres(0.72), 18), material);
  showerFace.position.copy(point(-1.35, wandTopIn - 0.36, columnZ + 0.2));
  addCylinderBetween(group, profile, style, "tub-filler-handshower-holder", point(-1.35, 33.9, columnZ + 0.2), point(-1.35, 35.2, columnZ + 0.2), 0.24, material);
  addTube(
    group,
    profile,
    style,
    "tub-filler-hanging-hose",
    [
      point(-1.35, wandBottomIn + 0.15, columnZ + 0.2),
      point(-1.32, 28, columnZ + 0.18),
      point(-1.12, 13.5, columnZ + 0.1),
      point(-0.85, 20, columnZ + 0.08),
      point(-0.52, 29.0, columnZ),
    ],
    0.14,
    darkMetal,
  );
}

function telephoneDoubleColumn(
  group: THREE.Group,
  profile: PelicanTubFillerProfile,
  material: THREE.Material,
  darkMetal: THREE.Material,
): void {
  const style: TubFillerStyle = "telephone-double-column";
  const heightIn = profile.heightIn;
  const spoutHeightIn = Math.min(profile.tubFillerSpoutHeightIn ?? 32.875, heightIn - 0.6);
  const reachIn = Math.min(Math.max(profile.tubFillerSpoutReachIn ?? 6.5, 3), 8);
  const centersIn = 6;
  const leftX = -centersIn / 2;
  const rightX = centersIn / 2;
  const columnZ = 2.25;
  const baseHeightIn = 0.48;
  const columnTopIn = heightIn - 4.6;
  const controlHeightIn = Math.min(36.25, heightIn - 5);

  for (const x of [leftX, rightX]) {
    const base = addPart(
      group,
      profile,
      style,
      "tub-filler-double-column-base",
      new THREE.CylinderGeometry(asMetres(3.625 / 2), asMetres(3.625 / 2), asMetres(baseHeightIn), 28),
      material,
    );
    base.position.copy(point(x, baseHeightIn / 2, columnZ));
    addCylinderBetween(group, profile, style, "tub-filler-double-column", point(x, baseHeightIn, columnZ), point(x, columnTopIn, columnZ), 0.48, material);
    addCrossHandle(group, profile, style, point(x, controlHeightIn, columnZ), material);
  }
  addCylinderBetween(group, profile, style, "tub-filler-connected-valve-bridge",
    point(leftX, controlHeightIn, columnZ), point(rightX, controlHeightIn, columnZ), 0.52, material);

  // The classic telephone handset is carried across the two 6-inch-center columns.
  const handsetY = heightIn - 0.52;
  addCylinderBetween(group, profile, style, "tub-filler-telephone-handset", point(-2.75, handsetY, columnZ), point(2.75, handsetY, columnZ), 0.42, material);
  for (const x of [-2.82, 2.82]) {
    const endCap = addPart(group, profile, style, "tub-filler-telephone-handset-end", new THREE.SphereGeometry(asMetres(0.52), 16, 12), material);
    endCap.position.copy(point(x, handsetY, columnZ));
  }
  for (const x of [leftX, rightX]) {
    addCylinderBetween(group, profile, style, "tub-filler-handshower-holder", point(x, columnTopIn - 0.35, columnZ), point(x, handsetY - 0.25, columnZ), 0.25, material);
  }

  const tipZ = columnZ - reachIn;
  const tubeRadiusIn = 0.37;
  const tubeTopIn = spoutHeightIn - tubeRadiusIn;
  addTube(
    group,
    profile,
    style,
    "tub-filler-bent-spout",
    [
      point(0, controlHeightIn, columnZ),
      point(0, tubeTopIn - 1.95, columnZ),
      point(0, tubeTopIn, columnZ - 1.2),
      point(0, tubeTopIn - 0.05, tipZ + 0.65),
      point(0, spoutHeightIn - 0.65, tipZ),
    ],
    tubeRadiusIn,
    material,
  );
  const outlet = addPart(group, profile, style, "tub-filler-open-spout-outlet", new THREE.CircleGeometry(asMetres(0.24), 16), darkMetal);
  outlet.position.copy(point(0, spoutHeightIn - 0.65, tipZ - 0.01));
  outlet.rotation.x = Math.PI / 2;

  // A constrained U keeps the telephone hose readable without claiming plumbing detail.
  addTube(
    group,
    profile,
    style,
    "tub-filler-hanging-hose",
    [
      point(0, handsetY - 0.35, columnZ + 0.18),
      point(0.18, 34, columnZ + 0.28),
      point(0.55, 14.5, columnZ + 0.25),
      point(0.78, 21, columnZ + 0.15),
      point(0.55, 29.5, columnZ + 0.05),
    ],
    0.14,
    darkMetal,
  );
}

/** PL-8538: published square post, horizontal spout and vertical handshower.
 * Minor lever/hose details are illustrative, never plumbing geometry. */
function squareSingleColumn(group: THREE.Group, profile: PelicanTubFillerProfile, material: THREE.Material, darkMetal: THREE.Material): void {
  const style: TubFillerStyle = "square-single-column";
  const columnZ = 3.1;
  const box = (part: string, w: number, h: number, d: number, x: number, y: number, z: number) => {
    const mesh = addPart(group, profile, style, part, new THREE.BoxGeometry(asMetres(w), asMetres(h), asMetres(d)), material);
    mesh.position.copy(point(x, y, z));
    return mesh;
  };
  box("tub-filler-square-base", 5.875, 2, 5.875, 0, 1, columnZ);
  box("tub-filler-square-column", 1.625, 34.25, 1.625, 0, 19.125, columnZ);
  const reach = profile.tubFillerSpoutReachIn ?? 8.875;
  const spoutHeight = profile.tubFillerSpoutHeightIn ?? 35;
  box("tub-filler-flat-spout", 1.25, 0.8, reach + 0.75, 0, 35.85, columnZ - reach / 2);
  const tip = addPart(group, profile, style, "tub-filler-open-spout-outlet", new THREE.CylinderGeometry(asMetres(0.35), asMetres(0.35), asMetres(0.4), 18), darkMetal);
  tip.position.copy(point(0, spoutHeight + 0.2, columnZ - reach));
  const wandHeight = profile.heightIn - 33;
  box("tub-filler-square-handshower", 0.85, wandHeight, 0.65, -2.8, 33 + wandHeight / 2, columnZ);
  box("tub-filler-handshower-holder", 2.8, 0.6, 0.65, -1.4, 32.6, columnZ);
  box("tub-filler-square-side-lever", 0.3, 3.6, 0.7, 2.3, 33.1, columnZ);
  box("tub-filler-square-lever-joint", 1.5, 0.65, 0.65, 1.4, 31.6, columnZ);
  addTube(group, profile, style, "tub-filler-hanging-hose", [point(-2.8, 33, columnZ), point(-2.9, 25, columnZ), point(-2.4, 9, columnZ), point(-1.9, 16, columnZ), point(-1.3, 31.8, columnZ)], 0.13, darkMetal);
}

/**
 * Creates only a floor-mounted tub filler: no tub shell, plumbing, or install
 * clearance is implied. Width/depth are intentionally held inside the
 * Bathroom Designer's 14 × 14 inch indicative visual occupancy; the supplied
 * overall height remains the measured product dimension.
 */
export function makePelicanTubFillerGroup(profile: PelicanTubFillerProfile): THREE.Group {
  const style = resolvedStyle(profile);
  const group = new THREE.Group();
  group.name = `Pelican ${profile.pelicanCode} tub filler`;
  group.userData.pelicanCode = profile.pelicanCode;
  group.userData.pelicanBathroomFixture = true;
  group.userData.fixtureKind = "tub-filler";
  group.userData.tubFillerStyle = style;
  group.userData.pelicanFinish = normalizedFinish(profile.finish);
  group.userData.visualOccupancyIn = {
    width: Math.min(MAX_VISUAL_FOOTPRINT_IN, profile.widthIn),
    depth: Math.min(MAX_VISUAL_FOOTPRINT_IN, profile.depthIn),
    height: profile.heightIn,
  };
  group.userData.visualOnly = true;
  group.userData.fabricationNote = "Tube thickness, hose path, and footprint are illustrative; this is not fabrication geometry.";

  const material = metalMaterial(profile.finish);
  const darkMetal = metalMaterial(profile.finish, true);
  if (style === "square-single-column") {
    squareSingleColumn(group, profile, material, darkMetal);
  } else if (style === "telephone-double-column") {
    telephoneDoubleColumn(group, profile, material, darkMetal);
  } else {
    gooseneckSingleColumn(group, profile, material, darkMetal);
  }
  return group;
}
