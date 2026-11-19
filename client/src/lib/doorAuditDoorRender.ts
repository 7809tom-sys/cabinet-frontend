/**
 * Offscreen front-on door capture for the Door Rendering Audit.
 *
 * Mounting the full Designer room would change with layout, camera, and
 * hardware. This capture reuses the Designer's door profile math, sample-photo
 * crop, finish sheen, and scene light colors, then frames one 18×30 in door
 * with a locked orthographic camera. The canvas is never attached to the page.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  doorProfileKind,
  threeDDoorFinishSurfaceProfile,
  threeDFaceMaterialColor,
  threeDShakerRailThickness,
  threeDUsesPhysicalShakerRails,
  type ThreeDDoorProfile,
} from "@/components/design/InteractiveRoom3D";
import {
  DOOR_AUDIT_CAPTURE,
  DOOR_AUDIT_LIGHTS,
  auditDoorCameraBounds,
  type DoorAuditDoorProfile,
  type DoorAuditRenderInput,
} from "@/lib/doorRenderingAudit";
import { attachSlopedRaisedPanel, effectiveRaisedBevelDepthIn } from "@/components/design/raisedPanelBevel";
import { resolveDoorStyleAppearance } from "@/lib/doorStyleAppearance";
import { RAISED_PANEL_BEVEL_DEPTH_IN, RAISED_PANEL_BEVEL_WIDTH_IN } from "@shared/doorStyleAppearance";
import { ColorGateBlock, runBestEffortColorGate, runColorGate } from "@shared/colorGate";
import { DL_SHAKER_GEOMETRY as SHAKER_GENERIC_IMAGE_GEOMETRY } from "@shared/shakerDoorBlueprint";
import { DLC_FRAME_DETAIL as SHAKER_GENERIC_IMAGE_FRAME } from "@shared/dlcFr26Textures";
import { doorLightsForFinish, type DoorLightRig } from "@shared/doorRenderLights";
import { hexFromCanvas } from "@/lib/doorColorProbe";
import { applyThreeDCabinetPieceGrain } from "@/lib/woodGrainVariation";
import { outlineEdges } from "@/lib/shakerFrameOutline";

const INCH = 1 / 12;

export type AuditDoorKind = "flat" | "shaker" | "raised" | "glass";

/** A front other than the 18 x 30 in audit door: a drawer front, a wall door, a base door. */
export type AuditDoorSize = { widthIn: number; heightIn: number };

export type BuildAuditDoorOptions = {
  size?: AuditDoorSize;
  /**
   * Draw the shaker so it reads at a glance: outline edges on every rail and stile, a
   * soft inner shadow along the opening, and the shaker generic image's rail depth. The
   * audit capture leaves this off, so its renders do not change.
   */
  outline?: boolean;
};

export type AuditDoorConstruction = {
  kind: AuditDoorKind;
  framed: boolean;
  widthIn: number;
  heightIn: number;
  thicknessIn: number;
  railIn: number | null;
  stileIn: number | null;
  bevelWidthIn: number | null;
  bevelDepthIn: number | null;
};

function toProfile(profile: DoorAuditDoorProfile | ThreeDDoorProfile | null | undefined): ThreeDDoorProfile {
  return {
    doorStyle: profile?.doorStyle ?? null,
    doorPanelType: profile?.doorPanelType ?? null,
    railWidth: profile?.railWidth ?? null,
    stileWidth: profile?.stileWidth ?? null,
    panelConstruction: profile?.panelConstruction ?? null,
    bevelWidth: profile?.bevelWidth ?? null,
    bevelDepth: profile?.bevelDepth ?? null,
    insideEdgeProfile: profile?.insideEdgeProfile ?? null,
    drawerFrontType: profile?.drawerFrontType ?? null,
    grainDirection: profile?.grainDirection ?? null,
    finishSheen: profile?.finishSheen ?? null,
  };
}

export function auditDoorKind(profile: DoorAuditDoorProfile | ThreeDDoorProfile | null | undefined): AuditDoorKind {
  const door = toProfile(profile);
  const profileKind = doorProfileKind(door.doorStyle, door.doorPanelType);
  if (door.panelConstruction === "glass") return "glass";
  if (profileKind === "raised" || door.panelConstruction === "raised") return "raised";
  if (threeDUsesPhysicalShakerRails(profileKind, true)) return "shaker";
  return "flat";
}

/** Rail, stile, and bevel sizes from the same helpers the Designer uses for a physical door. */
export function auditDoorConstruction(
  profile: DoorAuditDoorProfile | ThreeDDoorProfile | null | undefined,
  size?: AuditDoorSize,
): AuditDoorConstruction {
  const door = toProfile(profile);
  const kind = auditDoorKind(door);
  const doorWidthIn = size?.widthIn ?? DOOR_AUDIT_CAPTURE.doorWidthIn;
  const doorHeightIn = size?.heightIn ?? DOOR_AUDIT_CAPTURE.doorHeightIn;
  const widthFt = doorWidthIn * INCH;
  const heightFt = doorHeightIn * INCH;
  const wantsFrame = kind !== "flat";
  const railFt = wantsFrame ? threeDShakerRailThickness(widthFt, heightFt, door.railWidth) : 0;
  const stileFt = wantsFrame ? threeDShakerRailThickness(widthFt, heightFt, door.stileWidth) : 0;
  const framed = wantsFrame && railFt > 0 && stileFt > 0;
  let bevelWidthIn: number | null = null;
  let bevelDepthIn: number | null = null;
  if (kind === "raised" && framed) {
    const requestedBevelWidth = Number(door.bevelWidth);
    const requestedBevelDepth = Number(door.bevelDepth);
    const bevelWidthFt = Math.max(0.025, Math.min(
      Number.isFinite(requestedBevelWidth) && requestedBevelWidth > 0 ? requestedBevelWidth * INCH : RAISED_PANEL_BEVEL_WIDTH_IN * INCH,
      (widthFt - stileFt * 2) / 4,
      (heightFt - railFt * 2) / 4,
    ));
    // Same depth rule as the Designer: a shallow catalog step is lifted to a readable depth.
    const bevelDepthFt = Math.max(0.012, Math.min(
      effectiveRaisedBevelDepthIn(
        Number.isFinite(requestedBevelDepth) && requestedBevelDepth > 0 ? requestedBevelDepth : RAISED_PANEL_BEVEL_DEPTH_IN,
      ) * INCH,
      0.07,
    ));
    bevelWidthIn = bevelWidthFt / INCH;
    bevelDepthIn = bevelDepthFt / INCH;
  }
  return {
    kind: framed || kind === "flat" ? kind : "flat",
    framed,
    widthIn: doorWidthIn,
    heightIn: doorHeightIn,
    thicknessIn: DOOR_AUDIT_CAPTURE.doorThicknessIn,
    railIn: framed ? railFt / INCH : null,
    stileIn: framed ? stileFt / INCH : null,
    bevelWidthIn,
    bevelDepthIn,
  };
}

/** Center-crop a door sample the same way the Designer maps it onto a physical face. */
export function configureDoorAuditSampleTexture(texture: THREE.Texture, sampleUrl: string) {
  const curated = /rustic_hickory_vertical_grain/i.test(sampleUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = curated ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.wrapT = curated ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.repeat.set(curated ? 1 : 0.42, curated ? 1 : 0.42);
  texture.offset.set(curated ? 0 : 0.29, curated ? 0 : 0.29);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  texture.userData = {
    ...texture.userData,
    materialOnlyNoDoorGeometry: true,
    curatedCabinetFinish: curated,
  };
  return texture;
}

/**
 * A featured sample is often a whole cabinet face: drawer front on top, door
 * below, frame included. Projecting that photograph onto a constructed door
 * prints the drawer and the photo's rails on top of the real profile. Keep
 * only the uninterrupted center of the door panel and tile that wood.
 */
export function cropAuditSampleToPanelGrain(texture: THREE.Texture): THREE.Texture {
  const image = texture.image as { width?: number; height?: number } | undefined;
  if (!image?.width || !image.height || typeof document === "undefined") return texture;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return texture;
  // Stay inside the raised center panel. The stile edges of a cabinet-face
  // photo are bright highlights, and tiling those highlights reads as bar pulls.
  const sx = image.width * 0.4;
  const sy = image.height * 0.52;
  const sw = image.width * 0.2;
  const sh = image.height * 0.22;
  context.drawImage(image as CanvasImageSource, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const cropped = new THREE.CanvasTexture(canvas);
  cropped.colorSpace = THREE.SRGBColorSpace;
  cropped.wrapS = THREE.RepeatWrapping;
  cropped.wrapT = THREE.RepeatWrapping;
  cropped.anisotropy = texture.anisotropy || 8;
  cropped.needsUpdate = true;
  cropped.userData = {
    ...texture.userData,
    materialOnlyNoDoorGeometry: true,
    curatedCabinetFinish: true,
    doorPanelGrainCrop: true,
  };
  return cropped;
}

/**
 * Vertical stained-wood board used when a door has no sample photo. The canvas
 * is already the stain color, so the material stays untinted (white) and the
 * grain reads as wood instead of a flat gray slab.
 */
export function stainedWoodGrainTexture(hex: string): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = hex;
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (let line = 0; line < 42; line += 1) {
    const x = (line * 37) % canvas.width;
    context.strokeStyle = line % 4 === 0 ? "rgba(255,244,230,0.07)" : "rgba(0,0,0,0.22)";
    context.lineWidth = line % 5 === 0 ? 2 : 1;
    context.beginPath();
    context.moveTo(x, 0);
    context.bezierCurveTo(x + 8, 140, x - 6, 320, x + 3, canvas.height);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  texture.userData = { stainedWoodGrain: true, curatedCabinetFinish: true };
  return texture;
}

function faceMaterial(
  color: string,
  texture: THREE.Texture | null,
  sheen: DoorAuditDoorProfile["finishSheen"],
  piece: "rail" | "stile" | "panel" | "slab",
  grain: DoorAuditDoorProfile["grainDirection"],
) {
  let map = texture;
  if (texture && grain === "vertical-stiles-horizontal-rails" && piece === "rail") {
    map = texture.clone();
    map.center.set(0.5, 0.5);
    map.rotation = Math.PI / 2;
    map.needsUpdate = true;
  }
  const material = new THREE.MeshPhysicalMaterial({
    color: map && piece === "rail" ? "#ffffff" : threeDFaceMaterialColor(color, Boolean(texture)),
    map,
    ...threeDDoorFinishSurfaceProfile(sheen ?? undefined, Boolean(texture)),
    // The room environment is only a soft fill. A stronger map lifts a
    // charcoal stain toward gray.
    envMapIntensity: 0.55,
  });
  material.userData = { grainPiece: piece };
  return material;
}

/**
 * Soft shadow along the top and left of the opening and a faint highlight along the
 * bottom and right, from the shaker generic image's own strip strengths. It sits on
 * the center panel just behind the rails, so the panel reads as recessed.
 */
function shakerOpeningShadow(openingW: number, openingH: number, railDepth: number): THREE.Mesh[] {
  const strips: THREE.Mesh[] = [];
  const z = -railDepth / 2 + SHAKER_GENERIC_IMAGE_FRAME.stripDepth;
  const add = (w: number, h: number, x: number, y: number, color: string, opacity: number) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, SHAKER_GENERIC_IMAGE_FRAME.stripDepth),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
    );
    mesh.position.set(x, y, z);
    mesh.userData = { shakerOpeningShade: true };
    strips.push(mesh);
  };
  for (const [width, opacity] of SHAKER_GENERIC_IMAGE_FRAME.shadow) {
    const t = Math.min(width * 2, openingW / 3, openingH / 3);
    add(openingW, t, 0, openingH / 2 - t / 2, "#000000", Math.min(0.45, opacity * 1.6));
    add(t, openingH, -openingW / 2 + t / 2, 0, "#000000", Math.min(0.45, opacity * 1.6));
  }
  const hw = Math.min(SHAKER_GENERIC_IMAGE_FRAME.highlight.width, openingW / 3, openingH / 3);
  add(openingW, hw, 0, -openingH / 2 + hw / 2, "#ffffff", SHAKER_GENERIC_IMAGE_FRAME.highlight.opacity);
  add(hw, openingH, openingW / 2 - hw / 2, 0, "#ffffff", SHAKER_GENERIC_IMAGE_FRAME.highlight.opacity);
  return strips;
}

export function buildAuditDoor(
  input: (Pick<DoorAuditRenderInput, "color" | "samplePhotoUrl" | "name" | "code" | "distributorName" | "distributorCode" | "finish" | "woodSpecies" | "renderHex"> & {
    doorProfile?: DoorAuditDoorProfile | null;
    ourName?: string | null;
    styleCode?: string | null;
    styleId?: number | null;
  }) | null | undefined,
  texture: THREE.Texture | null,
  options: BuildAuditDoorOptions = {},
): THREE.Group {
  if (!input?.doorProfile) {
    const label = input?.name?.trim() || "This door";
    throw new Error(`${label} is missing its door profile, so it cannot be rendered.`);
  }
  const appearance = resolveDoorStyleAppearance(input);
  const profile = appearance.profile;
  const plan = auditDoorConstruction(profile, options.size);
  const color = appearance.finishHex;
  const stainedGrain = !texture && appearance.stainedWood ? stainedWoodGrainTexture(color) : null;
  const faceTexture = texture ?? stainedGrain;
  const width = plan.widthIn * INCH;
  const height = plan.heightIn * INCH;
  const thickness = plan.thicknessIn * INCH;
  const group = new THREE.Group();
  group.userData = {
    auditDoor: true,
    auditDoorKind: plan.kind,
    // One door, front-on. No cabinet box and no bar pulls.
    auditHardware: false,
    finishHex: color,
    stainedWood: appearance.stainedWood,
  };
  const slabMaterial = faceMaterial(color, faceTexture, profile.finishSheen, "slab", profile.grainDirection);

  if (plan.kind === "glass" && plan.framed && plan.railIn != null && plan.stileIn != null) {
    const rail = plan.railIn * INCH;
    const stile = plan.stileIn * INCH;
    const pane = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(0.04, width - stile * 2), Math.max(0.04, height - rail * 2), 0.012),
      new THREE.MeshPhysicalMaterial({
        color: "#b8d4dc",
        roughness: 0.07,
        metalness: 0,
        clearcoat: 0.32,
        clearcoatRoughness: 0.14,
        transmission: 0.48,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
      }),
    );
    pane.userData = { glassCenter: true };
    group.add(pane);
  } else {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(width, height, thickness), slabMaterial);
    slab.castShadow = false;
    slab.receiveShadow = false;
    slab.userData = { auditDoorSlab: true };
    group.add(slab);
  }

  const applyStyleGrain = () => {
    // One style id always samples the same board. A different style does not
    // reuse this crop. The sample image itself stays shared.
    const styleKey = input.styleId != null && Number.isFinite(Number(input.styleId))
      ? `style:${input.styleId}`
      : `sample:${input.samplePhotoUrl ?? "audit-door"}`;
    applyThreeDCabinetPieceGrain(group, {
      placementUid: styleKey,
      sampleUrl: input.samplePhotoUrl,
      grainDirection: profile.grainDirection,
      curated: /rustic_hickory_vertical_grain/i.test(input.samplePhotoUrl ?? "")
        || faceTexture?.userData?.stainedWoodGrain === true
        || faceTexture?.userData?.doorPanelGrainCrop === true
        || faceTexture?.userData?.curatedCabinetFinish === true,
      sourceTexture: faceTexture,
    });
    return group;
  };

  if (!plan.framed || plan.railIn == null || plan.stileIn == null) return applyStyleGrain();

  const rail = plan.railIn * INCH;
  const stile = plan.stileIn * INCH;
  // The shaker generic image keeps one rail depth for every shaker door.
  const railDepth = options.outline ? SHAKER_GENERIC_IMAGE_GEOMETRY.railDepth : 0.026;
  const frame = new THREE.Group();
  frame.position.z = thickness / 2 + railDepth / 2;
  frame.userData = {
    selectedStyleFace: plan.kind === "glass" ? "glass-door-frame" : plan.kind === "raised" ? "raised-panel" : "shaker",
    physicalRails: true,
    panelConstruction: plan.kind === "raised" ? "raised" : profile.panelConstruction ?? "flat",
  };
  const pieces = [
    [width, rail, 0, height / 2 - rail / 2, "rail"],
    [width, rail, 0, -height / 2 + rail / 2, "rail"],
    [stile, Math.max(0.02, height - rail * 2), -width / 2 + stile / 2, 0, "stile"],
    [stile, Math.max(0.02, height - rail * 2), width / 2 - stile / 2, 0, "stile"],
  ] as const;
  for (const [pieceWidth, pieceHeight, x, y, piece] of pieces) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(pieceWidth, pieceHeight, railDepth),
      faceMaterial(color, faceTexture, profile.finishSheen, piece, profile.grainDirection),
    );
    mesh.position.set(x, y, 0);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.userData = { physicalRail: true, grainPiece: piece };
    if (options.outline) mesh.add(outlineEdges(mesh.geometry, color));
    frame.add(mesh);
  }
  if (options.outline && plan.kind === "shaker") {
    frame.add(...shakerOpeningShadow(width - stile * 2, height - rail * 2, railDepth));
  }

  if (plan.kind === "raised" && plan.bevelWidthIn != null && plan.bevelDepthIn != null) {
    const bevelWidth = plan.bevelWidthIn * INCH;
    const bevelDepth = plan.bevelDepthIn * INCH;
    const bevelOuterWidth = Math.max(0.06, width - stile * 2);
    const bevelOuterHeight = Math.max(0.06, height - rail * 2);
    // Same sloped bevel, groove, and raised center the Designer draws, so the audit judges the real profile.
    attachSlopedRaisedPanel(frame, {
      outerWidth: bevelOuterWidth,
      outerHeight: bevelOuterHeight,
      bevelWidth,
      bevelDepth,
      faceColor: color,
      insideEdgeProfile: profile.insideEdgeProfile ?? "bevel",
      drawerFrontType: null,
      centerMaterial: faceMaterial(color, faceTexture, profile.finishSheen, "panel", profile.grainDirection),
      // The audit renders one door front, never a cabinet side or end.
      faceRole: "door",
    });
    if (/ogee|bead/i.test(profile.insideEdgeProfile ?? "")) {
      const sticking = new THREE.Mesh(
        new THREE.BoxGeometry(
          Math.max(0.05, bevelOuterWidth - bevelWidth * 0.7),
          Math.max(0.05, bevelOuterHeight - bevelWidth * 0.7),
          Math.max(0.012, bevelDepth * 0.45),
        ),
        faceMaterial(color, faceTexture, profile.finishSheen, "panel", profile.grainDirection),
      );
      sticking.position.z = bevelDepth * 0.72;
      sticking.userData = { profiledSticking: true, insideEdgeProfile: profile.insideEdgeProfile };
      frame.add(sticking);
    }
  }

  group.add(frame);
  return applyStyleGrain();
}

export function disposeObject(object: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    // Outline edges are line segments: free their geometry and material too.
    if (!mesh.isMesh && !(child as unknown as { isLine?: boolean }).isLine) return;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      const mapped = material as THREE.MeshStandardMaterial;
      if (mapped.map) textures.add(mapped.map);
      material.dispose();
    }
  });
  textures.forEach((texture) => texture.dispose());
}

/** Shown on a preview tile whose picture is a flat, near-white image. */
export const BLANK_PHOTO_MESSAGE = "This approved picture is a blank render; re-approve or make a Gemini picture.";

/**
 * True when RGBA pixels are one flat, near-white color: every channel averages 225 or more and the
 * brightness barely varies. A real door picture, even a white one, has shading and grain.
 */
export function isBlankPhotoReading(rgba: ArrayLike<number>): boolean {
  const count = Math.floor(rgba.length / 4);
  if (count === 0) return false;
  const sum = [0, 0, 0];
  let lumSum = 0;
  let lumSquares = 0;
  for (let i = 0; i < count; i += 1) {
    const r = rgba[i * 4]!;
    const g = rgba[i * 4 + 1]!;
    const b = rgba[i * 4 + 2]!;
    sum[0]! += r;
    sum[1]! += g;
    sum[2]! += b;
    const lum = (r + g + b) / 3;
    lumSum += lum;
    lumSquares += lum * lum;
  }
  const mean = lumSum / count;
  const deviation = Math.sqrt(Math.max(0, lumSquares / count - mean * mean));
  return sum.every((channel) => channel / count >= 225) && deviation < 1.5;
}

function textureLooksBlank(texture: THREE.Texture): boolean {
  const image = texture.image as CanvasImageSource & { width?: number; height?: number } | undefined;
  if (!image?.width || !image.height || typeof document === "undefined") return false;
  const probe = document.createElement("canvas");
  probe.width = 32;
  probe.height = 32;
  const context = probe.getContext("2d");
  if (!context) return false;
  context.drawImage(image, 0, 0, 32, 32);
  return isBlankPhotoReading(context.getImageData(0, 0, 32, 32).data);
}

export type LoadSampleTextureOptions = {
  /** Previews only: refuse a flat near-white picture with BLANK_PHOTO_MESSAGE. The Designer never sets this. */
  rejectBlank?: boolean;
};

export function loadSampleTexture(url: string, options: LoadSampleTextureOptions = {}): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    let settled = false;
    const finish = (error?: Error, texture?: THREE.Texture) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (error || !texture) reject(error ?? new Error("Could not load the sample photo for this door."));
      else resolve(texture);
    };
    const timer = window.setTimeout(() => {
      finish(new Error("The sample photo took too long to load for this door."));
    }, 15_000);
    loader.load(
      url,
      (texture) => {
        const cropped = cropAuditSampleToPanelGrain(configureDoorAuditSampleTexture(texture, url));
        if (options.rejectBlank && textureLooksBlank(cropped)) {
          cropped.dispose();
          finish(new Error(BLANK_PHOTO_MESSAGE));
          return;
        }
        finish(undefined, cropped);
      },
      undefined,
      () => finish(new Error("Could not load the sample photo for this door. The image may be blocking a canvas export.")),
    );
  });
}

export type DoorAuditCapture = {
  capture: (input: DoorAuditRenderInput) => Promise<{ base64: string; width: number; height: number }>;
  dispose: () => void;
};

export function createDoorAuditCapture(): DoorAuditCapture {
  if (typeof document === "undefined") {
    throw new Error("Door renders are captured in the admin browser.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = DOOR_AUDIT_CAPTURE.widthPx;
  canvas.height = DOOR_AUDIT_CAPTURE.heightPx;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  } catch {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true });
  }
  renderer.setPixelRatio(DOOR_AUDIT_CAPTURE.pixelRatio);
  renderer.setSize(DOOR_AUDIT_CAPTURE.widthPx, DOOR_AUDIT_CAPTURE.heightPx, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = DOOR_AUDIT_LIGHTS.exposure;
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(DOOR_AUDIT_LIGHTS.background);
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = DOOR_AUDIT_LIGHTS.environment;

  const hemi = new THREE.HemisphereLight(
    DOOR_AUDIT_LIGHTS.hemisphere.sky,
    DOOR_AUDIT_LIGHTS.hemisphere.ground,
    DOOR_AUDIT_LIGHTS.hemisphere.intensity,
  );
  scene.add(hemi);
  const key = new THREE.DirectionalLight(DOOR_AUDIT_LIGHTS.key.color, DOOR_AUDIT_LIGHTS.key.intensity);
  key.position.set(...DOOR_AUDIT_LIGHTS.key.position);
  key.castShadow = false;
  scene.add(key);
  const fill = new THREE.DirectionalLight(DOOR_AUDIT_LIGHTS.fill.color, DOOR_AUDIT_LIGHTS.fill.intensity);
  fill.position.set(...DOOR_AUDIT_LIGHTS.fill.position);
  scene.add(fill);

  const applyLights = (lights: DoorLightRig) => {
    renderer.toneMappingExposure = lights.exposure;
    scene.background = new THREE.Color(lights.background);
    scene.environmentIntensity = lights.environment;
    hemi.color.set(lights.hemisphere.sky);
    hemi.groundColor.set(lights.hemisphere.ground);
    hemi.intensity = lights.hemisphere.intensity;
    key.color.set(lights.key.color);
    key.intensity = lights.key.intensity;
    key.position.set(lights.key.position[0], lights.key.position[1], lights.key.position[2]);
    fill.color.set(lights.fill.color);
    fill.intensity = lights.fill.intensity;
    fill.position.set(lights.fill.position[0], lights.fill.position[1], lights.fill.position[2]);
  };

  const bounds = auditDoorCameraBounds();
  const camera = new THREE.OrthographicCamera(bounds.left, bounds.right, bounds.top, bounds.bottom, bounds.near, bounds.far);
  camera.position.set(...bounds.position);
  camera.lookAt(...bounds.lookAt);

  let current: THREE.Object3D | null = null;

  return {
    async capture(input) {
      if (current) {
        scene.remove(current);
        disposeObject(current);
        current = null;
      }
      const appearance = resolveDoorStyleAppearance(input);
      const lights = doorLightsForFinish(appearance.finishHex, input.renderExposure ?? null);
      applyLights(lights);
      const measurePatch = async (hex: string) => {
        const material = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.55, metalness: 0.02 });
        const patch = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), material);
        patch.position.z = 0.05;
        scene.add(patch);
        renderer.render(scene, camera);
        const measured = hexFromCanvas(renderer.domElement);
        scene.remove(patch);
        material.dispose();
        patch.geometry.dispose();
        return measured;
      };
      const gateInput = {
        baseHex: appearance.finishHex,
        renderHex: input.renderHex,
        threshold: input.colorDeltaEMax ?? null,
        measure: measurePatch,
      };
      // Best effort (previews): paint as close to the picked color as the lights allow, never refuse.
      const gate = input.bestEffortColor ? await runBestEffortColorGate(gateInput) : await runColorGate(gateInput);
      if (gate.status !== "pass" && !input.bestEffortColor) throw new ColorGateBlock(gate);
      const texture = input.samplePhotoUrl && !input.needsDoorOnlyPhoto ? await loadSampleTexture(input.samplePhotoUrl) : null;
      const door = buildAuditDoor({ ...input, renderHex: gate.hex, color: gate.hex }, texture);
      scene.add(door);
      current = door;
      renderer.render(scene, camera);
      renderer.render(scene, camera);
      const dataUrl = renderer.domElement.toDataURL("image/png");
      const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      if (!base64 || base64.length < 32) {
        throw new Error("The door render produced an empty image.");
      }
      return {
        base64,
        width: DOOR_AUDIT_CAPTURE.widthPx,
        height: DOOR_AUDIT_CAPTURE.heightPx,
      };
    },
    dispose() {
      if (current) {
        scene.remove(current);
        disposeObject(current);
        current = null;
      }
      environment.texture.dispose();
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
