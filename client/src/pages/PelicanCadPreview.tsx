/**
 * Dev-only view of the same sink call the designer uses. The default pair is
 * an IGES handmade bowl and a STEP granite bowl. `?models=PL-HA108,PL-100`
 * swaps in other SKUs.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { addSinkFixture } from "@/components/design/InteractiveRoom3D";
import type { SinkFixture } from "@/lib/design";

const DEFAULT_PREVIEWS: SinkFixture[] = [
  {
    uid: "preview-ha108",
    type: "single",
    x: -28,
    y: -9,
    width: 23,
    depth: 18,
    faucet: false,
    wallSide: "top",
    pelicanCode: "PL-HA108 R0 16g",
    pelicanProfileId: "pelican-pl-ha108-r0-stainless-undermount",
    bowlWidth: 21,
    bowlDepth: 16,
    bowlHeight: 10,
    exteriorHeight: 10,
    apronFront: false,
  },
  {
    uid: "preview-pl100",
    type: "single",
    x: 6,
    y: -10,
    width: 33,
    depth: 21,
    faucet: false,
    wallSide: "top",
    pelicanCode: "PL-100 Alpina",
    bowlWidth: 30,
    bowlDepth: 18,
    bowlHeight: 9,
    exteriorHeight: 10,
    apronFront: false,
  },
];

function previewsFromQuery(): SinkFixture[] {
  const requested = new URLSearchParams(window.location.search).get("models");
  if (!requested) return DEFAULT_PREVIEWS;
  return requested.split(",").filter(Boolean).map((slug, index) => ({
    uid: `preview-${slug}`,
    type: "single" as const,
    x: index * 40,
    y: -10,
    width: 33,
    depth: 20,
    faucet: false,
    wallSide: "top" as const,
    pelicanCode: slug,
    bowlWidth: 30,
    bowlDepth: 16,
    bowlHeight: 9,
    exteriorHeight: 10,
    apronFront: false,
  }));
}

export default function PelicanCadPreview() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState<string[]>([]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor("#e7eef2");
    mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, mount.clientWidth / mount.clientHeight, 0.05, 80);
    camera.position.set(0.4, 4.6, 4.4);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0.2, 2.7, 0);
    controls.update();
    scene.add(new THREE.HemisphereLight("#f4f7fb", "#c8c2b8", 1.15));
    const key = new THREE.DirectionalLight("#ffffff", 1.1);
    key.position.set(3, 8, 4);
    scene.add(key);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 8),
      new THREE.MeshStandardMaterial({ color: "#f7f4ee", roughness: 0.9 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0.2, 1.6, 0);
    scene.add(ground);
    const root = new THREE.Group();
    scene.add(root);
    for (const sink of previewsFromQuery()) addSinkFixture(root, sink);

    let frame = 0;
    const tick = () => {
      const names: string[] = [];
      root.traverse((node) => {
        if (node.userData.manufacturerCadLoaded === true && typeof node.userData.pelicanCadSlug === "string") {
          names.push(node.userData.pelicanCadSlug);
        }
      });
      setLoaded((current) => (current.join() === names.join() ? current : names));
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div className="flex h-screen flex-col bg-[#e7eef2]">
      <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm text-[#1a2744]">
        <strong>Pelican manufacturer drawings in the designer sink</strong>
        <span data-testid="pelican-cad-preview-loaded">{loaded.length ? loaded.join(", ") : "Loading drawings…"}</span>
      </div>
      <div ref={mountRef} className="min-h-0 flex-1" data-testid="pelican-cad-preview" />
    </div>
  );
}
