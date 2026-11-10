import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DOCUMENT_DOWNLOAD_ENABLED,
  documentDownloadName,
  formatUploadedLabel,
  inlineDocumentKind,
  type InlineDocumentKind,
} from "@shared/pptxDocument";
import { downloadDocumentBytes, fetchDocumentBytes, renderInlineDocument } from "./pptxPreview";

export type PptxDeckSource = {
  title: string;
  filename?: string | null;
  mimeType?: string | null;
  sourceUrl: string;
  uploadedAt?: Date | string | number | null;
};

function slideWidth(host: HTMLElement | null) {
  const measured = host?.clientWidth ?? 0;
  if (measured > 280) return Math.min(960, measured);
  if (typeof window === "undefined") return 960;
  return Math.min(960, Math.max(320, window.innerWidth - 64));
}

export function PptxDeckFrame({
  title,
  filename,
  mimeType,
  sourceUrl,
  uploadedAt,
}: PptxDeckSource) {
  const hostRef = useRef<HTMLDivElement>(null);
  const bytesRef = useRef<ArrayBuffer | null>(null);
  const kindRef = useRef<InlineDocumentKind | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [slideCount, setSlideCount] = useState(0);
  const uploadedLabel = formatUploadedLabel(uploadedAt);
  const kind = inlineDocumentKind({ filename, mimeType, url: sourceUrl });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let handle: { destroy: () => void } | null = null;
    setStatus("loading");
    setError(null);
    setSlideCount(0);
    bytesRef.current = null;

    (async () => {
      try {
        const fileKind = inlineDocumentKind({ filename, mimeType, url: sourceUrl });
        if (!fileKind) throw new Error("This file cannot be shown in the page.");
        kindRef.current = fileKind;
        const bytes = await fetchDocumentBytes(sourceUrl);
        if (cancelled) return;
        bytesRef.current = bytes;
        handle = await renderInlineDocument(host, bytes, fileKind, { width: slideWidth(host) });
        if (cancelled) {
          handle.destroy();
          return;
        }
        setSlideCount(handle.slideCount || 0);
        setStatus("ready");
      } catch (cause) {
        if (cancelled) return;
        setStatus("error");
        setError(cause instanceof Error ? cause.message : "Could not open this file.");
      }
    })();

    return () => {
      cancelled = true;
      handle?.destroy();
      host.replaceChildren();
    };
  }, [filename, mimeType, sourceUrl]);

  function download() {
    if (!DOCUMENT_DOWNLOAD_ENABLED) return;
    const bytes = bytesRef.current;
    const fileKind = kindRef.current;
    if (!bytes || !fileKind) return;
    downloadDocumentBytes(bytes, documentDownloadName(filename ?? title, fileKind), fileKind);
  }

  return (
    <section className="flex min-h-0 flex-col gap-3" data-testid="pptx-deck-viewer">
      <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-tight">{title}</h2>
          {uploadedLabel ? (
            <p className="mt-1 text-sm text-muted-foreground" data-testid="pptx-uploaded">{uploadedLabel}</p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">
            Opened in this page. The file is not sent to Microsoft or another app.
            {slideCount > 0 ? ` ${slideCount} ${slideCount === 1 ? "page" : "pages"}.` : ""}
          </p>
        </div>
        {DOCUMENT_DOWNLOAD_ENABLED ? (
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={download} aria-label={`Download ${title}`}>
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
        ) : null}
      </div>
      {status === "loading" ? <p className="text-sm text-muted-foreground">Opening…</p> : null}
      {status === "error" ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div
        ref={hostRef}
        data-testid="pptx-slide-host"
        className="relative mx-auto min-h-[320px] w-full overflow-auto rounded-md border border-border bg-white"
      />
      <p className="text-xs text-muted-foreground">
        {kind === "pptx"
          ? "Text, pictures, and basic shapes are shown here. Animations and some SmartArt can look simpler than they do in PowerPoint."
          : "The pages are drawn in this page."}
      </p>
    </section>
  );
}

export function PptxDeckViewer({
  open,
  onClose,
  deck,
}: {
  open: boolean;
  onClose: () => void;
  deck: PptxDeckSource | null;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="flex max-h-[92vh] flex-col overflow-y-auto sm:max-w-5xl" data-testid="pptx-deck-dialog">
        <DialogHeader className="sr-only">
          <DialogTitle>{deck?.title ?? "PowerPoint"}</DialogTitle>
          <DialogDescription>
            {deck ? formatUploadedLabel(deck.uploadedAt) ?? "PowerPoint preview" : "PowerPoint preview"}
          </DialogDescription>
        </DialogHeader>
        {deck ? <PptxDeckFrame key={deck.sourceUrl} {...deck} /> : null}
      </DialogContent>
    </Dialog>
  );
}
