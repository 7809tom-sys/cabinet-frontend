import { useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Loader2, Mail, TriangleAlert } from "lucide-react";
import {
  fabricationEmailOutcome,
  usableFabricatorEmail,
  useEmailFabricationSheet,
} from "@/lib/fabricationSheetEmail";
import {
  fabricationSheetEmailBody,
  fabricationSheetPdfBase64,
} from "@/lib/countertopFabricationSheetPdf";
import {
  fabricationSheetFileName,
  type CountertopFabricationSheet,
} from "@/lib/countertopFabricationSheet";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sheet: CountertopFabricationSheet | null;
  brandName?: string | null;
};

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; sentTo: string }
  | { kind: "failed"; message: string; blocked: boolean }
  | { kind: "endpoint-missing" };

/**
 * Email the generated fabrication sheet to a fabricator.
 *
 * The PDF is built in the browser from the same numbers the download uses and
 * sent as a base64 attachment, so the fabricator receives a file they can save
 * directly rather than a link that expires. Nothing reports success unless the
 * backend confirms the send.
 */
export function FabricationSheetEmailDialog({ open, onOpenChange, sheet, brandName }: Props) {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const send = useEmailFabricationSheet();

  const recipient = usableFabricatorEmail(email);
  const draft = useMemo(() => sheet ? fabricationSheetEmailBody(sheet, { brandName, note }) : null, [sheet, brandName, note]);

  const reset = () => setStatus({ kind: "idle" });

  async function handleSend() {
    if (!sheet || !recipient || !draft) return;
    setStatus({ kind: "sending" });
    try {
      const pdfBase64 = await fabricationSheetPdfBase64(sheet, brandName);
      const result = await send.mutateAsync({
        designId: sheet.job.designId,
        to: recipient,
        subject: draft.subject,
        body: draft.text,
        fileName: fabricationSheetFileName(sheet, brandName),
        pdfBase64,
      });
      const outcome = fabricationEmailOutcome(result, null);
      if (outcome.kind === "sent") setStatus({ kind: "sent", sentTo: outcome.sentTo });
      else if (outcome.kind === "endpoint-missing") setStatus({ kind: "endpoint-missing" });
      else setStatus({ kind: "failed", message: outcome.error, blocked: outcome.blocked });
    } catch (error) {
      const outcome = fabricationEmailOutcome(null, error);
      if (outcome.kind === "sent") setStatus({ kind: "sent", sentTo: outcome.sentTo });
      else if (outcome.kind === "endpoint-missing") setStatus({ kind: "endpoint-missing" });
      else if (outcome.kind === "failed") setStatus({ kind: "failed", message: outcome.error, blocked: outcome.blocked });
    }
  }

  function handleClose(next: boolean) {
    onOpenChange(next);
    if (!next) setTimeout(reset, 200);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg" data-testid="fabrication-email-dialog">
        {status.kind === "sent" ? (
          <div className="space-y-3 py-4 text-center">
            <CheckCircle2 className="mx-auto h-11 w-11 text-green-600" />
            <DialogTitle>Fabrication sheet sent</DialogTitle>
            <DialogDescription>
              The PDF was emailed to {status.sentTo} as an attachment. Ask the fabricator to confirm they received it.
            </DialogDescription>
            <Button className="mt-1" onClick={() => handleClose(false)}>Done</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-[#a87f33]" /> Email to fabricator
              </DialogTitle>
              <DialogDescription>
                {sheet
                  ? `Sends the ${sheet.totals.runCount}-run countertop sheet as a PDF attachment, with the run list written into the message body.`
                  : "Build the countertop first — there is nothing to send yet."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 py-1">
              <div className="grid gap-1.5">
                <Label htmlFor="fabricator-email">Fabricator email</Label>
                <Input
                  id="fabricator-email"
                  data-testid="fabricator-email-input"
                  type="email"
                  autoComplete="off"
                  placeholder="shop@fabricator.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={status.kind === "sending"}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="fabricator-note">Note to the fabricator (optional)</Label>
                <Textarea
                  id="fabricator-note"
                  data-testid="fabricator-email-note"
                  rows={2}
                  placeholder="Templates due Friday. Call before cutting."
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  disabled={status.kind === "sending"}
                />
              </div>
              {draft && (
                <div className="rounded-md border border-border bg-muted/40 p-2.5 text-[11px]">
                  <div className="font-semibold text-foreground">{draft.subject}</div>
                  <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap break-words font-sans text-muted-foreground">
                    {draft.text}
                  </pre>
                </div>
              )}
              {status.kind === "failed" && (
                <div
                  className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive"
                  data-testid="fabrication-email-error"
                  role="alert"
                >
                  <strong className="flex items-center gap-1.5">
                    <TriangleAlert className="h-3.5 w-3.5" /> The sheet was not emailed
                  </strong>
                  <p className="mt-1">{status.message}</p>
                </div>
              )}
              {status.kind === "endpoint-missing" && (
                <div
                  className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900"
                  data-testid="fabrication-email-endpoint-missing"
                  role="alert"
                >
                  <strong className="flex items-center gap-1.5">
                    <TriangleAlert className="h-3.5 w-3.5" /> Email endpoint not deployed
                  </strong>
                  <p className="mt-1">
                    The backend does not expose <code>design.emailFabricationSheet</code> yet, so nothing was sent.
                    Download the PDF and email it from your own mailbox until that endpoint ships.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)} disabled={status.kind === "sending"}>
                Cancel
              </Button>
              <Button
                data-testid="fabrication-email-send"
                onClick={() => void handleSend()}
                disabled={!sheet || !recipient || status.kind === "sending"}
              >
                {status.kind === "sending" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Mail className="mr-1.5 h-4 w-4" />}
                Send sheet
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
