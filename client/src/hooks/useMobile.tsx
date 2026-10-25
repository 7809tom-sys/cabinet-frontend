import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Returns true when the viewport is narrower than `breakpoint` (default 768px).
 *
 * Pass a larger breakpoint for touch-first layouts (e.g. the Kitchen Designer
 * uses 1024px) so tablets, foldables, and phones in "desktop site" mode that
 * report a wide CSS width still get the single-column, touch-optimized UI.
 */
export function useIsMobile(breakpoint: number = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < breakpoint);
    return () => mql.removeEventListener("change", onChange);
  }, [breakpoint]);

  return !!isMobile;
}
