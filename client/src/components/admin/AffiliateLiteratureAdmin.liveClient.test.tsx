// @vitest-environment jsdom
/**
 * Uses the real tRPC react client, not a stand-in for useMutation.
 * Calling `.fetch` on a procedure throws `hooks[lastArg] is not a function`,
 * which the production bundle reports as `e[i] is not a function`.
 * Ticking Affiliate library must go through useMutation and adminUpdate.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { observable } from "@trpc/server/observable";
import { afterEach, describe, expect, it, vi } from "vitest";
import { trpc } from "@/lib/trpc";
import AffiliateLiteratureAdmin from "./AffiliateLiteratureAdmin";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

type Row = Record<string, unknown>;

const rows: Row[] = [
  {
    id: 3,
    title: "Kitchen Installation Cost Sheet",
    description: "Kitchen material and labor estimating reference for affiliate installation estimates.",
    category: "Installation",
    filename: "KitchenCostSheet.pdf",
    url: "/manus-storage/library-documents/KitchenCostSheet.pdf",
    mimeType: "application/pdf",
    sizeBytes: 405504,
    isPublished: false,
    sortOrder: 2,
    visibility: "internal",
    documentRole: "literature",
    affiliateToggledAt: null,
    affiliateToggledByName: null,
  },
  {
    id: 10,
    title: "SolidTrac Catalog",
    description: "SolidTrac product literature.",
    category: "Product Catalogs",
    filename: "solidtrac.pdf",
    url: "/manus-storage/library-documents/solidtrac.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1048576,
    isPublished: false,
    sortOrder: 1,
    visibility: "internal",
    documentRole: null,
    affiliateToggledAt: null,
    affiliateToggledByName: null,
  },
  {
    id: 8,
    title: "Cabinet Dealz Affiliate Portal Sales Brochure",
    description: "Customer-facing overview of the affiliate storefront.",
    category: "Sales & Marketing",
    filename: "CabinetDealz_Affiliate_Portal_Sales_Brochure.pdf",
    url: "/manus-storage/library-documents/brochure.pdf",
    mimeType: "application/pdf",
    sizeBytes: 793600,
    isPublished: true,
    sortOrder: 3,
    visibility: "affiliate",
    documentRole: "literature",
    affiliateToggledAt: "2026-11-05T10:00:00.000Z",
    affiliateToggledByName: "Tom",
  },
  {
    id: 7,
    title: "Cabinet Dealz Designer User Guide",
    description: "Step-by-step guide for setting up a room and saving.",
    category: "Training",
    filename: "CabinetDealz_Designer_User_Guide.pdf",
    url: "/manus-storage/library-documents/guide.pdf",
    mimeType: "application/pdf",
    sizeBytes: 77824,
    isPublished: false,
    sortOrder: 4,
    visibility: "internal",
    documentRole: "literature",
    affiliateToggledAt: null,
    affiliateToggledByName: null,
  },
];

const calls: { type: string; path: string; input: unknown }[] = [];

function stateLink() {
  return () => ({ op }: { op: { type: string; path: string; input: unknown } }) =>
    observable((observer) => {
      calls.push({ type: op.type, path: op.path, input: op.input });
      if (op.type === "mutation" && op.path === "affiliateLiterature.adminUpdate") {
        const input = op.input as { id: number; inAffiliateLibrary?: boolean };
        const row = rows.find((entry) => entry.id === input.id);
        if (row && input.inAffiliateLibrary !== undefined) {
          row.visibility = input.inAffiliateLibrary ? "affiliate" : "internal";
          row.isPublished = input.inAffiliateLibrary;
          row.affiliateToggledAt = "2026-11-10T00:30:00.000Z";
          row.affiliateToggledByName = "Tom";
        }
        observer.next({ result: { data: { id: input.id } } });
      } else if (op.path === "affiliateResources.adminSignedFile") {
        observer.next({ result: { data: { url: "https://storage.example/signed/sheet.pdf", filename: "KitchenCostSheet.pdf", mimeType: "application/pdf" } } });
      } else {
        observer.next({ result: { data: rows.map((row) => ({ ...row })) } });
      }
      observer.complete();
      return () => undefined;
    });
}

function renderAdmin() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // AppRouter is not in this repo, so the typed client collapses. The runtime
  // object is still createTRPCReact; the cast keeps this test out of tsc.
  const clientApi = trpc as unknown as {
    createClient: (opts: { links: unknown[] }) => unknown;
    Provider: (props: { client: unknown; queryClient: QueryClient; children: React.ReactNode }) => React.ReactElement;
  };
  const client = clientApi.createClient({ links: [stateLink()] });
  return render(
    <clientApi.Provider client={client} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AffiliateLiteratureAdmin />
      </QueryClientProvider>
    </clientApi.Provider>,
  );
}

afterEach(() => {
  cleanup();
  calls.length = 0;
  rows[0].visibility = "internal";
  rows[0].isPublished = false;
  rows[0].affiliateToggledAt = null;
  rows[0].affiliateToggledByName = null;
});

describe("real tRPC client: Affiliate library tick", () => {
  it("sends adminUpdate through useMutation and flips the badge", async () => {
    renderAdmin();
    await waitFor(() => expect(screen.getByTestId("library-visibility-3").textContent).toContain("Internal"));
    expect(screen.getByTestId("library-section-reference").textContent).toContain("Kitchen Installation Cost Sheet");
    fireEvent.click(screen.getByLabelText("Affiliate library for Kitchen Installation Cost Sheet"));
    await waitFor(() => expect(screen.getByTestId("library-visibility-3").textContent).toContain("Affiliate library"));
    const update = calls.find((call) => call.path === "affiliateLiterature.adminUpdate");
    expect(update).toMatchObject({ type: "mutation", input: { id: 3, inAffiliateLibrary: true } });
    expect(screen.getByTestId("library-section-reference").textContent).toContain("Kitchen Installation Cost Sheet");
    expect(calls.some((call) => String(call.path).includes("fetch"))).toBe(false);
  });

  it("opens through the utils fetch, which is a query rather than a thrown e[i]", async () => {
    const opened: string[] = [];
    const openSpy = vi.spyOn(window, "open").mockImplementation((url) => {
      opened.push(String(url));
      return null;
    });
    renderAdmin();
    await waitFor(() => expect(screen.getByRole("button", { name: "Open Kitchen Installation Cost Sheet" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Open Kitchen Installation Cost Sheet" }));
    await waitFor(() => expect(opened).toEqual(["https://storage.example/signed/sheet.pdf"]));
    expect(calls.some((call) => call.path === "affiliateResources.adminSignedFile" && call.type === "query")).toBe(true);
    openSpy.mockRestore();
  });
});
