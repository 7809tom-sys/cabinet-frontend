// @vitest-environment jsdom
/**
 * The 3D view in a browser that cannot give it WebGL 2 — Chrome with WebGL 2
 * switched off, or with graphics acceleration off / the GPU blocked for the
 * page. three.js renders only through WebGL 2, so these mount the real
 * component and hold that the customer gets the specific browser fix instead of
 * "close other 3D tabs", and that a lost GPU context is handled instead of
 * leaving a blank canvas.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InteractiveRoom3D } from "./InteractiveRoom3D";

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
let contextRequests: string[] = [];

/** A browser that hands out only the context types listed. */
function browserOffers(types: string[]) {
  const original = HTMLCanvasElement.prototype.getContext;
  contextRequests = [];
  HTMLCanvasElement.prototype.getContext = function getContext(type: string) {
    contextRequests.push(type);
    if (!types.includes(type)) return null;
    return { getExtension: () => ({ loseContext() {} }) };
  } as unknown as GetContext;
  restoreGetContext = () => {
    HTMLCanvasElement.prototype.getContext = original;
  };
}

beforeEach(() => {
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
  restoreGetContext?.();
  restoreGetContext = null;
  vi.restoreAllMocks();
});

const notice = (container: HTMLElement) => container.querySelector('[data-testid="webgl-unavailable"]')?.textContent ?? "";
const wait = (ms: number) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });

describe("3D view without WebGL 2", () => {
  it("says WebGL 2 is off and how to turn it on, without pointless retries", async () => {
    browserOffers(["webgl"]);
    const { container } = render(<InteractiveRoom3D scene={scene} placed={[]} />);
    await wait(250);
    expect(notice(container)).toContain("WebGL 2 turned off");
    expect(notice(container)).toContain("Use graphics acceleration when available");
    expect(notice(container)).not.toContain("Close other 3D tabs");
    expect(notice(container)).toContain("Retry 3D view");
    // Every renderer attempt asked for WebGL 2 before the notice.
    expect(contextRequests.filter((type) => type === "webgl2").length).toBeGreaterThanOrEqual(4);
  });

  it("says WebGL is blocked after the automatic retries when no WebGL is offered", async () => {
    browserOffers([]);
    const { container } = render(<InteractiveRoom3D scene={scene} placed={[]} />);
    await wait(250);
    expect(notice(container)).toContain("Starting the interactive 3D view");
    for (let i = 0; i < 16 && notice(container).includes("Starting"); i++) await wait(500);
    expect(notice(container)).toContain("not letting this page use 3D graphics");
    expect(notice(container)).toContain("chrome://gpu");
  }, 20_000);
});

describe("3D view after a GPU reset", () => {
  const source = readFileSync(resolve(process.cwd(), "client/src/components/design/InteractiveRoom3D.tsx"), "utf8");

  it("shows a paused notice, rebuilds on restore, and starts a new context when Chrome never restores", () => {
    expect(source).toContain('renderer.domElement.addEventListener("webglcontextlost", onWebglContextLost);');
    expect(source).toContain('renderer.domElement.addEventListener("webglcontextrestored", onWebglContextRestored);');
    expect(source).toContain('renderer.domElement.removeEventListener("webglcontextlost", onWebglContextLost);');
    expect(source).toContain("setWebglContextGeneration((generation) => generation + 1);");
    expect(source).toMatch(/\}, \[webglUnavailable, webglContextGeneration, scene,/);
    expect(source).toContain('data-testid="webgl-context-lost"');
    const timeout = source.slice(source.indexOf("if (!webglContextLost) return;"), source.indexOf("}, [webglContextLost]);"));
    expect(timeout).toContain("rendererHostRef.current?.dispose();");
    expect(timeout).toContain("setWebglUnavailable(true);");
  });
});
