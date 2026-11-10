import { describe, expect, it } from "vitest";
import {
  DOCUMENT_DOWNLOAD_ENABLED,
  formatUploadedLabel,
  inlineDocumentKind,
  isPowerPointFile,
  pptxDownloadName,
  PPTX_MIME_TYPE,
} from "./pptxDocument";

describe("isPowerPointFile", () => {
  it("recognizes the Office Open XML mime type and a .pptx name", () => {
    expect(isPowerPointFile({ mimeType: PPTX_MIME_TYPE, filename: "notes.txt" })).toBe(true);
    expect(isPowerPointFile({ filename: "Investor Deck.PPTX" })).toBe(true);
    expect(isPowerPointFile({
      url: "https://files.example/library-documents/pitch.pptx?token=1",
    })).toBe(true);
  });

  it("leaves PDFs, spreadsheets, and legacy .ppt as non-decks", () => {
    expect(isPowerPointFile({ filename: "brochure.pdf", mimeType: "application/pdf" })).toBe(false);
    expect(isPowerPointFile({ filename: "prices.xlsx" })).toBe(false);
    expect(isPowerPointFile({ filename: "old-deck.ppt", mimeType: "application/vnd.ms-powerpoint" })).toBe(false);
    expect(isPowerPointFile({ filename: "notpptx.txt", url: "https://example.com/file" })).toBe(false);
  });
});

describe("formatUploadedLabel", () => {
  it("formats a stored timestamp in US Central time", () => {
    // 18:00 UTC is noon Central on a November date, after daylight saving ends.
    expect(formatUploadedLabel("2026-11-10T18:00:00.000Z")).toBe("Uploaded Nov 10, 2026");
    expect(formatUploadedLabel(new Date("2026-11-10T18:00:00.000Z"))).toBe("Uploaded Nov 10, 2026");
  });

  it("uses the Central calendar day when UTC has already rolled over", () => {
    // 05:30 UTC is still the evening of Nov 9 in Chicago (UTC-6).
    expect(formatUploadedLabel("2026-11-10T05:30:00.000Z")).toBe("Uploaded Nov 9, 2026");
    expect(formatUploadedLabel("2026-11-10T06:30:00.000Z")).toBe("Uploaded Nov 10, 2026");
  });

  it("returns null when the location did not provide a timestamp", () => {
    expect(formatUploadedLabel(null)).toBeNull();
    expect(formatUploadedLabel(undefined)).toBeNull();
    expect(formatUploadedLabel("")).toBeNull();
    expect(formatUploadedLabel("not-a-date")).toBeNull();
  });
});

describe("inlineDocumentKind", () => {
  it("treats PowerPoint, Word, and PDF notes as in-page documents", () => {
    expect(inlineDocumentKind({ filename: "deck.pptx" })).toBe("pptx");
    expect(inlineDocumentKind({ filename: "Pitch notes.DOCX" })).toBe("docx");
    expect(inlineDocumentKind({ mimeType: "application/pdf", filename: "notes.bin" })).toBe("pdf");
    expect(inlineDocumentKind({ filename: "prices.xlsx" })).toBeNull();
    expect(inlineDocumentKind({ filename: "old.ppt" })).toBeNull();
  });

  it("keeps the download control off until the owner turns the flag back on", () => {
    expect(DOCUMENT_DOWNLOAD_ENABLED).toBe(false);
  });
});

describe("pptxDownloadName", () => {
  it("keeps a pptx filename and adds the extension when the title has none", () => {
    expect(pptxDownloadName("library-documents/Investor_Deck.pptx")).toBe("Investor_Deck.pptx");
    expect(pptxDownloadName("Investor deck")).toBe("Investor deck.pptx");
    expect(pptxDownloadName("")).toBe("deck.pptx");
  });
});
