import { useState } from "react";
import { crmDueState } from "@shared/crmMailbox";
import { DOCUMENT_DOWNLOAD_ENABLED, formatUploadedLabel, inlineDocumentKind } from "@shared/pptxDocument";
import { saveDocumentFromUrl } from "@/components/documents/pptxPreview";
import { PptxDeckViewer, type PptxDeckSource } from "@/components/documents/PptxDeckViewer";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function CrmDueBanner({ nextFollowUpAt }: { nextFollowUpAt: string | Date | null | undefined }) {
  const due = crmDueState(nextFollowUpAt);
  if (due === "none") return null;
  return (
    <div className={`rounded-md px-3 py-2 text-xs font-semibold ${due === "overdue" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
      {due === "overdue" ? "Overdue" : "Due today"}
      {nextFollowUpAt ? ` · ${new Date(nextFollowUpAt).toLocaleDateString()}` : ""}
    </div>
  );
}

export function CrmDealFiles({ dealId }: { dealId: number }) {
  const utils = trpc.useUtils();
  const files = trpc.crm.dealFiles.list.useQuery({ dealId });
  const add = trpc.crm.dealFiles.add.useMutation({
    onSuccess: () => { setName(""); setUrl(""); utils.crm.dealFiles.list.invalidate({ dealId }); utils.crm.deal.invalidate({ id: dealId }); },
    onError: (error) => toast.error(error.message),
  });
  const remove = trpc.crm.dealFiles.remove.useMutation({
    onSuccess: () => utils.crm.dealFiles.list.invalidate({ dealId }),
  });
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [deck, setDeck] = useState<PptxDeckSource | null>(null);
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-muted-foreground">Files</p>
      <div className="mb-2 flex gap-2">
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="File name" aria-label="File name" />
        <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" aria-label="File URL" />
        <Button type="button" variant="outline" disabled={!name.trim() || !url.trim() || add.isPending} onClick={() => add.mutate({ dealId, fileName: name.trim(), fileUrl: url.trim() })}>Add</Button>
      </div>
      <ul className="space-y-1">
        {(files.data ?? []).map((file) => {
          const uploadedAt = (file as { createdAt?: string | Date | null }).createdAt ?? null;
          const inline = inlineDocumentKind({ filename: file.fileName, url: file.fileUrl });
          const uploadedLabel = inline ? formatUploadedLabel(uploadedAt) : null;
          return (
          <li key={file.id} className="flex items-center justify-between gap-2 text-xs">
            {inline ? (
              <button
                type="button"
                className="truncate text-left text-primary hover:underline"
                onClick={() => setDeck({
                  title: file.fileName,
                  filename: file.fileName,
                  sourceUrl: file.fileUrl,
                  uploadedAt,
                })}
              >
                {file.fileName}
                {uploadedLabel ? <span className="ml-2 text-muted-foreground" data-testid={`deal-file-uploaded-${file.id}`}>{uploadedLabel}</span> : null}
              </button>
            ) : (
              <a className="truncate text-primary hover:underline" href={file.fileUrl} target="_blank" rel="noreferrer">{file.fileName}</a>
            )}
            <span className="flex shrink-0 items-center gap-2">
              {DOCUMENT_DOWNLOAD_ENABLED && inline ? (
                <button type="button" className="text-primary hover:underline" onClick={() => { void saveDocumentFromUrl(file.fileUrl, file.fileName); }}>Download</button>
              ) : null}
              <button className="text-red-600" onClick={() => remove.mutate({ id: file.id })} aria-label={`Remove ${file.fileName}`}>Remove</button>
            </span>
          </li>
          );
        })}
        {(files.data ?? []).length === 0 && <li className="text-xs text-muted-foreground">No files yet.</li>}
      </ul>
      <PptxDeckViewer open={deck != null} deck={deck} onClose={() => setDeck(null)} />
    </div>
  );
}
