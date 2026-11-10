// @vitest-environment jsdom
/**
 * The 3D Designer used to build a brand-new WebGLRenderer, canvas, and context
 * inside its one big scene effect, then dispose them on cleanup. Because that
 * effect re-runs on ~70 inputs, every Generate state update tore the view down
 * and rebuilt it, so the customer saw the light/blank room flash several times
 * before the finished plan appeared.
 *
 * These tests pin the fixes:
 *  1. one renderer/canvas per mount, reused by scene rebuilds;
 *  2. the full-screen 3D dialog keyed on stable surface product ids, not on
 *     texture URLs that are still resolving;
 *  3. Generate's placement/finish changes rebuild scene contents only.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ThreeDRendererHost,
  clearParkedThreeDRenderers,
  createOrReuseThreeDWebGLRenderer,
  createThreeDWebGLRenderer,
  parkedThreeDRendererCount,
  sizeThreeDRenderer,
} from "./threeDRendererHost";
import { sameThreeDWallHeights } from "./InteractiveRoom3D";

const roomSource = readFileSync(resolve(process.cwd(), "client/src/components/design/InteractiveRoom3D.tsx"), "utf8");
const hostSource = readFileSync(resolve(process.cwd(), "client/src/components/design/threeDRendererHost.ts"), "utf8");
const designToolSource = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");

function fakeRenderer(options: { contextLost?: boolean } = {}) {
  const canvas = document.createElement("canvas");
  const sizes: Array<{ width: number; height: number }> = [];
  let pixelRatio = 1;
  const renderer = {
    domElement: canvas,
    dispose: vi.fn(),
    forceContextLoss: vi.fn(),
    getContext: () => ({ isContextLost: () => options.contextLost === true }),
    setAnimationLoop: vi.fn(),
    setRenderTarget: vi.fn(),
    renderLists: { dispose: vi.fn() },
    getPixelRatio: () => pixelRatio,
    setPixelRatio: vi.fn((value: number) => { pixelRatio = value; }),
    getSize: (target: { set(x: number, y: number): void; x: number; y: number }) => {
      const last = sizes[sizes.length - 1] ?? { width: 0, height: 0 };
      target.set(last.width, last.height);
      return target;
    },
    setSize: vi.fn((width: number, height: number) => { sizes.push({ width, height }); }),
    sizes,
  };
  return renderer;
}

describe("ThreeDRendererHost keeps one WebGL renderer for the whole mount", () => {
  it("creates the renderer and canvas once and reuses them for later scene rebuilds", () => {
    const created: ReturnType<typeof fakeRenderer>[] = [];
    const host = new ThreeDRendererHost(() => {
      const renderer = fakeRenderer();
      created.push(renderer);
      return renderer as unknown as THREE.WebGLRenderer;
    });
    const mount = document.createElement("div");

    const first = host.ensureMounted(mount);
    const second = host.ensureMounted(mount);
    const third = host.ensureMounted(mount);

    expect(created).toHaveLength(1);
    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(mount.childElementCount).toBe(1);
    expect(mount.firstElementChild).toBe(first!.domElement);
    // Nothing in a rebuild may dispose or lose the context.
    expect(created[0].dispose).not.toHaveBeenCalled();
    expect(created[0].forceContextLoss).not.toHaveBeenCalled();
  });

  it("disposes the renderer, releases the context, and removes the canvas only on unmount", () => {
    const renderers: ReturnType<typeof fakeRenderer>[] = [];
    const host = new ThreeDRendererHost(() => {
      const renderer = fakeRenderer();
      renderers.push(renderer);
      return renderer as unknown as THREE.WebGLRenderer;
    });
    const mount = document.createElement("div");
    host.ensureMounted(mount);

    expect(renderers[0].dispose).not.toHaveBeenCalled();
    host.dispose();

    expect(renderers[0].dispose).toHaveBeenCalledTimes(1);
    expect(renderers[0].forceContextLoss).toHaveBeenCalledTimes(1);
    expect(mount.childElementCount).toBe(0);
    expect(host.current).toBeNull();
  });

  it("reports an unavailable renderer instead of throwing when WebGL cannot start", () => {
    const host = new ThreeDRendererHost(() => null);
    expect(host.ensureMounted(document.createElement("div"))).toBeNull();
    expect(() => host.dispose()).not.toThrow();
  });

  it("returns null from the real factory rather than throwing when every context request fails", () => {
    // jsdom has no WebGL, which is exactly the "browser refuses a context" path.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(createThreeDWebGLRenderer()).toBeNull();
    expect(warn).toHaveBeenCalled();
  });
});

describe("unmounted 3D views hand their renderer to the next view", () => {
  afterEach(() => clearParkedThreeDRenderers());

  function hostFor(renderer: ReturnType<typeof fakeRenderer>) {
    return new ThreeDRendererHost(() => renderer as unknown as THREE.WebGLRenderer);
  }

  it("parks a healthy renderer on release without losing its context", () => {
    const renderer = fakeRenderer();
    const host = hostFor(renderer);
    const mount = document.createElement("div");
    host.ensureMounted(mount);
    renderer.domElement.style.cursor = "pointer";

    host.release();

    expect(renderer.dispose).not.toHaveBeenCalled();
    expect(renderer.forceContextLoss).not.toHaveBeenCalled();
    expect(mount.childElementCount).toBe(0);
    expect(renderer.domElement.style.cursor).toBe("");
    expect(renderer.setAnimationLoop).toHaveBeenCalledWith(null);
    expect(host.current).toBeNull();
    expect(parkedThreeDRendererCount()).toBe(1);
  });

  it("gives the parked renderer to the next 3D view instead of creating a context", () => {
    const renderer = fakeRenderer();
    const first = hostFor(renderer);
    first.ensureMounted(document.createElement("div"));
    first.release();

    const reused = createOrReuseThreeDWebGLRenderer();

    expect(reused).toBe(renderer as unknown as THREE.WebGLRenderer);
    expect(parkedThreeDRendererCount()).toBe(0);
  });

  it("destroys a renderer whose context is already lost instead of parking it", () => {
    const renderer = fakeRenderer({ contextLost: true });
    const host = hostFor(renderer);
    host.ensureMounted(document.createElement("div"));

    host.release();

    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(renderer.forceContextLoss).toHaveBeenCalledTimes(1);
    expect(parkedThreeDRendererCount()).toBe(0);
  });

  it("caps the parked renderers and destroys the extras", () => {
    const renderers = [fakeRenderer(), fakeRenderer(), fakeRenderer()];
    for (const renderer of renderers) {
      const host = hostFor(renderer);
      host.ensureMounted(document.createElement("div"));
      host.release();
    }

    expect(parkedThreeDRendererCount()).toBe(2);
    expect(renderers[2].forceContextLoss).toHaveBeenCalledTimes(1);
  });
});

describe("sizeThreeDRenderer leaves the painted frame alone", () => {
  it("skips setSize when the canvas already has the requested size and pixel ratio", () => {
    const renderer = fakeRenderer();
    const target = renderer as unknown as THREE.WebGLRenderer;

    expect(sizeThreeDRenderer(target, 640, 480, 2)).toBe(true);
    expect(renderer.setSize).toHaveBeenCalledTimes(1);

    // Re-running the scene effect with the same canvas size must not reset the
    // drawing buffer, which is what blanked the view.
    expect(sizeThreeDRenderer(target, 640, 480, 2)).toBe(false);
    expect(renderer.setSize).toHaveBeenCalledTimes(1);
  });

  it("resizes when the element or the pixel ratio really changed", () => {
    const renderer = fakeRenderer();
    const target = renderer as unknown as THREE.WebGLRenderer;
    sizeThreeDRenderer(target, 640, 480, 1);
    expect(sizeThreeDRenderer(target, 800, 480, 1)).toBe(true);
    expect(sizeThreeDRenderer(target, 800, 480, 1.5)).toBe(true);
    expect(renderer.setSize).toHaveBeenCalledTimes(3);
    expect(renderer.setPixelRatio).toHaveBeenLastCalledWith(1.5);
  });
});

describe("InteractiveRoom3D renderer lifecycle wiring", () => {
  it("creates the renderer host once in a mount-only effect", () => {
    expect(roomSource).toContain("const rendererHostRef = useRef<ThreeDRendererHost | null>(null);");
    expect(roomSource).toContain("const host = new ThreeDRendererHost();\n    rendererHostRef.current = host;");
    expect(roomSource).toContain("host.release();");
    expect(roomSource).toContain("rendererHostRef.current.ensureMounted(mount)");
  });

  it("does not reset the context-loss counter, which would allocate renderers forever", () => {
    const effect = roomSource.slice(
      roomSource.indexOf("A GPU reset loses the context"),
      roomSource.indexOf("A failed start used to be permanent"),
    );
    // The manual Retry button may zero the counter. The automatic path must not.
    expect(effect).not.toContain("webglAutoRetriesRef.current = 0");
    expect(effect).toContain("threeDContextLossAction(");
    expect(effect).toContain("contextLossRestartsRef");
  });

  it("does not create, mount, dispose, or force-lose a context inside the scene effect", () => {
    const start = roomSource.indexOf("const hostRenderer = rendererHostRef.current.ensureMounted(mount)");
    const end = roomSource.indexOf("}, [webglUnavailable, webglContextGeneration, scene, validSuggestions, placed,", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const sceneEffect = roomSource.slice(start, end);
    expect(sceneEffect).not.toContain("new THREE.WebGLRenderer");
    expect(sceneEffect).not.toContain("mount.replaceChildren");
    expect(sceneEffect).not.toContain("renderer.dispose()");
    expect(sceneEffect).not.toContain("forceContextLoss");
    expect(sceneEffect).not.toContain("renderer.domElement.remove()");
  });

  it("keeps forceContextLoss in the host so the unmount teardown still releases the context", () => {
    expect(hostSource).toContain("renderer.forceContextLoss()");
    expect(hostSource).toContain("renderer.domElement.remove()");
    // Chrome caps live WebGL contexts; the comment explains why dispose alone is not enough.
    expect(hostSource).toContain("Chrome caps live");
  });

  it("releases each rebuilt light's shadow map now that the context is no longer lost between builds", () => {
    const disposeBody = roomSource.slice(roomSource.indexOf("function disposeObject(root: THREE.Object3D)"));
    const end = disposeBody.indexOf("textures.forEach((texture) => texture.dispose());");
    expect(end).toBeGreaterThan(0);
    const body = disposeBody.slice(0, end);
    expect(body).toContain("lightShadow?.map");
    expect(body).toContain("shadowMap.dispose();");
    expect(body).toContain("lightShadow.map = null;");
  });
});

describe("re-applying work that is already done is a no-op", () => {
  it("keeps the 3D view mounted while the catalog scene refetches in the background", () => {
    expect(designToolSource).toContain("isFetching: interactive3dFetching");
    expect(designToolSource).toContain("const interactive3dLoading = interactive3dFetching && !interactive3dScene;");
    expect(designToolSource).toContain("{ enabled: canLoadCatalogInteractive3d, refetchOnWindowFocus: false }");
  });

  it("ignores a 3D presentation report that matches the stored presentation", () => {
    const start = designToolSource.indexOf("const setInteractive3dPresentation = useCallback(");
    expect(start).toBeGreaterThan(-1);
    const body = designToolSource.slice(start, designToolSource.indexOf("}, []);", start));
    expect(body).toContain("current.cabinetFinish === next.cabinetFinish && current.countertopFinish === next.countertopFinish");
    expect(body).toContain("? current");
  });

  it("keeps the wall-height object when the synced heights did not change", () => {
    expect(sameThreeDWallHeights({ top: 96, left: 96, right: 96, bottom: 96 }, { top: 96, left: 96, right: 96, bottom: 96 })).toBe(true);
    expect(sameThreeDWallHeights({ top: 96, left: 96, right: 96, bottom: 96 }, { top: 96, left: 108, right: 96, bottom: 96 })).toBe(false);
    expect(roomSource).toContain("setWallHeights((current) => sameThreeDWallHeights(current, nextHeights) ? current : nextHeights);");
  });

  it("never sets the deprecated soft shadow type that three.js resets on every frame", () => {
    expect(roomSource).not.toContain("PCFSoftShadowMap");
  });
});

describe("full-screen 3D view does not remount on texture URL changes", () => {
  it("keys both 3D views on the stable surface product ids", () => {
    expect(designToolSource).toContain("key={`active-surfaces-${threeDSurfaceViewKey}`}");
    expect(designToolSource).toContain("key={`active-surfaces-full-${threeDSurfaceViewKey}`}");
  });

  it("builds the remount key from surface product ids, never pending texture URLs", () => {
    const start = designToolSource.indexOf("const threeDSurfaceViewKey = useMemo(");
    expect(start).toBeGreaterThan(-1);
    const end = designToolSource.indexOf('].join("-")', start);
    expect(end).toBeGreaterThan(start);
    const builder = designToolSource.slice(start, end);
    expect(builder).toContain("threeDSurfaceProductIds.flooring");
    expect(builder).toContain("threeDSurfaceProductIds.backsplash");
    expect(builder).not.toContain("threeDSurfaceTextureUrls");
    expect(builder).not.toContain("pending");
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
