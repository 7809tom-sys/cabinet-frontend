import * as THREE from "three";

/**
 * The 3D view owns exactly one WebGL renderer and canvas for the life of the
 * component. Rebuilding the scene used to create a renderer, append its canvas,
 * and then dispose/forceContextLoss/remove it on every state change, which
 * blanked the view while the browser made a new context. Scene contents are now
 * rebuilt against this one renderer, so the previous frame stays on screen until
 * the next scene paints.
 */
export type ThreeDRendererFactory = () => THREE.WebGLRenderer | null;

export function createThreeDWebGLRenderer(): THREE.WebGLRenderer | null {
  try {
    return new THREE.WebGLRenderer({ antialias: true, alpha: true, stencil: true, powerPreference: "high-performance", preserveDrawingBuffer: true });
  } catch {
    // Some browsers refuse the first request (another tab or an earlier test may still
    // hold graphics contexts). Retry with plainer settings before giving up.
    try {
      return new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
    } catch {
      // Hybrid-graphics laptops can refuse the discrete GPU; ask for the
      // integrated one and accept a software-backed context.
      try {
        return new THREE.WebGLRenderer({ preserveDrawingBuffer: true, powerPreference: "low-power", failIfMajorPerformanceCaveat: false });
      } catch {
        // Last resort for Chrome with a restricted GPU: default options only.
        try {
          return new THREE.WebGLRenderer({ preserveDrawingBuffer: true });
        } catch (error) {
          console.warn("[3D] WebGL could not start", error);
          return null;
        }
      }
    }
  }
}

/**
 * Why no renderer could start. three.js only renders through WebGL 2, so a
 * browser that still offers WebGL 1 (WebGL 2 switched off) cannot be fixed by
 * retrying, and neither can one that offers no WebGL at all (graphics
 * acceleration off, or the GPU blocked for this page after repeated resets).
 */
export type ThreeDWebGLSupport = "webgl2" | "webgl1-only" | "none";

export function detectThreeDWebGLSupport(createCanvas: () => HTMLCanvasElement = () => document.createElement("canvas")): ThreeDWebGLSupport {
  const tryContext = (type: "webgl2" | "webgl"): boolean => {
    try {
      const context = createCanvas().getContext(type) as WebGLRenderingContext | WebGL2RenderingContext | null;
      if (!context) return false;
      context.getExtension("WEBGL_lose_context")?.loseContext();
      return true;
    } catch {
      return false;
    }
  };
  if (tryContext("webgl2")) return "webgl2";
  return tryContext("webgl") ? "webgl1-only" : "none";
}

export function threeDWebGLUnavailableMessage(support: ThreeDWebGLSupport): string {
  const keep = "Your 2D plan and elevation preview remain available.";
  if (support === "webgl1-only") {
    return `This browser has WebGL 2 turned off, and the 3D view needs it. In Chrome, open Settings > System, turn on "Use graphics acceleration when available", relaunch Chrome, then press Retry. ${keep}`;
  }
  if (support === "none") {
    return `This browser is not letting this page use 3D graphics (WebGL is off or blocked). In Chrome, open Settings > System, turn on "Use graphics acceleration when available", and relaunch Chrome. If it is already on, chrome://gpu shows whether WebGL is blocked. Then press Retry. ${keep}`;
  }
  return `The interactive 3D view could not start. Close other 3D tabs, then press Retry. ${keep}`;
}

/**
 * Renderers handed back by unmounted 3D views. Switching between Plan and 3D,
 * or between the kitchen, bathroom and closet designers, unmounts one view and
 * mounts the next; taking the parked renderer keeps the live WebGL context
 * count flat instead of asking the browser for a new context each time.
 */
const MAX_PARKED_RENDERERS = 2;
const parkedRenderers: THREE.WebGLRenderer[] = [];

function threeDRendererContextLost(renderer: THREE.WebGLRenderer): boolean {
  try {
    return renderer.getContext().isContextLost();
  } catch {
    return true;
  }
}

function destroyThreeDRenderer(renderer: THREE.WebGLRenderer): void {
  try {
    renderer.dispose();
  } finally {
    try { renderer.forceContextLoss(); } catch { /* already lost */ }
    renderer.domElement.remove();
  }
}

export function takeParkedThreeDRenderer(): THREE.WebGLRenderer | null {
  while (parkedRenderers.length > 0) {
    const renderer = parkedRenderers.pop()!;
    if (!threeDRendererContextLost(renderer)) return renderer;
    destroyThreeDRenderer(renderer);
  }
  return null;
}

export function parkedThreeDRendererCount(): number {
  return parkedRenderers.length;
}

/** Test hook: drops every parked renderer. */
export function clearParkedThreeDRenderers(): void {
  while (parkedRenderers.length > 0) destroyThreeDRenderer(parkedRenderers.pop()!);
}

export function createOrReuseThreeDWebGLRenderer(): THREE.WebGLRenderer | null {
  return takeParkedThreeDRenderer() ?? createThreeDWebGLRenderer();
}

export class ThreeDRendererHost {
  private renderer: THREE.WebGLRenderer | null = null;

  constructor(private readonly createRenderer: ThreeDRendererFactory = createOrReuseThreeDWebGLRenderer) {}

  get current() {
    return this.renderer;
  }

  /**
   * Returns this mount's renderer, creating it on first use. The canvas is only
   * re-attached when the host element changed (a WebGL retry swaps the node), so
   * a scene rebuild keeps the same canvas and its last frame.
   */
  ensureMounted(mount: HTMLElement): THREE.WebGLRenderer | null {
    if (!this.renderer) {
      this.renderer = this.createRenderer();
      if (!this.renderer) return null;
    }
    const canvas = this.renderer.domElement;
    if (canvas.parentElement !== mount) mount.replaceChildren(canvas);
    return this.renderer;
  }

  /**
   * Unmount teardown. A healthy renderer is parked for the next 3D view to
   * take; a lost one, or one beyond the parking limit, is destroyed.
   */
  release(): void {
    const renderer = this.renderer;
    if (!renderer) return;
    this.renderer = null;
    if (threeDRendererContextLost(renderer) || parkedRenderers.length >= MAX_PARKED_RENDERERS) {
      destroyThreeDRenderer(renderer);
      return;
    }
    renderer.setAnimationLoop(null);
    renderer.setRenderTarget(null);
    renderer.renderLists.dispose();
    const canvas = renderer.domElement;
    canvas.remove();
    // Each view labels and styles the canvas for itself; the next view must not
    // inherit test ids, aria labels, cursors or published bounds.
    for (const name of canvas.getAttributeNames()) {
      if (name !== "width" && name !== "height") canvas.removeAttribute(name);
    }
    // A 1x1 buffer frees the old frame's memory and makes the next view's first
    // size call apply its own size and CSS.
    renderer.setSize(1, 1, false);
    parkedRenderers.push(renderer);
  }

  /** Hard teardown for a failed start. forceContextLoss is required because
   * dispose() alone leaves the browser's WebGL context alive, and Chrome caps live
   * contexts, so the retry must not inherit this one. */
  dispose(): void {
    const renderer = this.renderer;
    if (!renderer) return;
    this.renderer = null;
    destroyThreeDRenderer(renderer);
  }
}

/**
 * Resizes the reused canvas only when the pixel ratio or the CSS size actually
 * changed. Re-assigning the same width/height still resets the drawing buffer,
 * which would blank the frame that is already on screen.
 */
export function sizeThreeDRenderer(
  renderer: THREE.WebGLRenderer,
  width: number,
  height: number,
  pixelRatio: number,
): boolean {
  const current = new THREE.Vector2();
  renderer.getSize(current);
  if (renderer.getPixelRatio() === pixelRatio && current.x === width && current.y === height) return false;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height);
  return true;
}
