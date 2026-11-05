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

export class ThreeDRendererHost {
  private renderer: THREE.WebGLRenderer | null = null;

  constructor(private readonly createRenderer: ThreeDRendererFactory = createThreeDWebGLRenderer) {}

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

  /** Unmount-only teardown. forceContextLoss is required because dispose()
   * alone leaves the browser's WebGL context alive, and Chrome caps live
   * contexts, so repeated Designer opens eventually refuse new ones. */
  dispose(): void {
    const renderer = this.renderer;
    if (!renderer) return;
    this.renderer = null;
    try {
      renderer.dispose();
    } finally {
      try { renderer.forceContextLoss(); } catch { /* already lost */ }
      renderer.domElement.remove();
    }
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
