import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CheckCircle2, Circle, Eye } from "lucide-react";

type BannerRow = {
  id: number;
  title: string;
  subtitle: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  backgroundColor: string;
  textColor: string;
  emoji: string | null;
  isActive: boolean;
  label: string | null;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type BannerFormData = {
  title: string;
  subtitle: string;
  ctaText: string;
  ctaUrl: string;
  backgroundColor: string;
  textColor: string;
  emoji: string;
  label: string;
};

const EMPTY_FORM: BannerFormData = {
  title: "",
  subtitle: "",
  ctaText: "Shop Now",
  ctaUrl: "/catalog",
  backgroundColor: "#1e3a5f",
  textColor: "#ffffff",
  emoji: "",
  label: "",
};

const HOLIDAY_PRESETS = [
  { label: "July 4th", emoji: "🇺🇸", bg: "#b91c1c", text: "#ffffff" },
  { label: "Labor Day", emoji: "🔨", bg: "#1e3a5f", text: "#ffffff" },
  { label: "Thanksgiving", emoji: "🦃", bg: "#92400e", text: "#ffffff" },
  { label: "Christmas", emoji: "🎄", bg: "#166534", text: "#ffffff" },
  { label: "New Year", emoji: "🎉", bg: "#1e3a5f", text: "#fbbf24" },
  { label: "Memorial Day", emoji: "🇺🇸", bg: "#1d4ed8", text: "#ffffff" },
  { label: "Black Friday", emoji: "🛒", bg: "#111827", text: "#facc15" },
  { label: "Spring Sale", emoji: "🌸", bg: "#be185d", text: "#ffffff" },
];

// ── Banner Preview ────────────────────────────────────────────────────────────
function BannerPreview({ form }: { form: BannerFormData }) {
  return (
    <div
      className="rounded-lg px-4 py-3 text-sm flex items-center justify-between gap-3 transition-all"
      style={{ backgroundColor: form.backgroundColor, color: form.textColor }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {form.emoji && <span className="text-base flex-shrink-0">{form.emoji}</span>}
        <div className="min-w-0">
          <span className="font-semibold">{form.title || "Banner title"}</span>
          {form.subtitle && (
            <span className="ml-2 opacity-80 text-xs hidden sm:inline">{form.subtitle}</span>
          )}
        </div>
      </div>
      {form.ctaText && (
        <span
          className="text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0 border"
          style={{ borderColor: form.textColor, color: form.textColor }}
        >
          {form.ctaText}
        </span>
      )}
    </div>
  );
}

// ── Edit / Create Dialog ──────────────────────────────────────────────────────
function BannerDialog({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial: BannerRow | null;
}) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<BannerFormData>(
    initial
      ? {
          title: initial.title,
          subtitle: initial.subtitle ?? "",
          ctaText: initial.ctaText ?? "",
          ctaUrl: initial.ctaUrl ?? "",
          backgroundColor: initial.backgroundColor,
          textColor: initial.textColor,
          emoji: initial.emoji ?? "",
          label: initial.label ?? "",
        }
      : EMPTY_FORM
  );

  const set = (key: keyof BannerFormData, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const createMutation = trpc.banners.adminCreate.useMutation({
    onSuccess: () => {
      utils.banners.adminList.invalidate();
      toast.success("Banner created");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.banners.adminUpdate.useMutation({
    onSuccess: () => {
      utils.banners.adminList.invalidate();
      toast.success("Banner updated");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const busy = createMutation.isPending || updateMutation.isPending;

  const handleSave = () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    const payload = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      ctaText: form.ctaText.trim() || null,
      ctaUrl: form.ctaUrl.trim() || null,
      backgroundColor: form.backgroundColor,
      textColor: form.textColor,
      emoji: form.emoji.trim() || null,
      label: form.label.trim() || null,
    };
    if (initial) {
      updateMutation.mutate({ id: initial.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Banner" : "New Banner"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Live preview */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5 font-medium">Preview</p>
            <BannerPreview form={form} />
          </div>

          {/* Holiday presets */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5 font-medium">Quick Presets</p>
            <div className="flex flex-wrap gap-1.5">
              {HOLIDAY_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="text-xs px-2 py-1 rounded-full border hover:opacity-80 transition-opacity flex items-center gap-1"
                  style={{ backgroundColor: p.bg, color: p.text, borderColor: p.bg }}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      emoji: p.emoji,
                      backgroundColor: p.bg,
                      textColor: p.text,
                      label: prev.label || p.label,
                    }))
                  }
                >
                  <span>{p.emoji}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-sm">Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. Independence Day Sale"
                disabled={busy}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-sm">Subtitle</Label>
              <Input
                value={form.subtitle}
                onChange={(e) => set("subtitle", e.target.value)}
                placeholder="Short description shown beside the title"
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">CTA Button Text</Label>
              <Input
                value={form.ctaText}
                onChange={(e) => set("ctaText", e.target.value)}
                placeholder="Shop Now"
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">CTA Button URL</Label>
              <Input
                value={form.ctaUrl}
                onChange={(e) => set("ctaUrl", e.target.value)}
                placeholder="/catalog"
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Background Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.backgroundColor}
                  onChange={(e) => set("backgroundColor", e.target.value)}
                  className="h-9 w-12 rounded border cursor-pointer"
                  disabled={busy}
                />
                <Input
                  value={form.backgroundColor}
                  onChange={(e) => set("backgroundColor", e.target.value)}
                  className="font-mono text-sm"
                  disabled={busy}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Text Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.textColor}
                  onChange={(e) => set("textColor", e.target.value)}
                  className="h-9 w-12 rounded border cursor-pointer"
                  disabled={busy}
                />
                <Input
                  value={form.textColor}
                  onChange={(e) => set("textColor", e.target.value)}
                  className="font-mono text-sm"
                  disabled={busy}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Emoji / Icon</Label>
              <Input
                value={form.emoji}
                onChange={(e) => set("emoji", e.target.value)}
                placeholder="🎄"
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Internal Label</Label>
              <Input
                value={form.label}
                onChange={(e) => set("label", e.target.value)}
                placeholder="e.g. Christmas 2025"
                disabled={busy}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={busy} className="min-w-20">
            {busy ? <Spinner className="h-4 w-4" /> : initial ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function BannerAdmin() {
  const utils = trpc.useUtils();
  const { data: bannerList = [], isLoading } = trpc.banners.adminList.useQuery();
  const [editBanner, setEditBanner] = useState<BannerRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BannerRow | null>(null);

  const setActiveMutation = trpc.banners.adminSetActive.useMutation({
    onSuccess: () => {
      utils.banners.adminList.invalidate();
      utils.banners.getActive.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.banners.adminDelete.useMutation({
    onSuccess: () => {
      utils.banners.adminList.invalidate();
      utils.banners.getActive.invalidate();
      toast.success("Banner deleted");
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const activeBanner = bannerList.find((b) => b.isActive);

  const handleToggleActive = (banner: BannerRow) => {
    if (banner.isActive) {
      // Deactivate all
      setActiveMutation.mutate({ id: null });
    } else {
      setActiveMutation.mutate({ id: banner.id });
    }
  };

  const handleEdit = (banner: BannerRow) => {
    setEditBanner(banner);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditBanner(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditBanner(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Banner Management</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create holiday and promotional banners. Only one banner can be active at a time.
          </p>
        </div>
        <Button onClick={handleCreate} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Banner
        </Button>
      </div>

      {/* Active banner callout */}
      {activeBanner && (
        <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              Currently active on storefront
            </span>
          </div>
          <div
            className="rounded px-3 py-2 text-sm flex items-center gap-2"
            style={{
              backgroundColor: activeBanner.backgroundColor,
              color: activeBanner.textColor,
            }}
          >
            {activeBanner.emoji && <span>{activeBanner.emoji}</span>}
            <span className="font-semibold">{activeBanner.title}</span>
            {activeBanner.subtitle && (
              <span className="opacity-80 text-xs hidden sm:inline">{activeBanner.subtitle}</span>
            )}
          </div>
        </div>
      )}

      {!activeBanner && !isLoading && bannerList.length > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-700 dark:text-amber-300">
          No banner is currently active. Toggle one below to display it on the storefront.
        </div>
      )}

      {/* Banner list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6" />
        </div>
      ) : bannerList.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No banners yet.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={handleCreate}>
            Create your first banner
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {bannerList.map((banner) => (
            <div
              key={banner.id}
              className={`rounded-lg border p-4 transition-all ${
                banner.isActive
                  ? "border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10"
                  : "border-border bg-card"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Active toggle */}
                <div className="flex flex-col items-center gap-1 pt-0.5">
                  <Switch
                    checked={banner.isActive}
                    onCheckedChange={() => handleToggleActive(banner)}
                    disabled={setActiveMutation.isPending}
                    aria-label={banner.isActive ? "Deactivate banner" : "Activate banner"}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {banner.isActive ? "Active" : "Off"}
                  </span>
                </div>

                {/* Banner preview */}
                <div className="flex-1 min-w-0">
                  <div
                    className="rounded px-3 py-2 text-sm flex items-center justify-between gap-2 mb-2"
                    style={{
                      backgroundColor: banner.backgroundColor,
                      color: banner.textColor,
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {banner.emoji && <span className="flex-shrink-0">{banner.emoji}</span>}
                      <span className="font-semibold truncate">{banner.title}</span>
                      {banner.subtitle && (
                        <span className="opacity-80 text-xs hidden md:inline truncate">
                          {banner.subtitle}
                        </span>
                      )}
                    </div>
                    {banner.ctaText && (
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full border flex-shrink-0"
                        style={{ borderColor: banner.textColor }}
                      >
                        {banner.ctaText}
                      </span>
                    )}
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {banner.label && (
                      <Badge variant="secondary" className="text-xs">
                        {banner.label}
                      </Badge>
                    )}
                    {banner.isActive && (
                      <Badge className="text-xs bg-green-600 hover:bg-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Live
                      </Badge>
                    )}
                    {banner.ctaUrl && (
                      <span className="text-xs text-muted-foreground font-mono">
                        → {banner.ctaUrl}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleEdit(banner)}
                    title="Edit banner"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(banner)}
                    title="Delete banner"
                    disabled={banner.isActive}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      {dialogOpen && (
        <BannerDialog
          open={dialogOpen}
          onClose={handleCloseDialog}
          initial={editBanner}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Banner</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{deleteTarget?.label || deleteTarget?.title}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })}
            >
              {deleteMutation.isPending ? <Spinner className="h-4 w-4" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
