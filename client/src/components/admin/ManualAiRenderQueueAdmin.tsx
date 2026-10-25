import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CheckCircle2, ClipboardCopy, ClipboardList, ExternalLink, ImagePlus, Loader2, Upload } from "lucide-react";

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The selected image could not be read."));
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("The selected image could not be read."));
    reader.readAsDataURL(file);
  });
}

export function ManualAiRenderQueueAdmin() {
  const utils = trpc.useUtils();
  const { data, isLoading, error, refetch } = trpc.designPhotoRenders.listManualAiHandoffs.useQuery();
  const upload = trpc.mediaLibrary.upload.useMutation();
  const attach = trpc.designPhotoRenders.attachManualAiResult.useMutation({
    onSuccess: async () => {
      await utils.designPhotoRenders.listManualAiHandoffs.invalidate();
      toast.success("The finished image is attached to the exact saved plan. The customer will receive the ready notice and email link.");
    },
    onError: (error) => toast.error(error.message),
  });
  const [uploadingRequestId, setUploadingRequestId] = useState<number | null>(null);

  const copyInstructions = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("AI instructions copied.");
    } catch {
      toast.error("Clipboard access is unavailable. Select and copy the instructions from this card.");
    }
  };

  const uploadFinishedImage = async (requestId: number, designId: number, file: File | undefined) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Upload a JPEG, PNG, or WebP finished kitchen image.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast.error("Keep the finished image at or below 12 MB.");
      return;
    }
    setUploadingRequestId(requestId);
    try {
      const dataBase64 = await readFileAsDataUrl(file);
      const stored = await upload.mutateAsync({
        label: `Manual AI result — saved plan ${designId}`,
        folder: "Manual AI Results",
        dataBase64,
        contentType: file.type,
      });
      await attach.mutateAsync({ requestId, imageUrl: stored.url });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The finished image could not be attached.");
    } finally {
      setUploadingRequestId(null);
    }
  };

  if (isLoading) return <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading manual AI render requests…</div>;
  if (error) return <div className="space-y-3 py-10 text-sm"><p className="text-destructive">Could not load manual AI render requests: {error.message}</p><Button size="sm" variant="outline" onClick={() => refetch()}>Retry</Button></div>;

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <strong>Manual render workflow:</strong> open or download the single locked reference board, upload it to your preferred image generator, use the copied instruction, then upload the finished kitchen image here. CabinetDealz checks that the saved plan has not changed before the customer result is attached.
      </div>
      {!data?.emailDeliveryConfigured && <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950"><strong>CRM package is active; internal email needs a recipient.</strong> Add the team mailbox under <a className="font-semibold underline" href="/admin?tab=notifications">Settings → Notifications → New Design Lead</a>. Until then, each prepared reference board is still recorded in the CRM workflow and visible here.</div>}
      {!data?.handoffs.length ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground"><CheckCircle2 className="h-6 w-6 text-emerald-600" /> No verified manual AI render requests are waiting.</CardContent></Card>
      ) : data.handoffs.map((handoff) => {
        const busy = uploadingRequestId === handoff.id || upload.isPending || attach.isPending;
        const planUrl = `/design?load=${handoff.kitchenDesignId}&preview=3d`;
        return (
          <Card key={handoff.id} className="overflow-hidden">
            <CardHeader className="border-b bg-muted/30">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Saved plan #{handoff.kitchenDesignId}</CardTitle>
                  <CardDescription>Verified customer request from {handoff.name}. Prepared {handoff.manualHandoffPreparedAt ? new Date(handoff.manualHandoffPreparedAt).toLocaleString() : "—"}.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{handoff.manualHandoffEmailSentAt ? "Package emailed" : "CRM package recorded"}</Badge>
                  <Badge className="bg-amber-600 text-white hover:bg-amber-600">Manual review</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div className="flex flex-wrap gap-2">
                {handoff.crmDealId && <Button asChild size="sm" variant="outline"><a href={`/admin?tab=crm&deal=${handoff.crmDealId}`}><ClipboardList className="mr-1.5 h-4 w-4" /> Open CRM review</a></Button>}
                <Button asChild size="sm" variant="outline"><a href={planUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-4 w-4" /> Open saved plan</a></Button>
                <Button asChild size="sm" variant="outline"><a href={handoff.manualHandoffBoardUrl!} target="_blank" rel="noreferrer"><ImagePlus className="mr-1.5 h-4 w-4" /> Open single reference board</a></Button>
                <Button size="sm" variant="outline" onClick={() => copyInstructions(handoff.manualHandoffPrompt!)}><ClipboardCopy className="mr-1.5 h-4 w-4" /> Copy AI instruction</Button>
              </div>
              <pre className="max-h-44 overflow-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed whitespace-pre-wrap">{handoff.manualHandoffPrompt}</pre>
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed p-3">
                <div className="min-w-0 flex-1"><div className="font-medium text-sm">Attach the finished AI image</div><div className="text-xs text-muted-foreground">JPEG, PNG, or WebP up to 12 MB. The completed image is saved to this exact plan and the customer is notified.</div></div>
                <input id={`manual-ai-finished-${handoff.id}`} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(event) => void uploadFinishedImage(handoff.id, handoff.kitchenDesignId, event.target.files?.[0])} />
                <Button size="sm" disabled={busy} onClick={() => document.getElementById(`manual-ai-finished-${handoff.id}`)?.click()}>{busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}{busy ? "Attaching…" : "Upload finished image"}</Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
