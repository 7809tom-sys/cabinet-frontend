// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AffiliateContractorRequest } from "@/lib/contractorAccessForm";

const { mutate, invalidate, mutationOptions, requests } = vi.hoisted(() => ({
  mutate: vi.fn(),
  invalidate: vi.fn(async () => undefined),
  mutationOptions: {
    current: null as null | {
      onSuccess?: (result: { id: number; status: "pending"; duplicate: boolean }) => void;
      onError?: (error: { message: string }) => void;
    },
  },
  requests: {
    current: {
      data: [] as AffiliateContractorRequest[],
      isLoading: false,
      error: null as { message: string } | null,
      refetch: vi.fn(),
    },
  },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ contractorAccess: { myAffiliateRequests: { invalidate } } }),
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
  invalidate.mockReset();
  mutationOptions.current = null;
  requests.current = { data: [], isLoading: false, error: null, refetch: vi.fn() };
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
    unmount();

    requests.current = { ...requests.current, data: [], error: { message: "Forbidden" } };
    render(<AddContractorPanel />);
    expect(screen.getByText("Forbidden").className).toContain("text-destructive");
  });
});
