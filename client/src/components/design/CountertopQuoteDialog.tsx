import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  squareFeet: number;
  linearFeet: number;
  hasIsland: boolean;
  defaultEmail?: string;
  defaultName?: string;
  defaultPhone?: string;
  // Snapshot of the current design so the team can see what's being quoted.
  roomData?: unknown;
  placedCabinets?: unknown;
}

const MATERIAL_KEYS = [
  "dt_cq_mat_quartz",
  "dt_cq_mat_granite",
  "dt_cq_mat_laminate",
  "dt_cq_mat_solid",
  "dt_cq_mat_butcher",
  "dt_cq_mat_marble",
  "dt_cq_mat_unsure",
] as const;
// English material values are the canonical values sent to the backend.
const MATERIAL_VALUES = ["Quartz", "Granite", "Laminate", "Solid Surface", "Butcher Block", "Marble", "Not sure yet"];

export function CountertopQuoteDialog({
  open, onOpenChange, squareFeet, linearFeet, hasIsland, defaultEmail, defaultName, defaultPhone, roomData, placedCabinets,
}: Props) {
  const { t } = useLanguage();
  const [name, setName] = useState(defaultName ?? "");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [zip, setZip] = useState("");
  const [material, setMaterial] = useState("Not sure yet");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submit = trpc.design.requestCountertopQuote.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success(t("dt_cq_toast_sent"));
    },
    onError: (e) => toast.error(e.message || t("dt_cq_toast_error")),
  });

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  function handleSubmit() {
    if (!emailValid) {
      toast.error(t("dt_cq_invalid_email"));
      return;
    }
    submit.mutate({
      contactName: name || undefined,
      contactEmail: email,
      contactPhone: phone || undefined,
      zip: zip || undefined,
      material: material === "Not sure yet" ? undefined : material,
      squareFeet,
      linearFeet,
      hasIsland,
      roomData: roomData ?? undefined,
      placedCabinets: placedCabinets ?? undefined,
      notes: notes || undefined,
    });
  }

  function handleClose(next: boolean) {
    onOpenChange(next);
    if (!next) {
      // reset after closing so a fresh request starts clean
      setTimeout(() => setSubmitted(false), 200);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {submitted ? (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
            <DialogTitle>{t("dt_cq_sent_title")}</DialogTitle>
            <DialogDescription>
              {t("dt_cq_sent_desc", { sqft: squareFeet, email })}
            </DialogDescription>
            <Button className="mt-2" onClick={() => handleClose(false)}>{t("dt_cq_done")}</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("dt_cq_title")}</DialogTitle>
              <DialogDescription>
                {t("dt_cq_desc")} <strong>{t("dt_cq_sqft", { sqft: squareFeet })}</strong>{" "}
                {t("dt_cq_linear", {
                  linear: linearFeet,
                  island: hasIsland ? t("dt_cq_incl_island") : "",
                })}.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 py-2">
              <div className="grid gap-1.5">
                <Label htmlFor="ct-email">{t("dt_cq_email")}</Label>
                <Input id="ct-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("dt_cq_email_ph")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="ct-name">{t("dt_cq_name")}</Label>
                  <Input id="ct-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("dt_cq_optional")} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ct-phone">{t("dt_cq_phone")}</Label>
                  <Input id="ct-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("dt_cq_optional")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="ct-zip">{t("dt_cq_zip")}</Label>
                  <Input id="ct-zip" value={zip} onChange={(e) => setZip(e.target.value)} placeholder={t("dt_cq_zip_ph")} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ct-material">{t("dt_cq_material")}</Label>
                  <Select value={material} onValueChange={setMaterial}>
                    <SelectTrigger id="ct-material"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MATERIAL_VALUES.map((m, i) => <SelectItem key={m} value={m}>{t(MATERIAL_KEYS[i])}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ct-notes">{t("dt_cq_notes")}</Label>
                <Textarea id="ct-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("dt_cq_notes_ph")} rows={3} />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>{t("dt_cq_cancel")}</Button>
              <Button onClick={handleSubmit} disabled={submit.isPending || !emailValid}>
                {submit.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                {t("dt_cq_send")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
