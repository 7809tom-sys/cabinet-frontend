import * as THREE from "three";
import type { VerifiedPelicanBathroomFixtureProfile } from "@/lib/pelicanBathroomFixtureProfiles";

/**
 * Alcove soaking tub geometry (PL-02849 / PL-02850 / PL-02851, L and R).
 *
 * The owner supplied ElevenLabs-generated reference renders and multi-view
 * sheets for the form, and said explicitly: use them for shape only, and take
 * every measurement from Pelican. The sheets also draw all three sizes as one
 * 32"-wide tub, which contradicts the catalog, so Pelican wins on every number:
 *
 *   PL-02849  60" x 30"         x 21-21/32"   well 53-35/64" x 23-5/8"
 *   PL-02850  60" x 32-1/64"    x 21-21/32"   well 53-11/32" x 25-19/32"
 *   PL-02851  60" x 35-63/64"   x 21-21/32"   well 53-11/32" x 29-17/32"
 *
 * The form is a plain rectangular box, which is what Pelican's own catalog photo
 * shows: a full-height flat front apron, square vertical ends, a flat deck with
 * a narrow rim and a raised tile flange along the back and both ends, and a
 * rectangular basin whose walls slope in, with the long shallow run at the
 * backrest end. The drain sits in the basin floor near the drain end and the
 * round overflow sits on that end wall above it.
 *
 * Everything is built in inches in a local frame whose drain end is at -Z, then
 * mirrored for a right-hand drain, so the L and R models differ only by that
 * mirror. Working in inches keeps the numbers readable against the spec sheet.
 */

export type AlcoveTubSpec = {
  /** Model family, without the drain suffix. */
  family: string;
  /** Overall length along the wall (the 60" side). */
  lengthIn: number;
  /** Overall front-to-back width. */
  widthIn: number;
  /** Overall height, to the top of the tile flange. */
  heightIn: number;
  /** Bathing well at the rim, long side. */
  basinRimLongIn: number;
  /** Bathing well at the rim, short side. */
  basinRimShortIn: number;
  /** Bathing well at the sump, long side. */
  basinSumpLongIn: number;
  /** Bathing well at the sump, short side. */
  basinSumpShortIn: number;
  /** Depth of the well, deck to sump. */
  basinDepthIn: number;
  /** Drain centre from the drain-end outer face. */
  drainOffsetFromEndIn: number;
  /** Overflow centre below the deck. */
  overflowBelowDeckIn: number;
  drainDiameterIn: number;
  overflowDiameterIn: number;
  /** Tile flange height above the deck. */
  tileFlangeIn: number;
};

/**
 * Published values from each model's own spec sheet. The only derived number is
 * `basinDepthIn`: the sheet gives the overall height and the well depth
 * separately, so the sump sits at 21-21/32" − 17-1/2" ≈ 4.14" above the floor,
 * which is the "Above Floor Rough-In" feature the sheet lists.
 */
export const ALCOVE_TUB_SPECS: Record<string, AlcoveTubSpec> = {
  "PL-02849": {
    family: "PL-02849",
    lengthIn: 60,
    widthIn: 30,
    heightIn: 21 + 21 / 32,
    basinRimLongIn: 53 + 35 / 64,
    basinRimShortIn: 23 + 5 / 8,
    basinSumpLongIn: 42 + 33 / 64,
    basinSumpShortIn: 16 + 59 / 64,
    basinDepthIn: 17.5,
    drainOffsetFromEndIn: 8 + 7 / 8,
    overflowBelowDeckIn: 2 + 3 / 4,
    drainDiameterIn: 2,
    overflowDiameterIn: 2 + 3 / 8,
    tileFlangeIn: 63 / 64,
  },
  "PL-02850": {
    family: "PL-02850",
    lengthIn: 60,
    widthIn: 32 + 1 / 64,
    heightIn: 21 + 21 / 32,
    basinRimLongIn: 53 + 11 / 32,
    basinRimShortIn: 25 + 19 / 32,
    basinSumpLongIn: 43 + 5 / 16,
    basinSumpShortIn: 19 + 11 / 16,
    basinDepthIn: 17.5,
    drainOffsetFromEndIn: 8 + 7 / 8,
    overflowBelowDeckIn: 2 + 3 / 4,
    drainDiameterIn: 2,
    overflowDiameterIn: 2 + 3 / 8,
    tileFlangeIn: 63 / 64,
  },
  "PL-02851": {
    family: "PL-02851",
    lengthIn: 60,
    widthIn: 35 + 63 / 64,
    heightIn: 21 + 21 / 32,
    basinRimLongIn: 53 + 11 / 32,
    basinRimShortIn: 29 + 17 / 32,
    basinSumpLongIn: 43 + 5 / 16,
    basinSumpShortIn: 23 + 5 / 8,
    basinDepthIn: 17.5,
    drainOffsetFromEndIn: 8 + 7 / 8,
    overflowBelowDeckIn: 2 + 3 / 4,
    drainDiameterIn: 2,
    overflowDiameterIn: 2 + 3 / 8,
    tileFlangeIn: 63 / 64,
  },
};

/**
 * How the length lost between the rim opening and the sump is split between the
 * two ends. Pelican publishes the two rectangles but not the split; the photos
 * and the reference renders both show the backrest as the long shallow end, so
 * the drain end takes 36% of the run. This is the one judgement call here.
 */
const DRAIN_END_SLOPE_SHARE = 0.36;

/** Thickness of the tile-flange strip, so it stays inside the tub outline. */
const FLANGE_THICKNESS_IN = 0.08;

/** How far the underside sits above zero, so it never z-fights the room floor. */
const UNDERSIDE_Y = 0.004;

const INCH = 1 / 12;

export function alcoveTubSpecFor(code: string): AlcoveTubSpec | null {
  const family = code
    .trim()
    .toUpperCase()
    // "PL-02851L", "PL-02851 R", and 'PL-02851 59"' all reduce to the family.
    .replace(/\s*(?:L|R)$/, "")
    .replace(/\s+\d+"$/, "");
  return ALCOVE_TUB_SPECS[family] ?? null;
}

export type AlcoveTubMaterials = {
  shell: THREE.Material;
  dark: THREE.Material;
};

export type AlcoveTubPart = {
  mesh: THREE.Mesh;
  part: string;
};

/**
 * Collector for one part's triangles.
 *
 * The designer's shell material is single sided, so a mis-wound face is not just
 * dark — it is invisible and you see straight through the tub. Every face states
 * the direction it must face and the triangle order is flipped to match, which
 * removes that whole class of see-through bug.
 */
class PartBuilder {
  private positions: number[] = [];
  private indices: number[] = [];

  /** A quad, wound so its front face points along `facing`. */
  quad(
    corners: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3],
    facing: THREE.Vector3,
  ): this {
    const [a, b, c, d] = corners;
    const normal = new THREE.Vector3()
      .subVectors(b, a)
      .cross(new THREE.Vector3().subVectors(c, a));
    const ordered = normal.dot(facing) >= 0 ? [a, b, c, d] : [d, c, b, a];
    const base = this.positions.length / 3;
    for (const point of ordered) this.positions.push(point.x, point.y, point.z);
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    return this;
  }

  geometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setIndex(this.indices);
    geometry.computeVertexNormals();
    return geometry;
  }
}

/**
 * Where the basin sits, in inches, with the drain end at -Z.
 *
 * Exported so the tests can check the built mesh against the same arithmetic
 * instead of re-deriving it.
 */
export function alcoveBasinLayout(spec: AlcoveTubSpec) {
  const rimHalfLong = spec.basinRimLongIn / 2;
  const rimHalfShort = spec.basinRimShortIn / 2;
  const sumpHalfLong = spec.basinSumpLongIn / 2;
  const sumpHalfShort = spec.basinSumpShortIn / 2;
  // The two end walls absorb the whole length difference between the rim
  // opening and the sump, so their runs add up to rim − sump (not half of it).
  const longRun = spec.basinRimLongIn - spec.basinSumpLongIn;
  const drainRun = longRun * DRAIN_END_SLOPE_SHARE;
  const backRun = longRun - drainRun;
  return {
    rimHalfLong,
    rimHalfShort,
    sumpHalfLong,
    sumpHalfShort,
    drainRun,
    backRun,
    /** Sump extent along the length, drain end first. */
    sumpFrom: -rimHalfLong + drainRun,
    sumpTo: rimHalfLong - backRun,
  };
}

/**
 * Build one alcove tub as separately named parts.
 *
 * Returns the parts rather than adding them, so the caller keeps ownership of the
 * group and its userData, exactly like the freestanding builder.
 */
export function makeAlcoveTubParts(
  profile: VerifiedPelicanBathroomFixtureProfile,
  materials: AlcoveTubMaterials,
): AlcoveTubPart[] {
  const spec = alcoveTubSpecFor(profile.pelicanCode);
  if (!spec) return [];

  // The stored profile carries the published front-to-back width; the length is
  // always the 60" run along the wall.
  const widthIn = profile.widthIn || spec.widthIn;
  const lengthIn = profile.depthIn || spec.lengthIn;
  const heightIn = profile.heightIn || spec.heightIn;

  const W = widthIn * INCH;
  const L = lengthIn * INCH;
  const H = heightIn * INCH;
  const halfW = W / 2;
  const halfL = L / 2;
  const flange = spec.tileFlangeIn * INCH;

  // Overall height is measured to the top of the tile flange, so the deck sits
  // one flange height below it.
  const deckY = H - flange;
  // Basin depth is published from the deck down, so the sump sits that far below
  // it. The sheet's own "above floor rough-in" clearance falls out of this.
  const floorY = Math.max(UNDERSIDE_Y + 0.02, deckY - spec.basinDepthIn * INCH);

  const layout = alcoveBasinLayout(spec);
  const rimX = layout.rimHalfShort * INCH;
  const sumpX = layout.sumpHalfShort * INCH;
  const rimZ = layout.rimHalfLong * INCH;
  const sumpFrom = layout.sumpFrom * INCH;
  const sumpTo = layout.sumpTo * INCH;

  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const up = new THREE.Vector3(0, 1, 0);
  const raw: Array<{ geometry: THREE.BufferGeometry; part: string; material?: THREE.Material }> = [];

  // ---- Outer box -----------------------------------------------------------
  // One prism, full height to the deck. The front apron is the -X long face and
  // runs straight to the floor with no taper and no panel of its own. The walls
  // are cut into a few bands rather than one tall quad so the mesh has real
  // vertices at intermediate heights — the silhouette tests measure the wall at
  // 45-55% of its height, and a single quad has nothing to measure there.
  {
    const b = new PartBuilder();
    const levels = [0, 0.25, 0.5, 0.75, 1].map((share) => share * deckY);
    for (let index = 0; index < levels.length - 1; index += 1) {
      const y0 = levels[index]!;
      const y1 = levels[index + 1]!;
      b.quad([v(-halfW, y0, -halfL), v(-halfW, y0, halfL), v(-halfW, y1, halfL), v(-halfW, y1, -halfL)], v(-1, 0, 0));
      b.quad([v(halfW, y0, -halfL), v(halfW, y0, halfL), v(halfW, y1, halfL), v(halfW, y1, -halfL)], v(1, 0, 0));
      b.quad([v(-halfW, y0, -halfL), v(halfW, y0, -halfL), v(halfW, y1, -halfL), v(-halfW, y1, -halfL)], v(0, 0, -1));
      b.quad([v(-halfW, y0, halfL), v(halfW, y0, halfL), v(halfW, y1, halfL), v(-halfW, y1, halfL)], v(0, 0, 1));
    }
    raw.push({ geometry: b.geometry(), part: "freestanding-tub-exterior" });

    // Underside, so the room floor never shows through the tub.
    const u = new PartBuilder();
    u.quad([
      v(-halfW, UNDERSIDE_Y, -halfL), v(halfW, UNDERSIDE_Y, -halfL),
      v(halfW, UNDERSIDE_Y, halfL), v(-halfW, UNDERSIDE_Y, halfL),
    ], v(0, -1, 0));
    raw.push({ geometry: u.geometry(), part: "freestanding-tub-base" });
  }

  // ---- Flat deck -----------------------------------------------------------
  // The narrow rim between the outer edge and the basin opening.
  {
    const b = new PartBuilder();
    // Along each long side, then across each end. The four pieces meet at the
    // inner opening's corners, so together they form the ring exactly.
    b.quad([v(-rimX, deckY, -rimZ), v(-halfW, deckY, -rimZ), v(-halfW, deckY, rimZ), v(-rimX, deckY, rimZ)], up);
    b.quad([v(rimX, deckY, -rimZ), v(halfW, deckY, -rimZ), v(halfW, deckY, rimZ), v(rimX, deckY, rimZ)], up);
    b.quad([v(-rimX, deckY, -rimZ), v(rimX, deckY, -rimZ), v(rimX, deckY, -halfL), v(-rimX, deckY, -halfL)], up);
    b.quad([v(-rimX, deckY, rimZ), v(rimX, deckY, rimZ), v(rimX, deckY, halfL), v(-rimX, deckY, halfL)], up);
    raw.push({ geometry: b.geometry(), part: "freestanding-tub-rim" });
  }

  // ---- Sloped basin walls --------------------------------------------------
  // The two long walls, sloping in to the sump width, plus the short drain-end
  // wall and the long backrest wall.
  {
    const b = new PartBuilder();
    b.quad([
      v(rimX, deckY, -rimZ), v(rimX, deckY, rimZ),
      v(sumpX, floorY, sumpTo), v(sumpX, floorY, sumpFrom),
    ], v(-1, 1, 0));
    b.quad([
      v(-rimX, deckY, -rimZ), v(-rimX, deckY, rimZ),
      v(-sumpX, floorY, sumpTo), v(-sumpX, floorY, sumpFrom),
    ], v(1, 1, 0));
    b.quad([
      v(-rimX, deckY, -rimZ), v(rimX, deckY, -rimZ),
      v(sumpX, floorY, sumpFrom), v(-sumpX, floorY, sumpFrom),
    ], v(0, 1, 1));
    b.quad([
      v(-rimX, deckY, rimZ), v(rimX, deckY, rimZ),
      v(sumpX, floorY, sumpTo), v(-sumpX, floorY, sumpTo),
    ], v(0, 1, -1));
    raw.push({ geometry: b.geometry(), part: "freestanding-tub-interior" });
  }

  // ---- Basin floor ---------------------------------------------------------
  {
    const b = new PartBuilder();
    b.quad([
      v(-sumpX, floorY, sumpFrom), v(sumpX, floorY, sumpFrom),
      v(sumpX, floorY, sumpTo), v(-sumpX, floorY, sumpTo),
    ], up);
    raw.push({ geometry: b.geometry(), part: "alcove-tub-well" });
  }

  // ---- Tile flange ---------------------------------------------------------
  // The raised lip along the back and both ends that the owner described. It
  // stands on the deck, and it is why the published height is measured to the
  // flange rather than to the deck.
  {
    const b = new PartBuilder();
    const t = FLANGE_THICKNESS_IN * INCH;
    // A U-shaped strip: the back wall plus both ends, open across the front.
    // Its four faces are the top edge, the outer skin, the inner skin, and the
    // two open ends, which the front apron closes off.
    const outerX = halfW;
    const innerX = halfW - t;
    const zLow = -halfL;
    const zHigh = halfL;
    // Top edge, walked as one continuous band: end, back, end.
    b.quad([v(-outerX, H, zLow), v(innerX, H, zLow), v(innerX, H, zLow + t), v(-outerX, H, zLow + t)], up);
    b.quad([v(innerX, H, zLow + t), v(innerX, H, zHigh - t), v(outerX, H, zHigh - t), v(outerX, H, zLow + t)], up);
    b.quad([v(-outerX, H, zHigh - t), v(innerX, H, zHigh - t), v(innerX, H, zHigh), v(-outerX, H, zHigh)], up);
    // Outer skin: the two ends and the back, below the top edge.
    b.quad([v(-outerX, deckY, zLow), v(outerX, deckY, zLow), v(outerX, H, zLow), v(-outerX, H, zLow)], v(0, 0, -1));
    b.quad([v(-outerX, deckY, zHigh), v(outerX, deckY, zHigh), v(outerX, H, zHigh), v(-outerX, H, zHigh)], v(0, 0, 1));
    b.quad([v(outerX, deckY, zLow), v(outerX, deckY, zHigh), v(outerX, H, zHigh), v(outerX, H, zLow)], v(1, 0, 0));
    // Inner skin, facing back into the deck.
    b.quad([v(innerX, deckY, zLow + t), v(innerX, deckY, zHigh - t), v(innerX, H, zHigh - t), v(innerX, H, zLow + t)], v(-1, 0, 0));
    // The two cuts where the strip meets the front apron.
    b.quad([v(-outerX, deckY, zLow + t), v(innerX, deckY, zLow + t), v(innerX, H, zLow + t), v(-outerX, H, zLow + t)], v(0, 0, 1));
    b.quad([v(-outerX, deckY, zHigh - t), v(innerX, deckY, zHigh - t), v(innerX, H, zHigh - t), v(-outerX, H, zHigh - t)], v(0, 0, -1));
    raw.push({ geometry: b.geometry(), part: "alcove-tub-flange" });
  }

  // ---- Drain and overflow --------------------------------------------------
  // Built as separate meshes because they are small and need their own material.
  const drainZ = -(halfL - spec.drainOffsetFromEndIn * INCH);
  const drainRadius = (spec.drainDiameterIn * INCH) / 2;
  const drain = new THREE.Mesh(
    new THREE.CylinderGeometry(drainRadius, drainRadius, 0.018, 28),
    materials.dark,
  );
  drain.position.set(0, floorY + 0.009, drainZ);

  const overflowY = deckY - spec.overflowBelowDeckIn * INCH;
  const slopeT = Math.min(1, Math.max(0, (deckY - overflowY) / Math.max(0.0001, deckY - floorY)));
  const overflowZ = -rimZ + (sumpFrom + rimZ) * slopeT + 0.012;
  const overflowRadius = (spec.overflowDiameterIn * INCH) / 2;
  const overflow = new THREE.Mesh(new THREE.CircleGeometry(overflowRadius, 32), materials.dark);
  // The drain-end wall leans in toward the sump, so its inward normal points
  // along +Z and up the slope.
  const inward = new THREE.Vector3(0, Math.abs(sumpFrom + rimZ), Math.abs(deckY - floorY)).normalize();
  overflow.position.set(0, overflowY, overflowZ);
  overflow.lookAt(new THREE.Vector3(0, overflowY, overflowZ).add(inward));

  // ---- Mirror for a right-hand drain ---------------------------------------
  // Everything above is modelled with the drain at -Z. A right-hand model is the
  // same tub mirrored in Z, so negate Z and reverse each triangle to keep the
  // faces pointing outward.
  const rightDrain = profile.drain === "right";
  if (rightDrain) {
    for (const entry of raw) mirrorGeometryInZ(entry.geometry);
  }

  const parts: AlcoveTubPart[] = raw.map((entry) => {
    const mesh = new THREE.Mesh(entry.geometry, entry.material ?? materials.shell);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return { mesh, part: entry.part };
  });

  const placeSmall = (mesh: THREE.Mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (rightDrain) mesh.position.z = -mesh.position.z;
    return mesh;
  };

  parts.push({ mesh: placeSmall(drain), part: "alcove-tub-drain" });
  parts.push({ mesh: placeSmall(overflow), part: "alcove-tub-overflow" });

  return parts;
}

function mirrorGeometryInZ(geometry: THREE.BufferGeometry) {
  const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
  for (let index = 0; index < positions.count; index += 1) {
    positions.setZ(index, -positions.getZ(index));
  }
  positions.needsUpdate = true;
  const index = geometry.getIndex();
  if (index) {
    const array = index.array as unknown as number[];
    for (let i = 0; i < array.length; i += 3) {
      const swap = array[i + 1]!;
      array[i + 1] = array[i + 2]!;
      array[i + 2] = swap;
    }
    index.needsUpdate = true;
  }
  geometry.computeVertexNormals();
}
