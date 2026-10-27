// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VendorReferralRow } from "@/lib/vendorReferralForm";

const { listState, updateMutate, invalidate, mutationOptions } = vi.hoisted(() => ({
  listState: {
    current: {
      data: undefined as VendorReferralRow[] | undefined,
      isLoading: false,
      isError: false,
      error: null as { message: string } | null,
      refetch: vi.fn(),
    },
  },
  updateMutate: vi.fn(),
  invalidate: vi.fn(),
  mutationOptions: {
    current: null as null | {
      onSuccess?: () => void;
      onError?: (error: { message: string }) => void;
    },
  },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ vendorReferrals: { adminList: { invalidate } } }),
    vendorReferrals: {
      adminList: { useQuery: () => listState.current },
      adminUpdateStatus: {
        useMutation: (options: typeof mutationOptions.current) => {
          mutationOptions.current = options ?? null;
          return { mutate: updateMutate, isPending: false };
        },
      },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import VendorReferralsAdmin from "./VendorReferralsAdmin";

const row: VendorReferralRow = {
  id: 7,
  affiliateId: 3,
  affiliateName: "Ada's Kitchens",
  vendorName: "Northwind Cabinets",
  contactName: "Ada Lopez",
  email: "ada@northwind.example",
  phone: "555-0100",
  notes: "Ships unfinished boxes.",
  status: "new",
  createdAt: "2026-10-01T12:00:00.000Z",
};

afterEach(() => {
  cleanup();
  updateMutate.mockReset();
  invalidate.mockReset();
  mutationOptions.current = null;
  listState.current = { data: undefined, isLoading: false, isError: false, error: null, refetch: vi.fn() };
});

describe("VendorReferralsAdmin", () => {
  it("is the People tab next to Approved Vendors", () => {
    const tabs = readFileSync(resolve(process.cwd(), "client/src/components/admin/AdminGroupedTabs.tsx"), "utf8");
    const approvedLine = '{ value: "approved-vendors", label: "Approved Vendors" }';
    const referralLine = '{ value: "vendor-referrals", label: "Vendor Referrals" }';
    const approved = tabs.indexOf(approvedLine);
    const referrals = tabs.indexOf(referralLine);
    expect(approved).toBeGreaterThan(-1);
    expect(referrals).toBeGreaterThan(approved);
    expect(tabs.slice(approved + approvedLine.length, referrals)).not.toContain("{ value:");
    expect(tabs).toContain('<TabsContent value="vendor-referrals" className="mt-6"><VendorReferralsAdmin /></TabsContent>');
    const source = readFileSync(resolve(process.cwd(), "client/src/components/admin/VendorReferralsAdmin.tsx"), "utf8");
    expect(source).toContain("vendorReferrals.adminList");
    expect(source).toContain("vendorReferrals.adminUpdateStatus");
  });

  it("lists a referral and updates its status", () => {
    listState.current = { ...listState.current, data: [row] };
    render(<VendorReferralsAdmin />);
    expect(screen.getByRole("heading", { name: "Vendor Referrals" })).toBeTruthy();
    expect(screen.getByText("Northwind Cabinets")).toBeTruthy();
    expect(screen.getByText("Ada's Kitchens")).toBeTruthy();
    expect(screen.getByText("ada@northwind.example")).toBeTruthy();
    expect(screen.getByText("Ships unfinished boxes.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Status for Northwind Cabinets"), { target: { value: "contacted" } });
    expect(updateMutate).toHaveBeenCalledWith({ id: 7, status: "contacted" });
    act(() => {
      mutationOptions.current?.onSuccess?.();
    });
    expect(invalidate).toHaveBeenCalled();
  });

  it("shows an empty list and a load error", () => {
    listState.current = { ...listState.current, data: [] };
    const { unmount } = render(<VendorReferralsAdmin />);
    expect(screen.getByText("No vendor referrals yet.")).toBeTruthy();
    unmount();

    listState.current = {
      ...listState.current,
      data: undefined,
      isError: true,
      error: { message: "Forbidden" },
      refetch: vi.fn(),
    };
    render(<VendorReferralsAdmin />);
    expect(screen.getByRole("alert").textContent).toContain("Couldn't load vendor referrals: Forbidden");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(listState.current.refetch).toHaveBeenCalled();
  });
});
