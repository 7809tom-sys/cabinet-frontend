import * as React from "react";

export const TABLET_WORKSPACE_MAX_WIDTH = 1366;
const PHONE_WORKSPACE_MAX_WIDTH = 1024;

export type TabletWorkspaceState = {
  /** True for the tablet tier: 1024–1366 CSS px wide. Width only — a wide touch screen (1440+/1536) keeps the normal desktop layout. */
  tablet: boolean;
  /** True when the primary pointer is a finger (pinch/two-finger gestures replace pan pads). */
  touch: boolean;
  /** Height greater than width — toolbar moves to the bottom. */
  portrait: boolean;
};

function readState(): TabletWorkspaceState {
  if (typeof window === "undefined") return { tablet: false, touch: false, portrait: false };
  const width = window.innerWidth;
  const height = window.innerHeight;
  const touch = window.matchMedia("(pointer: coarse)").matches;
  const tablet = width >= PHONE_WORKSPACE_MAX_WIDTH && width <= TABLET_WORKSPACE_MAX_WIDTH;
  return { tablet, touch, portrait: height > width };
}

/**
 * Tablet-tier workspace detection shared by the Designer page, the embedded
 * 3D viewer, and the site header so they all agree on when to collapse chrome.
 * Layout-only signal: it never changes design logic, prices, or the catalog.
 */
export function useTabletWorkspace(): TabletWorkspaceState {
  const [state, setState] = React.useState<TabletWorkspaceState>(() => ({ tablet: false, touch: false, portrait: false }));
  React.useEffect(() => {
    const update = () => setState(readState());
    update();
    const widthMql = window.matchMedia(`(max-width: ${TABLET_WORKSPACE_MAX_WIDTH}px)`);
    const pointerMql = window.matchMedia("(pointer: coarse)");
    const orientationMql = window.matchMedia("(orientation: portrait)");
    widthMql.addEventListener("change", update);
    pointerMql.addEventListener("change", update);
    orientationMql.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => {
      widthMql.removeEventListener("change", update);
      pointerMql.removeEventListener("change", update);
      orientationMql.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return state;
}

/** Session flag so a tablet user can bring the site header back with the CD button. */
export const DESIGNER_IMMERSIVE_EVENT = "cabinetdealz:designer-immersive";

export function useDesignerImmersive(): [boolean, (next: boolean) => void] {
  const [immersive, setImmersiveState] = React.useState(true);
  React.useEffect(() => {
    const onEvent = (event: Event) => {
      const detail = (event as CustomEvent<boolean>).detail;
      setImmersiveState(Boolean(detail));
    };
    window.addEventListener(DESIGNER_IMMERSIVE_EVENT, onEvent);
    return () => window.removeEventListener(DESIGNER_IMMERSIVE_EVENT, onEvent);
  }, []);
  const setImmersive = React.useCallback((next: boolean) => {
    setImmersiveState(next);
    window.dispatchEvent(new CustomEvent(DESIGNER_IMMERSIVE_EVENT, { detail: next }));
  }, []);
  return [immersive, setImmersive];
}
