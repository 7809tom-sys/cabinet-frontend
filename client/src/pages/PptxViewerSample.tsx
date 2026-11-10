import { useState } from "react";
import pptxUrl from "@/assets/cabinetdealz-pitch-sample.pptx?url";
import pdfUrl from "@/assets/pitch-notes-sample.pdf?url";
import docxUrl from "@/assets/pitch-notes-sample.docx?url";
import { PptxDeckFrame, type PptxDeckSource } from "@/components/documents/PptxDeckViewer";
import { formatUploadedLabel } from "@shared/pptxDocument";

/** Dev-only list so a click can be shown to render inside the page. */
const SAMPLE_UPLOADED_AT = "2026-11-10T18:00:00.000Z";

const SAMPLES: PptxDeckSource[] = [
  {
    title: "Cabinetdealz investor update",
    filename: "cabinetdealz-pitch-sample.pptx",
    sourceUrl: pptxUrl,
    uploadedAt: SAMPLE_UPLOADED_AT,
  },
  {
    title: "Pitch notes",
    filename: "pitch-notes-sample.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sourceUrl: docxUrl,
    uploadedAt: SAMPLE_UPLOADED_AT,
  },
  {
    title: "Pitch notes PDF",
    filename: "pitch-notes-sample.pdf",
    mimeType: "application/pdf",
    sourceUrl: pdfUrl,
    uploadedAt: SAMPLE_UPLOADED_AT,
  },
];

export default function PptxViewerSample() {
  const [open, setOpen] = useState<PptxDeckSource | null>(null);
  return (
    <main className="min-h-screen bg-stone-100 p-4 md:p-8">
      <h1 className="text-xl font-semibold">Library</h1>
      <ul className="mt-4 max-w-xl divide-y rounded-md border bg-white">
        {SAMPLES.map((file) => (
          <li key={file.filename} className="flex items-baseline justify-between gap-3 px-4 py-3">
            <button
              type="button"
              className="text-left font-medium text-primary hover:underline"
              onClick={() => setOpen(file)}
            >
              {file.title}
            </button>
            <span className="text-sm text-muted-foreground">{formatUploadedLabel(file.uploadedAt)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6">
        {open ? <PptxDeckFrame key={open.sourceUrl} {...open} /> : <p className="text-sm text-muted-foreground">Choose a deck to read it here.</p>}
      </div>
    </main>
  );
}
