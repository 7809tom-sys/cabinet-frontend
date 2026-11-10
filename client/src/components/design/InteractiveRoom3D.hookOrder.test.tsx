// @vitest-environment jsdom
/**
 * Regression cover for the production /design crash on 2026-11-08: "Minified
 * React error #300 — Rendered fewer hooks than expected".
 *
 * `InteractiveRoom3D` returned early for an empty room and for a failed WebGL
 * start, but declared one `useState` (the `?colorTrace=1` dismiss flag) after
 * both returns. The first render ran every hook; the moment the renderer could
 * not create a context — which is exactly what the fallback notice exists for —
 * the next render stopped before that hook and React aborted the whole Designer
 * to the top-level error boundary.
 *
 * Both tests mount the real component and drive the two early-return paths, so a
 * hook declared below either one fails here instead of in production.
 */
import { act, cleanup, render } from "@testing-library/react";
import { Component, type ReactNode } from "react";
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

/** The error the Designer's top-level boundary showed in production. */
const HOOK_ORDER_MESSAGE = /fewer hooks|more hooks|order of Hooks|Rendered (fewer|more)/i;

class CatchRendered extends Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }
  render() {
    return this.state.message === null
      ? this.props.children
      : <div data-testid="crashed">{this.state.message}</div>;
  }
}

type GetContext = HTMLCanvasElement["getContext"];
let restoreGetContext: (() => void) | null = null;

beforeEach(() => {
  // A machine that cannot hand out a WebGL context (GPU blocklisted, or the
  // browser's live-context cap reached). This is the path that crashed, so every
  // canvas — the 3D stage included — gets no drawing context at all.
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function getContext() {
    return null;
  } as unknown as GetContext;
  restoreGetContext = () => {
    HTMLCanvasElement.prototype.getContext = original;
  };
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
});

describe("InteractiveRoom3D hook order", () => {
  it("falls back to the WebGL notice without a hook-order crash", async () => {
    const { container, queryByTestId } = render(
      <CatchRendered>
        <InteractiveRoom3D scene={scene} placed={[]} />
      </CatchRendered>,
    );

    // The scene effect runs after the first paint, fails to get a context, and
    // re-renders through the `webglUnavailable` early return.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });

    const crash = queryByTestId("crashed");
    expect(crash?.textContent ?? "").not.toMatch(HOOK_ORDER_MESSAGE);
    expect(crash).toBeNull();
    expect(container.querySelector('[data-testid="webgl-starting"], [data-testid="webgl-unavailable"]')).not.toBeNull();
  });

  it("can go from the empty-room early return to a full render", async () => {
    const emptyScene = { ...scene, roomShape: null } as typeof scene;
    const { queryByTestId, rerender } = render(
      <CatchRendered>
        <InteractiveRoom3D scene={emptyScene} placed={[]} />
      </CatchRendered>,
    );
    expect(queryByTestId("crashed")).toBeNull();

    rerender(
      <CatchRendered>
        <InteractiveRoom3D scene={scene} placed={[]} />
      </CatchRendered>,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });

    const crash = queryByTestId("crashed");
    expect(crash?.textContent ?? "").not.toMatch(HOOK_ORDER_MESSAGE);
  });
});
