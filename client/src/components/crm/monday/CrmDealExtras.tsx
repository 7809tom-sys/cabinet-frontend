import { useState } from "react";
import { crmDueState } from "@shared/crmMailbox";
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
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-muted-foreground">Files</p>
      <div className="mb-2 flex gap-2">
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="File name" aria-label="File name" />
        <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" aria-label="File URL" />
        <Button type="button" variant="outline" disabled={!name.trim() || !url.trim() || add.isPending} onClick={() => add.mutate({ dealId, fileName: name.trim(), fileUrl: url.trim() })}>Add</Button>
      </div>
      <ul className="space-y-1">
        {(files.data ?? []).map((file) => (
          <li key={file.id} className="flex items-center justify-between gap-2 text-xs">
            <a className="truncate text-primary hover:underline" href={file.fileUrl} target="_blank" rel="noreferrer">{file.fileName}</a>
            <button className="text-red-600" onClick={() => remove.mutate({ id: file.id })} aria-label={`Remove ${file.fileName}`}>Remove</button>
          </li>
        ))}
        {(files.data ?? []).length === 0 && <li className="text-xs text-muted-foreground">No files yet.</li>}
      </ul>
    </div>
  );
}
