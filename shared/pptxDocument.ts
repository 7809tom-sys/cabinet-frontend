/**
 * Office files the literature library and file links can hold.
 * `.pptx`, `.docx`, and `.pdf` render inside the page. Legacy `.ppt` does not.
 */

export const PPTX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

export const PDF_MIME_TYPE = "application/pdf";

export const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type InlineDocumentKind = "pptx" | "pdf" | "docx";

/**
 * The owner asked the view path to open a deck in the page with no download
 * control. Set this to true to show Download again. The save helper stays in
 * the client either way and never navigates to the file URL.
 */
export const DOCUMENT_DOWNLOAD_ENABLED = false;

const UPLOADED_AT_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function filePath(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    return new URL(trimmed, "https://cabinetdealz.local").pathname.toLowerCase();
  } catch {
    return (trimmed.split("?")[0]?.split("#")[0] ?? trimmed).toLowerCase();
  }
}

function pathEndsWith(value: string | null | undefined, extension: string): boolean {
  return filePath(value).endsWith(extension);
}

export function isPowerPointFile(input: {
  filename?: string | null;
  mimeType?: string | null;
  url?: string | null;
}): boolean {
  const mime = (input.mimeType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (mime === PPTX_MIME_TYPE) return true;
  return pathEndsWith(input.filename, ".pptx") || pathEndsWith(input.url, ".pptx");
}

/** A deck or pitch note we can paint in the page. Null for everything else. */
export function inlineDocumentKind(input: {
  filename?: string | null;
  mimeType?: string | null;
  url?: string | null;
}): InlineDocumentKind | null {
  const mime = (input.mimeType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (mime === PPTX_MIME_TYPE || pathEndsWith(input.filename, ".pptx") || pathEndsWith(input.url, ".pptx")) return "pptx";
  if (mime === DOCX_MIME_TYPE || pathEndsWith(input.filename, ".docx") || pathEndsWith(input.url, ".docx")) return "docx";
  if (mime === PDF_MIME_TYPE || pathEndsWith(input.filename, ".pdf") || pathEndsWith(input.url, ".pdf")) return "pdf";
  return null;
}

export function isInlineDocument(input: {
  filename?: string | null;
  mimeType?: string | null;
  url?: string | null;
}): boolean {
  return inlineDocumentKind(input) != null;
}

/**
 * "Uploaded Nov 10, 2026" in US Central time.
 * Returns null when the record has no usable timestamp, so the UI never
 * invents a date.
 */
export function formatUploadedLabel(value: Date | string | number | null | undefined): string | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `Uploaded ${UPLOADED_AT_FORMAT.format(date)}`;
}

export function documentDownloadName(filename: string | null | undefined, kind: InlineDocumentKind): string {
  const trimmed = (filename ?? "").trim();
  const base = trimmed.split(/[/\\]/).pop() || "";
  const extension = kind === "pdf" ? ".pdf" : kind === "docx" ? ".docx" : ".pptx";
  if (base.toLowerCase().endsWith(extension)) return base;
  const fallback = kind === "pptx" ? "deck" : "document";
  return `${base || fallback}${extension}`;
}

export function pptxDownloadName(filename: string | null | undefined): string {
  return documentDownloadName(filename, "pptx");
}
