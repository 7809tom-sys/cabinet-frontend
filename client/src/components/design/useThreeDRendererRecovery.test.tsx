// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pageReloadEnv } from "@/lib/staleChunkReload";
import * as host from "./threeDRendererHost";
import { THREE_D_BACKGROUND_RETRY_MS, THREE_D_RESTORE_WAIT_MS, THREE_D_START_RETRY_DELAYS_MS, ThreeDRendererHost } from "./threeDRendererHost";
import { useThreeDRendererRecovery, type ThreeDRendererRecovery } from "./useThreeDRendererRecovery";

/** The shape of a 3D view: a scene effect that asks the host for a renderer while the status is "running". */
function Harness({ factory, onState, onBlocked }: { factory: () => unknown; onState: (state: ThreeDRendererRecovery & { hostDisposals: number }) => void; onBlocked?: () => void }) {
  const hostRef = useRef<ThreeDRendererHost | null>(null);
  const disposals = useRef(0);
  const recovery = useThreeDRendererRecovery(hostRef, { surface: "test", onBlocked });
  const running = recovery.status === "running";
  useEffect(() => {
    if (!running) return;
    if (!hostRef.current) {
      const created = new ThreeDRendererHost(factory as never);
      const dispose = created.dispose.bind(created);
      created.dispose = () => { disposals.current += 1; dispose(); };
      hostRef.current = created;
    }
    const renderer = hostRef.current.ensureMounted(document.createElement("div"));
    if (!renderer) {
      recovery.startFailed();
      return;
    }
    recovery.started();
    return recovery.attach(renderer);
  }, [running, recovery.generation]);
  onState({ ...recovery, hostDisposals: disposals.current });
  return null;
}

function fakeRenderer() {
  const canvas = document.createElement("canvas");
  return { domElement: canvas, getContext: () => ({ isContextLost: () => false, getExtension: () => ({ loseContext() {} }) }), dispose: vi.fn(), forceContextLoss: vi.fn() };
}

let state: ThreeDRendererRecovery & { hostDisposals: number };
const onState = (next: typeof state) => { state = next; };
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("starting the 3D view without the customer's help", () => {
  it("retries a refused start silently with backoff and runs once the browser gives a context", () => {
    let calls = 0;
    const factory = vi.fn(() => (++calls <= 4 ? null : fakeRenderer()));
    render(<Harness factory={factory} onState={onState} />);
    expect(state.status).toBe("starting");
    for (const delay of THREE_D_START_RETRY_DELAYS_MS.slice(0, 4)) {
      expect(state.status).toBe("starting");
      advance(delay);
    }
    expect(factory).toHaveBeenCalledTimes(5);
    expect(state.status).toBe("running");
  });

  it("only shows the unavailable notice after the quick retries, then keeps retrying in the background", () => {
    let available = false;
    const factory = vi.fn(() => (available ? fakeRenderer() : null));
    render(<Harness factory={factory} onState={onState} />);
    for (const delay of THREE_D_START_RETRY_DELAYS_MS) {
      expect(state.status).toBe("starting");
      advance(delay);
    }
    expect(state.status).toBe("unavailable");
    const attempts = factory.mock.calls.length;
    advance(THREE_D_BACKGROUND_RETRY_MS);
    expect(factory.mock.calls.length).toBe(attempts + 1);
    available = true;
    advance(THREE_D_BACKGROUND_RETRY_MS);
    expect(state.status).toBe("running");
  });

  it("tells a site Chrome has blocked apart from a slow start, without reloading on its own", () => {
    const reload = vi.spyOn(pageReloadEnv, "reload").mockImplementation(() => undefined);
    vi.spyOn(host, "lastThreeDStartFailure").mockReturnValue("blocked");
    const onBlocked = vi.fn();
    render(<Harness factory={() => null} onState={onState} onBlocked={onBlocked} />);
    expect(state.status).toBe("blocked");
    expect(onBlocked).toHaveBeenCalledTimes(1);
    advance(THREE_D_BACKGROUND_RETRY_MS * 3);
    expect(reload).not.toHaveBeenCalled();
  });

  it("does not report a block for an ordinary refusal", () => {
    vi.spyOn(host, "lastThreeDStartFailure").mockReturnValue("unavailable");
    const onBlocked = vi.fn();
    render(<Harness factory={() => null} onState={onState} onBlocked={onBlocked} />);
    advance(1000);
    expect(onBlocked).not.toHaveBeenCalled();
    expect(state.status).toBe("starting");
  });
});

describe("a hidden page holds no WebGL context", () => {
  function setVisibility(value: DocumentVisibilityState) {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue(value);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
  }

  it("releases the context while hidden and starts the view again when shown", () => {
    const renderers = [fakeRenderer(), fakeRenderer()];
    let next = 0;
    const factory = vi.fn(() => renderers[next++]);
    render(<Harness factory={factory} onState={onState} />);
    expect(state.status).toBe("running");
    setVisibility("hidden");
    expect(state.status).toBe("suspended");
    expect(renderers[0].forceContextLoss).toHaveBeenCalledTimes(1);
    advance(THREE_D_BACKGROUND_RETRY_MS);
    expect(factory).toHaveBeenCalledTimes(1);
    setVisibility("visible");
    expect(state.status).toBe("running");
    expect(factory).toHaveBeenCalledTimes(2);
  });
});

describe("a GPU reset while the view is open", () => {
  it("pauses, then rebuilds the scene when Chrome restores the context, however many times it happens", () => {
    const renderer = fakeRenderer();
    render(<Harness factory={() => renderer} onState={onState} />);
    for (let reset = 1; reset <= 10; reset += 1) {
      act(() => { renderer.domElement.dispatchEvent(new Event("webglcontextlost")); });
      expect(state.paused).toBe(true);
      act(() => { renderer.domElement.dispatchEvent(new Event("webglcontextrestored")); });
      expect(state.paused).toBe(false);
      expect(state.generation).toBe(reset);
      expect(state.status).toBe("running");
    }
  });

  it("starts a new context when Chrome does not restore the lost one", () => {
    const renderers = [fakeRenderer(), fakeRenderer()];
    let next = 0;
    const factory = vi.fn(() => renderers[next++]);
    render(<Harness factory={factory} onState={onState} />);
    act(() => { renderers[0].domElement.dispatchEvent(new Event("webglcontextlost")); });
    advance(THREE_D_RESTORE_WAIT_MS - 1);
    expect(state.paused).toBe(true);
    expect(factory).toHaveBeenCalledTimes(1);
    advance(1);
    advance(0);
    expect(state.paused).toBe(false);
    expect(state.status).toBe("running");
    expect(factory).toHaveBeenCalledTimes(2);
    expect(renderers[0].forceContextLoss).toHaveBeenCalled();
  });
});
