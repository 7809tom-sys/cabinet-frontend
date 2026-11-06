import * as React from "react";

/**
 * Canvas-only ("immersive") mode, published by the Designer so the chrome that
 * lives OUTSIDE it can hide too.
 *
 * The site header is rendered by `TopNav` and the page-history row by
 * `DesignerRoute`, both above the Designer in the tree. The Designer cannot
 * reach them through props, and covering them with a fixed overlay would leave
 * focusable links underneath. One custom event carries the flag instead — the
 * same pattern `useDesignerImmersive` already uses for the tablet header.
 */
export const DESIGNER_CANVAS_ONLY_EVENT = "cabinetdealz:designer-canvas-only";

function rememberDesignerCanvasOnly(next: boolean): void {
  if (typeof window === "undefined") return;
  (window as unknown as Record<string, unknown>).__designerCanvasOnly = next;
}

/** Publishes AND remembers, so chrome that mounts later still agrees. */
export function publishDesignerCanvasOnly(next: boolean): void {
  if (typeof window === "undefined") return;
  rememberDesignerCanvasOnly(next);
  window.dispatchEvent(new CustomEvent<boolean>(DESIGNER_CANVAS_ONLY_EVENT, { detail: next }));
}

export function readDesignerCanvasOnly(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as unknown as Record<string, unknown>).__designerCanvasOnly);
}

/**
 * `hidden` is the layout switch; the returned setter also publishes it, so a
 * header mounted later (a route change back into the Designer) still agrees.
 */
export function useDesignerCanvasOnly(): [boolean, (next: boolean) => void] {
  const [hidden, setHidden] = React.useState<boolean>(() => readDesignerCanvasOnly());
  React.useEffect(() => {
    const onEvent = (event: Event) => setHidden(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener(DESIGNER_CANVAS_ONLY_EVENT, onEvent);
    // A component that mounted after the flag was set still has to match it.
    setHidden(readDesignerCanvasOnly());
    return () => window.removeEventListener(DESIGNER_CANVAS_ONLY_EVENT, onEvent);
  }, []);
  const set = React.useCallback((next: boolean) => {
    rememberDesignerCanvasOnly(next);
    setHidden(next);
    publishDesignerCanvasOnly(next);
  }, []);  return [hidden, set];
}
