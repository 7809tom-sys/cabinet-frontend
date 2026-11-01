/**
 * Sloped raised-panel bevel for the 3D Designer.
 *
 * A flat box catches the same light as the center panel, so a raised door
 * reads as shaker. These four trapezoids rise from the recessed bed to the
 * center panel. Vertex colors keep the top/left slopes lighter and the
 * bottom/right slopes darker even when the room shadow map cannot resolve
 * a sub-inch edge.
 *
 * Geometries and bevel materials are cached. Callers must not dispose them.
 */
import * as THREE from "three";

const INCH = 1 / 12;

/** Depth used when the stored bevel is too shallow to read from the front. */
export const RAISED_PANEL_READABLE_BEVEL_DEPTH_IN = 0.45;
/** Dark groove between the stile and the start of the slope. */
export const RAISED_PANEL_GROOVE_IN = 0.18;

const SHARED_RESOURCE = { sharedRaisedPanelBevel: true };

export type RaisedPanelFaceRole = "door" | "drawer";

/**
 * Raised treatment follows the resolved profile only.
 * Doors use a raised profile or raised panel construction.
 * Drawers use a five-piece raised front, or the raised door profile unless
 * the drawer front is explicitly flat or slab. Names and style ids are ignored.
 */
export function threeDFaceUsesRaisedPanelBevel(input: {
  profileKind: string;
  panelConstruction?: string | null;
  drawerFrontType?: string | null;
  faceRole: RaisedPanelFaceRole;
  forceGlassFrame?: boolean;
}): boolean {
  if (input.forceGlassFrame) return false;
  const profileRaised = input.profileKind === "raised" || input.panelConstruction === "raised";
  if (input.faceRole === "drawer") {
    if (input.drawerFrontType === "five-piece-flat" || input.drawerFrontType === "slab") return false;
    return input.drawerFrontType === "five-piece-raised" || profileRaised;
  }
  return profileRaised;
}

/** Lift a shallow catalog step into the range that reads as raised, and keep an already-deep step. */
export function effectiveRaisedBevelDepthIn(requestedInches: number): number {
  const requested = Number.isFinite(requestedInches) && requestedInches > 0 ? requestedInches : 0.28;
  return requested < 0.4 ? RAISED_PANEL_READABLE_BEVEL_DEPTH_IN : requested;
}

type Vec3 = [number, number, number];
type RGB = [number, number, number];

const bevelGeometryCache = new Map<string, THREE.BufferGeometry>();
const grooveGeometryCache = new Map<string, THREE.BufferGeometry>();
const boxGeometryCache = new Map<string, THREE.BoxGeometry>();
const bevelMaterialCache = new Map<string, THREE.MeshStandardMaterial>();
let recessMaterial: THREE.MeshStandardMaterial | null = null;

function quantize(value: number): string {
  return value.toFixed(4);
}

function markShared(resource: { userData: Record<string, unknown> }) {
  resource.userData = { ...resource.userData, ...SHARED_RESOURCE };
}

function pushQuad(
  positions: number[],
  colors: number[],
  a: Vec3,
  b: Vec3,
  c: Vec3,
  d: Vec3,
  color: RGB,
) {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const acx = c[0] - a[0];
  const acy = c[1] - a[1];
  const facingViewer = abx * acy - aby * acx >= 0;
  const winding = facingViewer ? [a, b, c, a, c, d] : [a, d, c, a, c, b];
  for (const vertex of winding) {
    positions.push(vertex[0], vertex[1], vertex[2]);
    colors.push(color[0], color[1], color[2]);
  }
}

function geometryFrom(positions: number[], colors: number[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  markShared(geometry);
  return geometry;
}

/**
 * Picture-frame frustum: four trapezoids from the outer recess up to the
 * raised center. Normals face the room so the key light shades each slope.
 */
export function createSlopedRaisedPanelBevelGeometry(
  outerWidth: number,
  outerHeight: number,
  bevelWidth: number,
  bevelDepth: number,
): THREE.BufferGeometry {
  const key = [outerWidth, outerHeight, bevelWidth, bevelDepth].map(quantize).join("|");
  const cached = bevelGeometryCache.get(key);
  if (cached) return cached;

  const ow = outerWidth / 2;
  const oh = outerHeight / 2;
  const iw = Math.max(0.004, ow - bevelWidth);
  const ih = Math.max(0.004, oh - bevelWidth);
  const z1 = Math.max(0.001, bevelDepth);
  const positions: number[] = [];
  const colors: number[] = [];
  const top: RGB = [1, 1, 1];
  const left: RGB = [0.8, 0.8, 0.8];
  const right: RGB = [0.46, 0.46, 0.46];
  const bottom: RGB = [0.34, 0.34, 0.34];

  pushQuad(positions, colors, [-ow, oh, 0], [ow, oh, 0], [iw, ih, z1], [-iw, ih, z1], top);
  pushQuad(positions, colors, [-ow, -oh, 0], [ow, -oh, 0], [iw, -ih, z1], [-iw, -ih, z1], bottom);
  pushQuad(positions, colors, [-ow, oh, 0], [-iw, ih, z1], [-iw, -ih, z1], [-ow, -oh, 0], left);
  pushQuad(positions, colors, [ow, oh, 0], [iw, ih, z1], [iw, -ih, z1], [ow, -oh, 0], right);

  const geometry = geometryFrom(positions, colors);
  bevelGeometryCache.set(key, geometry);
  return geometry;
}

function createRaisedPanelGrooveGeometry(outerWidth: number, outerHeight: number, groove: number): THREE.BufferGeometry {
  const key = [outerWidth, outerHeight, groove].map(quantize).join("|");
  const cached = grooveGeometryCache.get(key);
  if (cached) return cached;

  const ow = outerWidth / 2;
  const oh = outerHeight / 2;
  const iw = Math.max(0.004, ow - groove);
  const ih = Math.max(0.004, oh - groove);
  const positions: number[] = [];
  const colors: number[] = [];
  const tone: RGB = [1, 1, 1];
  pushQuad(positions, colors, [-ow, oh, 0], [ow, oh, 0], [iw, ih, 0], [-iw, ih, 0], tone);
  pushQuad(positions, colors, [-ow, -oh, 0], [ow, -oh, 0], [iw, -ih, 0], [-iw, -ih, 0], tone);
  pushQuad(positions, colors, [-ow, oh, 0], [-iw, ih, 0], [-iw, -ih, 0], [-ow, -oh, 0], tone);
  pushQuad(positions, colors, [ow, oh, 0], [iw, ih, 0], [iw, -ih, 0], [ow, -oh, 0], tone);

  const geometry = geometryFrom(positions, colors);
  grooveGeometryCache.set(key, geometry);
  return geometry;
}

function sharedBox(width: number, height: number, depth: number): THREE.BoxGeometry {
  const key = [width, height, depth].map(quantize).join("|");
  const cached = boxGeometryCache.get(key);
  if (cached) return cached;
  const geometry = new THREE.BoxGeometry(width, height, depth);
  markShared(geometry);
  boxGeometryCache.set(key, geometry);
  return geometry;
}

function sharedRecessMaterial(): THREE.MeshStandardMaterial {
  if (!recessMaterial) {
    recessMaterial = new THREE.MeshStandardMaterial({
      color: "#0b0908",
      roughness: 0.94,
      metalness: 0,
      transparent: true,
      opacity: 0.94,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    markShared(recessMaterial);
  }
  return recessMaterial;
}

function sharedBevelMaterial(color: string): THREE.MeshStandardMaterial {
  const key = color.trim().toLowerCase() || "#f4f1ea";
  const cached = bevelMaterialCache.get(key);
  if (cached) return cached;
  const material = new THREE.MeshStandardMaterial({
    color: key,
    roughness: 0.58,
    metalness: 0.02,
    vertexColors: true,
  });
  markShared(material);
  bevelMaterialCache.set(key, material);
  return material;
}

export function attachSlopedRaisedPanel(
  parent: THREE.Object3D,
  input: {
    outerWidth: number;
    outerHeight: number;
    bevelWidth: number;
    bevelDepth: number;
    faceColor: string;
    insideEdgeProfile: string;
    drawerFrontType?: string | null;
    centerMaterial: THREE.Material;
  },
) {
  const groove = Math.min(
    RAISED_PANEL_GROOVE_IN * INCH,
    input.outerWidth * 0.12,
    input.outerHeight * 0.12,
    Math.max(0.004, input.bevelWidth * 0.45),
  );
  const slopeOuterWidth = Math.max(0.04, input.outerWidth - groove * 2);
  const slopeOuterHeight = Math.max(0.04, input.outerHeight - groove * 2);
  const bevelWidth = Math.max(0.008, Math.min(input.bevelWidth, slopeOuterWidth / 4, slopeOuterHeight / 4));
  const panelWidth = Math.max(0.02, slopeOuterWidth - bevelWidth * 2);
  const panelHeight = Math.max(0.02, slopeOuterHeight - bevelWidth * 2);
  const panelThickness = Math.max(0.012, Math.min(0.02, input.bevelDepth * 0.45));
  const insideEdgeProfile = input.insideEdgeProfile;

  const recessedBed = new THREE.Mesh(sharedBox(input.outerWidth, input.outerHeight, 0.006), sharedRecessMaterial());
  recessedBed.position.z = -0.01;
  recessedBed.userData = { raisedPanelRecess: true, insideEdgeProfile };
  parent.add(recessedBed);

  const grooveMesh = new THREE.Mesh(
    createRaisedPanelGrooveGeometry(input.outerWidth, input.outerHeight, groove),
    sharedRecessMaterial(),
  );
  grooveMesh.position.z = 0.001;
  grooveMesh.userData = { raisedPanelRecess: true, raisedPanelGroove: true, insideEdgeProfile };
  parent.add(grooveMesh);

  const bevel = new THREE.Mesh(
    createSlopedRaisedPanelBevelGeometry(slopeOuterWidth, slopeOuterHeight, bevelWidth, input.bevelDepth),
    sharedBevelMaterial(input.faceColor),
  );
  bevel.position.z = 0.003;
  bevel.castShadow = false;
  bevel.receiveShadow = false;
  bevel.userData = {
    raisedPanelBevel: true,
    sloped: true,
    bevelWidthIn: bevelWidth / INCH,
    bevelDepthIn: input.bevelDepth / INCH,
    insideEdgeProfile,
  };
  parent.add(bevel);

  const centerPanel = new THREE.Mesh(new THREE.BoxGeometry(panelWidth, panelHeight, panelThickness), input.centerMaterial);
  centerPanel.position.z = 0.003 + input.bevelDepth + panelThickness / 2;
  centerPanel.userData = {
    raisedCenterPanel: true,
    panelConstruction: "raised",
    drawerFrontType: input.drawerFrontType ?? null,
    grainPiece: "panel",
  };
  parent.add(centerPanel);
}
