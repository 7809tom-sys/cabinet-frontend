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
import { resolveDoorStyleAppearance } from "@/lib/doorStyleAppearance";
import { RAISED_PANEL_BEVEL_DEPTH_IN, RAISED_PANEL_BEVEL_WIDTH_IN } from "@shared/doorStyleAppearance";
import { applyThreeDCabinetPieceGrain } from "@/lib/woodGrainVariation";

const INCH = 1 / 12;

export type AuditDoorKind = "flat" | "shaker" | "raised" | "glass";

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
export function auditDoorConstruction(profile: DoorAuditDoorProfile | ThreeDDoorProfile | null | undefined): AuditDoorConstruction {
  const door = toProfile(profile);
  const kind = auditDoorKind(door);
  const widthFt = DOOR_AUDIT_CAPTURE.doorWidthIn * INCH;
  const heightFt = DOOR_AUDIT_CAPTURE.doorHeightIn * INCH;
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
    const bevelDepthFt = Math.max(0.012, Math.min(
      Number.isFinite(requestedBevelDepth) && requestedBevelDepth > 0 ? requestedBevelDepth * INCH : RAISED_PANEL_BEVEL_DEPTH_IN * INCH,
      0.07,
    ));
    bevelWidthIn = bevelWidthFt / INCH;
    bevelDepthIn = bevelDepthFt / INCH;
  }
  return {
    kind: framed || kind === "flat" ? kind : "flat",
    framed,
    widthIn: DOOR_AUDIT_CAPTURE.doorWidthIn,
    heightIn: DOOR_AUDIT_CAPTURE.doorHeightIn,
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
    envMapIntensity: 0.2,
  });
  material.userData = { grainPiece: piece };
  return material;
}

export function buildAuditDoor(
  input: (Pick<DoorAuditRenderInput, "color" | "samplePhotoUrl" | "name" | "code" | "distributorName" | "distributorCode" | "finish" | "woodSpecies"> & {
    doorProfile?: DoorAuditDoorProfile | null;
    ourName?: string | null;
    styleCode?: string | null;
    styleId?: number | null;
  }) | null | undefined,
  texture: THREE.Texture | null,
): THREE.Group {
  if (!input?.doorProfile) {
    const label = input?.name?.trim() || "This door";
    throw new Error(`${label} is missing its door profile, so it cannot be rendered.`);
  }
  const appearance = resolveDoorStyleAppearance(input);
  const profile = appearance.profile;
  const plan = auditDoorConstruction(profile);
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
    slab.castShadow = true;
    slab.receiveShadow = true;
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
  const railDepth = 0.026;
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
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { physicalRail: true, grainPiece: piece };
    frame.add(mesh);
  }

  if (plan.kind === "raised" && plan.bevelWidthIn != null && plan.bevelDepthIn != null) {
    const bevelWidth = plan.bevelWidthIn * INCH;
    const bevelDepth = plan.bevelDepthIn * INCH;
    const bevelOuterWidth = Math.max(0.06, width - stile * 2);
    const bevelOuterHeight = Math.max(0.06, height - rail * 2);
    const panelWidth = Math.max(0.04, bevelOuterWidth - bevelWidth * 2);
    const panelHeight = Math.max(0.04, bevelOuterHeight - bevelWidth * 2);
    const shadow = new THREE.MeshStandardMaterial({ color: "#1c1814", roughness: 0.78, metalness: 0.02, transparent: true, opacity: 0.52 });
    const recessed = new THREE.Mesh(new THREE.BoxGeometry(bevelOuterWidth, bevelOuterHeight, 0.008), shadow);
    recessed.position.z = -0.012;
    recessed.userData = { raisedPanelRecess: true };
    frame.add(recessed);
    const bevel = new THREE.Mesh(
      new THREE.BoxGeometry(bevelOuterWidth - 0.006, bevelOuterHeight - 0.006, Math.max(0.018, bevelDepth * 0.62)),
      faceMaterial(color, faceTexture, profile.finishSheen, "panel", profile.grainDirection),
    );
    bevel.position.z = bevelDepth * 0.31;
    bevel.userData = { raisedPanelBevel: true, insideEdgeProfile: profile.insideEdgeProfile ?? "bevel" };
    frame.add(bevel);
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
    const center = new THREE.Mesh(
      new THREE.BoxGeometry(panelWidth, panelHeight, Math.max(0.02, bevelDepth)),
      faceMaterial(color, faceTexture, profile.finishSheen, "panel", profile.grainDirection),
    );
    center.position.z = bevelDepth;
    center.castShadow = true;
    center.receiveShadow = true;
    center.userData = { raisedCenterPanel: true, panelConstruction: "raised" };
    frame.add(center);
  }

  group.add(frame);
  return applyStyleGrain();
}

function disposeObject(object: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
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

function loadSampleTexture(url: string): Promise<THREE.Texture> {
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
      (texture) => finish(undefined, cropAuditSampleToPanelGrain(configureDoorAuditSampleTexture(texture, url))),
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
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(DOOR_AUDIT_LIGHTS.background);
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = DOOR_AUDIT_LIGHTS.environment;

  scene.add(new THREE.HemisphereLight(
    DOOR_AUDIT_LIGHTS.hemisphere.sky,
    DOOR_AUDIT_LIGHTS.hemisphere.ground,
    DOOR_AUDIT_LIGHTS.hemisphere.intensity,
  ));
  const key = new THREE.DirectionalLight(DOOR_AUDIT_LIGHTS.key.color, DOOR_AUDIT_LIGHTS.key.intensity);
  key.position.set(...DOOR_AUDIT_LIGHTS.key.position);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  const shadowCamera = key.shadow.camera as THREE.OrthographicCamera;
  shadowCamera.near = 0.1;
  shadowCamera.far = 8;
  shadowCamera.left = -2;
  shadowCamera.right = 2;
  shadowCamera.top = 2;
  shadowCamera.bottom = -2;
  shadowCamera.updateProjectionMatrix();
  key.shadow.bias = -0.00015;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  const fill = new THREE.DirectionalLight(DOOR_AUDIT_LIGHTS.fill.color, DOOR_AUDIT_LIGHTS.fill.intensity);
  fill.position.set(...DOOR_AUDIT_LIGHTS.fill.position);
  scene.add(fill);

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
      const texture = input.samplePhotoUrl && !input.needsDoorOnlyPhoto ? await loadSampleTexture(input.samplePhotoUrl) : null;
      const door = buildAuditDoor(input, texture);
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
