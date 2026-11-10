// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const preview = vi.hoisted(() => ({
  rendered: 0,
}));

vi.mock("./pptxPreview", () => ({
  fetchDocumentBytes: vi.fn(async () => new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer),
  renderInlineDocument: vi.fn(async (host: HTMLElement) => {
    preview.rendered += 1;
    host.textContent = "Private decks stay in this browser.";
    return { destroy() { host.replaceChildren(); }, slideCount: 2, updatePagination() {} };
  }),
  downloadDocumentBytes: vi.fn(),
  saveDocumentFromUrl: vi.fn(),
}));

import { PptxDeckFrame } from "./PptxDeckViewer";
import { DOCUMENT_DOWNLOAD_ENABLED } from "@shared/pptxDocument";

afterEach(() => {
  cleanup();
  preview.rendered = 0;
});

describe("PptxDeckFrame", () => {
  it("shows the Central upload date and renders the deck in the page", async () => {
    render(
      <PptxDeckFrame
        title="Cabinetdealz investor update"
        filename="cabinetdealz-pitch-sample.pptx"
        sourceUrl="/samples/cabinetdealz-pitch-sample.pptx"
        uploadedAt="2026-11-10T18:00:00.000Z"
      />,
    );
    expect(screen.getByRole("heading", { name: "Cabinetdealz investor update" })).toBeTruthy();
    expect(screen.getByTestId("pptx-uploaded").textContent).toBe("Uploaded Nov 10, 2026");
    await waitFor(() => expect(screen.getByTestId("pptx-slide-host").textContent).toContain("Private decks stay in this browser."));
    expect(preview.rendered).toBe(1);
    expect(screen.queryByRole("button", { name: /Download/ })).toBeNull();
  });

  it("renders in the page with no download control", async () => {
    render(
      <PptxDeckFrame
        title="Investor deck"
        filename="investor-deck.pptx"
        sourceUrl="/deck.pptx"
        uploadedAt="2026-11-10T18:00:00.000Z"
      />,
    );
    await waitFor(() => expect(preview.rendered).toBe(1));
    expect(DOCUMENT_DOWNLOAD_ENABLED).toBe(false);
    expect(screen.queryByRole("button", { name: /Download/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Download/ })).toBeNull();
  });
});
