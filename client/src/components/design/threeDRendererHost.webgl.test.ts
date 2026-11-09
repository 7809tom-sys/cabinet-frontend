import { afterEach, describe, expect, it, vi } from "vitest";

const attempts: Array<Record<string, unknown>> = [];
let failures = 0;
vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();
  return {
    ...actual,
    WebGLRenderer: function FakeRenderer(this: object, options: Record<string, unknown>) {
      attempts.push(options);
      if (attempts.length <= failures) throw new Error("Error creating WebGL context.");
      return { options };
    },
  };
});

const { createThreeDWebGLRenderer, detectThreeDWebGLSupport, threeDWebGLUnavailableMessage } = await import("./threeDRendererHost");

afterEach(() => {
  attempts.length = 0;
  failures = 0;
  vi.restoreAllMocks();
});

const canvasOffering = (types: string[]) => () => ({
  getContext: (type: string) => (types.includes(type) ? { getExtension: () => ({ loseContext() {} }) } : null),
}) as unknown as HTMLCanvasElement;

describe("WebGL renderer start", () => {
  it("falls back through plainer context attributes, including the integrated GPU", () => {
    failures = 3;
    expect(createThreeDWebGLRenderer()).not.toBeNull();
    expect(attempts.map((options) => options.powerPreference ?? "default")).toEqual(["high-performance", "default", "low-power", "default"]);
    expect(attempts[2]).toMatchObject({ failIfMajorPerformanceCaveat: false });
  });

  it("returns null instead of throwing when no attempt works", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    failures = 10;
    expect(createThreeDWebGLRenderer()).toBeNull();
    expect(attempts).toHaveLength(4);
  });
});

describe("why WebGL could not start", () => {
  it("tells WebGL 2 off apart from no WebGL at all", () => {
    expect(detectThreeDWebGLSupport(canvasOffering(["webgl2", "webgl"]))).toBe("webgl2");
    expect(detectThreeDWebGLSupport(canvasOffering(["webgl"]))).toBe("webgl1-only");
    expect(detectThreeDWebGLSupport(canvasOffering([]))).toBe("none");
    expect(detectThreeDWebGLSupport(() => { throw new Error("no canvas"); })).toBe("none");
  });

  it("gives each case its own customer fix", () => {
    expect(threeDWebGLUnavailableMessage("webgl1-only")).toMatch(/WebGL 2 turned off.*graphics acceleration/);
    expect(threeDWebGLUnavailableMessage("none")).toMatch(/WebGL is off or blocked.*chrome:\/\/gpu/);
    expect(threeDWebGLUnavailableMessage("webgl2")).toContain("Close other 3D tabs");
    for (const support of ["webgl2", "webgl1-only", "none"] as const) {
      expect(threeDWebGLUnavailableMessage(support)).toContain("2D plan and elevation preview remain available");
    }
  });
});
