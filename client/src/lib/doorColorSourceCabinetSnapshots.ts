/**
 * Cabinet snapshots for the four door color source tiles.
 *
 * Each tile (Original image, Approved AI, Sherwin-Williams, Hex) shows a small cabinet
 * painted the way that source would paint it: a base cabinet (drawer over door) or a wall
 * cabinet (one door), in a three-quarter view. All four come from ONE offscreen WebGL
 * renderer that draws the tiles one after another and hands back a PNG data URL for each,
 * so the editor never holds four WebGL contexts at once.
 *
 * The fronts are the same doors the audit capture builds (`buildAuditDoor`), with the
 * shaker generic image's outline switched on so a flat Sherwin-Williams or hex color still
 * reads as a shaker: edge lines on the rails and stiles, a recessed center panel, and a
 * soft shadow along the opening. Colors are best effort: the paint is nudged toward the
 * picked hex under these lights, and a miss never refuses the picture.
 *
 * Nothing here talks to the network except loading the tile's own photo, and nothing is
 * written anywhere.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildAuditDoor, disposeObject, loadSampleTexture } from "@/lib/doorAuditDoorRender";
import { DOOR_AUDIT_LIGHTS, type DoorAuditRenderInput } from "@/lib/doorRenderingAudit";
import { resolveDoorStyleAppearance } from "@/lib/doorStyleAppearance";
import { hexFromCanvas } from "@/lib/doorColorProbe";
import { runBestEffortColorGate } from "@shared/colorGate";
import { doorLightsForFinish, type DoorLightRig } from "@shared/doorRenderLights";

export type SnapshotCabinetKind = "base" | "wall";

const INCH = 1 / 12;

export const CABINET_SNAPSHOT = {
  widthPx: 360,
  heightPx: 440,
  pixelRatio: 2,
  /** Turn toward the camera's right, so the left side of the box shows. */
  yaw: 0.55,
  /** Camera height above the cabinet's middle, in feet: a slight look down. */
  cameraRise: 0.9,
  /** The orthographic frame is this multiple of the cabinet height. */
  margin: 1.22,
  doorThicknessIn: 0.75,
  gapIn: 0.25,
  base: { widthIn: 18, boxHeightIn: 30.5, depthIn: 24, toeKickIn: 4, drawerIn: 5.75, counterIn: 1.25 },
  wall: { widthIn: 18, boxHeightIn: 30, depthIn: 12 },
} as const;

/** Total height of the drawn cabinet in inches (base includes toe kick and countertop). */
export function cabinetSnapshotHeightIn(kind: SnapshotCabinetKind): number {
  const { base, wall } = CABINET_SNAPSHOT;
  return kind === "base" ? base.toeKickIn + base.boxHeightIn + base.counterIn : wall.boxHeightIn;
}

/** The front pieces a cabinet kind carries, in inches: width, height and the y of its center above the floor. */
export function cabinetFrontLayout(kind: SnapshotCabinetKind): Array<{ role: "drawer" | "door"; widthIn: number; heightIn: number; centerYIn: number }> {
  const { base, wall, gapIn } = CABINET_SNAPSHOT;
  if (kind === "wall") {
    return [{ role: "door", widthIn: wall.widthIn - gapIn * 2, heightIn: wall.boxHeightIn - gapIn * 2, centerYIn: wall.boxHeightIn / 2 }];
  }
  const width = base.widthIn - gapIn * 2;
  const top = base.toeKickIn + base.boxHeightIn - gapIn;
  const drawerBottom = top - base.drawerIn;
  const doorTop = drawerBottom - gapIn;
  const doorBottom = base.toeKickIn + gapIn;
  return [
    { role: "drawer", widthIn: width, heightIn: base.drawerIn, centerYIn: (top + drawerBottom) / 2 },
    { role: "door", widthIn: width, heightIn: doorTop - doorBottom, centerYIn: (doorTop + doorBottom) / 2 },
  ];
}

function buildCabinet(
  kind: SnapshotCabinetKind,
  input: DoorAuditRenderInput,
  texture: THREE.Texture | null,
  finishHex: string,
): THREE.Group {
  const { base, wall, doorThicknessIn } = CABINET_SNAPSHOT;
  const spec = kind === "base" ? base : wall;
  const totalIn = cabinetSnapshotHeightIn(kind);
  const group = new THREE.Group();
  group.userData = { cabinetSnapshot: kind };
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: finishHex, roughness: 0.62, metalness: 0.02 });
  const toeKickIn = kind === "base" ? base.toeKickIn : 0;
  const boxHeightIn = spec.boxHeightIn;
  const boxCenterY = (toeKickIn + boxHeightIn / 2 - totalIn / 2) * INCH;
  const box = new THREE.Mesh(new THREE.BoxGeometry(spec.widthIn * INCH, boxHeightIn * INCH, spec.depthIn * INCH), bodyMaterial);
  box.position.set(0, boxCenterY, 0);
  box.userData = { cabinetBox: true };
  group.add(box);
  if (kind === "base") {
    const kick = new THREE.Mesh(
      new THREE.BoxGeometry((base.widthIn - 1) * INCH, base.toeKickIn * INCH, (base.depthIn - 3) * INCH),
      new THREE.MeshStandardMaterial({ color: "#2b2b2b", roughness: 0.9 }),
    );
    kick.position.set(0, (base.toeKickIn / 2 - totalIn / 2) * INCH, -1.5 * INCH);
    group.add(kick);
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry((base.widthIn + 0.75) * INCH, base.counterIn * INCH, (base.depthIn + 1) * INCH),
      new THREE.MeshStandardMaterial({ color: "#3d4245", roughness: 0.45, metalness: 0.05 }),
    );
    counter.position.set(0, (totalIn - base.counterIn / 2 - totalIn / 2) * INCH, 0.5 * INCH);
    group.add(counter);
  }
  for (const front of cabinetFrontLayout(kind)) {
    const door = buildAuditDoor(
      { ...input, renderHex: finishHex, color: finishHex },
      texture,
      { size: { widthIn: front.widthIn, heightIn: front.heightIn }, outline: true },
    );
    door.position.set(0, (front.centerYIn - totalIn / 2) * INCH, (spec.depthIn / 2 + doorThicknessIn / 2) * INCH);
    door.userData = { ...door.userData, cabinetFront: front.role };
    group.add(door);
  }
  group.rotation.y = CABINET_SNAPSHOT.yaw;
  return group;
}

export type CabinetSnapshotSession = {
  /** One PNG data URL of the cabinet painted for this input. Rejects when this one picture cannot be made. */
  snapshot: (input: DoorAuditRenderInput, kind: SnapshotCabinetKind) => Promise<string>;
  dispose: () => void;
};

/** One shared offscreen renderer. Call `snapshot` one tile at a time, then `dispose` once. */
export function createCabinetSnapshotSession(): CabinetSnapshotSession {
  if (typeof document === "undefined") {
    throw new Error("Cabinet snapshots are drawn in the admin browser.");
  }
  const { widthPx, heightPx, pixelRatio } = CABINET_SNAPSHOT;
  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = heightPx;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  } catch {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true });
  }
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(widthPx, heightPx, false);
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
  const hemi = new THREE.HemisphereLight(DOOR_AUDIT_LIGHTS.hemisphere.sky, DOOR_AUDIT_LIGHTS.hemisphere.ground, DOOR_AUDIT_LIGHTS.hemisphere.intensity);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(DOOR_AUDIT_LIGHTS.key.color, DOOR_AUDIT_LIGHTS.key.intensity);
  key.castShadow = false;
  scene.add(key);
  const fill = new THREE.DirectionalLight(DOOR_AUDIT_LIGHTS.fill.color, DOOR_AUDIT_LIGHTS.fill.intensity);
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

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 30);
  const frameCamera = (kind: SnapshotCabinetKind) => {
    const height = cabinetSnapshotHeightIn(kind) * INCH * CABINET_SNAPSHOT.margin;
    const width = height * (widthPx / heightPx);
    camera.left = -width / 2;
    camera.right = width / 2;
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.updateProjectionMatrix();
    camera.position.set(0, CABINET_SNAPSHOT.cameraRise, 6);
    camera.lookAt(0, 0, 0);
  };

  let current: THREE.Object3D | null = null;
  let disposed = false;

  return {
    async snapshot(input, kind) {
      if (disposed) throw new Error("The cabinet renderer was already closed.");
      if (current) {
        scene.remove(current);
        disposeObject(current);
        current = null;
      }
      frameCamera(kind);
      const appearance = resolveDoorStyleAppearance(input);
      applyLights(doorLightsForFinish(appearance.finishHex, input.renderExposure ?? null));
      const measurePatch = async (hex: string) => {
        const material = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.55, metalness: 0.02 });
        const patch = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), material);
        patch.position.z = 0.05;
        // Turned like the cabinet front, so the lights hit the patch the way they hit the door.
        patch.rotation.y = CABINET_SNAPSHOT.yaw;
        scene.add(patch);
        renderer.render(scene, camera);
        const measured = hexFromCanvas(renderer.domElement);
        scene.remove(patch);
        material.dispose();
        patch.geometry.dispose();
        return measured;
      };
      // Best effort: the closest color the lights allow, never a refusal.
      const gate = await runBestEffortColorGate({
        baseHex: appearance.finishHex,
        renderHex: input.renderHex,
        threshold: input.colorDeltaEMax ?? null,
        measure: measurePatch,
      });
      const texture = input.samplePhotoUrl && !input.needsDoorOnlyPhoto ? await loadSampleTexture(input.samplePhotoUrl) : null;
      if (disposed) {
        texture?.dispose();
        throw new Error("The cabinet renderer was closed.");
      }
      const cabinet = buildCabinet(kind, input, texture, gate.hex);
      scene.add(cabinet);
      current = cabinet;
      renderer.render(scene, camera);
      renderer.render(scene, camera);
      const dataUrl = renderer.domElement.toDataURL("image/png");
      if (!dataUrl || dataUrl.length < 64) throw new Error("The cabinet render produced an empty image.");
      return dataUrl;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
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

export type CabinetSnapshotJob = {
  key: string;
  input: DoorAuditRenderInput;
};

export type CabinetSnapshotResult = { url: string } | { error: string };

/**
 * Draw the jobs one after another on one shared renderer. A job that fails reports its own
 * error and the rest still run. `isCancelled` stops the run between tiles.
 */
export async function snapshotCabinets(
  jobs: readonly CabinetSnapshotJob[],
  kind: SnapshotCabinetKind,
  onResult: (key: string, result: CabinetSnapshotResult) => void,
  isCancelled: () => boolean = () => false,
  makeSession: () => CabinetSnapshotSession = createCabinetSnapshotSession,
): Promise<void> {
  if (jobs.length === 0) return;
  let session: CabinetSnapshotSession;
  try {
    session = makeSession();
  } catch (error) {
    const message = error instanceof Error && error.message.trim() ? error.message.trim() : "The cabinet render could not be created in this browser.";
    for (const job of jobs) onResult(job.key, { error: message });
    return;
  }
  try {
    for (const job of jobs) {
      if (isCancelled()) break;
      try {
        onResult(job.key, { url: await session.snapshot(job.input, kind) });
      } catch (error) {
        const message = error instanceof Error && error.message.trim() ? error.message.trim() : "This cabinet picture could not be drawn.";
        onResult(job.key, { error: message });
      }
    }
  } finally {
    session.dispose();
  }
}
