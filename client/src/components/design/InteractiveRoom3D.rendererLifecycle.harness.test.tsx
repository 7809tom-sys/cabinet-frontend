// @vitest-environment jsdom
/**
 * Integration-level check of the contract InteractiveRoom3D now follows:
 * the renderer host is created in a mount-only effect, and the scene effect
 * (which re-runs for placements/finish) only ever borrows it. This harness
 * mirrors those two effects so the assertion runs against real React effect
 * ordering rather than against source text alone.
 */
import { cleanup, render } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThreeDRendererHost } from "./threeDRendererHost";

afterEach(cleanup);

function makeRenderer() {
  const canvas = document.createElement("canvas");
  return {
    canvas,
    renderer: {
      domElement: canvas,
      dispose: vi.fn(),
      forceContextLoss: vi.fn(),
      getPixelRatio: () => 1,
      setPixelRatio: vi.fn(),
      getSize: (target: { set(x: number, y: number): void }) => target.set(800, 600),
      setSize: vi.fn(),
    },
  };
}

/** Same effect shape as InteractiveRoom3D: mount-only owner + rebuild-only scene effect. */
function RendererHarness({ placements, finish }: { placements: string[]; finish: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<ThreeDRendererHost | null>(null);
  const scenesBuilt = useRef(0);

  useEffect(() => {
    if (!hostRef.current) hostRef.current = new ThreeDRendererHost(() => makeRenderer().renderer as never);
    hostRef.current.ensureMounted(mountRef.current!);
  }, []);

  useEffect(() => {
    hostRef.current!.ensureMounted(mountRef.current!);
    scenesBuilt.current += 1;
  }, [placements, finish]);

  useEffect(() => () => {
    hostRef.current?.dispose();
    hostRef.current = null;
  }, []);

  return <div ref={mountRef} data-scenes={scenesBuilt.current} />;
}

describe("renderer survives scene rebuilds", () => {
  it("keeps one canvas and context across placement and finish changes", () => {
    const { container, rerender } = render(<RendererHarness placements={["A"]} finish="catalog" />);
    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();

    rerender(<RendererHarness placements={["A", "B"]} finish="catalog" />);
    rerender(<RendererHarness placements={["A", "B"]} finish="sage" />);
    rerender(<RendererHarness placements={["A", "B", "C"]} finish="sage" />);

    expect(container.querySelector("canvas")).toBe(canvas);
    expect(container.querySelectorAll("canvas")).toHaveLength(1);
    // Three scene rebuilds happened on the same canvas.
    expect(container.firstElementChild?.getAttribute("data-scenes")).toBe("3");
  });

  it("removes the canvas only when the component unmounts", () => {
    const { container, unmount } = render(<RendererHarness placements={["A"]} finish="catalog" />);
    expect(container.querySelector("canvas")).not.toBeNull();
    unmount();
    expect(container.querySelector("canvas")).toBeNull();
  });
});
