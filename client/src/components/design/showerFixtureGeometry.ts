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
/**
 * Emit a rectangle with a rectangular hole cut out of it.
 *
 * `emit(u0, u1, v0, v1)` is called once per surrounding strip. With no hole it is
 * called once for the whole rect, so callers can pass `undefined` freely.
 */
function rectWithHole(
  u0: number,
  u1: number,
  v0: number,
  v1: number,
  hole: { u0: number; u1: number; v0: number; v1: number } | null | undefined,
  emit: (a0: number, a1: number, b0: number, b1: number) => void,
): void {
  if (!hole) {
    emit(u0, u1, v0, v1);
    return;
  }
  // A hole that misses the panel entirely must not delete the panel.
  if (hole.u1 <= u0 || hole.u0 >= u1 || hole.v1 <= v0 || hole.v0 >= v1) {
    emit(u0, u1, v0, v1);
    return;
  }
  const hu0 = Math.max(u0, hole.u0);
  const hu1 = Math.min(u1, hole.u1);
  const hv0 = Math.max(v0, hole.v0);
  const hv1 = Math.min(v1, hole.v1);
  if (hv0 > v0) emit(u0, u1, v0, hv0);      // below the hole
  if (hv1 < v1) emit(u0, u1, hv1, v1);      // above it
  if (hu0 > u0) emit(u0, hu0, hv0, hv1);    // to its left
  if (hu1 < u1) emit(hu1, u1, hv0, hv1);    // to its right
}

export function makeShowerSurroundParts(
  profile: VerifiedPelicanBathroomFixtureProfile,
  materials: ShowerMaterials,
  options: {
    baseHeightIn?: number;
    /**
     * A hole to cut through the panel the niche is mounted on.
     *
     * Without it the panel is a solid sheet and the niche sits BEHIND it: from
     * inside the shower you look at wall, not into a recess. The niche is only
     * visible once the panel actually has an opening at its face.
     *
     * `side` is the panel to cut ("back" | "left" | "right"); the rectangle is in
     * that panel's own plane, in inches above the base.
     */
    opening?: {
      side: "back" | "left" | "right";
      centreAlongIn: number;   // along the panel, from its start
      widthIn: number;
      bottomIn: number;
      heightIn: number;
    } | null;
  } = {},
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
    const opening = options.opening?.side === "back" ? options.opening : null;
    const hole = opening
      ? {
        u0: -halfW + (opening.centreAlongIn - opening.widthIn / 2) * INCH,
        u1: -halfW + (opening.centreAlongIn + opening.widthIn / 2) * INCH,
        v0: base + opening.bottomIn * INCH,
        v1: base + (opening.bottomIn + opening.heightIn) * INCH,
      }
      : null;
    // Inner face, with the niche's opening cut out of it.
    rectWithHole(-halfW, halfW, base, top, hole, (u0, u1, v0, v1) => {
      p.quad([v(u0, v0, halfD - t), v(u1, v0, halfD - t), v(u1, v1, halfD - t), v(u0, v1, halfD - t)], v(0, 0, -1));
    });
    // Outer face: cut at the same rectangle. Left solid it sealed the back of the
    // recess, so from inside the shower you looked into the niche and met this
    // quad a third of an inch in — the recess read as a flat patch, not a recess.
    // The wet wall's own closed back is what covers the opening from outside.
    rectWithHole(-halfW, halfW, base, top, hole, (u0, u1, v0, v1) => {
      p.quad([v(u0, v0, halfD), v(u1, v0, halfD), v(u1, v1, halfD), v(u0, v1, halfD)], v(0, 0, 1));
    });
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
    // Inner face, with the niche's opening cut out when the niche is on this end.
    const sideName = side < 0 ? "left" : "right";
    const opening = options.opening?.side === sideName ? options.opening : null;
    const hole = opening
      ? {
        // Along the panel is plan Z; the opening is measured from the front (-halfD).
        u0: -halfD + (opening.centreAlongIn - opening.widthIn / 2) * INCH,
        u1: -halfD + (opening.centreAlongIn + opening.widthIn / 2) * INCH,
        v0: base + opening.bottomIn * INCH,
        v1: base + (opening.bottomIn + opening.heightIn) * INCH,
      }
      : null;
    rectWithHole(-halfD, halfD - t, base, top, hole, (u0, u1, v0, v1) => {
      p.quad([v(xInner, v0, u0), v(xInner, v0, u1), v(xInner, v1, u1), v(xInner, v1, u0)], v(-side, 0, 0));
    });
    // Outer face, cut at the niche's rectangle for the same reason as the back
    // panel: left solid it capped the recess from behind.
    rectWithHole(-halfD, halfD - t, base, top, hole, (u0, u1, v0, v1) => {
      p.quad([v(xOuter, v0, u0), v(xOuter, v0, u1), v(xOuter, v1, u1), v(xOuter, v1, u0)], v(side, 0, 0));
    });
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
  // The panel sheet sits in front of the wall the group is centred on, so the
  // finished surface the trim beds against is one panel thickness nearer the room.
  // Everything is offset by this: without it the trim plate's back face landed ON
  // the panel's OUTER face, so from the street the valve was a metal disc sitting
  // flush in the wall — the protrusion Tom photographed.
  const faceZ = wallZ - SHOWER_PANEL_THICKNESS_IN * INCH;

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
  plate.position.set(0, valveY, faceZ - 0.25 * INCH);
  push(plate, "shower-valve-trim");

  const lever = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55 * INCH, 0.7 * INCH, 2.2 * INCH, 20),
    materials.metal,
  );
  lever.rotation.x = Math.PI / 2;
  lever.position.set(0, valveY, faceZ - 1.5 * INCH);
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
  escutcheon.position.set(0, riserBottom, faceZ - 0.07 * INCH);
  push(escutcheon, "shower-riser-escutcheon");

  // Arm out into the room along -Z, then the head face over the pan.
  const arm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22 * INCH, 0.22 * INCH, reach, 16),
    materials.metal,
  );
  arm.rotation.x = Math.PI / 2;
  arm.position.set(0, headY, faceZ - reach / 2);
  push(arm, "shower-head-arm");

  const head = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6 * INCH, 2.2 * INCH, 0.8 * INCH, 28),
    materials.metal,
  );
  // Tom's 80" is the CENTRE of the head, so the head sits exactly on `headY`. It
  // used to hang 0.4" below the arm's centreline, which put the visible head 0.4"
  // under the specified height.
  head.position.set(0, headY, faceZ - reach);
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
    spout.position.set(0, deck + 8 * INCH, faceZ - 2 * INCH);
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
  options: {
    thicknessIn?: number;
    heightIn?: number;
    widthIn?: number;
    mountHeightIn?: number;
    nicheDepthIn?: number;
    /**
     * The height the niche's own group is lifted to, inches.
     *
     * This wall is a child of that group, so it inherits the lift. Without
     * cancelling it the wall floated up with the niche and its bottom sat at the
     * niche's height instead of the shower floor.
     */
    groupMountHeightIn?: number;
  } = {},
): ShowerPart[] {
  const t = SHOWER_PANEL_THICKNESS_IN * INCH;
  // A framed wet wall is framing PLUS the panel sheet already in front of it, so
  // the nominal 4.5" includes the 0.35" panel. Counting the panel twice made the
  // wall half an inch too deep and pushed its face off the back of the shower.
  const nominal = Math.max(0, (options.thicknessIn ?? SHOWER_WET_WALL_THICKNESS_IN) * INCH);
  const BACK_CLEARANCE_IN = 0.5;
  const nicheDepthIn = options.nicheDepthIn ?? profile.depthIn;

  // The recess back must finish INSIDE the framing, with a clear gap behind it.
  // Coincident faces z-fight and the loser is chosen per pixel, which is how the
  // niche's pale shell kept winning against the wall from outside. A real gap
  // removes the tie: the wall always covers it from the outside.
  // Same frame as the niche. The group origin sits `depth/2` out from the room
  // wall and local +Z runs INTO the wall, so a larger z is deeper in the wall.
  //
  //   panel inner face  = depth/2 - t   (the niche's opening plane)
  //   panel outer face  = depth/2       (where the framing starts)
  //   framed wall back  = inner + nominal
  //   recess back       = inner + niche depth
  //
  // The framing therefore starts at the panel's OUTER face and runs further in.
  // Starting it at the inner face (or at the recess back) left the wall standing
  // in front of the recess — on the room side of the glass.
  const halfFootprint = (profile.depthIn * INCH) / 2;
  const panelInner = halfFootprint - t;
  const wallInner = halfFootprint;                                  // framing's front
  const wallBack = panelInner + nominal;                            // framing's back
  const cavityBack = panelInner + nicheDepthIn * INCH + BACK_CLEARANCE_IN * INCH;

  const H = (options.heightIn ?? profile.heightIn) * INCH;
  const W = (options.widthIn ?? profile.widthIn) * INCH;
  const material = materials.panel ?? materials.shell;

  // Everything here is in the NICHE's local frame: z = 0 is the opening plane on
  // the panel's inside face, +z runs into the wall, and the group itself is lifted
  // to the niche's mounting height. So the wall's own vertical range has to cancel
  // that lift to span the real panel.
  const groupLift = (options.groupMountHeightIn ?? 0) * INCH;
  const yBottom = -groupLift;
  const yTop = H - groupLift;

  const parts: ShowerPart[] = [];
  const wallBox = (xa: number, xb: number, ya: number, yb: number, za: number, zb: number) => {
    // Take the extremes rather than trusting the caller's ordering: these are
    // computed from mixed frames above and an inverted pair would give a negative
    // box dimension and silently drop a piece of the wall.
    const x0 = Math.min(xa, xb);
    const x1 = Math.max(xa, xb);
    const y0 = Math.min(ya, yb);
    const y1 = Math.max(ya, yb);
    const z0 = Math.min(za, zb);
    const z1 = Math.max(za, zb);
    const w = x1 - x0;
    const h = y1 - y0;
    const d = z1 - z0;
    // A zero-width strip is a degenerate box: drop it rather than draw a sliver.
    if (w <= 1e-6 || h <= 1e-6 || d <= 1e-6) return;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    parts.push({ mesh, part: "shower-wet-wall" });
  };

  // The wall is a closed FRAME around the recess, not a slab in front of or behind
  // it. Drawn as a slab it either filled the niche (so the recess read as a flat
  // patch) or stood off the back of the panel as a separate bump. As a frame the
  // outside is one uninterrupted face and the recess stays empty.
  //
  // Back plate, closing the wall behind the recess. This is the surface seen from
  // outside, which is why it spans the whole panel.
  wallBox(-W / 2, W / 2, yBottom, yTop, wallBack, cavityBack);

  // The four sides, around the niche's opening and never across it.
  // The opening in the frame goes exactly where the NICHE is. The niche is always
  // authored at local y 0..height inside this same group, so the aperture is too —
  // no mount height involved. Deriving it from an absolute height instead put the
  // hole at floor level while the niche sat at 44–83", so the frame closed over the
  // niche and it read as a flat patch again.
  const halfNiche = (profile.widthIn * INCH) / 2;
  const nicheTop = profile.heightIn * INCH;
  // Cover the niche's face flange too, so no part of the frame laps over it.
  const openingBottom = -0.5 * INCH;
  const openingTop = nicheTop + 0.5 * INCH;
  wallBox(-W / 2, -halfNiche, yBottom, yTop, cavityBack, wallInner);
  wallBox(halfNiche, W / 2, yBottom, yTop, cavityBack, wallInner);
  wallBox(-halfNiche, halfNiche, yBottom, openingBottom, cavityBack, wallInner);
  wallBox(-halfNiche, halfNiche, openingTop, yTop, cavityBack, wallInner);

  return parts;
}

/**
 * Local z of a niche's OPENING plane, in the frame `makeShowerNicheParts` builds in.
 *
 * A niche group is placed at the fixture's footprint centre, half a depth out from
 * the room wall, so its opening only lands on the panel's inside face once it is
 * pushed forward by half the footprint and back by one panel thickness. Anything
 * that positions geometry relative to the niche — the selection box especially —
 * has to use this, or it covers the niche in the old frame and misses it.
 */
export function showerNicheOpeningOffsetIn(
  profile: VerifiedPelicanBathroomFixtureProfile,
): number {
  return (profile.depthIn - SHOWER_PANEL_THICKNESS_IN) / 2;
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

  // Where the opening plane sits relative to the group origin.
  //
  // The group is centred on the fixture's FOOTPRINT, so its origin is half a depth
  // back from the front of the part. The recess is authored from the opening
  // instead, so the two only line up once the opening is pushed forward by half the
  // footprint depth. Without this the niche straddled the panel: roughly half of it
  // stood out into the room and the other half came through the outside face —
  // exactly the bump Tom kept photographing. The wet wall below is offset by the
  // same amount, so the frame and the recess stay in one frame.
  //
  // The group sits half a depth out from the room wall (its footprint is flush to
  // that wall), and local +Z runs INTO the wall, so a point at local z maps to
  // `depth/2 - z` from the wall. The opening belongs on the panel's INNER face,
  // which is one panel thickness out from the wall, hence `depth/2 - t`.
  const halfFootprint = (profile.depthIn * INCH) / 2;
  const openingZ = halfFootprint - SHOWER_PANEL_THICKNESS_IN * INCH;

  const parts: ShowerPart[] = [];
  const push = (geometry: THREE.BufferGeometry, part: string) => {
    const mesh = new THREE.Mesh(geometry, materials.shell);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    parts.push({ mesh, part });
  };

  // The recess: opening at z = 0 (the wall's inner face), back at z = depth. Never
  // deeper than the wall, so nothing crosses the outer face.
  const zOpen = openingZ - shell;
  const zBack = openingZ + depth;
  const p = new Panel();
  p.quad([v(-W / 2, Hp, zBack), v(W / 2, Hp, zBack), v(W / 2, 0, zBack), v(-W / 2, 0, zBack)], v(0, 0, 1));
  p.quad([v(-W / 2, 0, zOpen), v(W / 2, 0, zOpen), v(W / 2, 0, zBack), v(-W / 2, 0, zBack)], UP);
  p.quad([v(-W / 2, Hp, zOpen), v(W / 2, Hp, zOpen), v(W / 2, Hp, zBack), v(-W / 2, Hp, zBack)], v(0, -1, 0));
  p.quad([v(-W / 2, 0, zOpen), v(-W / 2, 0, zBack), v(-W / 2, Hp, zBack), v(-W / 2, Hp, zOpen)], v(1, 0, 0));
  p.quad([v(W / 2, 0, zOpen), v(W / 2, 0, zBack), v(W / 2, Hp, zBack), v(W / 2, Hp, zOpen)], v(-1, 0, 0));
  push(p.geometry(), "shower-niche-body");

  // Face flange: the visible 1/2" border lapping the wall finish, on the shower
  // side of the opening so nothing laps onto the outside.
  const f = new Panel();
  const flange = 0.5 * INCH;
  const outerW = W / 2 + flange;
  f.quad([v(-outerW, Hp + flange, zOpen), v(outerW, Hp + flange, zOpen), v(W / 2, Hp, zOpen), v(-W / 2, Hp, zOpen)], v(0, 0, -1));
  f.quad([v(-outerW, -flange, zOpen), v(outerW, -flange, zOpen), v(W / 2, 0, zOpen), v(-W / 2, 0, zOpen)], v(0, 0, -1));
  f.quad([v(-outerW, -flange, zOpen), v(-outerW, Hp + flange, zOpen), v(-W / 2, Hp, zOpen), v(-W / 2, 0, zOpen)], v(0, 0, -1));
  f.quad([v(outerW, -flange, zOpen), v(outerW, Hp + flange, zOpen), v(W / 2, Hp, zOpen), v(W / 2, 0, zOpen)], v(0, 0, -1));
  push(f.geometry(), "shower-niche-flange");

  // Shelves, inside the available depth.
  const shelfCount = nicheShelfCount(profile.name);
  if (shelfCount > 0) {
    const shelfThickness = 0.4 * INCH;
    for (let index = 1; index <= shelfCount; index += 1) {
      const y = (Hp * index) / (shelfCount + 1);
      const shelfBack = zOpen + Math.max(depth * 0.94, 0.01);
      const s = new Panel();
      s.quad([v(-W / 2, y - shelfThickness / 2, zOpen), v(W / 2, y - shelfThickness / 2, zOpen),
        v(W / 2, y - shelfThickness / 2, shelfBack), v(-W / 2, y - shelfThickness / 2, shelfBack)], v(0, -1, 0));
      s.quad([v(-W / 2, y + shelfThickness / 2, zOpen), v(W / 2, y + shelfThickness / 2, zOpen),
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
