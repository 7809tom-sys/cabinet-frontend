// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CABINET_DEALS_RESTOCKING_FEE, CABINET_DEALS_RETURN_RULES } from "@/lib/distributorLegalTerms";

const list = vi.hoisted(() => vi.fn());
const save = vi.hoisted(() => vi.fn());

vi.mock("@/lib/trpc", () => ({
  trpc: {
    distributorLegalTerms: {
      list: { useQuery: () => list() },
      save: { useMutation: () => ({ mutateAsync: save, isPending: false }) },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import LegalAdmin from "./LegalAdmin";

afterEach(() => {
  cleanup();
  list.mockReset();
  save.mockReset();
});

function loaded(data: unknown[] | undefined, isError = false) {
  list.mockReturnValue({
    data,
    isLoading: false,
    isError,
    error: isError ? { message: "Table missing" } : null,
    refetch: vi.fn(),
  });
}

describe("Legal admin tab", () => {
  it("shows U.S. Cabinet Depot's own wording and the Cabinet Deals rules underneath, not inside it", () => {
    loaded([]);
    render(<LegalAdmin />);

    expect(screen.getByTestId("legal-admin")).toBeTruthy();
    expect(screen.getByTestId("legal-badge-us-cabinet-depot").textContent).toBe("Lifetime");
    const returns = screen.getByTestId("legal-text-us-cabinet-depot-returns") as HTMLTextAreaElement;
    const shipping = screen.getByTestId("legal-text-us-cabinet-depot-shipping") as HTMLTextAreaElement;
    const warranty = screen.getByTestId("legal-text-us-cabinet-depot-warranty") as HTMLTextAreaElement;
    expect(returns.value).toContain("All returns must be authorized by US Cabinet Depot prior to return shipment.");
    expect(returns.value).not.toContain("thirty percent (30%)");
    expect(returns.value).not.toContain(CABINET_DEALS_RETURN_RULES[0]);
    expect(shipping.value).toContain("Shipped orders, with the exception of small parcel orders");
    expect(warranty.value).toContain("Brothers Global Inc, warrants");
    expect(warranty.value).not.toContain("Return Merchandise Authorizations");

    const rules = screen.getByTestId("legal-cabinet-deals-us-cabinet-depot");
    expect(rules.textContent).toContain(CABINET_DEALS_RETURN_RULES[0]);
    expect(rules.textContent).toContain(CABINET_DEALS_RETURN_RULES[1]);
    expect(screen.getByTestId("legal-cabinet-deals-us-cabinet-depot-fee").textContent).toContain(CABINET_DEALS_RESTOCKING_FEE);
    expect(screen.getByTestId("legal-audit-us-cabinet-depot-returns").textContent).toContain("No admin edit yet");
    expect(screen.getByTestId("legal-repo-references").textContent).toContain("client/src/pages/ReturnPolicy.tsx");
  });

  it("shows the paste state for an empty saved section and the last editor when a section was saved", () => {
    loaded([
      {
        distributorKey: "us-cabinet-depot",
        sectionKey: "shipping",
        bodyText: "",
        updatedByName: "Tom",
        updatedAt: "2026-11-10T18:04:00.000Z",
      },
    ]);
    render(<LegalAdmin />);
    const shipping = screen.getByTestId("legal-text-us-cabinet-depot-shipping") as HTMLTextAreaElement;
    expect(shipping.value).toBe("");
    expect(shipping.placeholder).toBe("paste distributor terms here");
    expect(screen.getByTestId("legal-audit-us-cabinet-depot-shipping").textContent).toContain("Tom");
    expect(screen.getByTestId("legal-section-us-cabinet-depot-shipping").textContent).toContain("https://www.uscabinetdepot.com/terms-and-conditions");
  });

  it("shows Skyline, Faircrest, Milestone, and Pelican without merging the Cabinet Deals fee into their text", () => {
    loaded([]);
    render(<LegalAdmin />);

    fireEvent.click(screen.getByTestId("legal-distributor-skyline"));
    expect(screen.getByTestId("legal-badge-skyline").textContent).toBe("One year");
    const skylineReturns = screen.getByTestId("legal-text-skyline-returns") as HTMLTextAreaElement;
    expect(skylineReturns.value).not.toContain("twelve months");
    expect(skylineReturns.value).toContain("20% restocking fee will be charged");
    expect(skylineReturns.value).not.toContain("thirty percent (30%)");
    expect((screen.getByTestId("legal-text-skyline-warranty") as HTMLTextAreaElement).value).toContain("Limited 12 Month Warranty");

    fireEvent.click(screen.getByTestId("legal-distributor-faircrest"));
    expect(screen.getByTestId("legal-distributor-faircrest").textContent).toContain("Clark and Son");
    expect(screen.queryByTestId("legal-badge-faircrest")).toBeNull();
    expect((screen.getByTestId("legal-text-faircrest-returns") as HTMLTextAreaElement).value).toContain("Clark and Son will deny your claim");
    expect((screen.getByTestId("legal-text-faircrest-warranty") as HTMLTextAreaElement).value).toContain("Five (5) years");

    fireEvent.click(screen.getByTestId("legal-distributor-milestone"));
    expect(screen.getByTestId("legal-badge-milestone").textContent).toBe("12 months");
    expect((screen.getByTestId("legal-text-milestone-warranty") as HTMLTextAreaElement).value).toContain("twelve months");

    fireEvent.click(screen.getByTestId("legal-distributor-pelican"));
    const pelicanReturns = screen.getByTestId("legal-text-pelican-returns") as HTMLTextAreaElement;
    expect(pelicanReturns.value).toContain("The product must be unopened and in good condition.");
    expect(pelicanReturns.value).toContain("10 day return policy with a 30% restocking fee");
    expect(pelicanReturns.value).not.toContain("thirty percent (30%)");
    expect(screen.getByTestId("legal-cabinet-deals-pelican-fee").textContent).toContain("thirty percent (30%)");
  });

  it("blocks save when storage is missing and still shows the captured wording", () => {
    loaded(undefined, true);
    render(<LegalAdmin />);
    expect(screen.getByTestId("legal-storage-missing").textContent).toContain("0274_distributor_legal_terms.tidb.sql");
    expect((screen.getByTestId("legal-save-us-cabinet-depot-returns") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("legal-text-us-cabinet-depot-warranty") as HTMLTextAreaElement).value).toContain("Limited Lifetime Warranty");
  });
});
