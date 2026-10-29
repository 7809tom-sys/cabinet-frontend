// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ContractorAccessListRow } from "@/lib/contractorAccessForm";

const selfRow: ContractorAccessListRow = {
  id: 1,
  businessName: "Self Co",
  phone: "555-0101",
  licenseNumber: null,
  status: "pending",
  name: "Casey Customer",
  email: "casey@example.com",
  source: "self",
  submittedByUserId: null,
  submittedByName: null,
  submittedByEmail: null,
  contractorName: null,
  contractorEmail: null,
};

const affiliatePending: ContractorAccessListRow = {
  id: 2,
  businessName: "Build Co",
  phone: "555-0199",
  licenseNumber: "LIC-9",
  status: "pending",
  name: null,
  email: null,
  source: "affiliate",
  submittedByUserId: 9,
  submittedByName: "Ada Partner",
  submittedByEmail: "ada@store.example",
  contractorName: "Sam Builder",
  contractorEmail: "sam@build.example",
};

const affiliateApproved: ContractorAccessListRow = {
  ...affiliatePending,
  id: 3,
  businessName: "Reviewed Co",
  status: "approved",
  contractorName: "Riley Approved",
  contractorEmail: "riley@build.example",
};

const { reviewMutate, invalidate, mutationOptions, listMode } = vi.hoisted(() => ({
  reviewMutate: vi.fn(),
  invalidate: vi.fn(async () => undefined),
  mutationOptions: {
    current: null as null | {
      onSuccess?: () => void;
      onError?: (error: { message: string }) => void;
    },
  },
  listMode: { current: "ready" as "ready" | "empty" | "error" },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ contractorAccess: { list: { invalidate } } }),
    contractorAccess: {
      list: {
        useQuery: (input?: { status?: string; submittedByUserId?: number }) => {
          if (listMode.current === "error" && input?.status === "pending") {
            return { data: undefined, isLoading: false, error: { message: "Forbidden" }, refetch: vi.fn() };
          }
          if (listMode.current === "empty" && input?.status === "pending") {
            return { data: [], isLoading: false, error: null, refetch: vi.fn() };
          }
          if (input?.submittedByUserId === 9) {
            return { data: [affiliatePending, affiliateApproved], isLoading: false, error: null, refetch: vi.fn() };
          }
          if (input?.status === "pending") {
            return { data: [selfRow, affiliatePending], isLoading: false, error: null, refetch: vi.fn() };
          }
          return { data: [selfRow, affiliatePending, affiliateApproved], isLoading: false, error: null, refetch: vi.fn() };
        },
      },
      review: {
        useMutation: (options: typeof mutationOptions.current) => {
          mutationOptions.current = options ?? null;
          return { mutate: reviewMutate, isPending: false };
        },
      },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ContractorAccessAdmin from "./ContractorAccessAdmin";

afterEach(() => {
  cleanup();
  reviewMutate.mockReset();
  invalidate.mockReset();
  mutationOptions.current = null;
  listMode.current = "ready";
});

describe("Contractor access admin", () => {
  it("shows source, the submitting affiliate, and the contractor on every row", () => {
    render(<ContractorAccessAdmin />);
    const self = screen.getByRole("heading", { name: "Self Co" }).closest("article");
    const affiliate = screen.getByRole("heading", { name: "Build Co" }).closest("article");
    expect(self?.textContent).toContain("Source: Self");
    expect(self?.textContent).toContain("Submitted by: None");
    expect(self?.textContent).toContain("Contractor: Casey Customer · casey@example.com");
    expect(affiliate?.textContent).toContain("Source: Affiliate");
    expect(affiliate?.textContent).toContain("Submitted by: Ada Partner · ada@store.example");
    expect(affiliate?.textContent).toContain("Contractor: Sam Builder · sam@build.example");
    expect(screen.getByText("License LIC-9")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Reviewed Co" })).toBeNull();
  });

  it("filters to one affiliate's requests, including ones already reviewed", () => {
    render(<ContractorAccessAdmin />);
    fireEvent.change(screen.getByLabelText("Filter by affiliate"), { target: { value: "9" } });
    expect(screen.queryByRole("heading", { name: "Self Co" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Build Co" })).toBeTruthy();
    const reviewed = screen.getByRole("heading", { name: "Reviewed Co" }).closest("article");
    expect(reviewed?.textContent).toContain("Approved");
    expect(reviewed?.querySelector("button")).toBeNull();
    expect(screen.getByText(/Follow up if this affiliate is not responding/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(reviewMutate).toHaveBeenCalledWith({ id: 2, decision: "approved" });
    act(() => {
      mutationOptions.current?.onSuccess?.();
    });
    expect(invalidate).toHaveBeenCalled();
  });

  it("shows an empty queue and the list error in red", () => {
    listMode.current = "empty";
    const { unmount } = render(<ContractorAccessAdmin />);
    expect(screen.getByText("No pending contractor requests.")).toBeTruthy();
    unmount();

    listMode.current = "error";
    render(<ContractorAccessAdmin />);
    const error = screen.getByText("Forbidden");
    expect(error.className).toContain("text-destructive");
  });
});
