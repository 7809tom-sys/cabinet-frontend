// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DesignerErrorBoundary } from "./DesignerErrorBoundary";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  consoleError.mockRestore();
});

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

  it("reloads the page for a stale build chunk, because remounting replays the same failed import", async () => {
    const reload = vi.fn();
    const location = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { ...location, reload } });
    let imports = 0;
    const StaleDesigner = React.lazy(() => {
      imports += 1;
      return Promise.reject(new TypeError("Failed to fetch dynamically imported module: https://www.cabinetdealz.com/assets/DesignTool-BF--MoSG.js"));
    });
    try {
      await act(async () => {
        root.render(<DesignerErrorBoundary surface="designer"><React.Suspense fallback={null}><StaleDesigner /></React.Suspense></DesignerErrorBoundary>);
      });
      const panel = host.querySelector("[data-testid='designer-error-boundary']");
      expect(panel?.textContent).toContain("A newer version of the designer was published");
      expect(panel?.textContent).toContain("Reload page");
      expect(reloadButton()).toBeUndefined();
      act(() => (host.querySelector("[data-testid='designer-error-reload']") as HTMLButtonElement).click());
      expect(reload).toHaveBeenCalledTimes(1);
      expect(imports).toBe(1);
      expect(host.querySelector("[data-testid='designer-error-boundary']")).not.toBeNull();
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: location });
    }
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
});
