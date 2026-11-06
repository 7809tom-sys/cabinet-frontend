// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { state } = vi.hoisted(() => ({
  state: {
    rows: [] as Record<string, unknown>[],
    updateInputs: [] as Record<string, unknown>[],
    uploadInputs: [] as Record<string, unknown>[],
    signedFileInputs: [] as Record<string, unknown>[],
    invalidated: 0,
  },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: new Proxy({}, {
    get(_target, namespace) {
      if (namespace === "useUtils") {
        return () => ({
          affiliateLiterature: {
            adminList: { invalidate: () => { state.invalidated += 1; return Promise.resolve(); } },
          },
        });
      }
      if (typeof namespace !== "string") return undefined;
      // affiliateResources.adminSignedFile is the admin-only way to open a
      // private document; the page asks it for a link instead of using url.
      if (namespace === "affiliateResources") {
        return {
          adminSignedFile: {
            fetch: async (input: Record<string, unknown>) => {
              state.signedFileInputs.push(input);
              return { url: "https://storage.example/signed/guide.md", filename: "guide.md", mimeType: "text/plain" };
            },
          },
        };
      }
      return new Proxy({}, {
        get(_inner, procedure) {
          if (procedure === "adminList") {
            return { useQuery: () => ({ data: state.rows, isLoading: false, error: null }) };
          }
          if (procedure === "adminUpdate") {
            return {
              useMutation: (options?: { onSuccess?: (result: unknown, input: Record<string, unknown>) => void }) => ({
                mutate: (input: Record<string, unknown>) => {
                  state.updateInputs.push(input);
                  options?.onSuccess?.({ id: input.id }, input);
                },
                mutateAsync: async () => undefined,
                isPending: false,
              }),
            };
          }
          if (procedure === "adminUpload") {
            return {
              useMutation: (options?: { onSuccess?: (result: unknown, input: Record<string, unknown>) => void }) => ({
                mutate: (input: Record<string, unknown>) => {
                  state.uploadInputs.push(input);
                  options?.onSuccess?.({ id: 99, url: "/manus-storage/library-documents/x.pdf" }, input);
                },
                mutateAsync: async () => undefined,
                isPending: false,
              }),
            };
          }
          return {
            useMutation: () => ({ mutate: () => undefined, mutateAsync: async () => undefined, isPending: false }),
          };
        },
      });
    },
  }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import AffiliateLiteratureAdmin from "./AffiliateLiteratureAdmin";

beforeEach(() => {
  state.rows = [
    {
      id: 7,
      title: "Website Improvement Proposal — Lessons from Marazzi USA",
      description: "Internal strategy proposal.",
      category: "Internal",
      filename: "website-improvement-proposal.pdf",
      url: "/manus-storage/library-documents/internal/proposal.pdf",
      mimeType: "application/pdf",
      sizeBytes: 92281,
      isPublished: false,
      sortOrder: 900,
      visibility: "internal",
      affiliateToggledAt: null,
      affiliateToggledByName: null,
    },
    {
      id: 8,
      title: "Affiliate sales brochure",
      description: null,
      category: "Sales",
      filename: "brochure.pdf",
      url: "/manus-storage/library-documents/affiliate/brochure.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2048,
      isPublished: true,
      sortOrder: 10,
      visibility: "affiliate",
      affiliateToggledAt: "2026-11-05T10:00:00.000Z",
      affiliateToggledByName: "Tom",
    },
  ];
  state.updateInputs = [];
  state.uploadInputs = [];
  state.signedFileInputs = [];
  state.invalidated = 0;
});

afterEach(() => cleanup());

describe("admin literature page: Affiliate library checkbox", () => {
  it("shows a checkbox on every PDF, internal ones included", () => {
    render(<AffiliateLiteratureAdmin />);
    expect(screen.getByLabelText("Affiliate library for Website Improvement Proposal — Lessons from Marazzi USA")).toBeTruthy();
    expect(screen.getByLabelText("Affiliate library for Affiliate sales brochure")).toBeTruthy();
    expect(screen.getByTestId("library-visibility-7").textContent).toContain("Internal");
    expect(screen.getByTestId("library-visibility-8").textContent).toContain("Affiliate library");
  });

  it("adds an internal PDF to the affiliate library as soon as the box is checked", () => {
    render(<AffiliateLiteratureAdmin />);
    fireEvent.click(screen.getByLabelText("Affiliate library for Website Improvement Proposal — Lessons from Marazzi USA"));
    expect(state.updateInputs).toEqual([{ id: 7, inAffiliateLibrary: true }]);
  });

  it("removes a PDF from the affiliate library as soon as the box is cleared", () => {
    render(<AffiliateLiteratureAdmin />);
    fireEvent.click(screen.getByLabelText("Affiliate library for Affiliate sales brochure"));
    expect(state.updateInputs).toEqual([{ id: 8, inAffiliateLibrary: false }]);
  });

  it("never sends a publish or public flag - only the affiliate switch", () => {
    render(<AffiliateLiteratureAdmin />);
    fireEvent.click(screen.getByLabelText("Affiliate library for Website Improvement Proposal — Lessons from Marazzi USA"));
    const keys = Object.keys(state.updateInputs[0] ?? {});
    expect(keys).not.toContain("isPublished");
    expect(keys).not.toContain("visibility");
    expect(keys).not.toContain("isPublic");
  });

  it("shows who toggled a document and when", () => {
    render(<AffiliateLiteratureAdmin />);
    expect(screen.getByTestId("library-toggle-note-8").textContent)
      .toBe("Added to the affiliate library by Tom on 2026-11-05");
    expect(screen.queryByTestId("library-toggle-note-7")).toBeNull();
  });

  it("defaults a new upload to internal and sends the checkbox value", async () => {
    render(<AffiliateLiteratureAdmin />);
    const file = new File(["%PDF-1.4"], "proposal.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New internal note" } });
    fireEvent.change(screen.getByLabelText("Document"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /add to library/i }));
    await waitFor(() => expect(state.uploadInputs).toHaveLength(1));
    expect(state.uploadInputs[0]).toMatchObject({ title: "New internal note", inAffiliateLibrary: false });
    expect(Object.keys(state.uploadInputs[0])).not.toContain("isPublished");
  });

  it("reads an old row with no visibility column as internal, even if isPublished is set", () => {
    state.rows = [{
      id: 42,
      title: "Legacy document",
      category: "General",
      filename: "legacy.pdf",
      url: "/manus-storage/legacy.pdf",
      mimeType: "application/pdf",
      sizeBytes: 100,
      isPublished: true,
      sortOrder: 0,
    }];
    render(<AffiliateLiteratureAdmin />);
    // Fails closed until SQL 0255 backfills the column.
    expect(screen.getByLabelText("Affiliate library for Legacy document").getAttribute("aria-checked")).toBe("false");
    expect(screen.getByTestId("library-visibility-42").textContent).toContain("Internal");
  });

  it("opens a document through adminSignedFile, never through the private url", async () => {
    const opened: string[] = [];
    const openSpy = vi.spyOn(window, "open").mockImplementation((url) => {
      opened.push(String(url));
      return null;
    });
    render(<AffiliateLiteratureAdmin />);
    fireEvent.click(screen.getByRole("button", { name: "Open Website Improvement Proposal — Lessons from Marazzi USA" }));
    await waitFor(() => expect(state.signedFileInputs).toEqual([{ id: 7 }]));
    expect(opened).toEqual(["https://storage.example/signed/guide.md"]);
    // The row url is a private-bucket path and the storage proxy refuses it.
    expect(opened.some((url) => url.includes("/manus-storage/library-documents/"))).toBe(false);
    openSpy.mockRestore();
  });
});
