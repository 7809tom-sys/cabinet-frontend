import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, HandHeart, Link2, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HelperShareButton } from "@/components/design/designerHelperCards";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  helperMailerNotice,
  helperRequestSentCopy,
  type HelperNotifyPlan,
} from "@shared/designerHelperQueue";
import { useDesignerHelperProcedures } from "@/lib/designerHelperProcedures";

type Props = {
  designId: number | null;
  designName: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  affiliateSlug: string | null;
  /** Opens the Designer's existing Save dialog when there is no saved design yet. */
  onNeedSavedDesign?: () => void;
  compact?: boolean;
};

type Sent = {
  sharePath: string;
  designPath: string;
  notification: HelperNotifyPlan;
  mailerConfigured: boolean;
  customerSharePath: string | null;
};

/**
 * "Share / Get a designer helper" in the customer's Designer.
 *
 * Pressing it shares the current saved design and creates one help request.
 * Every designer whose Helper sign is on is queued and sees the request in the
 * app; the request is also mailed to each queued designer's address on file
 * when the server mailer is configured.
 */
export function DesignerHelperShare({
  designId,
  designName,
  customerName,
  customerEmail,
  customerPhone,
  affiliateSlug,
  onNeedSavedDesign,
  compact = false,
}: Props) {
  const helper = useDesignerHelperProcedures();
  const mailer = helper.designerHelper.mailerStatus.useQuery(undefined, { retry: false });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(customerName ?? "");
  const [email, setEmail] = useState(customerEmail ?? "");
  const [phone, setPhone] = useState(customerPhone ?? "");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState<Sent | null>(null);

  useEffect(() => {
    setName((value) => value || customerName || "");
  }, [customerName]);
  useEffect(() => {
    setEmail((value) => value || customerEmail || "");
  }, [customerEmail]);
  useEffect(() => {
    setPhone((value) => value || customerPhone || "");
  }, [customerPhone]);

  const mailerConfigured = mailer.data?.mailerConfigured ?? false;

  const ask = helper.designerHelper.request.useMutation({
    onSuccess: (result) => {
      setSent({
        sharePath: result.sharePath,
        designPath: result.designPath,
        notification: result.notification,
        mailerConfigured: result.mailerConfigured,
        customerSharePath: result.request.shareToken
          ? `/design/session/${result.request.shareToken}`
          : null,
      });
      toast.success("Design shared — a designer helper request is open", {
        description: helperRequestSentCopy(result.notification, result.mailerConfigured),
      });
    },
    onError: (error) => {
      toast.error("Could not ask for a designer helper", { description: error.message });
    },
  });

  const openDialog = () => {
    if (designId == null) {
      toast.info("Save this design first", {
        description: "A designer helper works on your saved plan, so save it once and then ask.",
      });
      onNeedSavedDesign?.();
      return;
    }
    setSent(null);
    setOpen(true);
  };

  const copyLink = async (path: string) => {
    const url = new URL(path, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Design link copied");
    } catch {
      window.prompt("Copy this design link", url);
    }
  };

  return (
    <>
      <HelperShareButton onClick={openDialog} compact={compact} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg" data-testid="designer-helper-share-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HandHeart className="h-5 w-5 text-[#a87f33]" aria-hidden="true" />
              Get a designer helper
            </DialogTitle>
            <DialogDescription>
              This shares your current design and asks an available CabinetDealz designer to look at it with you.
              Your plan is not changed.
            </DialogDescription>
          </DialogHeader>

          {sent ? (
            <div className="space-y-3" data-testid="designer-helper-share-result">
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
                {helperRequestSentCopy(sent.notification, sent.mailerConfigured)}
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">Your shared design link</Label>
                <div className="flex gap-2">
                  <Input readOnly value={new URL(sent.customerSharePath ?? sent.sharePath, window.location.origin).toString()} className="h-8 text-xs" />
                  <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => void copyLink(sent.customerSharePath ?? sent.sharePath)}>
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{helperMailerNotice(sent.mailerConfigured)}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-border p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">Design being shared</p>
                <p className="text-sm text-muted-foreground">{designName?.trim() || (designId != null ? `Design #${designId}` : "No saved design yet")}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="helper-note" className="text-xs">What do you need help with?</Label>
                <textarea
                  id="helper-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="For example: is the island spacing right, and did I pick the right filler beside the range?"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  data-testid="designer-helper-note"
                />
                <p className="text-[11px] text-muted-foreground">Optional, but it helps the designer start in the right place.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2 space-y-1">
                  <Label htmlFor="helper-name" className="text-[11px]">Your name</Label>
                  <Input id="helper-name" className="h-8 text-xs" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="helper-email" className="text-[11px]">Email</Label>
                  <Input id="helper-email" type="email" className="h-8 text-xs" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="helper-phone" className="text-[11px]">Phone</Label>
                  <Input id="helper-phone" type="tel" className="h-8 text-xs" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{helperMailerNotice(mailerConfigured)}</p>
            </div>
          )}

          <DialogFooter className="gap-2">
            {sent ? (
              <>
                <Button type="button" variant="outline" className="gap-1.5" onClick={() => void copyLink(sent.designPath)}>
                  <Link2 className="h-3.5 w-3.5" /> Copy designer link
                </Button>
                <Button type="button" onClick={() => setOpen(false)}>Done</Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button
                  type="button"
                  className="gap-1.5 bg-[#a87f33] hover:bg-[#946e2b]"
                  disabled={ask.isPending || designId == null}
                  data-testid="designer-helper-share-send"
                  onClick={() => {
                    if (designId == null) return;
                    ask.mutate({
                      designId,
                      helpNote: note.trim() || null,
                      customerName: name.trim() || null,
                      customerEmail: email.trim() || null,
                      customerPhone: phone.trim() || null,
                      affiliateSlug: affiliateSlug?.trim() || null,
                    });
                  }}
                >
                  {ask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                  Share and ask for a helper
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
