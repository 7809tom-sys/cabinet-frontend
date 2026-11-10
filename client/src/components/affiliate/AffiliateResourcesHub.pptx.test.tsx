// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PPTX_MIME_TYPE } from "@shared/pptxDocument";

vi.mock("@/components/documents/pptxPreview", () => ({
  fetchDocumentBytes: vi.fn(async () => new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer),
  renderInlineDocument: vi.fn(async (host: HTMLElement) => {
    host.textContent = "Private decks stay in this browser.";
    return { destroy() {}, slideCount: 1, updatePagination() {} };
  }),
  downloadDocumentBytes: vi.fn(),
  saveDocumentFromUrl: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("streamdown", () => ({ Streamdown: ({ children }: { children?: string }) => children ?? null }));

import { AffiliateResourceBrowser, type LiteratureSignedFile } from "./AffiliateResourcesHub";

afterEach(() => cleanup());

const deck = {
  id: 4,
  title: "Investor deck",
  description: "Q4 pitch",
  category: "Sales",
  url: "/manus-storage/library-documents/investor-deck",
  filename: null,
  mimeType: PPTX_MIME_TYPE,
  createdAt: "2026-11-10T18:00:00.000Z",
};

describe("printed materials PowerPoint", () => {
  it("shows the upload date and opens the deck instead of the private storage path", async () => {
    const requested: number[] = [];
    const file: LiteratureSignedFile = {
      url: "https://signed.example/object",
      filename: null,
      mimeType: PPTX_MIME_TYPE,
      createdAt: "2026-11-10T18:00:00.000Z",
    };
    render(
      <AffiliateResourceBrowser
        section="printed"
        items={[]}
        literature={[deck]}
        progress={[]}
        query=""
        storeName="North Store"
        logoUrl={null}
        storefrontUrl="https://cabinetdealz.com/store/north"
        onToggleComplete={() => undefined}
        onVideoProgress={() => undefined}
        onRequestFile={async () => file}
        onRequestLiterature={async (id) => {
          requested.push(id);
          return file;
        }}
      />,
    );

    expect(screen.getByTestId("literature-uploaded-4").textContent).toBe("Uploaded Nov 10, 2026");
    expect(screen.queryByText("Open published literature")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "View Investor deck" }));
    await waitFor(() => expect(screen.getByTestId("pptx-deck-viewer")).toBeTruthy());
    expect(requested).toEqual([4]);
    expect(screen.getByTestId("pptx-slide-host").textContent).toContain("Private decks stay in this browser.");
    expect(screen.getByTestId("pptx-uploaded").textContent).toBe("Uploaded Nov 10, 2026");
    expect(screen.queryByRole("button", { name: /Download/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Download/ })).toBeNull();
  });
});
