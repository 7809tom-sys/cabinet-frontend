// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AffiliateContractorRequest } from "@/lib/contractorAccessForm";

const { mutate, invalidate, refetchRequests, mutationOptions, reviewMutate, reviewOptions, reviewPending, markupMutate, markupOptions, markupPending, requests, markup } = vi.hoisted(() => ({
  mutate: vi.fn(),
  invalidate: vi.fn(async () => undefined),
  refetchRequests: vi.fn(),
  mutationOptions: {
    current: null as null | {
      onSuccess?: (result: { id: number; status: "pending"; duplicate: boolean }) => void;
      onError?: (error: { message: string }) => void;
    },
  },
  reviewMutate: vi.fn(),
  reviewOptions: {
    current: null as null | {
      onSuccess?: (result: { ok: true; status: "approved" | "rejected" }, input: { id: number; decision: "approved" | "rejected" }) => void;
      onError?: (error: { message: string; data?: { code?: string } | null }) => void;
    },
  },
  reviewPending: { current: false },
  markupMutate: vi.fn(),
  markupOptions: {
    current: null as null | {
      onSuccess?: (result: { ok: true }, input: { markupPercent: number | null; affiliateUserId?: number }) => void;
      onError?: (error: { message: string; data?: { code?: string } | null }) => void;
    },
  },
  markupPending: { current: false },
  requests: {
    current: {
      data: [] as AffiliateContractorRequest[],
      isLoading: false,
      error: null as { message: string } | null,
      refetch: vi.fn(),
    },
  },
  markup: {
    current: {
      data: { markupPercent: null as number | null, siteDefaultPercent: 20 },
      isLoading: false,
      error: null as { message: string; data?: { code?: string } | null } | null,
      refetch: vi.fn(),
    },
  },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ contractorAccess: { myAffiliateRequests: { invalidate }, affiliateMarkup: { invalidate } } }),
    contractorAccess: {
      submitForContractor: {
        useMutation: (options: typeof mutationOptions.current) => {
          mutationOptions.current = options ?? null;
          return { mutate, isPending: false };
        },
      },
      myAffiliateRequests: {
        useQuery: () => requests.current,
      },
      affiliateReview: {
        useMutation: (options: typeof reviewOptions.current) => {
          reviewOptions.current = options ?? null;
          return { mutate: reviewMutate, isPending: reviewPending.current };
        },
      },
      affiliateMarkup: {
        useQuery: () => markup.current,
      },
      setAffiliateMarkup: {
        useMutation: (options: typeof markupOptions.current) => {
          markupOptions.current = options ?? null;
          return { mutate: markupMutate, isPending: markupPending.current };
        },
      },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), message: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";
import { AddContractorPanel } from "./AddContractorPanel";

const request: AffiliateContractorRequest = {
  id: 4,
  contractorName: "Sam Builder",
  contractorEmail: "sam@build.example",
  businessName: "Build Co",
  phone: "555-0199",
  licenseNumber: "LIC-9",
  status: "pending",
  createdAt: "2026-10-02T15:00:00.000Z",
  reviewedAt: null,
  hasAccount: false,
};

afterEach(() => {
  cleanup();
  mutate.mockReset();
  reviewMutate.mockReset();
  markupMutate.mockReset();
  invalidate.mockReset();
  refetchRequests.mockReset();
  mutationOptions.current = null;
  reviewOptions.current = null;
  markupOptions.current = null;
  reviewPending.current = false;
  markupPending.current = false;
  requests.current = { data: [], isLoading: false, error: null, refetch: refetchRequests };
  markup.current = { data: { markupPercent: null, siteDefaultPercent: 20 }, isLoading: false, error: null, refetch: vi.fn() };
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.message).mockReset();
  vi.mocked(toast.error).mockReset();
});

function typeIn(label: RegExp | string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillRequest() {
  typeIn("Contractor name", " Sam Builder ");
  typeIn("Contractor email", "sam@build.example");
  typeIn("Business name", " Build Co ");
  typeIn("Phone", "555-0199");
  typeIn("License (optional)", "LIC-9");
}

describe("Add a contractor", () => {
  it("is on the affiliate desk for owners", () => {
    const dashboard = readFileSync(resolve(process.cwd(), "client/src/pages/AffiliateDashboard.tsx"), "utf8");
    const layout = readFileSync(resolve(process.cwd(), "client/src/components/affiliate/AffiliateDashboardLayout.tsx"), "utf8");
    expect(layout).toContain('{ icon: HardHat, label: "Add a contractor", section: "contractors" }');
    expect(dashboard).toContain('"contractors",');
    expect(dashboard).toContain('case "contractors":');
    expect(dashboard).toContain("<AddContractorPanel />");
    expect(dashboard).toContain('{ label: "Add a contractor", section: "contractors" as AffiliateSection, icon: HardHat }');
    expect(layout).toContain('item.section === "contractors"');
    const panel = readFileSync(resolve(process.cwd(), "client/src/components/affiliate/AddContractorPanel.tsx"), "utf8");
    const procedures = readFileSync(resolve(process.cwd(), "client/src/lib/contractorAccessProcedures.ts"), "utf8");
    expect(panel).toContain("submitForContractor");
    expect(panel).toContain("myAffiliateRequests");
    expect(procedures).toContain("Cast until AppRouter includes them");
    expect(procedures).toContain("trpc as unknown as");
  });

  it("requires contractor identity plus the shared application fields", () => {
    render(<AddContractorPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Add a contractor" }));
    expect(screen.getByRole("alert").textContent).toContain("Enter the contractor name.");
    expect(mutate).not.toHaveBeenCalled();

    typeIn("Contractor name", "Sam Builder");
    typeIn("Contractor email", "not-an-email");
    fireEvent.click(screen.getByRole("button", { name: "Add a contractor" }));
    expect(screen.getByRole("alert").textContent).toContain("Enter a valid contractor email.");
    expect(mutate).not.toHaveBeenCalled();
  });

  it("sends the request and says when one is already pending", () => {
    render(<AddContractorPanel />);
    fillRequest();
    fireEvent.click(screen.getByRole("button", { name: "Add a contractor" }));
    expect(mutate).toHaveBeenCalledWith({
      contractorName: "Sam Builder",
      contractorEmail: "sam@build.example",
      businessName: "Build Co",
      phone: "555-0199",
      licenseNumber: "LIC-9",
    });

    act(() => {
      mutationOptions.current?.onSuccess?.({ id: 4, status: "pending", duplicate: true });
    });
    expect(screen.getByRole("status").textContent).toBe("A request for that contractor is already pending.");
    expect(toast.message).toHaveBeenCalledWith("A request for that contractor is already pending.");
    expect(toast.success).not.toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalled();
    expect((screen.getByLabelText("Contractor name") as HTMLInputElement).value).toBe("");

    fillRequest();
    fireEvent.click(screen.getByRole("button", { name: "Add a contractor" }));
    act(() => {
      mutationOptions.current?.onSuccess?.({ id: 5, status: "pending", duplicate: false });
    });
    expect(toast.success).toHaveBeenCalledWith("Contractor request sent.");
    expect(screen.getByRole("status").textContent).toBe("Contractor request sent.");
  });

  it("shows the server error for an account that is already an approved contractor", () => {
    render(<AddContractorPanel />);
    fillRequest();
    fireEvent.click(screen.getByRole("button", { name: "Add a contractor" }));
    act(() => {
      mutationOptions.current?.onError?.({ message: "This account is already an approved contractor." });
    });
    expect(screen.getByRole("alert").textContent).toBe("This account is already an approved contractor.");
    expect(toast.error).toHaveBeenCalledWith("This account is already an approved contractor.");
    expect((screen.getByLabelText("Contractor name") as HTMLInputElement).value).toBe(" Sam Builder ");
  });

  it("lists status, dates, and whether the contractor has an account", () => {
    requests.current = {
      ...requests.current,
      data: [
        request,
        {
          ...request,
          id: 8,
          contractorName: "Riley Approved",
          contractorEmail: "riley@build.example",
          businessName: "Reviewed Co",
          phone: "555-0144",
          licenseNumber: null,
          status: "approved",
          reviewedAt: "2026-10-20T12:00:00.000Z",
          hasAccount: true,
        },
      ],
    };
    const { unmount } = render(<AddContractorPanel />);
    expect(screen.getByRole("heading", { name: "My contractor requests" })).toBeTruthy();
    const pending = screen.getByRole("heading", { name: "Sam Builder" }).closest("article");
    const approved = screen.getByRole("heading", { name: "Riley Approved" }).closest("article");
    expect(pending?.textContent).toContain("sam@build.example · Build Co · 555-0199");
    expect(pending?.textContent).toContain("License LIC-9");
    expect(pending?.textContent).toContain("Pending");
    expect(pending?.textContent).toContain(`Requested ${new Date(request.createdAt).toLocaleDateString()}`);
    expect(pending?.textContent).toContain("Not reviewed yet");
    expect(pending?.textContent).toContain("No account yet");
    expect(approved?.textContent).toContain("Approved");
    expect(approved?.textContent).toContain("Has an account");
    expect(approved?.textContent).toContain(`Reviewed ${new Date("2026-10-20T12:00:00.000Z").toLocaleDateString()}`);
    expect(pending?.querySelector("button")?.textContent).toContain("Approve");
    expect(approved?.querySelector("button")).toBeNull();
    unmount();

    requests.current = { ...requests.current, data: [], error: { message: "Forbidden" } };
    render(<AddContractorPanel />);
    expect(screen.getByText("Forbidden").className).toContain("text-destructive");
  });

  it("lets the affiliate approve or reject a pending request and shows the server error", () => {
    requests.current = { ...requests.current, data: [request], refetch: refetchRequests };
    render(<AddContractorPanel />);
    expect(screen.getByText(/You approve it before they get contractor tools/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(reviewMutate).toHaveBeenCalledWith({ id: 4, decision: "approved" });
    act(() => {
      reviewOptions.current?.onSuccess?.({ ok: true, status: "approved" }, { id: 4, decision: "approved" });
    });
    expect(toast.success).toHaveBeenCalledWith("Contractor approved.");
    expect(refetchRequests).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(reviewMutate).toHaveBeenCalledWith({ id: 4, decision: "rejected" });
    act(() => {
      reviewOptions.current?.onError?.({ message: "Only the submitting affiliate can review this request.", data: { code: "FORBIDDEN" } });
    });
    expect(screen.getByRole("alert").textContent).toBe("FORBIDDEN: Only the submitting affiliate can review this request.");
    expect(toast.error).toHaveBeenCalledWith("FORBIDDEN: Only the submitting affiliate can review this request.");
  });

  it("disables approve and reject while the review is pending", () => {
    reviewPending.current = true;
    requests.current = { ...requests.current, data: [request], refetch: refetchRequests };
    render(<AddContractorPanel />);
    expect((screen.getByRole("button", { name: "Approve" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Reject" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("saves a markup over the affiliate's cost and can clear it back to the site default", () => {
    render(<AddContractorPanel />);
    expect(screen.getByRole("heading", { name: "Contractor pricing" })).toBeTruthy();
    expect(screen.getByText("Set the markup you charge contractors over your cost (what you pay Cabinet Dealz). Leave it unset to use the site default.")).toBeTruthy();
    expect(screen.getByText("Site default is 20%.")).toBeTruthy();
    expect(screen.getByTestId("contractor-markup-example").textContent).toBe("A $100.00 cost sells to your contractors at $120.00");

    fireEvent.change(screen.getByLabelText("Markup over your cost (%)"), { target: { value: "12.5" } });
    expect(screen.getByTestId("contractor-markup-example").textContent).toBe("A $100.00 cost sells to your contractors at $112.50");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(markupMutate).toHaveBeenCalledWith({ markupPercent: 12.5 });

    fireEvent.click(screen.getByRole("button", { name: "Use site default" }));
    expect(markupMutate).toHaveBeenCalledWith({ markupPercent: null });
    act(() => {
      markupOptions.current?.onError?.({ message: "FORBIDDEN" });
    });
    expect(toast.error).toHaveBeenCalledWith("FORBIDDEN");
  });
});
