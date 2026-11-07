import * as THREE from "three";
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

function loftRings(rings: THREE.Vector3[][]): THREE.BufferGeometry {
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
      indices.push(a, d, b, b, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A flat band closing the rim between the outer and inner shells. */
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
    indices.push(o0, o1, i0, i0, o1, i1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The body of a freestanding tub, as one hollow shell.
 *
 * Returns the parts rather than adding them, so the caller keeps ownership of
 * the group and its userData.
 */
export function makeFreestandingTubParts(
  profile: VerifiedPelicanBathroomFixtureProfile,
  materials: TubGeometryMaterials,
  options: { slipper?: boolean } = {},
): FreestandingTubPart[] {
  const width = profile.widthIn / 12;
  const depth = profile.depthIn / 12;
  const height = profile.heightIn / 12;
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const slipper = options.slipper === true;
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

  const rimThickness = height * RIM_THICKNESS;
  const wall = width * 0.045;
  const levels = [0, 0.14, 0.34, 0.58, 0.8, 0.93, 1];
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
    return ringPointsAt(halfWidth, halfDepth, t, (angle, share) => share * height * topShareAt(angle));
  });
  push(loftRings(outer), "freestanding-tub-exterior");

  // Inner shell: inset by the wall, and one rim thickness below the outer rim
  // at the same point, so the band between them is the flat top edge.
  const inner = levels.map((level) => {
    const t = level === 1 ? 1 : level * (1 - rimThickness / height);
    return ringPointsAt(halfWidth - wall, halfDepth - wall, t, (angle, share) => (
      Math.max(0.02, share * height * topShareAt(angle) - rimThickness)
    ));
  });
  push(loftRings(inner), "freestanding-tub-interior");

  // A thin flat band closes the rim between the two shells.
  push(rimBand(outer[outer.length - 1]!, inner[inner.length - 1]!), "freestanding-tub-rim");

  // Floor of the basin.
  const wellY = Math.max(inner[0]![0]!.y, height * 0.1);
  const well = new THREE.Mesh(new THREE.CircleGeometry(0.5, SEGMENTS), materials.shell);
  well.rotation.x = -Math.PI / 2;
  well.scale.set((halfWidth - wall) * 2 * BASE_TAPER, (halfDepth - wall) * 2 * BASE_TAPER, 1);
  well.position.y = wellY;
  well.castShadow = true;
  well.receiveShadow = true;
  parts.push({ mesh: well, part: "freestanding-tub-well" });

  // Drain, at the foot end for a left/right drain, centred otherwise.
  const drainRadius = Math.max(0.025, width * 0.032);
  const drainZ = profile.drain === "left" ? -halfDepth * 0.62 : profile.drain === "right" ? halfDepth * 0.62 : 0;
  const drain = new THREE.Mesh(new THREE.CylinderGeometry(drainRadius, drainRadius, 0.014, 24), materials.dark);
  drain.position.set(0, wellY + 0.008, drainZ);
  parts.push({ mesh: drain, part: "freestanding-tub-drain" });

  // Overflow, on the back wall above the drain. A bathtub without one reads as
  // a moulded basin rather than a fixture.
  const overflow = new THREE.Mesh(
    new THREE.CapsuleGeometry(drainRadius * 0.42, drainRadius * 1.1, 6, 12),
    materials.dark,
  );
  overflow.rotation.z = Math.PI / 2;
  overflow.scale.set(1, 1, 0.42);
  overflow.position.set(0, Math.max(height * 0.62, wellY + drainRadius * 3), -halfDepth * 0.86);
  parts.push({ mesh: overflow, part: "freestanding-tub-overflow" });

  return parts;
}

/** Slipper tubs that carry a raised backrest, from the product photos. */
export function isSlipperTub(profile: Pick<VerifiedPelicanBathroomFixtureProfile, "pelicanCode" | "kind">): boolean {
  if (profile.kind !== "freestanding-tub") return false;
  return /^PL-02141/i.test(profile.pelicanCode.trim());
}
