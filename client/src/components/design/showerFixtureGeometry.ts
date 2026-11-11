import * as THREE from "three";
import type { VerifiedPelicanBathroomFixtureProfile } from "@/lib/pelicanBathroomFixtureProfiles";

/**
 * Shower fixture geometry: pans, surround panels, wall systems, niches.
 *
 * Each builder is a pure function returning named parts, matching the tub and
 * toilet builders, so the caller keeps ownership of the group and its userData
 * and the closure/envelope tests can measure the built meshes.
 *
 * Only a pan has a measured floor envelope. A surround is a wall panel set, a
 * shower system is wall trim, and a niche is recessed; those sit on walls rather
 * than occupying floor, which is why their footprint is not a floor body.
 */

export type ShowerMaterials = {
  /** White acrylic pan body. */
  shell: THREE.Material;
  /** Chrome / brushed trim. */
  metal: THREE.Material;
  /** Glass for a door panel. */
  glass?: THREE.Material;
  /** Panel face for a surround, keyed by finish name when available. */
  panel?: THREE.Material;
};

export type ShowerPart = {
  mesh: THREE.Mesh;
  part: string;
};

const INCH = 1 / 12;

/**
 * The fixed centre heights of a shower's valve and head, in inches above the
 * finished floor.
 *
 * Tom's rule, and deliberately not configurable: a plumber sets these out from the
 * floor, so they stay put whatever surround is fitted. The head is the CENTRE of
 * the head, not the top of its disk.
 */
/**
 * How thick a surround panel shell is, in inches.
 *
 * Shared by the surround (which draws the panel) and the niche (which is recessed
 * into it), so the recess can never be deeper than the wall holding it.
 */
export const SHOWER_PANEL_THICKNESS_IN = 0.35;

export const SHOWER_VALVE_HEIGHT_IN = 48;
export const SHOWER_HEAD_HEIGHT_IN = 80;

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Quad collector that guarantees each face points where it is meant to.
 *
 * The designer's fixture materials are single sided, so a mis-wound face is not
 * merely dark — it is invisible and you see straight through the fixture.
 */
class Panel {
  private positions: number[] = [];
  private uvs: number[] = [];
  private indices: number[] = [];

  /**
   * Planar UVs in world units, projected onto whichever plane the face lies in.
   *
   * A texture map is useless without UVs: the shader samples one texel and the whole
   * face renders as flat colour, which is exactly why the surround read as a plain
   * white box no matter what finish was set on it. Projecting in world units also
   * keeps grout spacing and marble veining at their real physical size, so a 60"
   * panel and a 36" end panel show the same tile scale.
   */
  private static planarUv(point: THREE.Vector3, normal: THREE.Vector3): [number, number] {
    const ax = Math.abs(normal.x);
    const ay = Math.abs(normal.y);
    const az = Math.abs(normal.z);
    if (ay >= ax && ay >= az) return [point.x, point.z];
    if (ax >= az) return [point.z, point.y];
    return [point.x, point.y];
  }

  quad(
    corners: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3],
    facing: THREE.Vector3,
  ): this {
    const [a, b, c, d] = corners;
    const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    const ordered = normal.dot(facing) >= 0 ? [a, b, c, d] : [d, c, b, a];
    const base = this.positions.length / 3;
    for (const point of ordered) {
      this.positions.push(point.x, point.y, point.z);
      const [u, w] = Panel.planarUv(point, facing);
      this.uvs.push(u, w);
    }
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    return this;
  }

  box(min: THREE.Vector3, max: THREE.Vector3): this {
    const { x: x0, y: y0, z: z0 } = min;
    const { x: x1, y: y1, z: z1 } = max;
    this.quad([v(x0, y0, z0), v(x0, y0, z1), v(x0, y1, z1), v(x0, y1, z0)], v(-1, 0, 0));
    this.quad([v(x1, y0, z0), v(x1, y0, z1), v(x1, y1, z1), v(x1, y1, z0)], v(1, 0, 0));
    this.quad([v(x0, y0, z0), v(x1, y0, z0), v(x1, y1, z0), v(x0, y1, z0)], v(0, 0, -1));
    this.quad([v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1)], v(0, 0, 1));
    this.quad([v(x0, y0, z0), v(x1, y0, z0), v(x1, y0, z1), v(x0, y0, z1)], v(0, -1, 0));
    this.quad([v(x0, y1, z0), v(x1, y1, z0), v(x1, y1, z1), v(x0, y1, z1)], UP);
    return this;
  }

  /** An outward-facing box shell is built by four walls plus a top; the pan
   * needs a genuine interior, so this is used for the rim and apron only. */
  geometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(this.uvs, 2));
    geometry.setIndex(this.indices);
    geometry.computeVertexNormals();
    return geometry;
  }
}

/**
 * A shower pan.
 *
 * Authored to the catalog's own convention so the plan footprint and the mesh
 * agree: `widthIn` runs on X and `depthIn` on Z, and the exposed front lip is
 * the long face at -Z. The back (+Z) and both ends are the walled sides, so the
 * pan snaps into a corner or alcove exactly like an alcove tub.
 *
 * The published height is the full pan height, so the flat rim sits at that
 * height with a recessed basin below it; the drain sits in the basin floor on the
 * published drain side.
 */
export function makeShowerPanParts(
  profile: VerifiedPelicanBathroomFixtureProfile,
  materials: ShowerMaterials,
): ShowerPart[] {
  const W = profile.widthIn * INCH;
  const D = profile.depthIn * INCH;
  const H = Math.max(0.25, profile.heightIn * INCH);
  const halfW = W / 2;
  const halfD = D / 2;

  // Rim width and basin depth scale with the pan so a 48" pan does not get a
  // 60" pan's rim. Both stay inside the published height.
  const rim = Math.min(3.5 * INCH, Math.min(W, D) * 0.14);
  const basinDepth = Math.min(H * 0.62, 2.6 * INCH);
  const basinY = H - basinDepth;

  const parts: ShowerPart[] = [];
  const push = (geometry: THREE.BufferGeometry, part: string, material: THREE.Material = materials.shell) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    parts.push({ mesh, part });
  };

  // ---- Outer walls ---------------------------------------------------------
  // Front lip is the -Z long face; the other three sides sit against walls.
  {
    const p = new Panel();
    p.quad([v(-halfW, 0, -halfD), v(-halfW, 0, halfD), v(-halfW, H, halfD), v(-halfW, H, -halfD)], v(-1, 0, 0));
    p.quad([v(halfW, 0, -halfD), v(halfW, 0, halfD), v(halfW, H, halfD), v(halfW, H, -halfD)], v(1, 0, 0));
    p.quad([v(-halfW, 0, -halfD), v(halfW, 0, -halfD), v(halfW, H, -halfD), v(-halfW, H, -halfD)], v(0, 0, -1));
    p.quad([v(-halfW, 0, halfD), v(halfW, 0, halfD), v(halfW, H, halfD), v(-halfW, H, halfD)], v(0, 0, 1));
    push(p.geometry(), "shower-pan-body");
  }

  // ---- Underside -----------------------------------------------------------
  {
    const p = new Panel();
    p.quad([
      v(-halfW, 0.004, -halfD), v(halfW, 0.004, -halfD),
      v(halfW, 0.004, halfD), v(-halfW, 0.004, halfD),
    ], v(0, -1, 0));
    push(p.geometry(), "shower-pan-base");
  }

  // ---- Flat rim around the recessed basin ----------------------------------
  const innerX = Math.max(1, halfW - rim);
  const innerZ = Math.max(1, halfD - rim);
  {
    const p = new Panel();
    p.quad([v(-innerX, H, -innerZ), v(-halfW, H, -innerZ), v(-halfW, H, innerZ), v(-innerX, H, innerZ)], UP);
    p.quad([v(innerX, H, -innerZ), v(halfW, H, -innerZ), v(halfW, H, innerZ), v(innerX, H, innerZ)], UP);
    p.quad([v(-innerX, H, -innerZ), v(innerX, H, -innerZ), v(innerX, H, -halfD), v(-innerX, H, -halfD)], UP);
    p.quad([v(-innerX, H, innerZ), v(innerX, H, innerZ), v(innerX, H, halfD), v(-innerX, H, halfD)], UP);
    push(p.geometry(), "shower-pan-rim");
  }

  // ---- Basin walls and floor -----------------------------------------------
  const floorW = innerX * 0.92;
  const floorD = innerZ * 0.94;
  {
    const p = new Panel();
    p.quad([v(innerX, H, -innerZ), v(innerX, H, innerZ), v(floorW, basinY, floorD), v(floorW, basinY, -floorD)], v(-1, 1, 0));
    p.quad([v(-innerX, H, -innerZ), v(-innerX, H, innerZ), v(-floorW, basinY, floorD), v(-floorW, basinY, -floorD)], v(1, 1, 0));
    p.quad([v(-innerX, H, -innerZ), v(innerX, H, -innerZ), v(floorW, basinY, -floorD), v(-floorW, basinY, -floorD)], v(0, 1, 1));
    p.quad([v(-innerX, H, innerZ), v(innerX, H, innerZ), v(floorW, basinY, floorD), v(-floorW, basinY, floorD)], v(0, 1, -1));
    push(p.geometry(), "shower-pan-basin-wall");

    const f = new Panel();
    f.quad([
      v(-floorW, basinY, -floorD), v(floorW, basinY, -floorD),
      v(floorW, basinY, floorD), v(-floorW, basinY, floorD),
    ], UP);
    push(f.geometry(), "shower-pan-basin-floor");
  }

  // ---- Drain ---------------------------------------------------------------
  // The drain sides are the pan's ends, which run along X.
  const drainRadius = Math.max(0.03, Math.min(W, D) * 0.045);
  const drainX = profile.drain === "left" ? -innerX * 0.45
    : profile.drain === "right" ? innerX * 0.45
      : 0;
  const drain = new THREE.Mesh(
    new THREE.CylinderGeometry(drainRadius, drainRadius, 0.014, 28),
    materials.metal,
  );
  drain.position.set(drainX, basinY + 0.008, 0);
  drain.receiveShadow = false;
  parts.push({ mesh: drain, part: "shower-pan-drain" });

  return parts;
}

/**
 * A three-piece alcove surround: the back wall plus both ends, standing from the
 * pan's rim to the published panel height.
 *
 * Authored in the same frame as the pan, so the two line up: `widthIn` runs on X
 * (the 60" back panel spans it), `depthIn` runs on Z (the two end panels run that
 * far), and the open front is the -Z long face where the door goes. Nothing here
 * occupies floor.
 */
export function makeShowerSurroundParts(
  profile: VerifiedPelicanBathroomFixtureProfile,
  materials: ShowerMaterials,
  options: { baseHeightIn?: number } = {},
): ShowerPart[] {
  const W = profile.widthIn * INCH;
  const D = profile.depthIn * INCH;
  const t = SHOWER_PANEL_THICKNESS_IN * INCH;
  const base = Math.max(0, options.baseHeightIn ?? 0) * INCH;
  const top = Math.max(base + 1, profile.heightIn * INCH);
  const halfW = W / 2;
  const halfD = D / 2;

  const parts: ShowerPart[] = [];
  const material = materials.panel ?? materials.shell;
  const push = (geometry: THREE.BufferGeometry, part: string) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    parts.push({ mesh, part });
  };

  // ---- Back panel: the +Z long side, spanning the full alcove width ----------
  {
    const p = new Panel();
    p.quad([
      v(-halfW, base, halfD - t), v(halfW, base, halfD - t),
      v(halfW, top, halfD - t), v(-halfW, top, halfD - t),
    ], v(0, 0, -1));
    p.quad([
      v(-halfW, base, halfD), v(halfW, base, halfD),
      v(halfW, top, halfD), v(-halfW, top, halfD),
    ], v(0, 0, 1));
    p.quad([
      v(-halfW, top, halfD - t), v(halfW, top, halfD - t),
      v(halfW, top, halfD), v(-halfW, top, halfD),
    ], UP);
    push(p.geometry(), "shower-surround-back");
  }

  // ---- End panels: the two short sides, running the alcove depth ------------
  for (const side of [-1, 1] as const) {
    const p = new Panel();
    const xOuter = side * halfW;
    const xInner = side * (halfW - t);
    // Inner face (toward the shower), outer face, top edge, and the cut edge at
    // the open front.
    p.quad([
      v(xInner, base, -halfD), v(xInner, base, halfD - t),
      v(xInner, top, halfD - t), v(xInner, top, -halfD),
    ], v(-side, 0, 0));
    p.quad([
      v(xOuter, base, -halfD), v(xOuter, base, halfD - t),
      v(xOuter, top, halfD - t), v(xOuter, top, -halfD),
    ], v(side, 0, 0));
    p.quad([
      v(xInner, top, -halfD), v(xInner, top, halfD - t),
      v(xOuter, top, halfD - t), v(xOuter, top, -halfD),
    ], UP);
    p.quad([
      v(xInner, base, -halfD), v(xOuter, base, -halfD),
      v(xOuter, top, -halfD), v(xInner, top, -halfD),
    ], v(0, 0, -1));
    push(p.geometry(), side < 0 ? "shower-surround-end-left" : "shower-surround-end-right");
  }

  return parts;
}

/**
 * A Hydra shower system on the wet wall: the valve trim plate, the lever, the
 * riser, the head, and the spout when the model has one.
 *
 * Mounted on the shower's BACK wall, which in the pan's frame is the +Z face at
 * z = depth. The trim lies flat on that wall and everything reaches out into the
 * room along -Z, so nothing pokes through the wall finish. The caller turns the
 * group to put that wall wherever the wet wall actually is.
 */
export function makeShowerSystemParts(
  profile: VerifiedPelicanBathroomFixtureProfile,
  materials: ShowerMaterials,
  options: {
    deckHeightIn?: number;
    wallDepthIn?: number;
    /**
     * Whether this set has a tub spout. Only the "...T/S" tub/shower combo does;
     * a shower-only set must never draw one.
     *
     * The valve and head heights are deliberately NOT options: they are fixed at
     * `SHOWER_VALVE_HEIGHT_IN` and `SHOWER_HEAD_HEIGHT_IN` above the finished
     * floor, because that is how a shower trim is set out.
     */
    hasTubSpout?: boolean;
  } = {},
): ShowerPart[] {
  const deck = Math.max(0, options.deckHeightIn ?? 0) * INCH;
  const reach = (profile.tubFillerSpoutReachIn ?? 8) * INCH;
  // The scene positions a fixture group at the fixture's own centre, so the
  // system is built about the origin too: the wall sits half a footprint away on
  // +Z and the head reaches back toward the room.
  const wallZ = ((profile.depthIn || 8) / 2) * INCH;

  // FIXED plumbing heights, measured from the finished floor. Tom's rule:
  //
  //   valve trim / handle centre  = 48"
  //   shower head centre          = 80"
  //
  // These are not the shopper's to choose and they are not clamped against the
  // panel. A shower trim is set out from the floor by the plumber, so the height is
  // the same whatever size surround is fitted — which is also why a taller panel
  // does not move the head and a shorter one does not drag it down.
  //
  // The earlier "keep the head 3 inches below the panel top" rule is gone: it made
  // the head height depend on the panel, so two showers with the same trim sat at
  // different heights depending on which surround they used.
  const valveHeightIn = SHOWER_VALVE_HEIGHT_IN;
  const headHeightIn = SHOWER_HEAD_HEIGHT_IN;

  const parts: ShowerPart[] = [];
  const push = (mesh: THREE.Mesh, part: string) => {
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    parts.push({ mesh, part });
  };

  // ---- Valve trim plate and lever -------------------------------------------
  const valveY = deck + valveHeightIn * INCH;
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(3 * INCH, 3 * INCH, 0.5 * INCH, 32),
    materials.metal,
  );
  plate.rotation.x = Math.PI / 2;
  plate.position.set(0, valveY, wallZ - 0.25 * INCH);
  push(plate, "shower-valve-trim");

  const lever = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55 * INCH, 0.7 * INCH, 2.2 * INCH, 20),
    materials.metal,
  );
  lever.rotation.x = Math.PI / 2;
  lever.position.set(0, valveY, wallZ - 1.5 * INCH);
  push(lever, "shower-valve-handle");

  // ---- Riser and head -------------------------------------------------------
  const headY = deck + headHeightIn * INCH;
  // The valve-to-head riser runs INSIDE the wall.
  //
  // It used to be a visible cylinder on the room side of the panel, which is not
  // how a Hydra set is installed — the pipe is buried and only the valve trim and
  // the arm come through the wall. Rendered as it was, the pipe ran up the
  // outside of the panel and bent over its top edge, which is exactly the leak Tom
  // saw. Nothing is drawn for the riser now; the trim and arm already read as one
  // connected fixture because the arm starts at the wall face.
  //
  // The escutcheon stays: it is the visible cover plate where the pipe meets the
  // finished face of the panel, and it belongs on the inside.
  const riserBottom = valveY + 1.5 * INCH;   // just above the trim plate
  const escutcheon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55 * INCH, 0.62 * INCH, 0.14 * INCH, 20),
    materials.metal,
  );
  escutcheon.rotation.x = Math.PI / 2;
  escutcheon.position.set(0, riserBottom, wallZ - 0.07 * INCH);
  push(escutcheon, "shower-riser-escutcheon");

  // Arm out into the room along -Z, then the head face over the pan.
  const arm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22 * INCH, 0.22 * INCH, reach, 16),
    materials.metal,
  );
  arm.rotation.x = Math.PI / 2;
  arm.position.set(0, headY, wallZ - reach / 2);
  push(arm, "shower-head-arm");

  const head = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6 * INCH, 2.2 * INCH, 0.8 * INCH, 28),
    materials.metal,
  );
  // Tom's 80" is the CENTRE of the head, so the head sits exactly on `headY`. It
  // used to hang 0.4" below the arm's centreline, which put the visible head 0.4"
  // under the specified height.
  head.position.set(0, headY, wallZ - reach);
  push(head, "shower-head");

  // ---- Tub spout ------------------------------------------------------------
  // Only a tub/shower combo has one. A shower-only build sits over a low pan with
  // nothing for a spout to fill, so drawing one put a nonsensical tap by the
  // shower floor.
  if (options.hasTubSpout && (profile.tubFillerSpoutReachIn ?? 0) >= 6) {
    const spout = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5 * INCH, 0.5 * INCH, 4 * INCH, 20),
      materials.metal,
    );
    spout.rotation.x = Math.PI / 2;
    spout.position.set(0, deck + 8 * INCH, wallZ - 2 * INCH);
    push(spout, "shower-spout");
  }

  return parts;
}

/**
 * A recessed niche: a shallow open box in a surround wall.
 *
 * It is recessed, so it has no floor footprint; the caller mounts it on a wall.
 */
/**
 * How thick a FRAMED shower wet wall is, in inches — a 2x4 stud wall plus tile.
 *
 * A surround on its own is a 0.35" panel sheet. A 3-17/32" niche cannot sit inside
 * that, and there is no room wall behind a free-standing shower side to hide it in,
 * so the recess simply stuck out of the back (Tom's screenshots, twice).
 *
 * A real installation builds a wet wall: framing deep enough to swallow the niche,
 * faced with the panel on the shower side. Giving the panel that thickness is what
 * makes the niche legal — the recess lives in the framing, the panel stays flush on
 * the inside, and the outside face is a flat wall.
 */
export const SHOWER_WET_WALL_THICKNESS_IN = 4.5;

/** The niche depth a wall of this thickness can absorb. */
export function nicheDepthForWallThickness(wallThicknessIn: number): number {
  // Leave the panel's own sheet on the inside face, so the recess starts where the
  // finish ends rather than eating the visible panel.
  return Math.max(0, wallThicknessIn - SHOWER_PANEL_THICKNESS_IN);
}

/**
 * A framed wet wall for one side of a surround: a solid slab from the panel's inner
 * face out to the wall's outer face, drawn in the panel's own material.
 *
 * The niche is then recessed inside THIS slab (see `availableDepthIn` on
 * `makeShowerNicheParts`), so the outer face is flat and nothing protrudes. Only the
 * slab is drawn — the panel stays where it was, flush on the inside.
 */
export function makeShowerWetWallParts(
  profile: VerifiedPelicanBathroomFixtureProfile,
  materials: ShowerMaterials,
  options: { thicknessIn?: number; heightIn?: number; widthIn?: number; mountHeightIn?: number; nicheDepthIn?: number } = {},
): ShowerPart[] {
  const t = SHOWER_PANEL_THICKNESS_IN * INCH;
  // The slab must finish BEHIND the niche's back, not level with it. Coincident
  // faces z-fight, and the loser is decided per-pixel — which is how the niche's
  // white shell kept showing through the wall on the outside. A clear gap removes
  // the tie entirely, so the wall always wins from outside.
  const BACK_CLEARANCE_IN = 0.5;
  const nicheDepthIn = options.nicheDepthIn ?? profile.depthIn;
  const needed = nicheDepthIn * INCH + BACK_CLEARANCE_IN * INCH - t;
  const thickness = Math.max(
    needed,
    Math.max(0, (options.thicknessIn ?? SHOWER_WET_WALL_THICKNESS_IN) * INCH - t),
  );
  const H = (options.heightIn ?? profile.heightIn) * INCH;
  const W = (options.widthIn ?? profile.widthIn) * INCH;
  const material = materials.panel ?? materials.shell;

  // The slab starts at the panel's OUTER face and runs back, so the assembled wall
  // is (panel + slab) thick on the inside and flat on the outside.
  //
  // It is built in the same local frame as the niche (`z` runs into the wall), so
  // placing it with the niche's own group puts it behind the correct panel on every
  // wall choice, and it follows the niche when the shower is moved.
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W, H, Math.max(thickness, 0.02)), material);
  slab.position.set(0, Math.max(0, options.mountHeightIn ?? 0) * INCH + H / 2, t + thickness / 2);
  slab.castShadow = false;
  slab.receiveShadow = false;
  return [{ mesh: slab, part: "shower-wet-wall" }];
}

export function makeShowerNicheParts(
  profile: VerifiedPelicanBathroomFixtureProfile,
  materials: ShowerMaterials,
  options: { availableDepthIn?: number } = {},
): ShowerPart[] {
  const W = profile.widthIn * INCH;
  const Hp = profile.heightIn * INCH;
  const shell = 0.12 * INCH;

  // How deep a recess this niche may cut, in inches.
  //
  // The niche is authored opening at z = 0 with its recess running into +Z, and its
  // placement rotates it so local +Z points INTO the wall it is mounted on. So the
  // recess eats into whatever thickness that wall has.
  //
  // A shower surround panel is a 0.35" sheet. A 3-17/32" recess behind it has
  // nowhere to go: there is no wall there, so anything drawn in that space sticks
  // out of the back of the shower and is visible from outside — which is exactly
  // what Tom photographed, twice. Wrapping that space in panel material only turned
  // a white bump into a grey bump.
  //
  // The caller therefore passes the depth the WALL can actually absorb:
  //   - a surround backed by a room wall: that wall's thickness,
  //   - a framed wet wall (see `makeShowerWetWallParts`): its stud depth,
  //   - a bare 0.35" panel with nothing behind it: 0.35", i.e. no real recess.
  //
  // Clamping here is the honest behaviour: a niche can only be as deep as the wall
  // holding it, so the outside face stays perfectly flat.
  const availableDepth = Number.isFinite(options.availableDepthIn) && (options.availableDepthIn ?? 0) > 0
    ? options.availableDepthIn!
    : SHOWER_PANEL_THICKNESS_IN;
  const depth = Math.min(profile.depthIn, availableDepth) * INCH;

  const parts: ShowerPart[] = [];
  const push = (geometry: THREE.BufferGeometry, part: string) => {
    const mesh = new THREE.Mesh(geometry, materials.shell);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    parts.push({ mesh, part });
  };

  // The recess: opening at z = 0 (the wall's inner face), back at z = depth. Never
  // deeper than the wall, so nothing crosses the outer face.
  const p = new Panel();
  p.quad([v(-W / 2, Hp, depth), v(W / 2, Hp, depth), v(W / 2, 0, depth), v(-W / 2, 0, depth)], v(0, 0, 1));
  p.quad([v(-W / 2, 0, -shell), v(W / 2, 0, -shell), v(W / 2, 0, depth), v(-W / 2, 0, depth)], UP);
  p.quad([v(-W / 2, Hp, -shell), v(W / 2, Hp, -shell), v(W / 2, Hp, depth), v(-W / 2, Hp, depth)], v(0, -1, 0));
  p.quad([v(-W / 2, 0, -shell), v(-W / 2, 0, depth), v(-W / 2, Hp, depth), v(-W / 2, Hp, -shell)], v(1, 0, 0));
  p.quad([v(W / 2, 0, -shell), v(W / 2, 0, depth), v(W / 2, Hp, depth), v(W / 2, Hp, -shell)], v(-1, 0, 0));
  push(p.geometry(), "shower-niche-body");

  // Face flange: the visible 1/2" border lapping the wall finish, on the shower
  // side of the opening so nothing laps onto the outside.
  const f = new Panel();
  const flange = 0.5 * INCH;
  const outerW = W / 2 + flange;
  f.quad([v(-outerW, Hp + flange, -shell), v(outerW, Hp + flange, -shell), v(W / 2, Hp, -shell), v(-W / 2, Hp, -shell)], v(0, 0, -1));
  f.quad([v(-outerW, -flange, -shell), v(outerW, -flange, -shell), v(W / 2, 0, -shell), v(-W / 2, 0, -shell)], v(0, 0, -1));
  f.quad([v(-outerW, -flange, -shell), v(-outerW, Hp + flange, -shell), v(-W / 2, Hp, -shell), v(-W / 2, 0, -shell)], v(0, 0, -1));
  f.quad([v(outerW, -flange, -shell), v(outerW, Hp + flange, -shell), v(W / 2, Hp, -shell), v(W / 2, 0, -shell)], v(0, 0, -1));
  push(f.geometry(), "shower-niche-flange");

  // Shelves, inside the available depth.
  const shelfCount = nicheShelfCount(profile.name);
  if (shelfCount > 0) {
    const shelfThickness = 0.4 * INCH;
    for (let index = 1; index <= shelfCount; index += 1) {
      const y = (Hp * index) / (shelfCount + 1);
      const shelfBack = Math.max(depth * 0.94, 0.01);
      const s = new Panel();
      s.quad([v(-W / 2, y - shelfThickness / 2, -shell), v(W / 2, y - shelfThickness / 2, -shell),
        v(W / 2, y - shelfThickness / 2, shelfBack), v(-W / 2, y - shelfThickness / 2, shelfBack)], v(0, -1, 0));
      s.quad([v(-W / 2, y + shelfThickness / 2, -shell), v(W / 2, y + shelfThickness / 2, -shell),
        v(W / 2, y + shelfThickness / 2, shelfBack), v(-W / 2, y + shelfThickness / 2, shelfBack)], UP);
      s.quad([v(-W / 2, y - shelfThickness / 2, shelfBack), v(W / 2, y - shelfThickness / 2, shelfBack),
        v(W / 2, y + shelfThickness / 2, shelfBack), v(-W / 2, y + shelfThickness / 2, shelfBack)], v(0, 0, 1));
      push(s.geometry(), `shower-niche-shelf-${index}`);
    }
  }

  return parts;
}

/** "PL-SN1639 Triple Shelf" -> 3. Unknown wording falls back to no shelves. */
export function nicheShelfCount(name: string | null | undefined): number {
  const text = (name ?? "").toLowerCase();
  // "with 2 Shelves", "3 shelf", "1 Shelf" all describe the same thing.
  const digit = text.match(/(\d+)\s*shel(?:f|ves)\b/);
  if (digit) return Math.max(0, Math.min(3, Number(digit[1])));
  if (/triple/.test(text)) return 3;
  if (/double/.test(text)) return 2;
  if (/single|one shelf/.test(text)) return 1;
  return 0;
}
