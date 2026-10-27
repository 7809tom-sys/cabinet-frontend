// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OnboardingRow } from "@/lib/vendorOnboarding";

const summaryQuery = vi.hoisted(() => vi.fn());
const flaggedQuery = vi.hoisted(() => vi.fn());
const ingestMutate = vi.hoisted(() => vi.fn());
const submitMutate = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      vendorOnboarding: {
        summary: { invalidate: vi.fn() },
        flagged: { invalidate: vi.fn() },
        adminList: { invalidate: vi.fn() },
      },
    }),
    vendorOnboarding: {
      summary: { useQuery: (input: unknown) => summaryQuery(input) },
      flagged: { useQuery: (input: unknown, opts?: unknown) => flaggedQuery(input, opts) },
      ingest: {
        useMutation: (opts: { onSuccess?: Function; onError?: Function }) => ({
          mutate: (input: unknown) => ingestMutate(input, opts),
          isPending: false,
        }),
      },
      submitDetails: {
        useMutation: (opts: { onSuccess?: Function; onError?: Function }) => ({
          mutate: (input: unknown) => submitMutate(input, opts),
          isPending: false,
        }),
      },
    },
  },
}));

import { toast } from "sonner";
import { VendorOnboarding } from "./VendorOnboarding";

const counts = { total: 10, matched: 6, flagged: 2, completed: 1, trimHeld: 1, styleUnmapped: 2 };

function row(overrides: Partial<OnboardingRow> = {}): OnboardingRow {
  return {
    id: 1,
    importId: 7,
    distributorId: 4,
    rowNumber: 2,
    sku: "B12",
    status: "flagged",
    flagReason: "missing_special",
    missingFields: ["price"],
    needsFullDetails: false,
    cabinetId: 90,
    masterCode: "B12",
    matchedVia: "master",
    candidateMasterCodes: [],
    reviewCabinetId: null,
    distributorName: "Line A",
    style: "Shaker",
    color: "White",
    price: null,
    styleId: null,
    skuId: null,
    category: null,
    subCategory: null,
    width: null,
    height: null,
    depth: null,
    description: null,
    numberOfDoors: null,
    numberOfDrawers: null,
    trimHeld: false,
    trimSupplierId: null,
    message: null,
    inherited: {
      cabinetId: 90,
      masterCode: "B12",
      description: "12 inch base",
      category: "Base",
      subCategory: null,
      width: "12.000",
      height: "34.500",
      depth: "24.000",
      numberOfDoors: 1,
      numberOfDrawers: 1,
    },
    ...overrides,
  };
}

function renderPortal(flaggedRows: OnboardingRow[] = [row(), row({ id: 9, sku: "HIDDEN-MATCH", status: "matched", flagReason: null, missingFields: [] })]) {
  const refetch = vi.fn();
  summaryQuery.mockReturnValue({
    data: { importId: 7, distributorId: 4, fileName: "prices.csv", createdAt: null, counts },
    isLoading: false,
    error: null,
    refetch,
  });
  flaggedQuery.mockReturnValue({
    data: {
      importId: 7,
      doors: [{ id: 3, name: "Shaker", color: "White" }, { id: 4, name: "Oxford", color: "Grey" }],
      rows: flaggedRows,
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
  render(<VendorOnboarding distributorId={4} />);
  return { refetch };
}

afterEach(() => {
  cleanup();
  summaryQuery.mockReset();
  flaggedQuery.mockReset();
  ingestMutate.mockReset();
  submitMutate.mockReset();
});

describe("vendor onboarding portal", () => {
  it("shows the summary explanations and only flagged rows", () => {
    renderPortal();
    expect(screen.getByText("Matched SKUs only needed distributor, style, color and price.")).toBeTruthy();
    expect(screen.getByText("Trim stays with the supplier that already sells it.")).toBeTruthy();
    expect(screen.getByText("The style text didn't match a door on their line, so no price was published.")).toBeTruthy();
    expect(screen.getByTestId("onboarding-count-matched").textContent).toBe("6");
    expect(screen.getByTestId("onboarding-count-trimHeld").textContent).toBe("1");
    expect(screen.getByTestId("onboarding-count-styleUnmapped").textContent).toBe("2");
    expect(screen.getByText("12 inch base")).toBeTruthy();
    expect(screen.getByText("Master details, read only")).toBeTruthy();
    expect(screen.getByLabelText("Price")).toBeTruthy();
    expect(screen.queryByLabelText("Width")).toBeNull();
    expect(screen.queryByLabelText("Style")).toBeNull();
    expect(screen.queryByText("HIDDEN-MATCH")).toBeNull();
    expect(screen.getByText("Complete these items")).toBeTruthy();
    expect(flaggedQuery).toHaveBeenCalledWith({ importId: 7, distributorId: 4 }, { enabled: true });
  });

  it("collects a full cabinet for an ambiguous SKU and names the candidates", () => {
    renderPortal([row({
      sku: "B12X",
      flagReason: "ambiguous",
      needsFullDetails: true,
      missingFields: [],
      candidateMasterCodes: ["B12", "B12FH"],
      inherited: null,
      style: "",
      distributorName: null,
      color: null,
    })]);
    expect(screen.getByText(/B12, B12FH/)).toBeTruthy();
    expect(screen.getByLabelText("Style")).toBeTruthy();
    expect(screen.getByLabelText("Distributor")).toBeTruthy();
    expect(screen.getByLabelText("Category")).toBeTruthy();
    expect(screen.getByLabelText("Subcategory")).toBeTruthy();
    expect(screen.getByLabelText("Width")).toBeTruthy();
    expect(screen.getByLabelText("Doors")).toBeTruthy();
    expect(screen.getByLabelText("Drawers")).toBeTruthy();
    expect(screen.queryByText("Master details, read only")).toBeNull();
  });

  it("forces drawers to 0 on a 9-inch base before submit", () => {
    renderPortal([row({
      sku: "CUSTOM9",
      flagReason: "unknown_sku",
      needsFullDetails: true,
      missingFields: [],
      masterCode: null,
      cabinetId: null,
      inherited: null,
      width: "9",
      category: "",
      numberOfDrawers: 2,
      distributorName: null,
      style: null,
      color: null,
    })]);
    const drawers = screen.getByLabelText("Drawers") as HTMLInputElement;
    expect(drawers.disabled).toBe(false);
    expect(drawers.value).toBe("2");
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Base" } });
    expect((screen.getByLabelText("Drawers") as HTMLInputElement).value).toBe("0");
    expect((screen.getByLabelText("Drawers") as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText("9-inch bases never have drawers.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save CUSTOM9" }));
    expect(submitMutate.mock.calls[0][0].numberOfDrawers).toBe(0);
  });

  it("keeps a row the server still marks flagged and shows its message", () => {
    renderPortal();
    fireEvent.click(screen.getByRole("button", { name: "Save B12" }));
    act(() => {
      submitMutate.mock.calls[0][1].onSuccess({
        row: { ...row(), status: "flagged", message: "Still missing price." },
        summary: counts,
        conflictStatus: null,
        staysPublic: null,
      });
    });
    expect(screen.getByTestId("flagged-row-1")).toBeTruthy();
    expect(screen.getByText(/Still missing price/)).toBeTruthy();
  });

  it("removes a finished row and says a review cabinet stays public", () => {
    renderPortal();
    fireEvent.click(screen.getByRole("button", { name: "Save B12" }));
    const opts = submitMutate.mock.calls[0][1];
    act(() => {
      opts.onSuccess({
        row: { ...row(), status: "completed", reviewCabinetId: 44 },
        summary: counts,
        conflictStatus: "review",
        staysPublic: true,
      });
    });
    expect(screen.queryByTestId("flagged-row-1")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("B12 went to CabinetDealz cabinet conflict review and stays public.");
  });

  it("shows a BAD_REQUEST on the row and leaves other errors off the row", () => {
    renderPortal();
    fireEvent.click(screen.getByRole("button", { name: "Save B12" }));
    act(() => {
      submitMutate.mock.calls[0][1].onError({
        message: "Style \"Mystery\" is not one door on this line. Use the line's door name.",
        data: { code: "BAD_REQUEST" },
      });
    });
    expect(screen.getByRole("alert").textContent).toMatch(/Mystery/);
    expect(screen.getByTestId("flagged-row-1")).toBeTruthy();

    cleanup();
    renderPortal();
    fireEvent.click(screen.getByRole("button", { name: "Save B12" }));
    act(() => {
      submitMutate.mock.calls.at(-1)?.[1].onError({ message: "Flagged row not found.", data: { code: "NOT_FOUND" } });
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(toast.error).toHaveBeenCalled();
  });

  it("sends pasted csv text to ingest and reloads the latest summary", async () => {
    const { refetch } = renderPortal();
    fireEvent.change(screen.getByLabelText("CSV or TSV text"), { target: { value: "SKU\tStyle\tColor\tPrice\nB12\tShaker\tWhite\t10" } });
    fireEvent.click(screen.getByRole("button", { name: "Import pasted sheet" }));
    await waitFor(() => expect(ingestMutate).toHaveBeenCalled());
    expect(ingestMutate.mock.calls[0][0]).toMatchObject({
      distributorId: 4,
      fileName: "pasted.csv",
      text: expect.stringContaining("B12"),
    });
    expect(ingestMutate.mock.calls[0][0].rows).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "Reload latest import" }));
    expect(refetch).toHaveBeenCalled();
    expect(summaryQuery).toHaveBeenCalledWith({ distributorId: 4 });
  });
});
