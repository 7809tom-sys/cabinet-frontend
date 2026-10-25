import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Trash2, CheckCircle2, Clock, History, Gift, Tag, CalendarDays } from "lucide-react";
import { AffiliateBannerScheduler } from "./AffiliateBannerScheduler";

// ─── Sale Badge Editor ────────────────────────────────────────────────────────
const BADGE_PRESETS = [
  { label: "10% Off",        discountBps: 1000 },
  { label: "15% Off",        discountBps: 1500 },
  { label: "20% Off",        discountBps: 2000 },
  { label: "25% Off",        discountBps: 2500 },
  { label: "Labor Day Sale", discountBps: 0 },
  { label: "Memorial Day",   discountBps: 0 },
  { label: "Black Friday",   discountBps: 0 },
  { label: "Clearance",      discountBps: 0 },
  { label: "New Arrival",    discountBps: 0 },
  { label: "Best Seller",    discountBps: 0 },
  { label: "Limited Time",   discountBps: 0 },
  { label: "Free Shipping",  discountBps: 0 },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function nextWeekStr() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

function defaultBadgeForm() {
  return {
    label: "",
    targetType: "all" as "style" | "category" | "all",
    targetId: null as number | null,
    discountBps: 0,
    startsAt: todayStr(),
    endsAt: nextWeekStr(),
    active: true,
  };
}

function SaleBadgeEditor() {
  const utils = trpc.useUtils();
  const { data: promos = [], isLoading } = trpc.affiliates.listPromoDiscounts.useQuery();
  const { data: styles = [] } = trpc.doorStyles.list.useQuery();
  const upsert = trpc.affiliates.upsertPromoDiscount.useMutation({
    onSuccess: () => { utils.affiliates.listPromoDiscounts.invalidate(); toast.success("Sale badge saved!"); setOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.affiliates.deletePromoDiscount.useMutation({
    onSuccess: () => { utils.affiliates.listPromoDiscounts.invalidate(); toast.success("Badge removed."); setDeleteId(null); },
    onError: (e) => toast.error(e.message),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(defaultBadgeForm());
  const [deleteId, setDeleteId] = useState<number | null>(null);

  function openNew() { setForm(defaultBadgeForm()); setOpen(true); }

  function applyPreset(p: typeof BADGE_PRESETS[0]) {
    setForm((f) => ({ ...f, label: p.label, discountBps: p.discountBps }));
  }

  function handleSave() {
    if (!form.label.trim()) { toast.error("Badge label is required."); return; }
    const startsAt = form.startsAt ? new Date(form.startsAt).getTime() : null;
    const endsAt = form.endsAt ? new Date(form.endsAt).getTime() : null;
    upsert.mutate({ ...form, startsAt, endsAt });
  }

  function isActive(p: { startsAt: Date | null; endsAt: Date | null; active: boolean }) {
    if (!p.active) return false;
    const now = Date.now();
    if (p.startsAt && p.startsAt.getTime() > now) return false;
    if (p.endsAt && p.endsAt.getTime() < now) return false;
    return true;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base">Sale Badges</h3>
          <p className="text-sm text-muted-foreground">Add promotional badges to door style cards on your storefront.</p>
        </div>
        <Button size="sm" onClick={openNew} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Badge
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-4">Loading...</div>
      ) : promos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
          No sale badges yet. Add one to show promotions on your storefront.
        </div>
      ) : (
        <div className="space-y-2">
          {promos.map((p) => {
            const active = isActive({ active: p.active ?? true, startsAt: p.startsAt ? new Date(p.startsAt) : null, endsAt: p.endsAt ? new Date(p.endsAt) : null });
            return (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3 bg-card">
                <div className="flex items-center gap-3">
                  <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{p.label}</span>
                      {p.discountBps > 0 && (
                        <Badge variant="secondary" className="text-xs">{(p.discountBps / 100).toFixed(0)}% off</Badge>
                      )}
                      <Badge variant={active ? "default" : "outline"} className={`text-xs ${active ? "bg-green-100 text-green-800 border-green-200" : ""}`}>
                        {active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {p.targetType === "all" ? "All styles" : p.targetType === "style" ? `Style #${p.targetId}` : `Category #${p.targetId}`}
                      {p.startsAt && ` · From ${new Date(p.startsAt).toLocaleDateString()}`}
                      {p.endsAt && ` to ${new Date(p.endsAt).toLocaleDateString()}`}
                    </div>
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(p.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Badge Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Sale Badge</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-2 block">Quick Presets</Label>
              <div className="flex flex-wrap gap-1.5">
                {BADGE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors hover:bg-primary hover:text-primary-foreground ${form.label === p.label ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background"}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="badge-label">Badge Label *</Label>
              <Input id="badge-label" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="e.g. Labor Day Sale" maxLength={128} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="badge-discount">Discount % (0 = label only)</Label>
                <Input id="badge-discount" type="number" min={0} max={100} value={form.discountBps / 100} onChange={(e) => setForm((f) => ({ ...f, discountBps: Math.round(parseFloat(e.target.value || "0") * 100) }))} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Applies To</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.targetType}
                  onChange={(e) => setForm((f) => ({ ...f, targetType: e.target.value as "style" | "category" | "all", targetId: null }))}
                >
                  <option value="all">All door styles</option>
                  <option value="style">Specific style</option>
                </select>
              </div>
            </div>
            {form.targetType === "style" && (
              <div className="space-y-1.5">
                <Label>Door Style</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.targetId ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, targetId: e.target.value ? parseInt(e.target.value) : null }))}
                >
                  <option value="">Select a style…</option>
                  {styles.map((s) => (
                    <option key={s.id} value={s.id}>{s.ourName || s.aliasName || s.styleCode}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="badge-start">Start Date</Label>
                <Input id="badge-start" type="date" value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="badge-end">End Date</Label>
                <Input id="badge-end" type="date" value={form.endsAt} onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="badge-active" checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
              <Label htmlFor="badge-active">Active now</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>{upsert.isPending ? "Saving…" : "Save Badge"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this badge?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the sale badge from your storefront immediately.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteId && del.mutate({ id: deleteId })}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Main Promotions Panel ────────────────────────────────────────────────────
export default function AffiliatePromotionsPanel() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-bold">Promotions &amp; Banners</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Run holiday banners across your storefront and add sale badges to door style cards.
        </p>
      </div>

      <Tabs defaultValue="banners">
        <TabsList>
          <TabsTrigger value="banners" className="gap-1.5">
            <CalendarDays className="h-4 w-4" /> Holiday Banners
          </TabsTrigger>
          <TabsTrigger value="badges" className="gap-1.5">
            <Tag className="h-4 w-4" /> Sale Badges
          </TabsTrigger>
        </TabsList>

        <TabsContent value="banners" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Storefront Banner</CardTitle>
              <CardDescription>
                Choose from pre-made holiday banners or write your own. The active banner shows at the top of your storefront.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AffiliateBannerScheduler />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="badges" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Door Style Sale Badges</CardTitle>
              <CardDescription>
                Add promotional badges to door style cards on your storefront. Set a discount percentage or just a label like "Labor Day Sale".
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SaleBadgeEditor />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
