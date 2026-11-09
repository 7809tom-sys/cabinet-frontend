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
