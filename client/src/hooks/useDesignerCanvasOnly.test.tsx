// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  DESIGNER_CANVAS_ONLY_EVENT,
  publishDesignerCanvasOnly,
  readDesignerCanvasOnly,
  useDesignerCanvasOnly,
} from "./useDesignerCanvasOnly";

afterEach(() => {
  // Reset the module-level window flag between cases.
  publishDesignerCanvasOnly(false);
});

describe("useDesignerCanvasOnly", () => {
  it("broadcasts the flag so chrome outside the Designer can hide", () => {
    const seen: boolean[] = [];
    const listener = (event: Event) => seen.push(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener(DESIGNER_CANVAS_ONLY_EVENT, listener);
    publishDesignerCanvasOnly(true);
    publishDesignerCanvasOnly(false);
    window.removeEventListener(DESIGNER_CANVAS_ONLY_EVENT, listener);
    expect(seen).toEqual([true, false]);
  });

  it("remembers the flag for chrome that mounts after the toggle", () => {
    publishDesignerCanvasOnly(true);
    expect(readDesignerCanvasOnly()).toBe(true);
    const { result } = renderHook(() => useDesignerCanvasOnly());
    // A header rendered after entry starts already hidden.
    expect(result.current[0]).toBe(true);
  });

  it("shares one value between the Designer and the header", () => {
    const header = renderHook(() => useDesignerCanvasOnly());
    const designer = renderHook(() => useDesignerCanvasOnly());
    expect(header.result.current[0]).toBe(false);
    act(() => designer.result.current[1](true));
    expect(header.result.current[0]).toBe(true);
    act(() => designer.result.current[1](false));
    expect(header.result.current[0]).toBe(false);
  });
});
