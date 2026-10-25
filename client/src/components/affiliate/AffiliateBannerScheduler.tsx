import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CalendarDays, Megaphone, CheckCircle2, Clock, History } from "lucide-react";

// ─── Holiday presets ──────────────────────────────────────────────────────────
const HOLIDAYS = [
  { key: "new_year",       label: "New Year's",     emoji: "🎆", message: "🎆 Happy New Year! Start 2025 with a brand-new kitchen — shop our cabinet collections today!" },
  { key: "valentines",     label: "Valentine's Day", emoji: "❤️", message: "❤️ Show your kitchen some love this Valentine's Day — exclusive deals on our most popular styles!" },
  { key: "presidents_day", label: "Presidents' Day", emoji: "🇺🇸", message: "🇺🇸 Presidents' Day Sale — save big on premium kitchen cabinets this weekend only!" },
  { key: "spring_sale",    label: "Spring Sale",     emoji: "🌸", message: "🌸 Spring into a new kitchen! Fresh styles, fresh savings — limited time only." },
  { key: "memorial_day",   label: "Memorial Day",    emoji: "🎖️", message: "🎖️ Memorial Day Weekend Sale — honor the season with a kitchen upgrade. Shop now!" },
  { key: "fourth_of_july", label: "4th of July",     emoji: "🎇", message: "🎇 Independence Day Sale — celebrate with stunning new cabinets at unbeatable prices!" },
  { key: "labor_day",      label: "Labor Day",       emoji: "🔨", message: "🔨 Labor Day Sale — the hardest-working cabinets at the best prices of the summer!" },
  { key: "halloween",      label: "Halloween",       emoji: "🎃", message: "🎃 Spooky savings on kitchen cabinets! Don't let this deal haunt you — shop before it's gone." },
  { key: "thanksgiving",   label: "Thanksgiving",    emoji: "🦃", message: "🦃 Thankful for great kitchens! Shop our Thanksgiving sale and save on your dream kitchen." },
  { key: "black_friday",   label: "Black Friday",    emoji: "🛍️", message: "🛍️ Black Friday MEGA SALE — our biggest discounts of the year on premium kitchen cabinets!" },
  { key: "cyber_monday",   label: "Cyber Monday",    emoji: "💻", message: "💻 Cyber Monday Deal — order online today and save on your entire cabinet order!" },
  { key: "christmas",      label: "Christmas",       emoji: "🎄", message: "🎄 Give the gift of a beautiful kitchen this Christmas — holiday savings are here!" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function statusOf(start: string, end: string): "active" | "upcoming" | "past" {
  const today = todayStr();
  if (today > end) return "past";
  if (today >= start) return "active";
  return "upcoming";
}

const STATUS_CONFIG = {
  active:   { label: "Active",    color: "bg-green-100 text-green-800 border-green-200",  icon: CheckCircle2 },
  upcoming: { label: "Upcoming",  color: "bg-blue-100 text-blue-800 border-blue-200",     icon: Clock },
  past:     { label: "Past",      color: "bg-gray-100 text-gray-500 border-gray-200",     icon: History },
};

// ─── Form defaults ────────────────────────────────────────────────────────────
function defaultForm() {
  const today = todayStr();
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  return {
    message: "",
    holidayKey: "",
    startDate: today,
    endDate: nextWeek.toISOString().slice(0, 10),
  };
}

type FormState = ReturnType<typeof defaultForm>;

// ─── Component ────────────────────────────────────────────────────────────────
export function AffiliateBannerScheduler() {
  const utils = trpc.useUtils();
  const { data: schedules = [], isLoading } = trpc.affiliates.listBannerSchedules.useQuery();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);

  const createMutation = trpc.affiliates.createBannerSchedule.useMutation({
    onSuccess: () => {
      utils.affiliates.listBannerSchedules.invalidate();
      toast.success("Banner scheduled!");
      setShowForm(false);
      setForm(defaultForm());
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.affiliates.updateBannerSchedule.useMutation({
    onSuccess: () => {
      utils.affiliates.listBannerSchedules.invalidate();
      toast.success("Banner updated!");
      setShowForm(false);
      setEditId(null);
      setForm(defaultForm());
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.affiliates.deleteBannerSchedule.useMutation({
    onSuccess: () => {
      utils.affiliates.listBannerSchedules.invalidate();
      toast.success("Banner removed.");
      setDeleteId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  function openCreate() {
    setEditId(null);
    setForm(defaultForm());
    setShowForm(true);
  }

  function openEdit(s: typeof schedules[0]) {
    setEditId(s.id);
    setForm({
      message: s.message,
      holidayKey: s.holidayKey ?? "",
      startDate: s.startDate,
      endDate: s.endDate,
    });
    setShowForm(true);
  }

  function handlePreset(h: typeof HOLIDAYS[0]) {
    setForm((f) => ({ ...f, message: h.message, holidayKey: h.key }));
  }

  function handleSubmit() {
    if (!form.message.trim()) { toast.error("Message is required."); return; }
    if (form.startDate > form.endDate) { toast.error("Start date must be before end date."); return; }
    const payload = {
      message: form.message.trim(),
      holidayKey: form.holidayKey || undefined,
      startDate: form.startDate,
      endDate: form.endDate,
    };
    if (editId !== null) {
      updateMutation.mutate({ id: editId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  // Group by status for display
  const active   = schedules.filter((s) => statusOf(s.startDate, s.endDate) === "active");
  const upcoming = schedules.filter((s) => statusOf(s.startDate, s.endDate) === "upcoming");
  const past     = schedules.filter((s) => statusOf(s.startDate, s.endDate) === "past");

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-amber-600" />
            Holiday Banner Scheduler
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Schedule promotional banners to automatically appear on your storefront during holidays and sales events.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Schedule Banner
        </Button>
      </div>

      {/* Active banners */}
      {active.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-green-700 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" /> Active Now
          </h3>
          {active.map((s) => (
            <BannerCard key={s.id} schedule={s} onEdit={() => openEdit(s)} onDelete={() => setDeleteId(s.id)} />
          ))}
        </div>
      )}

      {/* Upcoming banners */}
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-blue-700 flex items-center gap-1.5">
            <Clock className="h-4 w-4" /> Upcoming
          </h3>
          {upcoming.map((s) => (
            <BannerCard key={s.id} schedule={s} onEdit={() => openEdit(s)} onDelete={() => setDeleteId(s.id)} />
          ))}
        </div>
      )}

      {/* Past banners */}
      {past.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <History className="h-4 w-4" /> Past
          </h3>
          {past.map((s) => (
            <BannerCard key={s.id} schedule={s} onEdit={() => openEdit(s)} onDelete={() => setDeleteId(s.id)} dimmed />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && schedules.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Megaphone className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium text-muted-foreground">No banners scheduled yet</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Schedule holiday banners to automatically appear on your storefront.
            </p>
            <Button variant="outline" onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Schedule Your First Banner
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(v) => { if (!v) { setShowForm(false); setEditId(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Banner" : "Schedule a Banner"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Holiday presets */}
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                Holiday Presets — click to fill
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {HOLIDAYS.map((h) => (
                  <button
                    key={h.key}
                    type="button"
                    onClick={() => handlePreset(h)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      form.holidayKey === h.key
                        ? "bg-amber-500 text-white border-amber-500"
                        : "bg-background hover:bg-amber-50 border-border hover:border-amber-300"
                    }`}
                  >
                    {h.emoji} {h.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div>
              <Label htmlFor="banner-msg">Banner Message <span className="text-destructive">*</span></Label>
              <Textarea
                id="banner-msg"
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                placeholder="e.g. 🎄 Christmas Sale — save 15% on all cabinet orders this week!"
                rows={3}
                maxLength={500}
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">{form.message.length}/500</p>
            </div>

            {/* Live preview */}
            {form.message.trim() && (
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Preview
                </Label>
                <div className="rounded-md overflow-hidden border">
                  <div className="bg-[#1a2744] text-white text-xs py-2 px-4 text-center font-medium">
                    {form.message}
                  </div>
                </div>
              </div>
            )}

            {/* Date range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start-date">Start Date <span className="text-destructive">*</span></Label>
                <Input
                  id="start-date"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="end-date">End Date <span className="text-destructive">*</span></Label>
                <Input
                  id="end-date"
                  type="date"
                  value={form.endDate}
                  min={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  className="mt-1.5"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              The banner will automatically appear on your storefront from the start date through the end date. If multiple banners overlap, the most recently created one takes priority.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? "Saving…" : editId ? "Save Changes" : "Schedule Banner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Banner Schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the scheduled banner. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId !== null && deleteMutation.mutate({ id: deleteId })}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Banner card ──────────────────────────────────────────────────────────────
function BannerCard({
  schedule,
  onEdit,
  onDelete,
  dimmed = false,
}: {
  schedule: { id: number; message: string; startDate: string; endDate: string; holidayKey: string | null };
  onEdit: () => void;
  onDelete: () => void;
  dimmed?: boolean;
}) {
  const status = statusOf(schedule.startDate, schedule.endDate);
  const cfg = STATUS_CONFIG[status];
  const holiday = HOLIDAYS.find((h) => h.key === schedule.holidayKey);

  return (
    <Card className={`transition-opacity ${dimmed ? "opacity-50" : ""}`}>
      <CardContent className="py-3 px-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Status + holiday badge */}
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
                <cfg.icon className="h-3 w-3" />
                {cfg.label}
              </span>
              {holiday && (
                <span className="text-xs text-muted-foreground">
                  {holiday.emoji} {holiday.label}
                </span>
              )}
            </div>
            {/* Message */}
            <p className="text-sm font-medium leading-snug line-clamp-2">{schedule.message}</p>
            {/* Dates */}
            <p className="text-xs text-muted-foreground mt-1">
              {schedule.startDate} → {schedule.endDate}
            </p>
          </div>
          {/* Actions */}
          <div className="flex gap-1 shrink-0">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit} title="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete} title="Remove">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
