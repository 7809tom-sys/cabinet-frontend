import { useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CalendarCheck, Video, Phone, MapPin, Loader2, CheckCircle2, UserRound } from "lucide-react";
import { readReferralCode } from "@/hooks/useReferral";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultName?: string;
  defaultEmail?: string;
  defaultPhone?: string;
  designId?: number | null;
  designName?: string | null;
  /** /store/:slug scope. The server resolves this slug; it is not an affiliate id. */
  affiliateSlug?: string | null;
};

const MODE_ICON: Record<string, React.ReactNode> = {
  video: <Video className="h-3.5 w-3.5" />,
  phone: <Phone className="h-3.5 w-3.5" />,
  in_person: <MapPin className="h-3.5 w-3.5" />,
};
const MODE_LABEL_KEY: Record<string, "dt_pd_mode_video" | "dt_pd_mode_phone" | "dt_pd_mode_in_person"> = {
  video: "dt_pd_mode_video",
  phone: "dt_pd_mode_phone",
  in_person: "dt_pd_mode_in_person",
};

export function ProDesignerDialog({
  open,
  onOpenChange,
  defaultName,
  defaultEmail,
  defaultPhone,
  designId,
  designName,
  affiliateSlug,
}: Props) {
  const { t } = useLanguage();
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [name, setName] = useState(defaultName ?? "");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [topic, setTopic] = useState("");
  const [done, setDone] = useState(false);

  const utils = trpc.useUtils();
  const { data: slots, isLoading } = trpc.consultations.openSlots.useQuery(undefined, {
    enabled: open,
  });

  const book = trpc.consultations.book.useMutation({
    onSuccess: () => {
      setDone(true);
      utils.consultations.openSlots.invalidate();
      toast.success(t("dt_pd_toast_booked"));
    },
    onError: (e) => {
      toast.error(e.message || t("dt_pd_toast_error"));
      utils.consultations.openSlots.invalidate();
    },
  });

  // Group slots by local calendar day for a tidy picker.
  const grouped = useMemo(() => {
    const out = new Map<string, Array<NonNullable<typeof slots>[number]>>();
    (slots ?? []).forEach((s) => {
      const key = new Date(s.startAt).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      const arr = out.get(key) ?? [];
      arr.push(s);
      out.set(key, arr);
    });
    return Array.from(out.entries());
  }, [slots]);

  const canBook = selectedSlotId != null && name.trim() && /\S+@\S+\.\S+/.test(email);

  function reset() {
    setDone(false);
    setSelectedSlotId(null);
    setTopic("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
        {done ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <h3 className="mt-3 text-lg font-semibold">{t("dt_pd_booked_title")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("dt_pd_booked_desc", { phone: phone ? t("dt_pd_booked_or_phone") : "" })}
            </p>
            <Button className="mt-5" onClick={() => onOpenChange(false)}>
              {t("dt_pd_done")}
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserRound className="h-5 w-5 text-[#a87f33]" />
                {t("dt_pd_title")}
              </DialogTitle>
              <DialogDescription>
                {t("dt_pd_desc")}
                {designName ? (
                  <span className="mt-1 block font-medium text-foreground">
                    {t("dt_pd_design_attached", { name: designName })}
                  </span>
                ) : null}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Slot picker */}
              <div>
                <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("dt_pd_choose_time")}
                </Label>
                {isLoading ? (
                  <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> {t("dt_pd_loading_times")}
                  </div>
                ) : grouped.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                    {t("dt_pd_no_times")}
                  </div>
                ) : (
                  <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                    {grouped.map(([day, daySlots]) => (
                      <div key={day}>
                        <p className="mb-1 text-xs font-medium text-foreground">{day}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {daySlots.map((s) => {
                            const selected = s.id === selectedSlotId;
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => setSelectedSlotId(s.id)}
                                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                  selected
                                    ? "border-[#a87f33] bg-[#a87f33] text-white"
                                    : "border-border hover:border-[#a87f33]/60 hover:bg-muted/50"
                                }`}
                                title={t("dt_pd_slot_title", { mode: t(MODE_LABEL_KEY[s.mode]), designer: s.designerName ?? t("dt_pd_a_designer") })}
                              >
                                {new Date(s.startAt).toLocaleTimeString(undefined, {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                                <span className={selected ? "opacity-90" : "text-muted-foreground"}>
                                  {MODE_ICON[s.mode]}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Contact */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="pd-name" className="text-xs">
                    {t("dt_pd_your_name")}
                  </Label>
                  <Input id="pd-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("dt_pd_name_ph")} />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="pd-phone" className="text-xs">
                    {t("dt_pd_phone_opt")}
                  </Label>
                  <Input id="pd-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("dt_pd_phone_ph")} />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="pd-email" className="text-xs">
                    {t("dt_pd_email")}
                  </Label>
                  <Input id="pd-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("dt_pd_email_ph")} />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="pd-topic" className="text-xs">
                    {t("dt_pd_topic")}
                  </Label>
                  <Textarea
                    id="pd-topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder={t("dt_pd_topic_ph")}
                    rows={2}
                  />
                </div>
              </div>

              <Button
                className="w-full gap-2 bg-[#a87f33] hover:bg-[#946e2b]"
                disabled={!canBook || book.isPending}
                onClick={() =>
                  selectedSlotId != null &&
                  book.mutate({
                    slotId: selectedSlotId,
                    customerName: name.trim(),
                    customerEmail: email.trim(),
                    customerPhone: phone.trim() || undefined,
                    topic: topic.trim() || undefined,
                    designId: designId ?? undefined,
                    designName: designName ?? undefined,
                    affiliateSlug: affiliateSlug ?? undefined,
                    referralCode: readReferralCode() ?? undefined,
                  })
                }
              >
                {book.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> {t("dt_pd_booking")}
                  </>
                ) : (
                  <>
                    <CalendarCheck className="h-4 w-4" /> {t("dt_pd_book")}
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
