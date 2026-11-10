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

/**
 * Context requests, most capable first. None asks for the discrete GPU:
 * "high-performance" makes dual-GPU laptops switch GPUs, which can cost the
 * page a context. three.js only renders through WebGL 2.
 */
export const THREE_D_CONTEXT_ATTEMPTS: readonly WebGLContextAttributes[] = [
  { alpha: true, antialias: true, stencil: true, preserveDrawingBuffer: true, powerPreference: "default", failIfMajorPerformanceCaveat: false },
  { alpha: true, antialias: false, stencil: true, preserveDrawingBuffer: true, powerPreference: "default", failIfMajorPerformanceCaveat: false },
  { alpha: true, antialias: false, stencil: false, preserveDrawingBuffer: true, powerPreference: "low-power", failIfMajorPerformanceCaveat: false },
];

/**
 * Why the last start failed. "blocked" is Chrome refusing WebGL to the whole
 * site because a second GPU reset hit while the site held a live context. Only
 * a reload the customer starts from the browser lifts it; a reload or
 * navigation started by the page, even from a click, does not.
 */
export type ThreeDStartFailure = "blocked" | "unavailable";
let lastStartFailure: ThreeDStartFailure | null = null;

export function lastThreeDStartFailure(): ThreeDStartFailure | null {
  return lastStartFailure;
}

function releaseContext(context: WebGLRenderingContext | WebGL2RenderingContext | null | undefined): void {
  try {
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    /* already lost */
  }
}

/**
 * Asks for the context itself and hands it to three.js, instead of letting
 * three.js ask. On a refused request three.js asks again without attributes just
 * to word its error, and that second context is never released; a context that
 * arrives already lost (the GPU process is restarting) makes its constructor
 * throw. Either way a failed start would leave a live context behind.
 */
export function createThreeDWebGLRenderer(createCanvas: () => HTMLCanvasElement = () => document.createElement("canvas")): THREE.WebGLRenderer | null {
  let blocked = false;
  let lastError: unknown = null;
  for (const attributes of THREE_D_CONTEXT_ATTEMPTS) {
    let context: WebGL2RenderingContext | null = null;
    try {
      const canvas = createCanvas();
      const onCreationError = (event: Event) => {
        if (/blocked/i.test((event as WebGLContextEvent).statusMessage ?? "")) blocked = true;
      };
      canvas.addEventListener?.("webglcontextcreationerror", onCreationError);
      try {
        context = canvas.getContext("webgl2", attributes) as WebGL2RenderingContext | null;
      } finally {
        canvas.removeEventListener?.("webglcontextcreationerror", onCreationError);
      }
      if (!context || context.isContextLost()) continue;
      const renderer = new THREE.WebGLRenderer({ ...attributes, canvas, context } as THREE.WebGLRendererParameters);
      lastStartFailure = null;
      return renderer;
    } catch (error) {
      lastError = error;
      releaseContext(context);
    }
  }
  lastStartFailure = blocked ? "blocked" : "unavailable";
  console.warn("[3D] WebGL could not start", lastError ?? lastStartFailure);
  return null;
}

/** Waits between silent start attempts, then THREE_D_BACKGROUND_RETRY_MS for as long as the view stays open. */
export const THREE_D_START_RETRY_DELAYS_MS = [250, 500, 1000, 2000, 4000, 8000] as const;
export const THREE_D_BACKGROUND_RETRY_MS = 15_000;
/** Chrome restores a context lost to one GPU reset within about a second; past this the view starts a new one. */
export const THREE_D_RESTORE_WAIT_MS = 2500;

export const THREE_D_STARTING_MESSAGE = "Starting the 3D view…";
export const THREE_D_RECONNECTING_MESSAGE = "Reconnecting the 3D view…";
export const THREE_D_UNAVAILABLE_MESSAGE =
  "The 3D view is taking longer than usual to start. It keeps trying on its own; your 2D plan and elevation preview stay available.";
export const THREE_D_BLOCKED_MESSAGE =
  "Chrome paused 3D graphics on this site after your graphics card reset. Reload this page to bring the 3D view back; your design is kept on this device, and your 2D plan and elevation preview stay available.";

/**
 * Renderers handed back by unmounted 3D views. Switching between Plan and 3D,
 * or between the kitchen, bathroom and closet designers, unmounts one view and
 * mounts the next; taking the parked renderer keeps the live WebGL context
 * count flat instead of asking the browser for a new context each time.
 *
 * A parked renderer still holds a live context, and Chrome blocks WebGL for the
 * whole site once a second GPU reset (sleep and wake, a driver update, a display
 * change) hits while the site holds one. So parking only bridges quick view
 * switches: parked renderers are destroyed after THREE_D_PARK_GRACE_MS, and at
 * once when the page is hidden.
 */
const MAX_PARKED_RENDERERS = 2;
export const THREE_D_PARK_GRACE_MS = 15_000;
const parkedRenderers: THREE.WebGLRenderer[] = [];
let parkTimer: ReturnType<typeof setTimeout> | null = null;
let purgeWhenHiddenInstalled = false;

function scheduleParkedRendererPurge(): void {
  if (parkTimer) clearTimeout(parkTimer);
  parkTimer = setTimeout(clearParkedThreeDRenderers, THREE_D_PARK_GRACE_MS);
  if (purgeWhenHiddenInstalled || typeof document === "undefined") return;
  purgeWhenHiddenInstalled = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") clearParkedThreeDRenderers();
  });
}

function threeDRendererContextLost(renderer: THREE.WebGLRenderer): boolean {
  try {
    return renderer.getContext().isContextLost();
  } catch {
    return true;
  }
}

function destroyThreeDRenderer(renderer: THREE.WebGLRenderer): void {
  let context: WebGL2RenderingContext | null = null;
  try {
    context = renderer.getContext() as WebGL2RenderingContext;
  } catch {
    /* no context */
  }
  if (context && threeDRendererContextLost(renderer)) {
    // A lost context cannot be released, and three.js has already asked Chrome
    // to restore it; Chrome then brings it back with no renderer attached, a
    // live context nobody owns. Give it straight back when that happens.
    renderer.domElement.addEventListener("webglcontextrestored", () => releaseContext(context), { once: true });
  }
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

/** Destroys every parked renderer, releasing its context. */
export function clearParkedThreeDRenderers(): void {
  if (parkTimer) clearTimeout(parkTimer);
  parkTimer = null;
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
    scheduleParkedRendererPurge();
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
 * Hard ceiling for the drawing buffer. A 3x display otherwise allocates a
 * framebuffer several times the CSS size, on top of a shadow map up to 2048,
 * which is enough to reset the GPU. The quality profile already stays at or
 * under this; sizeThreeDRenderer enforces it for every caller.
 */
export const THREE_D_MAX_PIXEL_RATIO = 1.75;

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
  const cappedRatio = Math.min(Math.max(1, pixelRatio || 1), THREE_D_MAX_PIXEL_RATIO);
  const current = new THREE.Vector2();
  renderer.getSize(current);
  if (renderer.getPixelRatio() === cappedRatio && current.x === width && current.y === height) return false;
  renderer.setPixelRatio(cappedRatio);
  renderer.setSize(width, height);
  return true;
}
