// @vitest-environment jsdom
/**
 * The 3D view when Chrome will not give it a WebGL context: briefly while its
 * GPU process restarts after a reset, and for the rest of the page's life once
 * the page has lost a context to a second reset. These mount the real component
 * and hold that the customer never has to close tabs, change settings or press
 * Retry: starts are retried silently, a blocked page reloads into 3D, and the
 * notice is a last resort that keeps trying on its own.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pageReloadEnv } from "@/lib/staleChunkReload";
import { InteractiveRoom3D } from "./InteractiveRoom3D";
import { THREE_D_CONTEXT_ATTEMPTS, THREE_D_START_RETRY_DELAYS_MS } from "./threeDRendererHost";

const hosts = vi.hoisted(() => ({ created: 0, released: 0 }));
vi.mock("./threeDRendererHost", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./threeDRendererHost")>();
  class CountedHost extends actual.ThreeDRendererHost {
    constructor(...args: ConstructorParameters<typeof actual.ThreeDRendererHost>) {
      super(...args);
      hosts.created += 1;
    }
    release() {
      hosts.released += 1;
      super.release();
    }
  }
  return { ...actual, ThreeDRendererHost: CountedHost };
});

const { router } = vi.hoisted(() => {
  const queryResult = {
    data: undefined,
    isLoading: false,
    isPending: false,
    isSuccess: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: async () => ({}),
  };
  const mutationResult = { mutate: () => {}, mutateAsync: async () => ({}), isPending: false, reset: () => {}, error: null };
  const hooks: Record<string, unknown> = {
    useQuery: () => queryResult,
    useMutation: () => mutationResult,
    useInfiniteQuery: () => ({ ...queryResult, fetchNextPage: async () => {} }),
    useSuspenseQuery: () => queryResult,
    setData: async () => ({}),
    invalidate: async () => ({}),
  };
  const proxy: unknown = new Proxy(function noop() {}, {
    get(_target, prop: string) {
      if (prop in hooks) return hooks[prop];
      return proxy;
    },
    apply() {
      return proxy;
    },
  });
  return { router: proxy };
});

vi.mock("@/lib/trpc", () => ({ trpc: router }));
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, isAuthenticated: false, loading: false, logout: async () => {} }),
}));
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { signOut: async () => ({}), getSession: async () => ({ data: { session: null } }) } },
}));

const scene = {
  roomShape: {
    id: "rectangle",
    name: "Rectangle",
    defaultDimensions: { width: 144, depth: 120, ceilingHeight: 96 },
    geometryTemplate: null,
  },
  layout: { id: "saved-2d-plan", name: "Saved 2D plan" },
  suggestions: [],
  materials: {
    cabinet: { publicName: "Finish", name: "Finish", color: null, finish: null, doorStyle: null, doorPanelType: null },
    defaults: { floor: "#ebe5db", countertop: "#3d4245", backsplash: "#f2f0ea", wall: "#f7f5f0" },
  },
} as unknown as Parameters<typeof InteractiveRoom3D>[0]["scene"];

type GetContext = HTMLCanvasElement["getContext"];
let restoreGetContext: (() => void) | null = null;
let contextRequests: Array<{ type: string; attributes: unknown }> = [];

/** A browser that refuses every WebGL context, optionally because it blocked the page. */
function browserRefuses(statusMessage = "Could not create a WebGL context") {
  const original = HTMLCanvasElement.prototype.getContext;
  contextRequests = [];
  HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement, type: string, attributes?: unknown) {
    contextRequests.push({ type, attributes });
    const event = new Event("webglcontextcreationerror") as Event & { statusMessage: string };
    event.statusMessage = statusMessage;
    this.dispatchEvent(event);
    return null;
  } as unknown as GetContext;
  restoreGetContext = () => {
    HTMLCanvasElement.prototype.getContext = original;
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
    });
  }
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  restoreGetContext?.();
  restoreGetContext = null;
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

const starting = (container: HTMLElement) => container.querySelector('[data-testid="webgl-starting"]');
const notice = (container: HTMLElement) => container.querySelector('[data-testid="webgl-unavailable"]')?.textContent ?? "";
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe("3D view while Chrome refuses a WebGL context", () => {
  it("retries silently, asking once per attempt, before any notice", async () => {
    browserRefuses();
    const { container } = render(<InteractiveRoom3D scene={scene} placed={[]} />);
    await advance(0);
    expect(starting(container)?.textContent).toBe("Starting the 3D view…");
    expect(notice(container)).toBe("");
    for (const delay of THREE_D_START_RETRY_DELAYS_MS.slice(0, -1)) {
      await advance(delay);
      expect(notice(container)).toBe("");
    }
    // Only WebGL 2 requests with the start's own attributes: no unattributed second request left alive.
    expect(contextRequests.every((request) => request.type === "webgl2" && request.attributes != null)).toBe(true);
    expect(contextRequests.length % THREE_D_CONTEXT_ATTEMPTS.length).toBe(0);
  });

  it("ends on a notice that keeps trying and never sends the customer to tabs or browser settings", async () => {
    browserRefuses();
    const { container } = render(<InteractiveRoom3D scene={scene} placed={[]} />);
    await advance(0);
    for (const delay of THREE_D_START_RETRY_DELAYS_MS) await advance(delay);
    expect(notice(container)).toContain("keeps trying on its own");
    expect(notice(container)).toContain("2D plan and elevation preview stay available");
    expect(notice(container)).not.toMatch(/close other|tab|setting|chrome|acceleration|press retry/i);
    const before = contextRequests.length;
    await advance(15_000);
    expect(contextRequests.length).toBeGreaterThan(before);
  });

  it("keeps one renderer host through the retries and releases it on unmount", async () => {
    browserRefuses();
    hosts.created = 0;
    hosts.released = 0;
    const { unmount } = render(<InteractiveRoom3D scene={scene} placed={[]} />);
    await advance(0);
    for (const delay of THREE_D_START_RETRY_DELAYS_MS) await advance(delay);
    unmount();
    expect(hosts.created).toBe(1);
    expect(hosts.released).toBe(hosts.created);
  });

  it("tells the customer to reload when Chrome has blocked WebGL for the site, and that reload lands back in 3D", async () => {
    browserRefuses("Web page caused context loss and was blocked");
    const reload = vi.spyOn(pageReloadEnv, "reload").mockImplementation(() => undefined);
    const onWebglBlocked = vi.fn();
    window.history.replaceState(null, "", "/design?room=bathroom");
    const { container } = render(<InteractiveRoom3D scene={scene} placed={[]} onWebglBlocked={onWebglBlocked} />);
    await advance(0);
    expect(notice(container)).toMatch(/Reload this page to bring the 3D view back; your design is kept/);
    expect(notice(container)).not.toMatch(/close|\btabs?\b|setting|acceleration/i);
    expect(onWebglBlocked).toHaveBeenCalledTimes(1);
    expect(new URLSearchParams(window.location.search).get("preview")).toBe("3d");
    expect(new URLSearchParams(window.location.search).get("room")).toBe("bathroom");
    // A reload the page starts itself does not lift Chrome's block, so it never tries one.
    await advance(60_000);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("3D view after a GPU reset", () => {
  const source = readFileSync(resolve(process.cwd(), "client/src/components/design/InteractiveRoom3D.tsx"), "utf8");

  it("follows loss and restore on the renderer and rebuilds the scene on restore", () => {
    expect(source).toContain("const detachContextRecovery = threeDStart.attach(renderer);");
    expect(source).toContain("detachContextRecovery();");
    expect(source).toMatch(/\}, \[webglUnavailable, webglContextGeneration, scene,/);
    expect(source).toContain('data-testid="webgl-context-lost"');
    expect(source).not.toMatch(/claimThreeDGpuRecovery|GPU_RESET_LIMIT/);
  });

  it("never swaps in an unreleased host after a recovery", () => {
    const mountEffect = source.slice(source.indexOf("const host = new ThreeDRendererHost();"), source.indexOf("const host = new ThreeDRendererHost();") + 700);
    expect(mountEffect).toContain("if (current && current !== host) current.release();");
  });

  it("holds the Auto-Design sink and faucet choosers while the paused notice shows", () => {
    const designTool = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");
    expect(designTool).toContain("open={autoDesignFaucetPrompt != null && !threeDGraphicsPaused}");
    expect(designTool).toContain("open={autoDesignSinkPrompt != null && !threeDGraphicsPaused}");
    expect(designTool.match(/onGraphicsPausedChange=\{setThreeDGraphicsPaused\}/g)?.length).toBe(2);
    expect(source).toContain("onGraphicsPausedChangeRef.current?.(webglContextLost);");
  });
});
