// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import * as THREE from "three";
import { VendorClosetScene, CLOSET_TOWER_BACK_FT, CLOSET_WALL_GAP_TOLERANCE_FT } from "./VendorClosetScene";
import {
  addStudioConnectedCorner, createStudioDesign, switchStudioWall,
  type StudioCornerId, type StudioDesign, type StudioWall,
} from "@/lib/vendorClosetStudio";

/**
 * jsdom has no WebGL, so the renderer is stubbed. Everything that decides where a board goes — the
 * scene graph, the transforms and the geometry — is the real code under test.
 */
vi.mock("three", async () => {
  const actual = await vi.importActual<typeof import("three")>("three");
  class StubRenderer {
    domElement = document.createElement("canvas");
    shadowMap = { enabled: false, type: 0 };
    outputColorSpace = "";
    toneMapping = 0;
    toneMappingExposure = 1;
    setPixelRatio() {}
    setSize() {}
    render() {}
    dispose() {}
    forceContextLoss() {}
    setAnimationLoop() {}
    setRenderTarget() {}
    renderLists = { dispose() {} };
    getContext() { return { isContextLost: () => false }; }
  }
  return { ...actual, WebGLRenderer: StubRenderer };
});

vi.mock("three/examples/jsm/controls/OrbitControls.js", async () => {
  const actual = await vi.importActual<typeof import("three")>("three");
  return {
    OrbitControls: class {
      target = new actual.Vector3();
      enableDamping = false;
      enablePan = false;
      zoomToCursor = false;
      minPolarAngle = 0;
      maxPolarAngle = 0;
      minDistance = 0;
      maxDistance = 0;
      enabled = true;
      addEventListener() {}
      removeEventListener() {}
      update() {}
      dispose() {}
    },
  };
});

const room = (): StudioDesign => ({ ...createStudioDesign(), wallWidthIn: 120, roomDepthIn: 108, roomHeightIn: 96 });

/**
 * The scene paints its finish texture on a 2D canvas, which jsdom does not implement. Only the
 * texture is stubbed; the geometry under test never reads a pixel.
 */
function stubCanvas2d() {
  const context = {
    fillStyle: "", strokeStyle: "", globalAlpha: 1, lineWidth: 1,
    fillRect() {}, beginPath() {}, moveTo() {}, bezierCurveTo() {}, stroke() {},
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(((kind: string) => kind === "2d" ? context : null) as unknown as HTMLCanvasElement["getContext"]);
}

function cornerDesign(cornerId: StudioCornerId): StudioDesign {
  const result = addStudioConnectedCorner(room(), cornerId, "fixed", 40, `corner-${cornerId}`);
  if (!result.ok) throw new Error(result.reason);
  return result.design;
}

/** Mounts the real scene and returns the canvas whose dataset it publishes, plus its live scene. */
async function mountScene(design: StudioDesign) {
  stubCanvas2d();
  class ResizeObserverStub {
    observe() {}
    disconnect() {}
  }
  const original = globalThis.ResizeObserver;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
  const { unmount } = render(
    <VendorClosetScene design={design} selectedBay={0} partToPlace={null} decor={false} onSelectBay={() => {}} onPlace={() => {}} onError={() => {}} />,
  );
  await waitFor(() => expect(document.querySelector("canvas")?.dataset.designWall).toBe(design.wall));
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = original;
  const canvas = document.querySelector<HTMLCanvasElement>(`canvas[data-design-wall="${design.wall}"]`)!;
  return { canvas, unmount };
}

const read = (canvas: HTMLCanvasElement) => ({
  runBack: Number(canvas.dataset.runBackFt),
  runDepth: Number(canvas.dataset.runDepthFt),
  rotation: Number(canvas.dataset.activeTowerRotation),
  boxBack: Number(canvas.dataset.activeBoxBackFt),
  boxDepth: Number(canvas.dataset.activeBoxDepthFt),
  hasCompanion: canvas.dataset.hasCompanion === "true",
  companionRotation: Number(canvas.dataset.companionRotation),
  companionBack: Number(canvas.dataset.companionBackFt),
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("VendorClosetScene never rotates the active tower", () => {
  it("keeps every tower run back against the wall on every wall, corner shelf or not", async () => {
    for (const wall of ["back", "left", "right", "front"] as StudioWall[]) {
      for (const cornerId of [null, "back-left", "front-right"] as Array<StudioCornerId | null>) {
        const design = cornerId ? switchStudioWall(cornerDesign(cornerId), wall) : switchStudioWall(room(), wall);
        const { canvas, unmount } = await mountScene(design);
        const scene = read(canvas);
        const label = `${wall}${cornerId ? ` + ${cornerId}` : ""}`;
        // The whole bug: a rotation applied on top of geometry that was already in the wall frame.
        expect(Math.abs(scene.rotation), `${label} active tower rotation`).toBe(0);
        // The run's back edge is on the slab, in feet, and its board depth is unchanged. A rotated
        // tower would have swapped those two numbers, which is what "floating away" looked like.
        expect(scene.runBack, `${label} run back edge`).toBeCloseTo(CLOSET_TOWER_BACK_FT, 3);
        expect(scene.runDepth, `${label} run board depth`).toBeCloseTo(14.5 / 12, 3);
        // Nothing in the drawn tower is further back than the wall, and the box keeps its depth.
        expect(scene.boxBack, `${label} drawn tower back`).toBeLessThanOrEqual(CLOSET_WALL_GAP_TOLERANCE_FT);
        expect(scene.boxDepth, `${label} drawn tower depth`).toBeGreaterThan(14.5 / 12 - CLOSET_WALL_GAP_TOLERANCE_FT);
        unmount();
      }
    }
  });

  it("turns only the companion, and keeps it on the corner it shares", async () => {
    for (const cornerId of ["back-left", "back-right", "front-left", "front-right"] as StudioCornerId[]) {
      const wall = cornerId.startsWith("back") ? "back" : "front";
      const { canvas, unmount } = await mountScene(switchStudioWall(cornerDesign(cornerId), wall));
      const scene = read(canvas);
      expect(scene.hasCompanion, `${cornerId} has a companion`).toBe(true);
      // The companion is a side wall: it turns a quarter about the shared corner...
      const turn = Math.abs(Math.atan2(Math.sin(scene.companionRotation), Math.cos(scene.companionRotation)));
      expect(turn, `${cornerId} companion turn`).toBeCloseTo(Math.PI / 2, 3);
      // ...and runs from the corner shelf's envelope into the room, not across it.
      expect(scene.companionBack, `${cornerId} companion back`).toBeCloseTo(29.5 / 12, 3);
      // The active tower on this wall is untouched by the companion.
      expect(Math.abs(scene.rotation), `${cornerId} active rotation`).toBe(0);
      expect(scene.runBack, `${cornerId} active run back`).toBeCloseTo(CLOSET_TOWER_BACK_FT, 3);
      unmount();
    }
  });

  it("draws no companion when the plan has no corner shelf", async () => {
    const { canvas, unmount } = await mountScene(switchStudioWall(room(), "left"));
    const scene = read(canvas);
    expect(scene.hasCompanion).toBe(false);
    expect(scene.rotation).toBe(0);
    expect(scene.runBack).toBeCloseTo(CLOSET_TOWER_BACK_FT, 3);
    unmount();
  });
});

describe("the published readout is the bug report's own number", () => {
  it("defines the tower back at the wall and a tolerance under one board", () => {
    expect(CLOSET_TOWER_BACK_FT).toBe(0);
    expect(CLOSET_WALL_GAP_TOLERANCE_FT).toBeLessThan(14.5 / 12);
  });
});
