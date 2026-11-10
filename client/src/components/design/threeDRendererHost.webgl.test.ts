// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const constructed: Array<Record<string, unknown>> = [];
let constructorThrows = 0;
vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();
  return {
    ...actual,
    WebGLRenderer: function FakeRenderer(this: object, options: Record<string, unknown>) {
      constructed.push(options);
      if (constructed.length <= constructorThrows) throw new TypeError("Cannot read properties of null (reading 'precision')");
      return { options };
    },
  };
});

const {
  THREE_D_BLOCKED_MESSAGE,
  THREE_D_CONTEXT_ATTEMPTS,
  THREE_D_MAX_PIXEL_RATIO,
  THREE_D_PARK_GRACE_MS,
  THREE_D_STARTING_MESSAGE,
  THREE_D_UNAVAILABLE_MESSAGE,
  ThreeDRendererHost,
  clearParkedThreeDRenderers,
  createThreeDWebGLRenderer,
  lastThreeDStartFailure,
  parkedThreeDRendererCount,
  sizeThreeDRenderer,
} = await import("./threeDRendererHost");

type Answer = "refuse" | "blocked" | "lost" | "ok";

/** A browser whose successive webgl2 requests get the listed answers. */
function browser(answers: Answer[]) {
  const requests: Array<{ type: string; attributes: unknown }> = [];
  const released: number[] = [];
  const createCanvas = () => {
    const canvas = document.createElement("canvas");
    canvas.getContext = ((type: string, attributes: unknown) => {
      const index = requests.length;
      requests.push({ type, attributes });
      const answer = answers[index] ?? "refuse";
      if (answer === "refuse" || answer === "blocked") {
        const event = new Event("webglcontextcreationerror") as Event & { statusMessage: string };
        event.statusMessage = answer === "blocked" ? "Web page caused context loss and was blocked" : "Could not create a WebGL context";
        canvas.dispatchEvent(event);
        return null;
      }
      return {
        isContextLost: () => answer === "lost",
        getExtension: (name: string) => (name === "WEBGL_lose_context" && answer !== "lost" ? { loseContext: () => released.push(index) } : null),
      };
    }) as unknown as HTMLCanvasElement["getContext"];
    return canvas;
  };
  return { createCanvas, requests, released };
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  constructed.length = 0;
  constructorThrows = 0;
  vi.restoreAllMocks();
});

describe("starting the WebGL renderer", () => {
  it("never asks for the discrete GPU and never fails on a performance caveat", () => {
    for (const attributes of THREE_D_CONTEXT_ATTEMPTS) {
      expect(attributes.powerPreference).not.toBe("high-performance");
      expect(attributes.failIfMajorPerformanceCaveat).toBe(false);
    }
    expect(THREE_D_CONTEXT_ATTEMPTS.map((attributes) => attributes.antialias)).toEqual([true, false, false]);
  });

  it("falls back to plainer attributes and hands three.js the context it got", () => {
    const fake = browser(["refuse", "refuse", "ok"]);
    const renderer = createThreeDWebGLRenderer(fake.createCanvas) as unknown as { options: Record<string, unknown> };
    expect(renderer).not.toBeNull();
    expect(fake.requests.map((request) => request.type)).toEqual(["webgl2", "webgl2", "webgl2"]);
    expect(fake.requests.map((request) => request.attributes)).toEqual(THREE_D_CONTEXT_ATTEMPTS);
    expect(constructed).toHaveLength(1);
    expect(constructed[0].context).toBeDefined();
    expect(lastThreeDStartFailure()).toBeNull();
  });

  it("asks once per attempt when the browser refuses, so a refusal leaves no context behind", () => {
    const fake = browser([]);
    expect(createThreeDWebGLRenderer(fake.createCanvas)).toBeNull();
    // three.js on its own asks a second time, without attributes, to word its error, and never releases that context.
    expect(fake.requests).toHaveLength(THREE_D_CONTEXT_ATTEMPTS.length);
    expect(constructed).toHaveLength(0);
    expect(lastThreeDStartFailure()).toBe("unavailable");
  });

  it("skips a context that arrives already lost instead of letting three.js throw on it", () => {
    const fake = browser(["lost", "ok"]);
    expect(createThreeDWebGLRenderer(fake.createCanvas)).not.toBeNull();
    expect(constructed).toHaveLength(1);
  });

  it("releases the context when three.js cannot start on it", () => {
    constructorThrows = 1;
    const fake = browser(["ok", "ok"]);
    expect(createThreeDWebGLRenderer(fake.createCanvas)).not.toBeNull();
    expect(fake.released).toEqual([0]);
  });

  it("recognizes Chrome blocking WebGL for the page", () => {
    expect(createThreeDWebGLRenderer(browser(["blocked", "blocked", "blocked"]).createCanvas)).toBeNull();
    expect(lastThreeDStartFailure()).toBe("blocked");
    expect(createThreeDWebGLRenderer(browser(["ok"]).createCanvas)).not.toBeNull();
    expect(lastThreeDStartFailure()).toBeNull();
  });
});

describe("a renderer destroyed while its context is lost", () => {
  it("gives the context back when Chrome restores it later", () => {
    const canvas = document.createElement("canvas");
    let lost = true;
    const loseContext = vi.fn();
    const context = { isContextLost: () => lost, getExtension: () => ({ loseContext }) };
    const renderer = { domElement: canvas, getContext: () => context, dispose: vi.fn(), forceContextLoss: vi.fn() };
    const host = new ThreeDRendererHost(() => renderer as never);
    host.ensureMounted(document.createElement("div"));
    host.dispose();
    expect(loseContext).not.toHaveBeenCalled();
    lost = false;
    canvas.dispatchEvent(new Event("webglcontextrestored"));
    expect(loseContext).toHaveBeenCalledTimes(1);
  });
});

describe("parked renderers", () => {
  function healthyRenderer() {
    const canvas = document.createElement("canvas");
    const renderer = {
      domElement: canvas,
      getContext: () => ({ isContextLost: () => false }),
      dispose: vi.fn(),
      forceContextLoss: vi.fn(),
      setAnimationLoop: vi.fn(),
      setRenderTarget: vi.fn(),
      setSize: vi.fn(),
      renderLists: { dispose: vi.fn() },
    };
    return renderer;
  }
  function park(renderer: ReturnType<typeof healthyRenderer>) {
    const host = new ThreeDRendererHost(() => renderer as never);
    host.ensureMounted(document.createElement("div"));
    host.release();
  }

  afterEach(() => {
    clearParkedThreeDRenderers();
    vi.useRealTimers();
  });

  it("give their context back once the grace period for a quick view switch has passed", () => {
    vi.useFakeTimers();
    const renderer = healthyRenderer();
    park(renderer);
    expect(parkedThreeDRendererCount()).toBe(1);
    vi.advanceTimersByTime(THREE_D_PARK_GRACE_MS - 1);
    expect(renderer.forceContextLoss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(parkedThreeDRendererCount()).toBe(0);
    expect(renderer.forceContextLoss).toHaveBeenCalledTimes(1);
  });

  it("give their context back as soon as the page is hidden", () => {
    const renderer = healthyRenderer();
    park(renderer);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    visibility.mockRestore();
    expect(parkedThreeDRendererCount()).toBe(0);
    expect(renderer.forceContextLoss).toHaveBeenCalledTimes(1);
  });
});

describe("what the customer reads", () => {
  it("never asks them to close tabs, change browser settings or retry by hand", () => {
    for (const message of [THREE_D_STARTING_MESSAGE, THREE_D_UNAVAILABLE_MESSAGE, THREE_D_BLOCKED_MESSAGE]) {
      expect(message).not.toMatch(/close|\btabs?\b|setting|acceleration|relaunch|restart|driver|chrome:\/\/|press retry/i);
    }
    expect(THREE_D_BLOCKED_MESSAGE).toMatch(/Reload this page.*design is kept/);
    expect(THREE_D_UNAVAILABLE_MESSAGE).toMatch(/keeps trying on its own/);
    expect(THREE_D_UNAVAILABLE_MESSAGE).toMatch(/2D plan and elevation preview stay available/);
  });
});

describe("drawing buffer size", () => {
  it("never draws above the pixel-ratio ceiling, even on a 3x display", () => {
    expect(THREE_D_MAX_PIXEL_RATIO).toBe(1.75);
    const renderer = {
      ratio: 1,
      size: { x: 0, y: 0 },
      getPixelRatio: () => renderer.ratio,
      setPixelRatio(value: number) { renderer.ratio = value; },
      getSize(target: { set: (x: number, y: number) => void }) { target.set(renderer.size.x, renderer.size.y); },
      setSize(width: number, height: number) { renderer.size = { x: width, y: height }; },
    };
    expect(sizeThreeDRenderer(renderer as unknown as import("three").WebGLRenderer, 800, 600, 3)).toBe(true);
    expect(renderer.ratio).toBe(1.75);
    expect(sizeThreeDRenderer(renderer as unknown as import("three").WebGLRenderer, 800, 600, 3)).toBe(false);
  });
});
