import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Pencil } from "lucide-react";

function fmtDim(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return `${n % 1 === 0 ? n.toFixed(0) : n}"`;
}

type ConflictItem = {
  id: number;
  masterCode: string;
  description: string;
  category: string;
  subCategory: string | null;
  width: string | null;
  height: string | null;
  depth: string | null;
  conflictReason: string | null;
  skuCount: number;
  distributorNames: string[];
  doorStyleNames: string[];
  styleIds: number[];
};

type EditForm = {
  description: string;
  category: string;
  subCategory: string;
  width: string;
  height: string;
  depth: string;
  conflictReason: string;
  styleId: string; // "" = leave unchanged
};

const CUSTOM_CATEGORY = "__custom__";

function EditConflictDialog({
  cabinet,
  open,
  onOpenChange,
}: {
  cabinet: ConflictItem;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const { data: categoryOptions } = trpc.cabinets.allCategories.useQuery();
  const { data: styleOptions } = trpc.cabinets.doorStyleOptions.useQuery();
  const currentStyleId = cabinet.styleIds.length === 1 ? String(cabinet.styleIds[0]) : "";
  const [form, setForm] = useState<EditForm>({
    description: cabinet.description ?? "",
    category: cabinet.category ?? "",
    subCategory: cabinet.subCategory ?? "",
    width: cabinet.width ?? "",
    height: cabinet.height ?? "",
    depth: cabinet.depth ?? "",
    conflictReason: cabinet.conflictReason ?? "",
    styleId: currentStyleId,
  });
  // When the current category isn't in the known list, treat it as a custom
  // free-text entry so the dropdown still works.
  const knownCats = categoryOptions ?? [];
  const [customCat, setCustomCat] = useState(false);
  const categoryIsKnown = form.category === "" || knownCats.includes(form.category);
  const showCustomCat = customCat || (!categoryIsKnown && form.category !== "");

  const update = trpc.cabinets.updateConflictCabinet.useMutation({
    onSuccess: (_d, vars) => {
      utils.cabinets.conflicts.invalidate();
      onOpenChange(false);
      toast.success(
        vars.clearAfter
          ? "Saved — conflict cleared and product is live again."
          : "Conflict product updated.",
      );
    },
    onError: (e) => toast.error(e.message),
  });

  const set = (k: keyof EditForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const payload = (clearAfter: boolean) => ({
    id: cabinet.id,
    description: form.description.trim(),
    category: form.category.trim(),
    subCategory: form.subCategory.trim() === "" ? null : form.subCategory.trim(),
    width: form.width.trim() === "" ? null : form.width.trim(),
    height: form.height.trim() === "" ? null : form.height.trim(),
    depth: form.depth.trim() === "" ? null : form.depth.trim(),
    conflictReason: form.conflictReason.trim() === "" ? null : form.conflictReason.trim(),
    // Only send styleId when the admin actually picked a (different) one.
    styleId:
      form.styleId !== "" && form.styleId !== currentStyleId ? Number(form.styleId) : undefined,
    clearAfter,
  });

  const invalid = form.description.trim() === "" || form.category.trim() === "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono">Edit {cabinet.masterCode}</DialogTitle>
          <DialogDescription>
            Fix the product data that caused this conflict, then save. You can save and clear the
            conflict in one step once it looks right.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          <div className="grid gap-1.5">
            <Label htmlFor="ec-desc">Description</Label>
            <Input id="ec-desc" value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ec-cat">Category</Label>
              {showCustomCat ? (
                <div className="flex gap-1.5">
                  <Input
                    id="ec-cat"
                    value={form.category}
                    onChange={(e) => set("category", e.target.value)}
                    placeholder="New category name"
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCustomCat(false);
                      if (!knownCats.includes(form.category)) set("category", knownCats[0] ?? "");
                    }}
                  >
                    List
                  </Button>
                </div>
              ) : (
                <Select
                  value={knownCats.includes(form.category) ? form.category : ""}
                  onValueChange={(v) => {
                    if (v === CUSTOM_CATEGORY) {
                      setCustomCat(true);
                      set("category", "");
                    } else {
                      set("category", v);
                    }
                  }}
                >
                  <SelectTrigger id="ec-cat">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {knownCats.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_CATEGORY}>+ New category…</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ec-sub">Sub-category</Label>
              <Input id="ec-sub" value={form.subCategory} onChange={(e) => set("subCategory", e.target.value)} placeholder="—" />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="ec-style">Door style</Label>
            <Select value={form.styleId} onValueChange={(v) => set("styleId", v)}>
              <SelectTrigger id="ec-style">
                <SelectValue placeholder="Select the correct door style" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {(styleOptions ?? []).map((opt) => (
                  <SelectItem key={opt.id} value={String(opt.id)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cabinet.styleIds.length > 1 ? (
              <p className="text-xs text-amber-700">
                This item is carried under {cabinet.styleIds.length} door styles. Picking one will
                re-point all of its SKUs to that single style.
              </p>
            ) : form.styleId !== currentStyleId && form.styleId !== "" ? (
              <p className="text-xs text-muted-foreground">
                Saving will move this product to the selected door style.
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ec-w">Width (in)</Label>
              <Input id="ec-w" inputMode="decimal" value={form.width} onChange={(e) => set("width", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ec-h">Height (in)</Label>
              <Input id="ec-h" inputMode="decimal" value={form.height} onChange={(e) => set("height", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ec-d">Depth (in)</Label>
              <Input id="ec-d" inputMode="decimal" value={form.depth} onChange={(e) => set("depth", e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ec-reason">Review note</Label>
            <Textarea
              id="ec-reason"
              rows={2}
              value={form.conflictReason}
              onChange={(e) => set("conflictReason", e.target.value)}
              placeholder="Why is this held / what was fixed?"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={update.isPending}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => update.mutate(payload(false))}
            disabled={update.isPending || invalid}
          >
            Save changes
          </Button>
          <Button
            onClick={() => update.mutate(payload(true))}
            disabled={update.isPending || invalid}
            className="gap-1.5"
          >
            <CheckCircle2 className="h-4 w-4" />
            Save &amp; clear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ConflictsAdmin() {
  const utils = trpc.useUtils();
  const { data, isLoading, error, refetch } = trpc.cabinets.conflicts.useQuery();
  const [editing, setEditing] = useState<ConflictItem | null>(null);
  const clear = trpc.cabinets.clearConflict.useMutation({
    onSuccess: () => {
      utils.cabinets.conflicts.invalidate();
      toast.success("Conflict cleared — product is live again.");
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-6 w-6 text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-destructive">Couldn't load conflicts: {error.message}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const items = (data ?? []) as ConflictItem[];

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium">Conflicts / Needs Review</p>
          <p className="text-amber-800">
            Products held here are hidden from the public catalog, storefront and the 3D Designer
            until reviewed. Prices are preserved. Edit a product to fix what caused the conflict, or
            clear it to put the product back live.
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No products in conflict. Everything is live.
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((c) => (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base font-mono">{c.masterCode}</CardTitle>
                  <Badge variant="destructive">Conflict</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-foreground">{c.description}</p>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
                  <span>
                    <span className="font-medium text-foreground">Category:</span> {c.category}
                    {c.subCategory ? ` / ${c.subCategory}` : ""}
                  </span>
                  <span>
                    <span className="font-medium text-foreground">Size:</span> {fmtDim(c.width)}W ×{" "}
                    {fmtDim(c.height)}H × {fmtDim(c.depth)}D
                  </span>
                  <span>
                    <span className="font-medium text-foreground">SKUs:</span> {c.skuCount}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
                  <span>
                    <span className="font-medium text-foreground">Distributor:</span>{" "}
                    {c.distributorNames.length ? c.distributorNames.join(", ") : "—"}
                  </span>
                  <span>
                    <span className="font-medium text-foreground">Door style:</span>{" "}
                    {c.doorStyleNames.length ? c.doorStyleNames.join(", ") : "—"}
                  </span>
                </div>
                {c.conflictReason && (
                  <p className="rounded bg-muted px-3 py-2 text-xs text-muted-foreground">
                    {c.conflictReason}
                  </p>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setEditing(c)}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <CheckCircle2 className="h-4 w-4" />
                        Clear conflict
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Clear conflict for {c.masterCode}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This returns the product to live status — it will appear in the public
                          catalog, storefront and Design Tool again. Only do this after you've
                          verified the product against the catalog book.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => clear.mutate({ id: c.id })}
                          disabled={clear.isPending}
                        >
                          Clear conflict
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <EditConflictDialog
          cabinet={editing}
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
        />
      )}
    </div>
  );
}
