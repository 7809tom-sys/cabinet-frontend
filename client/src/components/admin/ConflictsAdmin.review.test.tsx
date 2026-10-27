// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const conflictsQuery = vi.fn();

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ cabinets: { conflicts: { invalidate: vi.fn() } } }),
    cabinets: {
      conflicts: { useQuery: () => conflictsQuery() },
      clearConflict: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      allCategories: { useQuery: () => ({ data: ["Base"] }) },
      doorStyleOptions: { useQuery: () => ({ data: [{ id: 1, label: "Shaker" }] }) },
      updateConflictCabinet: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

import ConflictsAdmin from "./ConflictsAdmin";

afterEach(() => {
  cleanup();
  conflictsQuery.mockReset();
  window.history.replaceState({}, "", "/");
});

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    masterCode: "B30",
    description: '30" base cabinet',
    category: "Base",
    subCategory: null,
    width: "30",
    height: "34.5",
    depth: "24",
    numberOfDrawers: 2,
    conflictReason: "Drawer count is not verified.",
    conflictStatus: "review",
    staysPublic: true,
    skuCount: 3,
    distributorNames: ["CS"],
    doorStyleNames: ["Shaker"],
    styleIds: [1],
    ...overrides,
  };
}

describe("ConflictsAdmin public review flags", () => {
  it("keeps review rows public and still marks hidden conflicts", () => {
    conflictsQuery.mockReturnValue({
      data: [
        item(),
        item({
          id: 2,
          masterCode: "HIDDEN1",
          description: "Hidden conflict cabinet",
          staysPublic: false,
          conflictStatus: "conflict",
          numberOfDrawers: null,
        }),
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ConflictsAdmin />);

    expect(screen.getByText(/Needs review items stay public/)).toBeTruthy();
    expect(screen.getByText("Needs review")).toBeTruthy();
    expect(screen.getByText("Conflict")).toBeTruthy();
    expect(screen.getByText(/2 drawers/)).toBeTruthy();
    expect(screen.getByText("Hidden conflict cabinet")).toBeTruthy();
  });

  it("edits drawer count for a public review row", () => {
    conflictsQuery.mockReturnValue({
      data: [item()],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ConflictsAdmin />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByLabelText("Drawers")).toBeTruthy();
    expect((screen.getByLabelText("Drawers") as HTMLInputElement).value).toBe("2");
    expect(screen.getByRole("button", { name: /Save & clear/ })).toBeTruthy();
  });

  it("opens the existing editor when a review cabinet id is in the address", () => {
    window.history.replaceState({}, "", "/admin?tab=conflicts&cabinetId=1");
    conflictsQuery.mockReturnValue({
      data: [item()],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ConflictsAdmin />);

    expect(screen.getByText("Edit B30")).toBeTruthy();
    expect(document.getElementById("conflict-cabinet-1")).toBeTruthy();
  });
});
