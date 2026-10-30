// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ContractorAccessListRow } from "@/lib/contractorAccessForm";

const selfRow: ContractorAccessListRow = {
  id: 1,
  userId: 15,
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
  userId: 81,
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
  userId: null,
  businessName: "Reviewed Co",
  status: "approved",
  contractorName: "Riley Approved",
  contractorEmail: "riley@build.example",
};

const { reviewMutate, invalidate, markupMutate, mutationOptions, listMode, markup } = vi.hoisted(() => ({
  reviewMutate: vi.fn(),
  invalidate: vi.fn(async () => undefined),
  markupMutate: vi.fn(),
  mutationOptions: {
    current: null as null | {
      onSuccess?: () => void;
      onError?: (error: { message: string }) => void;
    },
  },
  listMode: { current: "ready" as "ready" | "empty" | "error" },
  markup: {
    current: {
      data: { markupPercent: null as number | null, siteDefaultPercent: 10 },
      isLoading: false,
      error: null as { message: string } | null,
      refetch: vi.fn(),
    },
  },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ contractorAccess: { list: { invalidate }, affiliateMarkup: { invalidate } } }),
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
      affiliateMarkup: {
        useQuery: () => markup.current,
      },
      setAffiliateMarkup: {
        useMutation: () => ({ mutate: markupMutate, isPending: false }),
      },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ContractorAccessAdmin from "./ContractorAccessAdmin";

afterEach(() => {
  cleanup();
  reviewMutate.mockReset();
  markupMutate.mockReset();
  invalidate.mockReset();
  mutationOptions.current = null;
  listMode.current = "ready";
  markup.current = { data: { markupPercent: null, siteDefaultPercent: 10 }, isLoading: false, error: null, refetch: vi.fn() };
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
    expect(screen.getByText("No contractor account yet")).toBeTruthy();

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

  it("lets any admin open a contractor page and set that affiliate's markup", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/components/admin/ContractorAccessAdmin.tsx"), "utf8");
    expect(source).toContain("trpc.contractorAccess.review.useMutation");
    expect(source).not.toContain("affiliateReview");
    render(<ContractorAccessAdmin />);
    const self = screen.getByRole("heading", { name: "Self Co" }).closest("article");
    const affiliate = screen.getByRole("heading", { name: "Build Co" }).closest("article");
    expect(self?.textContent).toContain("Affiliate: None");
    expect(affiliate?.textContent).toContain("Affiliate: Ada Partner · ada@store.example");
    const links = screen.getAllByRole("link", { name: "View contractor" });
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/contractor?contractorUserId=15",
      "/contractor?contractorUserId=81",
    ]);
    expect(screen.getByRole("heading", { name: "Contractor pricing for Ada Partner · ada@store.example" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Markup over cost (%)"), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(markupMutate).toHaveBeenCalledWith({ markupPercent: 15, affiliateUserId: 9 });
    fireEvent.click(screen.getByRole("button", { name: "Use site default" }));
    expect(markupMutate).toHaveBeenCalledWith({ markupPercent: null, affiliateUserId: 9 });
    expect(source).not.toContain("Log in as");
  });
});
