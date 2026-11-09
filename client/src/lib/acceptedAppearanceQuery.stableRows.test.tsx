// @vitest-environment jsdom
/**
 * The 3D view rebuilds its whole scene (and recompiles its shaders) whenever
 * the per-cabinet door inputs change identity, and those inputs are derived
 * from `useAcceptedDoorAppearance().rows`. A fresh `rows` array on every render
 * meant any unrelated designer update rebuilt the 3D room, which is what made
 * the cabinets flash and the drawing freeze for a signed-in designer.
 */
import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const queryResult: { data: unknown; isLoading: boolean; isError: boolean; error: unknown; refetch: () => void } = {
  data: undefined,
  isLoading: false,
  isError: true,
  error: { data: { code: "NOT_FOUND" } },
  refetch: () => {},
};

vi.mock("@/lib/trpc", () => ({
  trpc: {
    doorStyles: {
      acceptedAppearance: {
        useQuery: () => queryResult,
      },
    },
  },
}));

import { useAcceptedDoorAppearance } from "./acceptedAppearanceQuery";

describe("useAcceptedDoorAppearance keeps rows stable between renders", () => {
  it("returns the same empty rows array while the endpoint is unavailable", () => {
    const { result, rerender } = renderHook(({ ids }) => useAcceptedDoorAppearance(ids), { initialProps: { ids: [1] } });
    const first = result.current.rows;
    rerender({ ids: [1] });
    rerender({ ids: [1] });
    expect(result.current.rows).toBe(first);
  });

  it("returns the same rows array until the query data itself changes", () => {
    queryResult.isError = false;
    queryResult.data = [{ styleId: 7, colorHex: "#ffffff", textureUrl: null, approvedVersionId: 1 }];
    const { result, rerender } = renderHook(() => useAcceptedDoorAppearance([7]));
    const first = result.current.rows;
    rerender();
    expect(result.current.rows).toBe(first);

    queryResult.data = [{ styleId: 7, colorHex: "#000000", textureUrl: null, approvedVersionId: 2 }];
    rerender();
    expect(result.current.rows).not.toBe(first);
    expect(result.current.rows[0]?.colorHex).toBe("#000000");
  });
});
