// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DESIGNER_BOUNDARY_STABLE_MS,
  DesignerErrorBoundary,
  designerBoundaryEnv,
  designerBoundaryReloadFlag,
  isChunkLoadError,
  useDesignerCrashFlush,
  useLastCommitted,
} from "./DesignerErrorBoundary";

const DESIGNER_FLAG = designerBoundaryReloadFlag("designer");

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

function button(label: string) {
  return Array.from(host.querySelectorAll("button")).find((candidate) => candidate.textContent?.includes(label));
}

function reloadButton() {
  return button("Reload designer");
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
    expect(JSON.parse(window.sessionStorage.getItem(DESIGNER_FLAG)!)).toMatchObject({ surface: "designer", reason: "chunk-load" });

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
    expect(JSON.parse(window.sessionStorage.getItem(DESIGNER_FLAG)!)).toMatchObject({ reason: "repeated-crash" });
    // Still crashing after that reload: no automatic reload again; the button reloads the page by hand.
    act(() => reloadButton()!.click());
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("clears the reload guard and the crash streak once the surface has run cleanly", () => {
    vi.useFakeTimers();
    let now = 1_000_000;
    designerBoundaryEnv.now = () => now;
    window.sessionStorage.setItem(DESIGNER_FLAG, "{}");
    act(() => root.render(<DesignerErrorBoundary surface="designer"><div>ok</div></DesignerErrorBoundary>));
    now += DESIGNER_BOUNDARY_STABLE_MS;
    act(() => vi.advanceTimersByTime(DESIGNER_BOUNDARY_STABLE_MS));
    expect(window.sessionStorage.getItem(DESIGNER_FLAG)).toBeNull();

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

  it("saves the last committed state at a crash, not the state that crashed", () => {
    const saves: number[] = [];
    let setValue: (value: number) => void = () => {};
    function Designer() {
      const [value, set] = React.useState(1);
      setValue = set;
      const snapshot = React.useCallback(() => value, [value]);
      const committed = useLastCommitted(snapshot);
      const flush = React.useCallback(() => saves.push(committed.current!), [committed]);
      useDesignerCrashFlush(flush);
      if (value === 3) throw new Error("designer render failed");
      return <div>value {value}</div>;
    }
    act(() => root.render(<DesignerErrorBoundary surface="designer"><Designer /></DesignerErrorBoundary>));
    act(() => setValue(2));
    act(() => setValue(3));
    expect(panel()).not.toBeNull();
    expect(saves).toEqual([2]);
  });

  it("offers Discard draft only after the reload guard was used, and starts clean from it", () => {
    let discards = 0;
    let draft: "bad" | null = "bad";
    // Like the Designer: it mounts empty, then applies the saved draft in an effect.
    function Designer() {
      const [restored, setRestored] = React.useState<"bad" | null>(null);
      React.useEffect(() => setRestored(draft), []);
      const flush = React.useCallback(() => {}, []);
      const discard = React.useCallback(() => {
        discards += 1;
        draft = null;
      }, []);
      useDesignerCrashFlush(flush, discard);
      if (restored === "bad") throw new Error("designer render failed");
      return <div data-testid="designer-ok">designer</div>;
    }
    act(() => root.render(<DesignerErrorBoundary surface="designer"><Designer /></DesignerErrorBoundary>));
    expect(panel()).not.toBeNull();
    expect(button("Discard draft")).toBeUndefined();
    act(() => root.unmount());

    // The page already reloaded once for this surface and the draft still crashes it.
    window.sessionStorage.setItem(DESIGNER_FLAG, JSON.stringify({ surface: "designer", reason: "repeated-crash" }));
    root = createRoot(host);
    act(() => root.render(<DesignerErrorBoundary surface="designer"><Designer /></DesignerErrorBoundary>));
    expect(panel()).not.toBeNull();
    act(() => button("Discard draft")!.click());
    expect(discards).toBe(1);
    expect(panel()).toBeNull();
    expect(host.querySelector("[data-testid='designer-ok']")).not.toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });

  it("never reloads the page for the 3D view while the designer keeps editing", async () => {
    vi.useFakeTimers();
    let now = 1_000_000;
    designerBoundaryEnv.now = () => now;
    function BrokenScene(): React.ReactNode {
      throw new Error("scene setup failed");
    }
    // Every edit re-renders the designer; the 3D stays broken throughout.
    const render = (undoRedo: number, edit: number) => act(() => root.render(
      <div data-edit={edit}>
        <DesignerErrorBoundary surface="3d" resetKey={undoRedo} pageReload={false}><BrokenScene /></DesignerErrorBoundary>
      </div>,
    ));
    for (let edit = 0; edit < 20; edit++) {
      render(0, edit);
      now += 100;
    }
    for (let undo = 1; undo <= 6; undo++) {
      render(undo, 100 + undo);
      now += 100;
    }
    for (let click = 0; click < 6; click++) act(() => reloadButton()!.click());
    expect(panel()?.getAttribute("data-designer-surface")).toBe("3d");
    expect(reload).not.toHaveBeenCalled();
    expect(window.sessionStorage.length).toBe(0);

    // A chunk that failed to load inside the 3D view also stays in place.
    act(() => root.unmount());
    root = createRoot(host);
    const LazyScene = React.lazy(() => Promise.reject(new TypeError("Failed to fetch dynamically imported module: /assets/three-old.js")));
    act(() => root.render(
      <React.Suspense fallback={null}>
        <DesignerErrorBoundary surface="3d" pageReload={false}><LazyScene /></DesignerErrorBoundary>
      </React.Suspense>,
    ));
    for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve(); });
    act(() => reloadButton()!.click());
    expect(reload).not.toHaveBeenCalled();
  });

  it("does not count remounts from a reset key toward the crash streak", () => {
    function AlwaysThrows(): React.ReactNode {
      throw new Error("designer render failed");
    }
    for (let key = 0; key < 6; key++) {
      act(() => root.render(<DesignerErrorBoundary surface="designer" resetKey={key}><AlwaysThrows /></DesignerErrorBoundary>));
    }
    expect(panel()).not.toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });

  it("keeps each surface's reload guard until that surface itself has run cleanly", () => {
    vi.useFakeTimers();
    const closetFlag = designerBoundaryReloadFlag("closet");
    window.sessionStorage.setItem(DESIGNER_FLAG, "{}");
    window.sessionStorage.setItem(closetFlag, "{}");
    act(() => root.render(
      <>
        <DesignerErrorBoundary surface="3d" pageReload={false}><div>scene</div></DesignerErrorBoundary>
        <DesignerErrorBoundary surface="closet"><div>closet</div></DesignerErrorBoundary>
      </>,
    ));
    act(() => vi.advanceTimersByTime(DESIGNER_BOUNDARY_STABLE_MS + 1));
    expect(window.sessionStorage.getItem(closetFlag)).toBeNull();
    expect(window.sessionStorage.getItem(DESIGNER_FLAG)).toBe("{}");
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
