// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DESIGNER_BOUNDARY_RELOAD_FLAG,
  DESIGNER_BOUNDARY_STABLE_MS,
  DesignerErrorBoundary,
  designerBoundaryEnv,
  isChunkLoadError,
  useDesignerCrashFlush,
} from "./DesignerErrorBoundary";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let consoleError: ReturnType<typeof vi.spyOn>;
let reload: ReturnType<typeof vi.fn>;
const realEnv = { ...designerBoundaryEnv };

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  reload = vi.fn();
  designerBoundaryEnv.reload = reload;
  window.sessionStorage.clear();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  consoleError.mockRestore();
  Object.assign(designerBoundaryEnv, realEnv);
  window.sessionStorage.clear();
  vi.useRealTimers();
});

function panel() {
  return host.querySelector("[data-testid='designer-error-boundary']");
}

async function settle() {
  for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve(); });
}

function reloadButton() {
  return Array.from(host.querySelectorAll("button")).find((button) => button.textContent?.includes("Reload designer"));
}

describe("designer error boundary", () => {
  it("shows the in-place panel for a render error and remounts the designer on Reload", () => {
    let mounts = 0;
    let shouldThrow = true;
    function Designer() {
      React.useEffect(() => {
        mounts += 1;
      }, []);
      if (shouldThrow) throw new Error("designer render failed");
      return <div data-testid="designer-ok">designer</div>;
    }

    act(() => root.render(<div data-testid="page-chrome"><DesignerErrorBoundary surface="designer"><Designer /></DesignerErrorBoundary></div>));
    const panel = host.querySelector("[data-testid='designer-error-boundary']");
    expect(panel?.getAttribute("role")).toBe("alert");
    expect(panel?.getAttribute("data-designer-surface")).toBe("designer");
    expect(panel?.textContent).toContain("The designer hit a problem");
    expect(host.textContent).not.toContain("An unexpected error occurred");
    expect(host.querySelector("[data-testid='page-chrome']")).not.toBeNull();
    expect(consoleError.mock.calls.some((call) => String(call[0]).includes('Designer surface "designer" failed to render'))).toBe(true);
    expect(mounts).toBe(0);

    shouldThrow = false;
    act(() => reloadButton()!.click());
    expect(host.querySelector("[data-testid='designer-error-boundary']")).toBeNull();
    expect(host.querySelector("[data-testid='designer-ok']")).not.toBeNull();
    expect(mounts).toBe(1);
  });

  it("catches React #185 (maximum update depth) from a runaway ref callback", () => {
    function RunawayRef() {
      const [, setCount] = React.useState(0);
      return <div ref={() => setCount((count) => count + 1)} />;
    }

    act(() => root.render(<DesignerErrorBoundary surface="3d"><RunawayRef /></DesignerErrorBoundary>));
    expect(host.querySelector("[data-testid='designer-error-boundary']")?.getAttribute("data-designer-surface")).toBe("3d");
    expect(consoleError.mock.calls.some((call) => call.some((arg) => /Maximum update depth exceeded/.test(String((arg as Error)?.message ?? arg))))).toBe(true);
  });

  it("keeps an open DialogContent stable while its parent re-renders (no #185 from the slot ref)", () => {
    function Parent() {
      const [tick, setTick] = React.useState(0);
      React.useLayoutEffect(() => {
        if (tick < 40) setTick(tick + 1);
      }, [tick]);
      return (
        <Dialog open>
          <DialogContent>
            <DialogTitle>Range bridge</DialogTitle>
            <DialogDescription>tick {tick}</DialogDescription>
          </DialogContent>
        </Dialog>
      );
    }

    act(() => root.render(<DesignerErrorBoundary surface="designer"><Parent /></DesignerErrorBoundary>));
    expect(host.querySelector("[data-testid='designer-error-boundary']")).toBeNull();
    expect(document.body.textContent).toContain("tick 40");
  });

  it("reloads the page once for a chunk that failed to load, then shows the panel instead of looping", async () => {
    const chunkError = () => new TypeError("Failed to fetch dynamically imported module: https://www.cabinetdealz.com/assets/DesignTool-old.js");
    const mountLazy = async () => {
      const LazyDesigner = React.lazy(() => Promise.reject(chunkError()));
      act(() => root.render(
        <React.Suspense fallback={<div>loading</div>}>
          <DesignerErrorBoundary surface="designer"><LazyDesigner /></DesignerErrorBoundary>
        </React.Suspense>,
      ));
      await settle();
    };
    expect(isChunkLoadError(chunkError())).toBe(true);
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isChunkLoadError(Object.assign(new Error("Loading chunk 812 failed."), { name: "ChunkLoadError" }))).toBe(true);
    expect(isChunkLoadError(new Error("designer render failed"))).toBe(false);

    await mountLazy();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(JSON.parse(window.sessionStorage.getItem(DESIGNER_BOUNDARY_RELOAD_FLAG)!)).toMatchObject({ surface: "designer", reason: "chunk-load" });

    // The reloaded page fails the same way: the flag stops a second automatic reload.
    act(() => root.unmount());
    root = createRoot(host);
    await mountLazy();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(panel()).not.toBeNull();
    // Remounting cannot recover a cached rejected import, so the button reloads the page.
    act(() => reloadButton()!.click());
    expect(reload).toHaveBeenCalledTimes(2);
    expect(panel()).not.toBeNull();
  });

  it("falls back to one guarded page reload on the third crash in a row", () => {
    function AlwaysThrows(): React.ReactNode {
      throw new Error("designer render failed");
    }
    act(() => root.render(<DesignerErrorBoundary surface="designer"><AlwaysThrows /></DesignerErrorBoundary>));
    expect(panel()).not.toBeNull();
    act(() => reloadButton()!.click());
    expect(reload).not.toHaveBeenCalled();
    act(() => reloadButton()!.click());
    expect(reload).toHaveBeenCalledTimes(1);
    expect(JSON.parse(window.sessionStorage.getItem(DESIGNER_BOUNDARY_RELOAD_FLAG)!)).toMatchObject({ reason: "repeated-crash" });
    // Still crashing after that reload: no automatic reload again; the button reloads the page by hand.
    act(() => reloadButton()!.click());
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("clears the reload guard and the crash streak once the surface has run cleanly", () => {
    vi.useFakeTimers();
    let now = 1_000_000;
    designerBoundaryEnv.now = () => now;
    window.sessionStorage.setItem(DESIGNER_BOUNDARY_RELOAD_FLAG, "{}");
    act(() => root.render(<DesignerErrorBoundary surface="designer"><div>ok</div></DesignerErrorBoundary>));
    now += DESIGNER_BOUNDARY_STABLE_MS;
    act(() => vi.advanceTimersByTime(DESIGNER_BOUNDARY_STABLE_MS));
    expect(window.sessionStorage.getItem(DESIGNER_BOUNDARY_RELOAD_FLAG)).toBeNull();

    // Two crashes far apart are not a streak.
    let fail = true;
    function Flaky() {
      if (fail) throw new Error("designer render failed");
      return <div>ok</div>;
    }
    for (let round = 0; round < 3; round++) {
      fail = true;
      act(() => root.render(<DesignerErrorBoundary surface="designer"><Flaky key={round} /></DesignerErrorBoundary>));
      fail = false;
      act(() => reloadButton()!.click());
      now += DESIGNER_BOUNDARY_STABLE_MS + 1;
      act(() => vi.advanceTimersByTime(DESIGNER_BOUNDARY_STABLE_MS + 1));
    }
    expect(reload).not.toHaveBeenCalled();
  });

  it("saves the pending draft when the designer crashes, before it is torn down", () => {
    const saves: string[] = [];
    let crash = false;
    function Designer() {
      const [edits] = React.useState("unsaved edit");
      const flush = React.useCallback(() => saves.push(edits), [edits]);
      useDesignerCrashFlush(flush);
      if (crash) throw new Error("designer render failed");
      return <div>designer</div>;
    }
    function Page({ tick }: { tick: number }) {
      return <DesignerErrorBoundary surface="designer"><Designer key="d" />{tick}</DesignerErrorBoundary>;
    }
    act(() => root.render(<Page tick={0} />));
    expect(saves).toEqual([]);
    crash = true;
    act(() => root.render(<Page tick={1} />));
    expect(panel()).not.toBeNull();
    expect(saves).toEqual(["unsaved edit"]);
  });

  it("clears the 3D panel when the layout revision changes, e.g. after an undo", () => {
    let bad = true;
    function Scene() {
      if (bad) throw new Error("scene setup failed");
      return <div data-testid="scene">scene</div>;
    }
    const render = (revision: number) => act(() => root.render(<DesignerErrorBoundary surface="3d" resetKey={revision}><Scene /></DesignerErrorBoundary>));
    render(4);
    expect(panel()).not.toBeNull();
    render(4);
    expect(panel()).not.toBeNull();
    bad = false;
    render(5);
    expect(panel()).toBeNull();
    expect(host.querySelector("[data-testid='scene']")).not.toBeNull();
    // A revision change with no error does not remount the scene.
    const scene = host.querySelector("[data-testid='scene']");
    render(6);
    expect(host.querySelector("[data-testid='scene']")).toBe(scene);
  });
});
