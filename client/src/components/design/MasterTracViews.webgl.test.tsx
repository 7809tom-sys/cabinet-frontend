// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { defaultTowerConfig, planMasterTracTower } from "@/lib/masterTracTower";
import type { PlacedCabinet, RoomData, WallSide } from "@/lib/design";
import { MasterTracCorner3D } from "./MasterTracCornerViews";
import { MasterTracRod3D } from "./MasterTracRodViews";
import { clearParkedThreeDRenderers, THREE_D_START_RETRY_DELAYS_MS } from "./threeDRendererHost";

const created: { domElement: HTMLCanvasElement; dispose: () => void }[] = [];

vi.mock("three", async () => {
  const actual = await vi.importActual<typeof import("three")>("three");
  class StubRenderer {
    domElement: HTMLCanvasElement;
    shadowMap = { enabled: false, type: 0 };
    outputColorSpace = "";
    toneMapping = 0;
    toneMappingExposure = 1;
    renderLists = { dispose() {} };
    dispose = vi.fn();
    constructor({ canvas }: { canvas: HTMLCanvasElement }) {
      this.domElement = canvas;
      created.push(this);
    }
    setPixelRatio() {}
    setSize() {}
    render() {}
    setAnimationLoop() {}
    setRenderTarget() {}
    forceContextLoss() {}
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
      minDistance = 0;
      maxDistance = 0;
      update() {}
      dispose() {}
    },
  };
});

const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };

function cornerTower(): PlacedCabinet[] {
  const result = planMasterTracTower({ ...defaultTowerConfig(), corner: "start" }, room, "top", 0, []);
  if (!result.ok) throw new Error("corner tower did not plan");
  return result.plan.boards;
}

function rodTower(): PlacedCabinet[] {
  const config = defaultTowerConfig();
  config.bays[0].adjustableHeightsIn = [];
  config.bays[0].storage = { kind: "rod", count: 2, rodFinish: "Chrome", heightsIn: [40, 70] };
  const result = planMasterTracTower(config, room, "top", 0, []);
  if (!result.ok) throw new Error("rod tower did not plan");
  return result.plan.boards;
}

const views = [
  { name: "corner", prefix: "mastertrac-corner", View: MasterTracCorner3D, placed: cornerTower },
  { name: "rod", prefix: "mastertrac-rod", View: MasterTracRod3D, placed: rodTower },
];

let browserGivesContext = true;

beforeEach(() => {
  browserGivesContext = true;
  created.length = 0;
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement, kind: string) {
    if (kind !== "webgl2" || !browserGivesContext) return null;
    return { isContextLost: () => false, getExtension: () => null } as unknown as RenderingContext;
  } as never);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  clearParkedThreeDRenderers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("MasterTrac 3D views start through the shared renderer host", () => {
  for (const { name, prefix, View, placed } of views) {
    it(`${name}: renders through one pooled renderer and parks it on unmount`, () => {
      const boards = placed();
      const view = render(<View placed={boards} wall={"top" as WallSide} onEdit={() => {}} />);
      expect(screen.getByTestId(`${prefix}-3d-canvas`)).toBeTruthy();
      expect(screen.queryByTestId(`${prefix}-webgl-starting`)).toBeNull();
      view.rerender(<View placed={[...boards]} wall={"top" as WallSide} onEdit={() => {}} />);
      expect(created).toHaveLength(1);
      view.unmount();
      expect(document.querySelector("canvas")).toBeNull();
      expect(created[0].dispose).not.toHaveBeenCalled();
    });

    it(`${name}: retries quietly when the browser refuses a context, then renders without user action`, () => {
      vi.useFakeTimers();
      browserGivesContext = false;
      render(<View placed={placed()} wall={"top" as WallSide} onEdit={() => {}} />);
      expect(screen.getByTestId(`${prefix}-webgl-starting`).textContent).not.toMatch(/close|tab|setting|flag/i);
      act(() => { vi.advanceTimersByTime(THREE_D_START_RETRY_DELAYS_MS[0]); });
      expect(screen.getByTestId(`${prefix}-webgl-starting`)).toBeTruthy();
      browserGivesContext = true;
      act(() => { vi.advanceTimersByTime(THREE_D_START_RETRY_DELAYS_MS[1]); });
      expect(screen.queryByTestId(`${prefix}-webgl-starting`)).toBeNull();
      expect(screen.getByTestId(`${prefix}-3d-canvas`)).toBeTruthy();
    });
  }
});
