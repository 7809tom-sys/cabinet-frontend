import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { StudioDesign, StudioKind, StudioWall } from "@/lib/vendorClosetStudio";
import { STUDIO_CORNER_SHELF_THICKNESS_IN, STUDIO_ILLUSTRATIVE_SHOE_PITCH_DEG, studioBasketPlacementsForWall, studioBayCut, studioBays, studioCornerPlanningFootprint, studioCornerShelvesForWall, studioFixedBottom, studioFixedTop, studioPanelHeight, studioTowerFootprint, studioWidth } from "@/lib/vendorClosetStudio";

const IN = 1 / 12;
const MAT: Record<StudioDesign["finish"], { face: string; edge: string; grain: string }> = {
  "Glacier White": { face: "#f1f0eb", edge: "#c4c0b8", grain: "#c8c4bc" },
  "Slate Rift": { face: "#555553", edge: "#343434", grain: "#797874" },
  "Spiced Mahogany": { face: "#774d3a", edge: "#4c291f", grain: "#9a7255" },
};

function woodTexture(finish: StudioDesign["finish"]) {
  const c = document.createElement("canvas"); c.width = 128; c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = MAT[finish].face; ctx.fillRect(0, 0, 128, 128);
  ctx.globalAlpha = finish === "Glacier White" ? 0.11 : 0.14;
  for (let line = 0; line < 45; line++) {
    const x = (line * 67 + 13) % 128;
    ctx.strokeStyle = MAT[finish].grain; ctx.lineWidth = line % 7 === 0 ? 1.2 : 0.35;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + (line % 3) - 1, 38, x - (line % 5), 78, x + (line % 4), 128); ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4; return texture;
}

/** This scene is completely independent of InteractiveRoom3D and kitchen/Wall Builder geometry. */
export function VendorClosetScene({ design, selectedBay, selectedCornerId = null, partToPlace, onSelectBay, onPlace, onError }: {
  design: StudioDesign;
  selectedBay: number;
  selectedCornerId?: string | null;
  partToPlace: StudioKind | null;
  onSelectBay: (bayIndex: number) => void;
  onPlace: (bayIndex: number, bottomIn: number, kind: StudioKind) => void;
  onError: (message: string) => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const handlers = useRef({ onSelectBay, onPlace, onError, partToPlace });
  handlers.current = { onSelectBay, onPlace, onError, partToPlace };
  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#e9e5db");
    const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 130);
    const visibleCornerShelves = studioCornerShelvesForWall(design);
    const hasCornerPlanning = visibleCornerShelves.length > 0;
    const cornerFocus = visibleCornerShelves.find((shelf) => shelf.id === selectedCornerId) ?? visibleCornerShelves[0] ?? null;
    const cornerFocusFootprint = cornerFocus ? studioCornerPlanningFootprint(design, cornerFocus) : null;
    const towerWidth = studioWidth(design) * IN;
    const w = hasCornerPlanning ? design.wallWidthIn * IN : towerWidth;
    const roomDepth = hasCornerPlanning ? design.roomDepthIn * IN : 12;
    if (cornerFocusFootprint) {
      const focusX = (cornerFocusFootprint.xMin + cornerFocusFootprint.xMax) / 2 * IN;
      const focusZ = (cornerFocusFootprint.zMin + cornerFocusFootprint.zMax) / 2 * IN;
      camera.position.set(w * 0.42, Math.max(9, Math.max(w, roomDepth) * 0.92), Math.max(roomDepth * 1.28, focusZ + 8));
      camera.lookAt(focusX, (cornerFocus.elevationIn + 3) * IN, focusZ);
    } else camera.position.set(w * 0.63, 5.7, Math.max(12, Math.max(w, roomDepth) * 2.3));
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.6;
    renderer.domElement.dataset.testid = "vendor-closet-canvas";
    renderer.domElement.setAttribute("aria-label", "Interactive vendor closet scene: drag a part into a tower, or choose a part and tap a tower");
    renderer.domElement.tabIndex = 0;
    host.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.52;
    controls.minDistance = 4.3;
    controls.maxDistance = 26;
    controls.target.set(cornerFocusFootprint ? (cornerFocusFootprint.xMin + cornerFocusFootprint.xMax) / 2 * IN : w / 2, cornerFocus ? (cornerFocus.elevationIn + 3) * IN : 3.6, cornerFocusFootprint ? (cornerFocusFootprint.zMin + cornerFocusFootprint.zMax) / 2 * IN : hasCornerPlanning ? roomDepth / 2 : 0);
    controls.update();

    scene.add(new THREE.HemisphereLight(0xfff6e8, 0xa9a2a0, 2.1));
    const windowLight = new THREE.DirectionalLight(0xfff5df, 3.9);
    windowLight.position.set(w / 2 + 1, 9, 7);
    windowLight.castShadow = true;
    windowLight.shadow.mapSize.set(2048, 2048);
    windowLight.shadow.camera.left = -14; windowLight.shadow.camera.right = 14;
    windowLight.shadow.camera.top = 14; windowLight.shadow.camera.bottom = -14;
    windowLight.shadow.bias = -0.0002;
    scene.add(windowLight);
    const fill = new THREE.DirectionalLight(0xe4ecff, 1.15);
    fill.position.set(-2, 4, -5); scene.add(fill);
    const room = new THREE.Group(); scene.add(room);
    const oak = new THREE.MeshStandardMaterial({ color: 0xb69a77, roughness: 0.78 });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(Math.max(17, w + 9), 0.13, Math.max(12, roomDepth + 4)), oak);
    floor.position.set(w / 2, -0.1, hasCornerPlanning ? roomDepth / 2 : 1.75); floor.receiveShadow = true; room.add(floor);
    const seamMaterial = new THREE.LineBasicMaterial({ color: 0x967d62, transparent: true, opacity: 0.35 });
    for (let z = -4; z <= (hasCornerPlanning ? roomDepth + 4 : 7); z += 0.44) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-9, -0.033, z), new THREE.Vector3(w + 9, -0.033, z)]), seamMaterial); room.add(line);
    }
    const wall = new THREE.Mesh(new THREE.BoxGeometry(Math.max(16, w + 4), 9, 0.14), new THREE.MeshStandardMaterial({ color: 0xf3eee5, roughness: 0.95 }));
    wall.position.set(w / 2, 4.35, -0.13); wall.receiveShadow = true; room.add(wall);
    const baseboard = new THREE.Mesh(new THREE.BoxGeometry(Math.max(16, w + 4), 0.23, 0.11), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82 }));
    baseboard.position.set(w / 2, 0.18, -0.02); baseboard.receiveShadow = true; room.add(baseboard);
    const palette = MAT[design.finish];
    const texture = woodTexture(design.finish);
    const boardMat = new THREE.MeshPhysicalMaterial({ color: palette.face, map: texture, roughness: 0.65, metalness: 0.02, clearcoat: 0.09, clearcoatRoughness: 0.65 });
    const edgeMat = new THREE.MeshStandardMaterial({ color: palette.edge, roughness: 0.75 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xb4b9b7, metalness: 0.75, roughness: 0.27 });
    const shoeMat = new THREE.MeshPhysicalMaterial({ color: palette.face, map: texture, roughness: 0.72 });
    const drawerMat = new THREE.MeshPhysicalMaterial({ color: palette.face, map: texture, roughness: 0.6 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xb9a37b, metalness: 0.7, roughness: 0.33 });
    const basketWireMat = new THREE.LineBasicMaterial({ color: 0x697b7c, transparent: true, opacity: 0.9 });
    const hintMat = new THREE.MeshBasicMaterial({ color: 0xb19056, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide });
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const parts = new THREE.Group(); scene.add(parts);
    const activeTowerParts = new THREE.Group(); parts.add(activeTowerParts);
    const targets: THREE.Mesh[] = [];
    const box = (width: number, height: number, depth: number, x: number, y: number, z: number, mat: THREE.Material, shadow = true) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width * IN, height * IN, depth * IN), mat);
      mesh.position.set(x * IN, y * IN, z * IN);
      mesh.castShadow = shadow; mesh.receiveShadow = true; activeTowerParts.add(mesh); return mesh;
    };
    const worldBox = (width: number, height: number, depth: number, x: number, y: number, z: number, mat: THREE.Material, shadow = true) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width * IN, height * IN, depth * IN), mat);
      mesh.position.set(x * IN, y * IN, z * IN);
      mesh.castShadow = shadow; mesh.receiveShadow = true; parts.add(mesh); return mesh;
    };
    const panelHeight = studioPanelHeight(design);
    const fixedBottom = studioFixedBottom(design);
    const fixedTop = studioFixedTop(design);
    const depth = 14.5;
    let cursor = 0;
    for (let index = 0; index < design.bays.length; index++) {
      const bay = design.bays[index];
      box(0.75, panelHeight, depth, cursor + 0.375, panelHeight / 2 + (design.mount === "hanging" ? 6 : 0), depth / 2, boardMat);
      box(bay.widthIn, 0.75, depth, cursor + 0.75 + bay.widthIn / 2, fixedBottom + 0.375 + (design.mount === "hanging" ? 6 : 0), depth / 2, boardMat);
      box(bay.widthIn, 0.75, depth, cursor + 0.75 + bay.widthIn / 2, fixedTop + 0.375 + (design.mount === "hanging" ? 6 : 0), depth / 2, boardMat);
      // Field-cut authority covers straight fixed/adjustable shelves only; no shortened cleat is implied.
      if (!studioBayCut(bay)) {
        const cleat = box(bay.widthIn, 5.5, 0.75, cursor + 0.75 + bay.widthIn / 2, panelHeight - 3 + (design.mount === "hanging" ? 6 : 0), -0.14, edgeMat, false);
        cleat.userData = { realSkuReference: true, hardwareShapeIllustrative: true };
      }
      const cx = cursor + 0.75 + bay.widthIn / 2;
      for (const item of bay.items) {
        const bottom = item.bottomIn + (design.mount === "hanging" ? 6 : 0);
        if (item.kind === "shelf") box(bay.widthIn, 0.75, depth, cx, bottom + 0.375, depth / 2, boardMat);
        else if (item.kind === "shoe") {
          // The front low edge stays at the selected elevation. This owner-approved pitch is illustrative, not a supplier fit/attachment claim.
          const shoeDepth = depth * 0.94;
          const shoePitchRad = STUDIO_ILLUSTRATIVE_SHOE_PITCH_DEG * Math.PI / 180;
          const shoeGroup = new THREE.Group();
          shoeGroup.position.set(cx * IN, bottom * IN, depth * IN);
          shoeGroup.rotation.x = shoePitchRad;
          shoeGroup.userData = { illustrativePitchDeg: STUDIO_ILLUSTRATIVE_SHOE_PITCH_DEG, sourcedShelfThicknessIn: 0.75, supplierFitToVerify: true };

          const shoeBoard = new THREE.Mesh(new THREE.BoxGeometry(bay.widthIn * IN, 0.75 * IN, shoeDepth * IN), shoeMat);
          shoeBoard.position.set(0, 0.375 * IN, -shoeDepth / 2 * IN);
          shoeBoard.castShadow = true; shoeBoard.receiveShadow = true;
          shoeBoard.userData = { illustrativePitchDeg: STUDIO_ILLUSTRATIVE_SHOE_PITCH_DEG, sourcedShelfThicknessIn: 0.75, visualGeometryIllustrative: true };
          shoeGroup.add(shoeBoard);

          const shoeFence = new THREE.Mesh(new THREE.BoxGeometry((bay.widthIn - 0.4) * IN, 0.16 * IN, 0.16 * IN), metalMat);
          shoeFence.position.set(0, (0.75 + 0.08) * IN, -0.5 * IN);
          shoeFence.castShadow = false; shoeFence.receiveShadow = true;
          shoeFence.userData = { illustrativePitchDeg: STUDIO_ILLUSTRATIVE_SHOE_PITCH_DEG, fenceGeometryIllustrative: true };
          shoeGroup.add(shoeFence);
          activeTowerParts.add(shoeGroup);
        } else if (item.kind === "drawer") {
          const slabFront = box(bay.widthIn - 0.3, 5, 0.65, cx, bottom + 2.5, depth - 0.25, drawerMat);
          slabFront.userData = { sourcedStyle: "Small Slab Drawer Front", exactFaceMeasurementsIllustrative: true };
        } else {
          const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, bay.widthIn * IN, 14), metalMat);
          rod.rotation.z = Math.PI / 2; rod.position.set(cx * IN, bottom * IN, depth * 0.58 * IN);
          rod.userData = { illustrativeDiameter: true }; activeTowerParts.add(rod);
        }
      }
      for (const placement of studioBasketPlacementsForWall(design).filter((basket) => basket.bayId === bay.id)) {
        // The wire treatment is decorative. This box is the deliberately conservative visual envelope, not sourced rail, slide, travel, door, or mounting geometry.
        const basketGeometry = new THREE.BoxGeometry(placement.nominalWidthIn * IN, placement.nominalHeightIn * IN, placement.nominalDepthIn * IN);
        const basketOutline = new THREE.LineSegments(new THREE.EdgesGeometry(basketGeometry), basketWireMat);
        basketOutline.position.set(cx * IN, (placement.bottomIn + placement.nominalHeightIn / 2) * IN, (placement.nominalDepthIn / 2) * IN);
        basketOutline.userData = { basketVisualPlanningEnvelope: true, decorativeWireLook: true, sku: placement.sku, wallId: placement.wallId, bayId: placement.bayId, nominalWidthIn: placement.nominalWidthIn, nominalHeightIn: placement.nominalHeightIn, nominalDepthIn: placement.nominalDepthIn, supplierRailAndClearanceToVerify: true };
        activeTowerParts.add(basketOutline);
      }
      if (index === selectedBay) {
        const trim = box(bay.widthIn + 1.2, 0.18, 0.18, cursor + bay.widthIn / 2 + 0.75, 0.05, depth + 1, brass, false);
        trim.userData = { selectionMarker: true };
        box(bay.widthIn, panelHeight - 5, 0.1, cursor + bay.widthIn / 2 + 0.75, panelHeight / 2 + (design.mount === "hanging" ? 6 : 0), depth + 0.4, hintMat, false);
      }
      const hit = new THREE.Mesh(new THREE.BoxGeometry(bay.widthIn * IN, (panelHeight - 7) * IN, 0.05), hitMat);
      hit.position.set((cursor + 0.75 + bay.widthIn / 2) * IN, (panelHeight / 2 + (design.mount === "hanging" ? 6 : 0)) * IN, (depth + 0.7) * IN);
      hit.userData.bayIndex = index;
      targets.push(hit); activeTowerParts.add(hit);
      cursor += bay.widthIn + 0.75;
    }
    if (design.bays.length) box(0.75, panelHeight, depth, cursor + 0.375, panelHeight / 2 + (design.mount === "hanging" ? 6 : 0), depth / 2, boardMat);
    const renderCompanionTower = (wallId: StudioWall) => {
      const bays = studioBays(design, wallId);
      if (!bays.length) return;
      const footprint = studioTowerFootprint(design, wallId);
      const runsAcrossX = wallId === "back" || wallId === "front";
      const fixedAxis = runsAcrossX ? (footprint.zMin + footprint.zMax) / 2 : (footprint.xMin + footprint.xMax) / 2;
      let run = runsAcrossX ? footprint.xMin : footprint.zMin;
      const panelY = panelHeight / 2 + (design.mount === "hanging" ? 6 : 0);
      const shelfY = (value: number) => value + 0.375 + (design.mount === "hanging" ? 6 : 0);
      const upright = (position: number) => runsAcrossX
        ? worldBox(0.75, panelHeight, depth, position + 0.375, panelY, fixedAxis, boardMat)
        : worldBox(depth, panelHeight, 0.75, fixedAxis, panelY, position + 0.375, boardMat);
      upright(run);
      for (const bay of bays) {
        const mid = run + 0.75 + bay.widthIn / 2;
        if (runsAcrossX) {
          worldBox(bay.widthIn, 0.75, depth, mid, shelfY(fixedBottom), fixedAxis, boardMat);
          worldBox(bay.widthIn, 0.75, depth, mid, shelfY(fixedTop), fixedAxis, boardMat);
        } else {
          worldBox(depth, 0.75, bay.widthIn, fixedAxis, shelfY(fixedBottom), mid, boardMat);
          worldBox(depth, 0.75, bay.widthIn, fixedAxis, shelfY(fixedTop), mid, boardMat);
        }
        run += bay.widthIn + 0.75;
        upright(run - 0.75);
      }
    };
    const connectedActiveShelf = visibleCornerShelves.find((shelf) => shelf.towerConnection === "visualAligned" && shelf.wallIds.includes(design.wall));
    if (connectedActiveShelf) {
      const footprint = studioTowerFootprint(design, design.wall);
      if (design.wall === "back") activeTowerParts.position.set(footprint.xMin * IN, 0, footprint.zMin * IN);
      else if (design.wall === "right") { activeTowerParts.rotation.y = -Math.PI / 2; activeTowerParts.position.set(footprint.xMax * IN, 0, footprint.zMin * IN); }
      else if (design.wall === "left") { activeTowerParts.rotation.y = Math.PI / 2; activeTowerParts.position.set(footprint.xMin * IN, 0, footprint.zMax * IN); }
      else { activeTowerParts.rotation.y = Math.PI; activeTowerParts.position.set(footprint.xMax * IN, 0, footprint.zMax * IN); }
    }
    // The visible board is a deliberately illustrative pie; the conservative 29.5-in collision envelope remains model-only.
    for (const shelf of visibleCornerShelves) {
      const footprint = studioCornerPlanningFootprint(design, shelf);
      const r = shelf.nominalFootprintIn * IN;
      const originX = (shelf.cornerId.endsWith("left") ? footprint.xMin : footprint.xMax) * IN;
      const originZ = (shelf.cornerId.startsWith("back") ? footprint.zMin : footprint.zMax) * IN;
      const sx = shelf.cornerId.endsWith("left") ? 1 : -1;
      const sz = shelf.cornerId.startsWith("back") ? 1 : -1;
      const pie = new THREE.Shape();
      pie.moveTo(0, 0); pie.lineTo(r, 0);
      pie.bezierCurveTo(r, r * 0.5523, r * 0.5523, r, 0, r);
      pie.lineTo(0, 0);
      const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(pie, { depth: STUDIO_CORNER_SHELF_THICKNESS_IN * IN, bevelEnabled: false, curveSegments: 28 }), boardMat);
      mesh.rotation.x = Math.PI / 2;
      mesh.scale.set(sx, sz, 1);
      mesh.position.set(originX, (shelf.elevationIn + STUDIO_CORNER_SHELF_THICKNESS_IN) * IN, originZ);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.userData = { cornerShelfPlanningEnvelope: true, illustrativePieShelf: true, finish: design.finish, sku: shelf.sku, cornerId: shelf.cornerId, mount: shelf.mount, geometryRevision: shelf.geometryRevision, nominalFootprintIn: shelf.nominalFootprintIn, profileIllustrative: true, installationFitToVerify: true };
      parts.add(mesh);
      if (shelf.towerConnection === "visualAligned") {
        const companionWall = shelf.wallIds.find((wall) => wall !== design.wall);
        if (companionWall) renderCompanionTower(companionWall);
      }
    }
    const ray = new THREE.Raycaster();
    const point = new THREE.Vector2();
    const pick = (clientX: number, clientY: number) => {
      const r = renderer.domElement.getBoundingClientRect();
      point.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(point, camera);
      const hit = ray.intersectObjects(targets, false)[0];
      return hit ? { index: hit.object.userData.bayIndex as number, height: hit.point.y / IN - (design.mount === "hanging" ? 6 : 0) } : null;
    };
    const onClick = (event: MouseEvent) => {
      const hit = pick(event.clientX, event.clientY);
      if (!hit) return;
      handlers.current.onSelectBay(hit.index);
      if (handlers.current.partToPlace) handlers.current.onPlace(hit.index, hit.height, handlers.current.partToPlace);
    };
    const onDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes("application/x-vendor-closet-part")) return;
      event.preventDefault(); event.dataTransfer.dropEffect = pick(event.clientX, event.clientY) ? "copy" : "none";
    };
    const onDrop = (event: DragEvent) => {
      const value = event.dataTransfer?.getData("application/x-vendor-closet-part");
      if (!["shelf", "rod", "drawer", "shoe"].includes(value ?? "")) return;
      event.preventDefault();
      const hit = pick(event.clientX, event.clientY);
      if (!hit) { handlers.current.onError("Drop inside an actual tower bay, not on an upright or the floor."); return; }
      handlers.current.onSelectBay(hit.index);
      handlers.current.onPlace(hit.index, hit.height, value as StudioKind);
    };
    renderer.domElement.addEventListener("click", onClick);
    renderer.domElement.addEventListener("dragover", onDragOver);
    renderer.domElement.addEventListener("drop", onDrop);
    const resize = () => {
      const width = Math.max(host.clientWidth, 1), height = Math.max(host.clientHeight, 1);
      camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    let running = true, frame = 0;
    const tick = () => { if (!running) return; controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(tick); };
    tick();
    return () => {
      running = false; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener("click", onClick);
      renderer.domElement.removeEventListener("dragover", onDragOver);
      renderer.domElement.removeEventListener("drop", onDrop);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) object.geometry.dispose();
      });
      for (const material of [oak, seamMaterial, wall.material, baseboard.material, boardMat, edgeMat, metalMat, shoeMat, drawerMat, brass, basketWireMat, hintMat, hitMat]) {
        if (Array.isArray(material)) material.forEach((mat) => mat.dispose()); else material.dispose();
      }
      texture.dispose(); renderer.dispose(); host.removeChild(renderer.domElement);
    };
  }, [design, selectedBay, selectedCornerId]);
  return <div ref={mount} className="h-full min-h-0 w-full touch-none" role="group" aria-label="Vendor closet 3D design canvas" data-testid="vendor-closet-3d" />;
}
