import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { getDocument, GlobalWorkerOptions, TextLayer } from "pdfjs-dist";
import {
  documentDownloadName,
  inlineDocumentKind,
  PDF_MIME_TYPE,
  type InlineDocumentKind,
} from "@shared/pptxDocument";

export type InlinePreviewHandle = {
  destroy: () => void;
  slideCount: number;
  updatePagination: () => void;
};

let pdfWorkerReady = false;

function ensurePdfWorker() {
  if (pdfWorkerReady) return;
  GlobalWorkerOptions.workerSrc = workerUrl;
  pdfWorkerReady = true;
}

/** Fetch file bytes for the in-page renderer. This does not navigate or download. */
export async function fetchDocumentBytes(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url, { credentials: "omit", mode: "cors" });
  if (!response.ok) {
    throw new Error(`Could not load the file (${response.status}).`);
  }
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength) throw new Error("This file was empty.");
  return bytes;
}

export async function renderInlineDocument(
  host: HTMLElement,
  bytes: ArrayBuffer,
  kind: InlineDocumentKind,
  options: { width: number },
): Promise<InlinePreviewHandle> {
  host.replaceChildren();
  if (kind === "pptx") return renderPptx(host, bytes, options.width);
  if (kind === "pdf") return renderPdf(host, bytes, options.width);
  return renderDocx(host, bytes);
}

async function renderPptx(host: HTMLElement, bytes: ArrayBuffer, width: number): Promise<InlinePreviewHandle> {
  const { init } = await import("pptx-preview");
  const previewer = init(host, {
    width,
    height: Math.round(width * 9 / 16),
    mode: "slide",
  });
  await previewer.preview(bytes);
  // The library paints the first slide while currentIndex is still -1, so the
  // counter would read "0/N" until the viewer moves.
  previewer.updatePagination();
  return previewer;
}

async function renderPdf(host: HTMLElement, bytes: ArrayBuffer, width: number): Promise<InlinePreviewHandle> {
  ensurePdfWorker();
  const pdf = await getDocument({ data: bytes.slice(0) }).promise;
  const pages: HTMLCanvasElement[] = [];
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const page = await pdf.getPage(number);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(1.6, Math.max(0.5, width / base.width));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.className = "block max-w-full bg-white";
    canvas.setAttribute("aria-label", `Page ${number}`);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not draw this PDF.");
    await page.render({ canvasContext: context, viewport }).promise;
    const textHost = document.createElement("div");
    textHost.className = "sr-only";
    const textLayer = new TextLayer({
      textContentSource: await page.getTextContent(),
      container: textHost,
      viewport,
    });
    await textLayer.render();
    const sheet = document.createElement("div");
    sheet.className = "mx-auto mb-4 max-w-full bg-white shadow-sm";
    sheet.append(canvas, textHost);
    host.appendChild(sheet);
    pages.push(canvas);
  }
  return {
    slideCount: pdf.numPages,
    updatePagination() {},
    destroy() {
      pages.forEach((canvas) => canvas.remove());
      void pdf.destroy();
    },
  };
}

async function renderDocx(host: HTMLElement, bytes: ArrayBuffer): Promise<InlinePreviewHandle> {
  const { renderAsync } = await import("docx-preview");
  await renderAsync(new Blob([bytes]), host, undefined, {
    inWrapper: true,
    className: "docx-notes",
    ignoreFonts: false,
  });
  const text = host.textContent ?? "";
  return {
    slideCount: text.trim() ? 1 : 0,
    updatePagination() {},
    destroy() {
      host.replaceChildren();
    },
  };
}

/** Used only when DOCUMENT_DOWNLOAD_ENABLED is turned back on. Saves a blob; never opens the file URL. */
export function downloadDocumentBytes(bytes: ArrayBuffer, filename: string, kind: InlineDocumentKind) {
  const mime = kind === "pdf"
    ? PDF_MIME_TYPE
    : kind === "docx"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = documentDownloadName(filename, kind);
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function saveDocumentFromUrl(url: string, filename: string | null | undefined) {
  const kind = inlineDocumentKind({ filename, url });
  if (!kind) return;
  const bytes = await fetchDocumentBytes(url);
  downloadDocumentBytes(bytes, filename ?? "document", kind);
}
