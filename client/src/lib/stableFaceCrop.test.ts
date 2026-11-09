// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DlcFaceCrop } from "@shared/dlcFr26Textures";
import { useStableFaceCrop } from "./stableFaceCrop";

const crop = (solidColor = "#c8b090"): DlcFaceCrop => ({
  slug: "driftwood",
  doorSize: [1024, 1536],
  drawerSize: [1024, 384],
  drawerSolidColor: null,
  solidColor,
  grainUrl: "https://example.test/grain.jpg",
  faceTileIn: [12, 24],
  tintLinear: [1, 0.9, 0.8],
});

describe("useStableFaceCrop", () => {
  it("returns the same crop across renders while the values are unchanged", () => {
    const { result, rerender } = renderHook(({ value }) => useStableFaceCrop(value), { initialProps: { value: crop() } });
    const first = result.current;
    rerender({ value: crop() });
    expect(result.current).toBe(first);
    rerender({ value: crop() });
    expect(result.current).toBe(first);
  });

  it("returns a new crop when a value changes, and null without one", () => {
    const { result, rerender } = renderHook(({ value }: { value: DlcFaceCrop | null }) => useStableFaceCrop(value), { initialProps: { value: crop() as DlcFaceCrop | null } });
    const first = result.current;
    rerender({ value: crop("#202020") });
    expect(result.current).not.toBe(first);
    expect(result.current?.solidColor).toBe("#202020");
    rerender({ value: null });
    expect(result.current).toBeNull();
  });
});
