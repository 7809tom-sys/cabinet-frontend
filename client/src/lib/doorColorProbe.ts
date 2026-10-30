/**
 * Flat color patch under the door studio lights. The audit and the Designer
 * both measure this patch before trusting a door color.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { DoorLightRig } from "@shared/doorRenderLights";

function averageHex(data: Uint8ClampedArray): string {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let index = 0; index < data.length; index += 4) {
    r += data[index] ?? 0;
    g += data[index + 1] ?? 0;
    b += data[index + 2] ?? 0;
    count += 1;
  }
  const safe = Math.max(1, count);
  const channel = (value: number) => Math.min(255, Math.max(0, Math.round(value / safe))).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** Read the center of an already-rendered canvas. */
export function hexFromCanvas(canvas: HTMLCanvasElement): string {
  const probe = document.createElement("canvas");
  probe.width = 8;
  probe.height = 8;
  const context = probe.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("The color patch could not be read.");
  const size = Math.min(canvas.width, canvas.height);
  const crop = Math.max(4, Math.round(size * 0.25));
  context.drawImage(
    canvas,
    Math.round((canvas.width - crop) / 2),
    Math.round((canvas.height - crop) / 2),
    crop,
    crop,
    0,
    0,
    8,
    8,
  );
  return averageHex(context.getImageData(0, 0, 8, 8).data);
}

/**
 * Render one untextured square under `lights` and return the tone-mapped hex.
 * The caller owns retries. This renderer is thrown away after the read.
 */
export async function probeFlatPatchHex(lights: DoorLightRig, hex: string): Promise<string> {
  if (typeof document === "undefined") throw new Error("Color patches are measured in the browser.");
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true });
  renderer.setSize(64, 64, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = lights.exposure;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(lights.background);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = lights.environment;
  scene.add(new THREE.HemisphereLight(lights.hemisphere.sky, lights.hemisphere.ground, lights.hemisphere.intensity));
  const key = new THREE.DirectionalLight(lights.key.color, lights.key.intensity);
  key.position.set(lights.key.position[0], lights.key.position[1], lights.key.position[2]);
  scene.add(key);
  const fill = new THREE.DirectionalLight(lights.fill.color, lights.fill.intensity);
  fill.position.set(lights.fill.position[0], lights.fill.position[1], lights.fill.position[2]);
  scene.add(fill);
  const material = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.55, metalness: 0.02 });
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(patch);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.set(0, 0, 2);
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
  const measured = hexFromCanvas(renderer.domElement);
  material.dispose();
  patch.geometry.dispose();
  environment.texture.dispose();
  environment.dispose();
  pmrem.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return measured;
}
