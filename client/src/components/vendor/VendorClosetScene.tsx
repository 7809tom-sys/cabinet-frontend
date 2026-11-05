import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { StudioDesign, StudioKind, StudioWall } from "@/lib/vendorClosetStudio";
import { STUDIO_BASKET_FRAME_HEX, STUDIO_BASKET_LINER_PLACEHOLDER_HEX, STUDIO_CORNER_SHELF_THICKNESS_IN, STUDIO_ILLUSTRATIVE_SHOE_PITCH_DEG, studioBasketPlacementsForWall, studioBasketSurface, studioBayCut, studioBays, studioCornerPlanningFootprint, studioCornerShelvesForWall, studioFixedBottom, studioFixedTop, studioPanelHeight, studioTowerFootprint, studioWidth } from "@/lib/vendorClosetStudio";
import { CLOSET_FRAME_PADDING, closetFitDistance, frameClosetStudioCamera, type ClosetAabb, type ClosetCameraView } from "./closetStudioCamera";
import { createClosetDlShakerFront } from "./closetShakerFront";
import { STUDIO_DECOR_FABRIC_HEX, STUDIO_DECOR_SHOE_HEX, studioWallDecor, type StudioDecorBay } from "@/lib/vendorClosetDecor";

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
export function VendorClosetScene({ design, selectedBay, selectedCornerId = null, partToPlace, basketToPlace = null, cameraView = "angle", fitToken = 0, decor = true, onSelectBay, onPlace, onPlaceBasket, onError }: {
  design: StudioDesign;
  selectedBay: number;
  selectedCornerId?: string | null;
  partToPlace: StudioKind | null;
  basketToPlace?: string | null;
  cameraView?: ClosetCameraView;
  /** Presentation-only clothes and shoes; never parts, so never in the material reference. */
  decor?: boolean;
  /** Bump to refit the tower after a view change or a Fit click. */
  fitToken?: number;
  onSelectBay: (bayIndex: number) => void;
  onPlace: (bayIndex: number, bottomIn: number, kind: StudioKind) => void;
  onPlaceBasket?: (bayIndex: number, bottomIn: number, sku: string) => void;
  onError: (message: string) => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const handlers = useRef({ onSelectBay, onPlace, onPlaceBasket, onError, partToPlace, basketToPlace });
  handlers.current = { onSelectBay, onPlace, onPlaceBasket, onError, partToPlace, basketToPlace };
  const viewRef = useRef(cameraView);
  viewRef.current = cameraView;
  /** Decor visibility is a live ref so the toggle never re-runs the scene effect (no rebuild). */
  const decorRef = useRef(decor);
  decorRef.current = decor;
  const decorGroupsRef = useRef<THREE.Group[]>([]);
  const decorVisible = decorRef.current;
  const reframeRef = useRef<() => void>(() => {});
  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#e9e5db");
    const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 130);
    const visibleCornerShelves = studioCornerShelvesForWall(design);
    const hasCornerPlanning = visibleCornerShelves.length > 0;
    const towerWidth = studioWidth(design) * IN;
    const w = hasCornerPlanning ? design.wallWidthIn * IN : towerWidth;
    const roomDepth = hasCornerPlanning ? design.roomDepthIn * IN : Math.max(4, 14.5 * IN + 3);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.6;
    renderer.domElement.dataset.testid = "vendor-closet-canvas";
    // setSize(..., false) leaves CSS sizing to us; without this the canvas lays out at pixelRatio-scaled size and shows only a zoomed top-left corner on HiDPI screens.
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.domElement.setAttribute("aria-label", "Interactive vendor closet scene: drag a part into a tower, or choose a part and tap a tower");
    renderer.domElement.tabIndex = 0;
    host.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.zoomToCursor = false;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minPolarAngle = 0.35;
    controls.minDistance = 1.4;
    controls.maxDistance = 40;
    controls.target.set(w / 2, 3.6, 0.6);

    scene.add(new THREE.HemisphereLight(0xfff6e8, 0xa9a2a0, 2.1));
    const windowLight = new THREE.DirectionalLight(0xfff5df, 3.9);
    windowLight.position.set(w / 2 + 1, 9, 7);
    windowLight.castShadow = true;
    windowLight.shadow.mapSize.set(2048, 2048);
    windowLight.shadow.camera.left = -14; windowLight.shadow.camera.right = 14;
    windowLight.shadow.camera.top = 14; windowLight.shadow.camera.bottom = -14;
    windowLight.shadow.bias = -0.0002;
    scene.add(windowLight);
    const fill = new THREE.DirectionalLight(0xfff6e8, 1.15);
    fill.position.set(-2, 4, -5); scene.add(fill);
    const room = new THREE.Group(); scene.add(room);
    const oak = new THREE.MeshStandardMaterial({ color: 0xb69a77, roughness: 0.78 });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(Math.max(6, w + 2), 0.13, Math.max(5, roomDepth)), oak);
    floor.position.set(w / 2, -0.1, 1.6); floor.receiveShadow = true; room.add(floor);
    const seamMaterial = new THREE.LineBasicMaterial({ color: 0x967d62, transparent: true, opacity: 0.35 });
    for (let z = -0.4; z <= 4.4; z += 0.44) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1, -0.033, z), new THREE.Vector3(w + 1, -0.033, z)]), seamMaterial); room.add(line);
    }
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xf3eee5, roughness: 0.95, transparent: true, opacity: 1 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(Math.max(4, w + 2), Math.max(6, studioPanelHeight(design) * IN + 1.1), 0.14), wallMaterial);
    wall.position.set(w / 2, (studioPanelHeight(design) * IN + 1.1) / 2, -0.2); wall.receiveShadow = true; room.add(wall);
    const baseboard = new THREE.Mesh(new THREE.BoxGeometry(Math.max(4, w + 2), 0.23, 0.11), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82 }));
    baseboard.position.set(w / 2, 0.12, -0.08); baseboard.receiveShadow = true; room.add(baseboard);
    const palette = MAT[design.finish];
    const texture = woodTexture(design.finish);
    const boardMat = new THREE.MeshPhysicalMaterial({ color: palette.face, map: texture, roughness: 0.65, metalness: 0.02, clearcoat: 0.09, clearcoatRoughness: 0.65 });
    const edgeMat = new THREE.MeshStandardMaterial({ color: palette.edge, roughness: 0.75 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xb4b9b7, metalness: 0.75, roughness: 0.27 });
    const shoeMat = new THREE.MeshPhysicalMaterial({ color: palette.face, map: texture, roughness: 0.72 });
    const shakerMaterials: THREE.Material[] = [];
    const brass = new THREE.MeshStandardMaterial({ color: 0xb9a37b, metalness: 0.7, roughness: 0.33 });
    const basketLinerMat = new THREE.MeshStandardMaterial({ color: STUDIO_BASKET_LINER_PLACEHOLDER_HEX, roughness: 0.9, metalness: 0, transparent: false, opacity: 1, depthWrite: true });
    const basketFrameMat = new THREE.MeshStandardMaterial({ color: STUDIO_BASKET_FRAME_HEX, roughness: 0.42, metalness: 0.55, transparent: false, opacity: 1, depthWrite: true });
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
    // Decoration is built from a handful of shared geometries and materials, created once per scene
    // render, so adding clothes never allocates a material per garment and never rebuilds the scene.
    const decorFabric = STUDIO_DECOR_FABRIC_HEX.map((hex) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.94, metalness: 0 }));
    const decorShoe = STUDIO_DECOR_SHOE_HEX.map((hex) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.7, metalness: 0.04 }));
    /**
     * One silhouette per garment type, built once per scene and reused by every hanger. The outline
     * includes sleeve bumps and a tapered body, which reads as clothing from the front and from an
     * angle, unlike a plain box. Because the geometry is shared, thirty garments cost four shapes.
     */
    const garmentGeometry = (kind: "shirt" | "dress" | "coat" | "trouser") => {
      const shape = new THREE.Shape();
      if (kind === "trouser") {
        // Waistband plus two legs with a gap; one unit tall, one unit wide.
        shape.moveTo(-0.42, 1); shape.lineTo(0.42, 1); shape.lineTo(0.42, 0.93);
        shape.lineTo(0.15, 0.93); shape.lineTo(0.11, 0); shape.lineTo(-0.11, 0);
        shape.lineTo(-0.15, 0.93); shape.lineTo(-0.42, 0.93); shape.lineTo(-0.42, 1);
        return new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false, curveSegments: 4 });
      }
      // Shoulder line, a sleeve bump out to each side, then a body that flares for a dress/coat.
      const flare = kind === "shirt" ? 0.42 : 0.5;
      shape.moveTo(-0.26, 1);
      shape.lineTo(0.26, 1);          // neckline / shoulders
      shape.lineTo(0.5, 0.9);         // right shoulder point
      shape.lineTo(0.72, 0.62);       // right sleeve
      shape.lineTo(0.56, 0.56);
      shape.lineTo(flare, 0.8);       // body under the arm
      shape.lineTo(flare, 0);         // hem
      shape.lineTo(-flare, 0);
      shape.lineTo(-flare, 0.8);
      shape.lineTo(-0.56, 0.56);
      shape.lineTo(-0.72, 0.62);      // left sleeve
      shape.lineTo(-0.5, 0.9);
      shape.lineTo(-0.26, 1);
      return new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false, curveSegments: 4 });
    };
    const garmentGeometries: Record<"shirt" | "dress" | "coat" | "trouser", THREE.BufferGeometry> = {
      shirt: garmentGeometry("shirt"), dress: garmentGeometry("dress"), coat: garmentGeometry("coat"), trouser: garmentGeometry("trouser"),
    };
    const hangerBarGeometry = new THREE.BoxGeometry(1, 1, 1);
    const hangerHookGeometry = new THREE.CylinderGeometry(0.012, 0.012, 1, 6);
    const decorMaterialList = [...decorFabric, ...decorShoe];
    const hangingOffsetIn = design.mount === "hanging" ? 6 : 0;
    /** Clothes, folded stacks and shoes for one bay: presentation only, never a part or a price. */
    const renderBayDecor = (bayId: string, bayIndex: number, bayLeftIn: number) => {
      const decorBay: StudioDecorBay | undefined = decorByBay.get(bayId);
      if (!decorBay) return;
      const group = new THREE.Group();
      group.userData = { decorOnly: true, notInMaterialReference: true, bayId };
      group.visible = decorVisible;
      decorBay.hangers.forEach((hanger, hangerIndex) => {
        const dropIn = hanger.kind === "dress" ? 50 : hanger.kind === "coat" ? 44 : hanger.kind === "trouser" ? 34 : 28;
        // Hanging clothes overlap on the rod, exactly like a real closet, so each garment is drawn
        // wider than its pitch. That is what turns a row of ribbons into a rail of clothes. A small
        // deterministic hem variation stops neighbouring pieces merging into one block.
        const bodyWidth = hanger.kind === "dress" || hanger.kind === "coat" ? 10 : hanger.kind === "trouser" ? 6 : 8;
        const hemVarianceIn = ((hangerIndex * 7) % 5) - 2;
        const body = new THREE.Mesh(garmentGeometries[hanger.kind], decorFabric[(bayIndex + hanger.kind.length) % decorFabric.length]);
        body.scale.set(bodyWidth * IN, (dropIn + hemVarianceIn) * IN, 1);
        body.position.set((bayLeftIn + hanger.leftIn + hanger.widthIn / 2) * IN, (hanger.rodBottomIn + hangingOffsetIn - dropIn) * IN, depth * 0.58 * IN - (hangerIndex % 3) * 0.02);
        body.castShadow = true; body.receiveShadow = true;
        body.userData = { decorKind: "hanger", hangerKind: hanger.kind, silhouette: true };
        group.add(body);
        // Hanger bar and hook, so the garment reads as hanging rather than floating.
        const bar = new THREE.Mesh(hangerBarGeometry, metalMat);
        bar.scale.set(Math.min(bodyWidth, 12) * IN, 0.05, 0.05);
        bar.position.set((bayLeftIn + hanger.leftIn + hanger.widthIn / 2) * IN, (hanger.rodBottomIn + hangingOffsetIn - 0.15) * IN, depth * 0.58 * IN);
        group.add(bar);
        const hook = new THREE.Mesh(hangerHookGeometry, metalMat);
        hook.scale.set(1, 1.1 * IN, 1);
        hook.position.set((bayLeftIn + hanger.leftIn + hanger.widthIn / 2) * IN, (hanger.rodBottomIn + hangingOffsetIn + 0.45) * IN, depth * 0.58 * IN);
        group.add(hook);
      });
      for (const stack of decorBay.folded) {
        for (let layer = 0; layer < stack.stackIn; layer += 1) {
          const piece = new THREE.Mesh(hangerBarGeometry, decorFabric[(stack.hueIndex + layer) % decorFabric.length]);
          piece.scale.set(stack.widthIn * IN, 1.1 * IN, 9 * IN);
          piece.position.set((bayLeftIn + stack.leftIn + stack.widthIn / 2) * IN, (stack.shelfBottomIn + 0.75 + 1.1 * (layer + 0.5) + layer * 0.12 + hangingOffsetIn) * IN, 7.6 * IN);
          piece.castShadow = true; piece.receiveShadow = true;
          piece.userData = { decorKind: "folded" };
          group.add(piece);
        }
      }
      for (const shoe of decorBay.shoes) {
        for (const pair of [0, 1]) {
          const piece = new THREE.Mesh(hangerBarGeometry, decorShoe[shoe.hueIndex % decorShoe.length]);
          piece.scale.set(shoe.widthIn * 0.46 * IN, 2.4 * IN, 8.5 * IN);
          piece.position.set((bayLeftIn + shoe.leftIn + pair * shoe.widthIn * 0.52 + shoe.widthIn * 0.23) * IN, (shoe.heightIn + hangingOffsetIn) * IN, 7.4 * IN);
          piece.castShadow = true; piece.receiveShadow = true;
          piece.userData = { decorKind: "shoe" };
          group.add(piece);
        }
      }
      activeTowerParts.add(group);
      decorGroups.push(group);
    };
    const decorByBay = new Map<string, StudioDecorBay>(studioWallDecor(design, design.wall).map((bay) => [bay.bayId, bay]));
    /** Decor groups this scene built; the toggle effect below only flips their visibility. */
    const decorGroups: THREE.Group[] = [];
    decorGroupsRef.current = decorGroups;
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
          const faceWidth = bay.widthIn - 0.3;
          const faceHeight = 5;
          const front = createClosetDlShakerFront(faceWidth, faceHeight, palette.face, "drawer");
          front.position.set(cx * IN, (bottom + faceHeight / 2) * IN, (depth - 0.25) * IN);
          front.userData = { ...front.userData, sourcedStyle: "Small Slab Drawer Front", exactFaceMeasurementsIllustrative: true, dlShakerBlueprint: true };
          front.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              const materials = Array.isArray(child.material) ? child.material : [child.material];
              for (const material of materials) if (!shakerMaterials.includes(material)) shakerMaterials.push(material);
            }
          });
          activeTowerParts.add(front);
        } else {
          const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, bay.widthIn * IN, 14), metalMat);
          rod.rotation.z = Math.PI / 2; rod.position.set(cx * IN, bottom * IN, depth * 0.58 * IN);
          rod.userData = { illustrativeDiameter: true }; activeTowerParts.add(rod);
        }
      }
      renderBayDecor(bay.id, index, cursor + 0.75);
      for (const placement of studioBasketPlacementsForWall(design).filter((basket) => basket.bayId === bay.id)) {
        // Solid fabric liner. The catalog has no liner photo or color (Chrome is the frame finish only). This box is still the conservative visual envelope, not sourced rail, slide, travel, door, or mounting geometry.
        const surface = studioBasketSurface(placement.sku);
        const basketMesh = new THREE.Mesh(new THREE.BoxGeometry(placement.nominalWidthIn * IN, placement.nominalHeightIn * IN, placement.nominalDepthIn * IN), basketLinerMat);
        basketMesh.position.set(cx * IN, (placement.bottomIn + placement.nominalHeightIn / 2) * IN, (placement.nominalDepthIn / 2) * IN);
        basketMesh.castShadow = true; basketMesh.receiveShadow = true;
        const lip = new THREE.Mesh(new THREE.BoxGeometry(placement.nominalWidthIn * IN, 0.15 * IN, placement.nominalDepthIn * IN), basketFrameMat);
        lip.position.y = (placement.nominalHeightIn / 2 - 0.075) * IN;
        basketMesh.add(lip);
        basketMesh.userData = { basketVisualPlanningEnvelope: true, opaqueLiner: true, linerPlaceholder: true, linerColor: surface.fabricHex, frameColor: surface.frameHex, sku: placement.sku, wallId: placement.wallId, bayId: placement.bayId, nominalWidthIn: placement.nominalWidthIn, nominalHeightIn: placement.nominalHeightIn, nominalDepthIn: placement.nominalDepthIn, supplierRailAndClearanceToVerify: true };
        activeTowerParts.add(basketMesh);
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
    parts.updateMatrixWorld(true);
    const cabinetBounds = new THREE.Box3().setFromObject(parts);
    if (cabinetBounds.isEmpty() || !Number.isFinite(cabinetBounds.min.x)) {
      const height = studioPanelHeight(design) * IN;
      cabinetBounds.set(new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.max(w, 2), height, 14.5 * IN));
    }
    const centerX = (cabinetBounds.min.x + cabinetBounds.max.x) / 2;
    const cabinetW = Math.max(cabinetBounds.max.x - cabinetBounds.min.x, 2);
    const cabinetH = Math.max(cabinetBounds.max.y - Math.min(cabinetBounds.min.y, 0), 4);
    const wallW = cabinetW + 2.2;
    const wallH = cabinetH + 1.05;
    wall.geometry.dispose();
    wall.geometry = new THREE.BoxGeometry(wallW, wallH, 0.14);
    wall.position.set(centerX, wallH / 2, -0.2);
    baseboard.geometry.dispose();
    baseboard.geometry = new THREE.BoxGeometry(wallW, 0.23, 0.11);
    baseboard.position.set(centerX, 0.12, -0.08);
    floor.geometry.dispose();
    floor.geometry = new THREE.BoxGeometry(wallW + 1.2, 0.13, 5.4);
    floor.position.set(centerX, -0.1, 1.5);
    const cabinetAabb: ClosetAabb = {
      minX: cabinetBounds.min.x, minY: Math.min(cabinetBounds.min.y, 0), minZ: cabinetBounds.min.z,
      maxX: cabinetBounds.max.x, maxY: cabinetBounds.max.y, maxZ: cabinetBounds.max.z,
    };
    let userAimed = false;
    let enforcingFit = false;
    const applyFrame = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      const frame = frameClosetStudioCamera(cabinetAabb, width / height, { view: viewRef.current });
      camera.position.set(frame.position.x, frame.position.y, frame.position.z);
      camera.near = frame.near;
      camera.far = frame.far;
      camera.lookAt(frame.target.x, frame.target.y, frame.target.z);
      controls.target.set(frame.target.x, frame.target.y, frame.target.z);
      controls.minDistance = frame.minDistance;
      controls.maxDistance = frame.maxDistance;
      controls.minPolarAngle = frame.polarAngle;
      controls.maxPolarAngle = frame.polarAngle;
      controls.update();
    };
    const keepTowerInFrame = () => {
      if (enforcingFit) return;
      enforcingFit = true;
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      const offset = camera.position.clone().sub(controls.target);
      const needed = closetFitDistance(cabinetAabb, width / height, { x: offset.x, y: offset.y, z: offset.z }, { padding: CLOSET_FRAME_PADDING, fovDeg: camera.fov });
      controls.minDistance = needed;
      if (offset.length() < needed - 0.02) {
        offset.setLength(needed);
        camera.position.copy(controls.target).add(offset);
      }
      enforcingFit = false;
    };
    controls.addEventListener("start", () => { userAimed = true; });
    controls.addEventListener("change", () => { if (userAimed) keepTowerInFrame(); });
    reframeRef.current = () => { userAimed = false; applyFrame(); camera.updateProjectionMatrix(); };
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
      if (handlers.current.basketToPlace && handlers.current.onPlaceBasket) {
        handlers.current.onPlaceBasket(hit.index, hit.height, handlers.current.basketToPlace);
        return;
      }
      if (handlers.current.partToPlace) handlers.current.onPlace(hit.index, hit.height, handlers.current.partToPlace);
    };
    const onDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes("application/x-vendor-closet-part")) return;
      event.preventDefault(); event.dataTransfer.dropEffect = pick(event.clientX, event.clientY) ? "copy" : "none";
    };
    const onDrop = (event: DragEvent) => {
      const value = event.dataTransfer?.getData("application/x-vendor-closet-part");
      const basketSku = value?.startsWith("basket:") ? value.slice("basket:".length) : "";
      if (!basketSku && !["shelf", "rod", "drawer", "shoe"].includes(value ?? "")) return;
      event.preventDefault();
      const hit = pick(event.clientX, event.clientY);
      if (!hit) { handlers.current.onError("Drop inside an actual tower bay, not on an upright or the floor."); return; }
      handlers.current.onSelectBay(hit.index);
      if (basketSku && handlers.current.onPlaceBasket) handlers.current.onPlaceBasket(hit.index, hit.height, basketSku);
      else if (value) handlers.current.onPlace(hit.index, hit.height, value as StudioKind);
    };
    renderer.domElement.addEventListener("click", onClick);
    renderer.domElement.addEventListener("dragover", onDragOver);
    renderer.domElement.addEventListener("drop", onDrop);
    const resize = () => {
      const width = Math.max(host.clientWidth, 1), height = Math.max(host.clientHeight, 1);
      camera.aspect = width / height;
      if (!userAimed) applyFrame();
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    let running = true, frame = 0;
    const tick = () => {
      if (!running) return;
      const blocking = camera.position.z < wall.position.z + 0.05;
      wallMaterial.opacity = blocking ? 0.14 : 1;
      wallMaterial.depthWrite = !blocking;
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      running = false; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener("click", onClick);
      renderer.domElement.removeEventListener("dragover", onDragOver);
      renderer.domElement.removeEventListener("drop", onDrop);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) object.geometry.dispose();
      });
      for (const material of [oak, seamMaterial, wall.material, baseboard.material, boardMat, edgeMat, metalMat, shoeMat, brass, basketLinerMat, basketFrameMat, hintMat, hitMat, ...decorMaterialList, ...shakerMaterials]) {
        if (Array.isArray(material)) material.forEach((mat) => mat.dispose()); else material.dispose();
      }
      texture.dispose(); renderer.dispose(); host.removeChild(renderer.domElement);
    };
  }, [design, selectedBay, selectedCornerId]);
  useEffect(() => {
    // Presentation toggle only: flip visibility of the decor groups already in the scene. Rebuilding
    // here would leak the whole WebGL scene on every toggle click.
    for (const group of decorGroupsRef.current) group.visible = decor;
  }, [decor]);
  useEffect(() => { reframeRef.current(); }, [cameraView, fitToken]);
  return <div ref={mount} className="h-full min-h-0 w-full touch-none" role="group" aria-label="Vendor closet 3D design canvas" data-testid="vendor-closet-3d" />;
}
