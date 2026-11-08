import * as THREE from "three";
import { ellipticalSinkBowlGeometry, recessedSinkBowlGeometry } from "@/components/design/InteractiveRoom3D";

/**
 * Renders the two bowl geometries the designer can draw, from directly above, with
 * a fixed orthographic camera. PL-3608 is a round basin; its bowl must be an
 * ellipse, not the rounded rectangle that every basin used to be.
 */

const W = 16.5 / 12; // published PL-3608 interior width
const D = 13.5 / 12; // published interior depth
const H = 3.5 / 12;  // published interior height

function draw(canvas: HTMLCanvasElement, geometry: THREE.BufferGeometry, tint: number) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(2);
  const size = 620;
  renderer.setSize(size, size, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#12171d");

  const span = Math.max(W, D) * 1.55;
  const camera = new THREE.OrthographicCamera(-span / 2, span / 2, span / 2, -span / 2, 0.01, 50);
  camera.position.set(0, 6, 0.0001);
  camera.lookAt(0, 0, 0);

  // China, lit so the taper of the wall is visible.
  const china = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(tint),
    roughness: 0.06,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    side: THREE.DoubleSide,
  });
  const bowl = new THREE.Mesh(geometry, china);
  scene.add(bowl);

  // A countertop deck, built as a RING around the opening so the bowl is visible
  // through it from above. A solid slab simply hid the bowl.
  const deckMaterial = new THREE.MeshPhysicalMaterial({ color: "#dfe3e7", roughness: 0.35, clearcoat: 0.3 });
  const outerX = W * 1.35;
  const outerZ = D * 1.45;
  const holeX = W / 2;
  const holeZ = D / 2;
  const deckShape = new THREE.Shape();
  deckShape.moveTo(-outerX, -outerZ);
  deckShape.lineTo(outerX, -outerZ);
  deckShape.lineTo(outerX, outerZ);
  deckShape.lineTo(-outerX, outerZ);
  deckShape.lineTo(-outerX, -outerZ);
  const hole = new THREE.Path();
  if (geometry.userData.ellipticalSinkBowl) {
    hole.absellipse(0, 0, holeX, holeZ, 0, Math.PI * 2, true);
  } else {
    hole.moveTo(-holeX, -holeZ);
    hole.lineTo(-holeX, holeZ);
    hole.lineTo(holeX, holeZ);
    hole.lineTo(holeX, -holeZ);
    hole.lineTo(-holeX, -holeZ);
  }
  deckShape.holes.push(hole);
  const deckGeometry = new THREE.ExtrudeGeometry(deckShape, { depth: 0.06, bevelEnabled: false });
  const deck = new THREE.Mesh(deckGeometry, deckMaterial);
  // The extrude runs along +Z; lay it flat and put its top face at y = 0.
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = 0.06;
  scene.add(deck);

  scene.add(new THREE.AmbientLight("#ffffff", 0.55));
  const key = new THREE.DirectionalLight("#fff8f0", 2.4);
  key.position.set(-2.2, 5, 2.6);
  scene.add(key);
  const fill = new THREE.DirectionalLight("#dce9f5", 0.9);
  fill.position.set(2.6, 3.5, -1.8);
  scene.add(fill);

  renderer.render(scene, camera);
  renderer.dispose();
}

const root = document.getElementById("root")!;
root.innerHTML = `
  <h1>PL-3608 basin — the bowl the designer now draws</h1>
  <p>
    PL-3608's specification sheet states <b>Circular Basin</b> and interior 16 ½″ × 13 ½″ × 3 ½″.
    Left: the ellipse the renderer builds from that shape. Right: the rounded rectangle it used to
    build for <i>every</i> vanity basin, which is what put a rectangular sink under a round product.
    Both are the same published measurements; only the plan shape differs.
  </p>
  <div class="row">
    <div class="cell">
      <div class="cap">Ellipse — what PL-3608 draws now</div>
      <canvas id="ellipse"></canvas>
      <div class="sub">Rim and countertop opening are elliptical, matching the round product photo.</div>
    </div>
    <div class="cell">
      <div class="cap">Rounded rectangle — the old, shape-blind bowl</div>
      <canvas id="rect"></canvas>
      <div class="sub">Same width and depth, but square corners: the bug the shopper reported.</div>
    </div>
  </div>
`;

draw(document.getElementById("ellipse") as HTMLCanvasElement, ellipticalSinkBowlGeometry(W, D, H, 96), 0xf7f8f6);
draw(document.getElementById("rect") as HTMLCanvasElement, recessedSinkBowlGeometry(W, D, H, 0.12), 0xf7f8f6);

document.body.dataset.proofReady = "yes";
