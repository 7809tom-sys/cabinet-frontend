// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdminOnboardingRow } from "@/lib/vendorOnboarding";

const adminList = vi.hoisted(() => vi.fn());

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      vendorOnboarding: {
        summary: { invalidate: vi.fn() },
        flagged: { invalidate: vi.fn() },
        adminList: { invalidate: vi.fn() },
      },
    }),
    distributors: {
      list: {
        useQuery: () => ({ data: [{ id: 4, name: "Depot" }, { id: 8, name: "Other Line" }], isLoading: false, error: null }),
      },
    },
    vendorOnboarding: {
      adminList: { useQuery: (input: unknown) => adminList(input) },
    },
  },
}));

import VendorOnboardingAdmin from "./VendorOnboardingAdmin";

function adminRow(overrides: Partial<AdminOnboardingRow> = {}): AdminOnboardingRow {
  return {
    id: 3,
    importId: 7,
    distributorId: 4,
    rowNumber: 4,
    sku: "NEW1",
    status: "completed",
    flagReason: null,
    missingFields: [],
    needsFullDetails: false,
    cabinetId: null,
    masterCode: "NEW1",
    matchedVia: null,
    candidateMasterCodes: [],
    reviewCabinetId: 44,
    distributorName: "Depot",
    style: "Shaker",
    color: "White",
    price: "189.00",
    styleId: 3,
    skuId: 12,
    category: "Base",
    subCategory: null,
    width: "9.000",
    height: "34.500",
    depth: "24.000",
    description: "9 inch base",
    numberOfDoors: 1,
    numberOfDrawers: 0,
    trimHeld: false,
    trimSupplierId: null,
    message: null,
    inherited: null,
    conflictStatus: "review",
    conflictReason: "Vendor onboarding",
    staysPublic: true,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  adminList.mockReset();
});

describe("vendor onboarding admin", () => {
  it("filters the list and links a completed review cabinet, not a matched master", () => {
    adminList.mockReturnValue({
      data: {
        imports: [{ id: 7, distributorId: 4, distributorName: "Depot", fileName: "prices.csv", createdAt: "2026-10-27", matched: 6, flagged: 1, completed: 1 }],
        rows: [
          adminRow(),
          adminRow({
            id: 8,
            sku: "B30",
            status: "matched",
            cabinetId: 9,
            reviewCabinetId: null,
            masterCode: "B30",
            conflictStatus: null,
            staysPublic: false,
          }),
        ],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<VendorOnboardingAdmin />);
    expect(adminList).toHaveBeenCalledWith({ limit: 200 });
    const link = screen.getByRole("link", { name: "Open in Cabinet Conflicts" });
    expect(link.getAttribute("href")).toBe("/admin?tab=conflicts&cabinetId=44");
    expect(screen.getByText("Master B30 (id 9)")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /id 9/ })).toBeNull();

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "completed" } });
    expect(adminList).toHaveBeenCalledWith({ limit: 200, status: "completed" });
    fireEvent.change(screen.getByLabelText("Distributor"), { target: { value: "8" } });
    expect(adminList).toHaveBeenCalledWith({ limit: 200, distributorId: 8, status: "completed" });
    fireEvent.change(screen.getByLabelText("Import"), { target: { value: "7" } });
    expect(adminList).toHaveBeenCalledWith({ limit: 200, distributorId: 8, importId: 7, status: "completed" });
  });
});
