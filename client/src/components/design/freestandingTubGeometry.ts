import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { VerifiedPelicanBathroomFixtureProfile } from "@/lib/pelicanBathroomFixtureProfiles";

/**
 * Freestanding bathtub geometry.
 *
 * Pelican's sheets publish the exterior envelope, the drain side, and the
 * silhouette from the product photos. They do not publish a cross-section, so
 * the shell below is built to the published outline and stays inside that
 * envelope:
 *
 * - **Slipper (PL-02141).** The Stillwater tub is asymmetric: the backrest end
 *   rises above the foot end in one continuous curve. It has a thin bullnose
 *   rim, walls that taper to a smaller floor footprint, no faucet deck, and no
 *   visible feet. The mesh reproduces that outline rather than a symmetric oval.
 * - **Oval.** The same body at one rim height all round.
 * - **Rectangular / rounded-rectangular.** A separate lofted shell, unchanged.
 *
 * Every model gets a real drain and an overflow slot, because a bathtub with a
 * blank interior reads as a placeholder.
 */

export type TubGeometryMaterials = {
  shell: THREE.Material;
  dark: THREE.Material;
};

export type FreestandingTubPart = {
  mesh: THREE.Mesh;
  part: string;
};

const SEGMENTS = 96;

/** How much higher the slipper backrest sits than the foot end. */
const SLIPPER_BACK_RISE = 0.17;
/** The rim's own thickness, as a share of the tub height. */
const RIM_THICKNESS = 0.012;
/** The floor footprint relative to the rim plan. */
const BASE_TAPER = 0.74;
/** The backrest influence begins at this share of the length from the foot. */
const SLIPPER_BACK_SHARE = 0.42;

function profilePoint(t: number): { width: number } {
  // t: 0 at the floor, 1 at the rim. Taper out from a narrow base toward the
  // full plan, the way an acrylic freestanding tub reads in profile. The curve
  // is normalised so the rim is exactly the published plan and the body never
  // exceeds it.
  const ease = (value: number) => value * value * (3 - 2 * value);
  const taper = BASE_TAPER + (1 - BASE_TAPER) * ease(Math.min(1, t / 0.7));
  const belly = 1 + 0.012 * Math.sin(Math.min(1, t) * Math.PI);
  const width = taper * belly;
  // Keep the widest point at or inside the published envelope.
  return { width: Math.min(width, 1) };
}

/**
 * One tub outline ring, with each point's height given explicitly.
 *
 * `heightAt(angle, t)` lets the slipper raise only the back end and lets the
 * inner shell sit one rim thickness below the outer one.
 */
function ringPointsAt(
  halfWidth: number,
  halfDepth: number,
  t: number,
  heightAt: (angle: number, t: number) => number,
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const plan = profilePoint(t);
  for (let index = 0; index < SEGMENTS; index += 1) {
    const angle = (index / SEGMENTS) * Math.PI * 2;
    points.push(new THREE.Vector3(
      Math.cos(angle) * halfWidth * plan.width,
      heightAt(angle, t),
      Math.sin(angle) * halfDepth * plan.width,
    ));
  }
  return points;
}

function loftRings(rings: THREE.Vector3[][], options: { inward?: boolean } = {}): THREE.BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  const ringLength = rings[0]!.length;
  for (const ring of rings) {
    for (const point of ring) vertices.push(point.x, point.y, point.z);
  }
  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    for (let index = 0; index < ringLength; index += 1) {
      const next = (index + 1) % ringLength;
      const a = ring * ringLength + index;
      const b = ring * ringLength + next;
      const c = (ring + 1) * ringLength + next;
      const d = (ring + 1) * ringLength + index;
      // The inner skin of a hollow shell must wind the opposite way, or its
      // faces point outward and are culled from inside the basin. That turned
      // the tub into an open scoop: you saw through the near wall.
      if (options.inward) indices.push(a, b, d, b, c, d);
      else indices.push(a, d, b, b, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A flat band closing the rim between the outer and inner shells, facing up. */
function rimBand(outer: THREE.Vector3[], inner: THREE.Vector3[]): THREE.BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let index = 0; index < outer.length; index += 1) {
    vertices.push(outer[index]!.x, outer[index]!.y, outer[index]!.z);
    vertices.push(inner[index]!.x, inner[index]!.y, inner[index]!.z);
  }
  for (let index = 0; index < outer.length; index += 1) {
    const next = (index + 1) % outer.length;
    const o0 = index * 2;
    const i0 = o0 + 1;
    const o1 = next * 2;
    const i1 = o1 + 1;
    // Wound so the band's normal points up out of the rim.
    indices.push(o0, i0, o1, i0, i1, o1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * A rounded-rectangle outline ring at height share `t`, matching this family's
 * published top view. `radiusShare` is how round the corners are.
 */
function roundedRingPoints(
  halfWidth: number,
  halfDepth: number,
  t: number,
  radiusShare: number,
  heightAt: (angle: number, t: number) => number,
  cornerSegments = 10,
): THREE.Vector3[] {
  const plan = profilePoint(t);
  const w = halfWidth * 2 * plan.width;
  const d = halfDepth * 2 * plan.width;
  const radius = Math.min(w, d) * radiusShare;
  const points: THREE.Vector3[] = [];
  // Walk the four corners in order so the ring closes cleanly.
  const corners: Array<{ cx: number; cz: number; start: number }> = [
    { cx: w / 2 - radius, cz: d / 2 - radius, start: 0 },
    { cx: -w / 2 + radius, cz: d / 2 - radius, start: Math.PI / 2 },
    { cx: -w / 2 + radius, cz: -d / 2 + radius, start: Math.PI },
    { cx: w / 2 - radius, cz: -d / 2 + radius, start: Math.PI * 1.5 },
  ];
  const total = corners.length * (cornerSegments + 1);
  let step = 0;
  for (const { cx, cz, start } of corners) {
    for (let index = 0; index <= cornerSegments; index += 1) {
      const angle = start + (index / cornerSegments) * (Math.PI / 2);
      const pointAngle = (step / total) * Math.PI * 2;
      points.push(new THREE.Vector3(
        cx + Math.cos(angle) * radius,
        heightAt(pointAngle, t),
        cz + Math.sin(angle) * radius,
      ));
      step += 1;
    }
  }
  return points;
}

/**
 * A flat cap across a ring, so the shell is closed rather than open-ended.
 * Used for the basin floor and the underside.
 */
/** A flat cap across a ring, so the shell is closed rather than open-ended.
 * `facing` says which way the visible side of the cap points. */
function capRing(ring: THREE.Vector3[], yFor: (point: THREE.Vector3) => number, facing: "up" | "down" = "up"): THREE.BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  let cx = 0;
  let cz = 0;
  for (const point of ring) {
    cx += point.x;
    cz += point.z;
  }
  cx /= ring.length;
  cz /= ring.length;
  vertices.push(cx, yFor(ring[0]!), cz);
  for (const point of ring) vertices.push(point.x, yFor(point), point.z);
  for (let index = 0; index < ring.length; index += 1) {
    const next = (index + 1) % ring.length;
    // The outline rings run clockwise, so the index order decides the facing.
    if (facing === "up") indices.push(0, next + 1, index + 1);
    else indices.push(0, index + 1, next + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The body of a freestanding tub, as one closed hollow shell.
 *
 * Returns the parts rather than adding them, so the caller keeps ownership of
 * the group and its userData. The basin floor is part of the shell, so the room
 * floor never shows through the tub.
 */
export function makeFreestandingTubParts(
  profile: VerifiedPelicanBathroomFixtureProfile,
  materials: TubGeometryMaterials,
  options: { slipper?: boolean; apronFront?: boolean } = {},
): FreestandingTubPart[] {
  const width = profile.widthIn / 12;
  const depth = profile.depthIn / 12;
  const height = profile.heightIn / 12;
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const slipper = options.slipper === true;
  const rectangular = profile.tubShape === "rectangular" || profile.tubShape === "rounded-rectangular"
    // An alcove tub is a rectangle in plan too, with a wider corner radius.
    || options.apronFront === true;
  const radiusShare = profile.tubShape === "rounded-rectangular" || options.apronFront
    ? 0.22
    : 0.06;
  // The published height is the OVERALL height, measured at the backrest. The
  // foot end is therefore lower, not the backrest higher.
  const footShare = 1 / (1 + SLIPPER_BACK_RISE);
  // The backrest end is +Z. A tub with no backrest keeps one rim height.
  const topShareAt = (angle: number) => {
    if (!slipper) return 1;
    const towardBack = (Math.sin(angle) + 1) / 2; // 1 at +Z, 0 at -Z
    const influence = THREE.MathUtils.smoothstep(towardBack, SLIPPER_BACK_SHARE, 1);
    return footShare + (1 - footShare) * influence;
  };
  const ringAt = (hw: number, hd: number, t: number, heightAt: (angle: number, share: number) => number) => (
    rectangular
      ? roundedRingPoints(hw, hd, t, radiusShare, heightAt)
      : ringPointsAt(hw, hd, t, heightAt)
  );
  // The basin floor is a real surface, high enough to read as the bottom of a
  // bath rather than the room floor.
  const basinFloorShare = 0.16;

  const isAlcove = options.apronFront === true;
  const wellPart = isAlcove ? "alcove-tub-well" : "freestanding-tub-well";
  const drainPart = isAlcove ? "alcove-tub-drain" : "freestanding-tub-drain";
  const overflowPart = isAlcove ? "alcove-tub-overflow" : "freestanding-tub-overflow";
  const rimThickness = height * RIM_THICKNESS;
  const wall = width * 0.045;
  const levels = [0, 0.24, 0.46, 0.68, 0.86, 0.95, 1];
  const parts: FreestandingTubPart[] = [];
  const push = (geometry: THREE.BufferGeometry, part: string, material: THREE.Material = materials.shell) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parts.push({ mesh, part });
    return mesh;
  };

  // Outer shell, tapered from the floor up to the rim itself.
  const outer = levels.map((level) => {
    const t = level === 1 ? 1 : level * (1 - rimThickness / height);
    return ringAt(halfWidth, halfDepth, t, (angle, share) => share * height * topShareAt(angle));
  });
  push(loftRings(outer), "freestanding-tub-exterior");
  // Close the underside so no room floor is visible through the tub.
  push(capRing(outer[0]!, () => 0.004, "down"), "freestanding-tub-base");

  // Inner shell: inset by the wall, and one rim thickness below the outer rim
  // at the same point, so the band between them is the flat top edge. It starts
  // at the basin floor, not at the room floor.
  const basinLevels = [basinFloorShare, ...levels.filter((level) => level > basinFloorShare)];
  const inner = basinLevels.map((level) => {
    const t = level === 1 ? 1 : level * (1 - rimThickness / height);
    return ringAt(halfWidth - wall, halfDepth - wall, t, (angle, share) => (
      Math.max(0.02, share * height * topShareAt(angle) - rimThickness)
    ));
  });
  push(loftRings(inner, { inward: true }), "freestanding-tub-interior");

  // A thin flat band closes the rim between the two shells.
  push(rimBand(outer[outer.length - 1]!, inner[inner.length - 1]!), "freestanding-tub-rim");

  // Floor of the basin: a real cap at the bottom of the inner shell.
  const basinRing = inner[0]!;
  const well = capRing(basinRing, () => basinRing[0]!.y, "up");
  push(well, wellPart);
  const wellY = basinRing[0]!.y;

  // Drain, at the foot end for a left/right drain, centred otherwise.
  const drainRadius = Math.max(0.025, width * 0.032);
  const drainZ = profile.drain === "left" ? -halfDepth * 0.62 : profile.drain === "right" ? halfDepth * 0.62 : 0;
  const drain = new THREE.Mesh(new THREE.CylinderGeometry(drainRadius, drainRadius, 0.014, 24), materials.dark);
  drain.position.set(0, wellY + 0.008, drainZ);
  parts.push({ mesh: drain, part: drainPart });

  // Overflow, on the back wall above the drain. A bathtub without one reads as
  // a moulded basin rather than a fixture.
  const overflow = new THREE.Mesh(
    new THREE.CapsuleGeometry(drainRadius * 0.42, drainRadius * 1.1, 6, 12),
    materials.dark,
  );
  overflow.rotation.z = Math.PI / 2;
  overflow.scale.set(1, 1, 0.42);
  overflow.position.set(0, Math.max(height * 0.62, wellY + drainRadius * 3), -halfDepth * 0.86);
  parts.push({ mesh: overflow, part: overflowPart });

  // An alcove tub shows a finished apron across the room-facing side. It is a
  // panel on the closed shell, not a separate wall, so the tub stays sealed.
  if (options.apronFront === true) {
    const apron = new THREE.Mesh(
      new RoundedBoxGeometry(width * 0.9, height * 0.72, 0.06, 4, 0.03),
      materials.shell,
    );
    apron.position.set(0, height * 0.40, halfDepth - 0.05);
    apron.castShadow = true;
    apron.receiveShadow = true;
    parts.push({ mesh: apron, part: "alcove-tub-apron" });
  }

  return parts;
}

/** Slipper tubs that carry a raised backrest, from the product photos. */
export function isSlipperTub(profile: Pick<VerifiedPelicanBathroomFixtureProfile, "pelicanCode" | "kind">): boolean {
  if (profile.kind !== "freestanding-tub") return false;
  return /^PL-02141/i.test(profile.pelicanCode.trim());
}
