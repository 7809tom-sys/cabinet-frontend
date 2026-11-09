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

const { MAX_THREE_D_GPU_RECOVERIES, THREE_D_GPU_RESET_LIMIT_MESSAGE, claimThreeDGpuRecovery, createThreeDWebGLRenderer, detectThreeDWebGLSupport, resetThreeDGpuRecoveriesForTests, threeDWebGLUnavailableMessage } = await import("./threeDRendererHost");

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
    const webgl2Off = threeDWebGLUnavailableMessage("webgl1-only");
    expect(webgl2Off).toMatch(/^The 3D view needs WebGL 2, which is turned off in this browser\./);
    expect(webgl2Off).toContain('make sure "Use graphics acceleration when available" is on');
    expect(webgl2Off).toContain("blocked by your IT policy");
    expect(webgl2Off).not.toContain("Close other 3D tabs");
    expect(threeDWebGLUnavailableMessage("none")).toMatch(/WebGL is off or blocked.*chrome:\/\/gpu/);
    expect(threeDWebGLUnavailableMessage("webgl2")).toContain("Close other 3D tabs");
    for (const support of ["webgl2", "webgl1-only", "none"] as const) {
      expect(threeDWebGLUnavailableMessage(support)).toContain("2D plan and elevation preview remain available");
    }
  });
});

describe("GPU-reset recoveries", () => {
  function memory(stored: Record<string, string> = {}) {
    return { stored, getItem: (key: string) => stored[key] ?? null, setItem: (key: string, value: string) => { stored[key] = value; } };
  }

  it("allows three per session, then stops with a clear message", () => {
    resetThreeDGpuRecoveriesForTests();
    const storage = memory();
    expect(MAX_THREE_D_GPU_RECOVERIES).toBe(3);
    expect([1, 2, 3, 4].map(() => claimThreeDGpuRecovery(storage))).toEqual([true, true, true, false]);
    // A reload of the page keeps the session's count.
    resetThreeDGpuRecoveriesForTests();
    expect(claimThreeDGpuRecovery(memory(storage.stored))).toBe(false);
    expect(THREE_D_GPU_RESET_LIMIT_MESSAGE).toMatch(/reset several times.*Reload the page.*2D plan and elevation preview remain available/);
  });

  it("still caps them for the page when session storage is missing or throws", () => {
    resetThreeDGpuRecoveriesForTests();
    const throwing = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect([claimThreeDGpuRecovery(null), claimThreeDGpuRecovery(throwing), claimThreeDGpuRecovery(null), claimThreeDGpuRecovery(throwing)]).toEqual([true, true, true, false]);
    resetThreeDGpuRecoveriesForTests();
  });
});
