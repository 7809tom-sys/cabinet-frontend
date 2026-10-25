import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ImageIcon, RotateCw, RotateCcw, Upload, Search, X } from "lucide-react";

// ─── In-browser image editor ────────────────────────────────────────────────
// Crop (drag a square within the image), rotate, zoom. Outputs a square JPEG
// data URL so every product photo comes out consistent. Self-paced: edit one,
// save, move on.

type SkuRow = {
  skuId: number;
  platformSku: string;
  imageUrl: string | null;
  cabinetId: number;
  masterCode: string;
  cabinetDescription: string | null;
  category: string | null;
  subCategory: string | null;
  styleId: number;
  styleName: string | null;
  styleCode: string | null;
  doorImageUrl: string | null;
  roomImageUrl: string | null;
};

type MasterRow = {
  cabinetId: number;
  masterCode: string;
  description: string | null;
  category: string | null;
  subCategory: string | null;
  imageUrl: string | null;
  skuCount: number;
};

function resolveImg(r: SkuRow): string | null {
  return r.imageUrl || r.doorImageUrl || r.roomImageUrl || null;
}

// Render the source image to a square canvas with zoom + rotation, return JPEG.
function exportSquare(
  img: HTMLImageElement,
  rotation: number,
  zoom: number,
  offsetX: number,
  offsetY: number,
  size = 800,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.save();
  ctx.translate(size / 2 + offsetX, size / 2 + offsetY);
  ctx.rotate((rotation * Math.PI) / 180);
  const base = Math.max(size / img.width, size / img.height);
  const scale = base * zoom;
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
  return canvas.toDataURL("image/jpeg", 0.9);
}

function ImageEditor({
  file,
  existingUrl,
  onCancel,
  onSave,
}: {
  file: File | null;
  existingUrl: string | null;
  onCancel: () => void;
  onSave: (dataUrl: string) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const dragging = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setSrc(reader.result as string);
      reader.readAsDataURL(file);
    } else if (existingUrl) {
      setSrc(existingUrl);
    }
  }, [file, existingUrl]);

  useEffect(() => {
    if (!src) return;
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => {
      imgRef.current = im;
      setImgLoaded(true);
    };
    im.src = src;
  }, [src]);

  const handleSave = () => {
    if (!imgRef.current) return;
    const dataUrl = exportSquare(imgRef.current, rotation, zoom, offset.x, offset.y);
    onSave(dataUrl);
  };

  return (
    <div className="space-y-4">
      <div
        className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-lg border bg-muted"
        onMouseDown={(e) => (dragging.current = { x: e.clientX - offset.x, y: e.clientY - offset.y })}
        onMouseMove={(e) => {
          if (dragging.current)
            setOffset({ x: e.clientX - dragging.current.x, y: e.clientY - dragging.current.y });
        }}
        onMouseUp={() => (dragging.current = null)}
        onMouseLeave={() => (dragging.current = null)}
      >
        {src ? (
          <img
            src={src}
            alt="edit"
            draggable={false}
            className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
            style={{
              transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${zoom})`,
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Spinner />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/10" />
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setRotation((r) => r - 90)}>
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setRotation((r) => r + 90)}>
          <RotateCw className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 px-2">
          <span className="text-xs text-muted-foreground">Zoom</span>
          <input
            type="range"
            min={0.5}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setZoom(1);
            setRotation(0);
            setOffset({ x: 0, y: 0 });
          }}
        >
          Reset
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">Drag the image to reposition · square crop</p>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSave} disabled={!imgLoaded}>
          Save photo
        </Button>
      </DialogFooter>
    </div>
  );
}

function EditDialog({
  row,
  onClose,
}: {
  row: SkuRow;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<"pick" | "edit">(row.imageUrl ? "pick" : "pick");
  const [applyAll, setApplyAll] = useState(true);
  const fileInput = useRef<HTMLInputElement | null>(null);

  // Sub-category editing
  const [subCat, setSubCat] = useState(row.subCategory ?? "");
  const [cat, setCat] = useState(row.category ?? "");
  const metaQuery = trpc.genericCabinets.list.useQuery(
    { page: 0, pageSize: 1 },
    { staleTime: 60_000 }
  );
  const categories: string[] = (metaQuery.data?.categories ?? []) as string[];
  const subCategories: string[] = (metaQuery.data?.subCategories ?? []) as string[];
  const updateCabinet = trpc.genericCabinets.update.useMutation({
    onSuccess: () => { utils.skuImages.list.invalidate(); utils.genericCabinets.list.invalidate(); },
  });

  const siblingCount = trpc.skuImages.cabinetSiblingCount.useQuery({ skuId: row.skuId });
  const upload = trpc.skuImages.upload.useMutation();
  const setImage = trpc.skuImages.setImage.useMutation();

  const busy = upload.isPending || setImage.isPending || updateCabinet.isPending;

  // Save category/subCategory changes if they differ from original
  const saveMetaIfChanged = async () => {
    const catChanged = cat !== (row.category ?? "");
    const subChanged = subCat !== (row.subCategory ?? "");
    if ((catChanged || subChanged) && row.cabinetId) {
      await updateCabinet.mutateAsync({
        id: row.cabinetId,
        ...(catChanged ? { category: cat } : {}),
        ...(subChanged ? { subCategory: subCat || null } : {}),
      });
    }
  };

  const doSave = async (dataUrl: string) => {
    try {
      const { url } = await upload.mutateAsync({
        filename: `${row.platformSku}.jpg`,
        dataBase64: dataUrl,
        contentType: "image/jpeg",
      });
      const res = await setImage.mutateAsync({
        skuId: row.skuId,
        imageUrl: url,
        applyToAllCabinet: applyAll,
      });
      toast.success(
        applyAll
          ? `Photo applied to ${res.updated} ${row.masterCode} product${res.updated === 1 ? "" : "s"}`
          : "Photo saved for this product",
      );
      utils.skuImages.list.invalidate();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Could not save photo");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            {row.styleName} — {row.masterCode}
          </DialogTitle>
        </DialogHeader>

        {busy ? (
          <div className="flex items-center justify-center py-10">
            <Spinner /> <span className="ml-2 text-sm">Saving…</span>
          </div>
        ) : stage === "pick" ? (
          <div className="space-y-4">
            <div className="mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-lg border bg-muted">
              {resolveImg(row) ? (
                <img src={resolveImg(row)!} alt={row.masterCode} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-8 w-8" />
                </div>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFile(f);
                  setStage("edit");
                }
              }}
            />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => fileInput.current?.click()}>
                <Upload className="mr-2 h-4 w-4" /> Upload new photo
              </Button>
              {resolveImg(row) && (
                <Button variant="outline" onClick={() => setStage("edit")}>
                  Edit current
                </Button>
              )}
            </div>

            <label className="flex items-start gap-2 rounded-md border bg-muted/40 p-3">
              <Checkbox checked={applyAll} onCheckedChange={(v) => setApplyAll(Boolean(v))} className="mt-0.5" />
              <span className="text-sm">
                <span className="font-medium">Apply to all {row.masterCode}</span>
                <span className="block text-xs text-muted-foreground">
                  Use this photo for every {row.masterCode} across all door styles
                  {siblingCount.data ? ` (${siblingCount.data.count} products)` : ""}. Uncheck to
                  update only this one.
                </span>
              </span>
            </label>

            {/* Category / Sub-category quick-edit */}
            <div className="rounded-md border bg-muted/40 p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cabinet classification</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Category</label>
                  <select
                    className="h-8 w-full rounded-md border bg-background px-2 text-sm"
                    value={cat}
                    onChange={(e) => setCat(e.target.value)}
                  >
                    <option value="">— none —</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Sub-category</label>
                  <select
                    className="h-8 w-full rounded-md border bg-background px-2 text-sm"
                    value={subCat}
                    onChange={(e) => setSubCat(e.target.value)}
                  >
                    <option value="">— none —</option>
                    {subCategories.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              {(cat !== (row.category ?? "") || subCat !== (row.subCategory ?? "")) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs"
                  disabled={updateCabinet.isPending}
                  onClick={async () => {
                    await saveMetaIfChanged();
                    toast.success("Classification updated");
                  }}
                >
                  {updateCabinet.isPending ? "Saving…" : "Save classification"}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <ImageEditor
            file={file}
            existingUrl={file ? null : resolveImg(row)}
            onCancel={() => setStage("pick")}
            onSave={doSave}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Batch uploader (auto-match by filename) ─────────────────────────────────
function BatchUploader({ onDone }: { onDone: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const matchQ = trpc.skuImages.matchFilenames.useQuery(
    { filenames: files.map((f) => f.name) },
    { enabled: files.length > 0 },
  );
  const upload = trpc.skuImages.upload.useMutation();
  const setImage = trpc.skuImages.setImage.useMutation();
  const utils = trpc.useUtils();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const matched = matchQ.data?.matches ?? [];
  const unmatched = matchQ.data?.unmatched ?? [];

  const run = async () => {
    if (!matched.length) return;
    setRunning(true);
    setProgress(0);
    let done = 0;
    for (const m of matched) {
      const f = files.find((x) => x.name === m.filename);
      if (!f) continue;
      try {
        const dataUrl: string = await new Promise((res) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result as string);
          reader.readAsDataURL(f);
        });
        const { url } = await upload.mutateAsync({
          filename: m.filename,
          dataBase64: dataUrl,
          contentType: f.type || "image/jpeg",
        });
        // batch matches target a specific SKU; do not cascade
        await setImage.mutateAsync({ skuId: m.skuId, imageUrl: url, applyToAllCabinet: false });
      } catch {
        /* keep going */
      }
      done += 1;
      setProgress(Math.round((done / matched.length) * 100));
    }
    setRunning(false);
    toast.success(`Uploaded ${done} photo${done === 1 ? "" : "s"}`);
    utils.skuImages.list.invalidate();
    onDone();
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div>
          <h3 className="font-medium">Batch upload photos</h3>
          <p className="text-sm text-muted-foreground">
            Drop or select many photos. Files are auto-matched to products by SKU code (e.g.{" "}
            <code>CS-ASP-B21.jpg</code>) or by style + cabinet name in the file name. Anything that
            can't be matched is listed so nothing goes to the wrong product.
          </p>
        </div>
        <Input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
        {files.length > 0 && (
          <div className="space-y-2 text-sm">
            {matchQ.isFetching ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Spinner /> Matching {files.length} files…
              </div>
            ) : (
              <>
                <p>
                  <span className="font-medium text-green-600">{matched.length} matched</span>
                  {unmatched.length > 0 && (
                    <span className="ml-2 font-medium text-amber-600">
                      {unmatched.length} unmatched
                    </span>
                  )}
                </p>
                {unmatched.length > 0 && (
                  <div className="max-h-28 overflow-auto rounded border bg-muted/40 p-2 text-xs text-muted-foreground">
                    {unmatched.map((u) => (
                      <div key={u}>{u}</div>
                    ))}
                  </div>
                )}
              </>
            )}
            {running && <p className="text-xs text-muted-foreground">Uploading… {progress}%</p>}
            <Button onClick={run} disabled={!matched.length || running || matchQ.isFetching}>
              {running ? "Uploading…" : `Upload ${matched.length} matched photo${matched.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const PAGE_SIZE = 60;

// ─── Master-level edit dialog ────────────────────────────────────────────────
function MasterEditDialog({ row, onClose }: { row: MasterRow; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<"pick" | "edit">("pick");
  const fileInput = useRef<HTMLInputElement | null>(null);

  // Category / sub-category editing
  const [cat, setCat] = useState(row.category ?? "");
  const [subCat, setSubCat] = useState(row.subCategory ?? "");
  const metaQuery = trpc.genericCabinets.list.useQuery({ page: 0, pageSize: 1 }, { staleTime: 60_000 });
  const categories: string[] = (metaQuery.data?.categories ?? []) as string[];
  const subCategories: string[] = (metaQuery.data?.subCategories ?? []) as string[];
  const updateCabinet = trpc.genericCabinets.update.useMutation({
    onSuccess: () => { utils.skuImages.masterList.invalidate(); utils.genericCabinets.list.invalidate(); },
  });

  const upload = trpc.skuImages.upload.useMutation();
  const setMasterImage = trpc.skuImages.setMasterImage.useMutation({
    onSuccess: () => { utils.skuImages.masterList.invalidate(); },
  });

  const busy = upload.isPending || setMasterImage.isPending || updateCabinet.isPending;

  const doSave = async (dataUrl: string) => {
    try {
      const { url } = await upload.mutateAsync({
        filename: `${row.masterCode}.jpg`,
        dataBase64: dataUrl,
        contentType: "image/jpeg",
      });
      const res = await setMasterImage.mutateAsync({ cabinetId: row.cabinetId, imageUrl: url });
      toast.success(`Photo applied to ${res.updated} product${res.updated === 1 ? "" : "s"}`);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Could not save photo");
    }
  };

  const saveMetaIfChanged = async () => {
    const catChanged = cat !== (row.category ?? "");
    const subChanged = subCat !== (row.subCategory ?? "");
    if ((catChanged || subChanged) && row.cabinetId) {
      await updateCabinet.mutateAsync({
        id: row.cabinetId,
        ...(catChanged ? { category: cat } : {}),
        ...(subChanged ? { subCategory: subCat || null } : {}),
      });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{row.masterCode}</DialogTitle>
          <p className="text-xs text-muted-foreground">{row.description}</p>
        </DialogHeader>

        {busy ? (
          <div className="flex items-center justify-center py-10">
            <Spinner /> <span className="ml-2 text-sm">Saving…</span>
          </div>
        ) : stage === "pick" ? (
          <div className="space-y-4">
            <div className="mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-lg border bg-muted">
              {row.imageUrl ? (
                <img src={row.imageUrl} alt={row.masterCode} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-8 w-8" />
                </div>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setFile(f); setStage("edit"); }
              }}
            />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => fileInput.current?.click()}>
                <Upload className="mr-2 h-4 w-4" /> {row.imageUrl ? "Replace photo" : "Upload photo"}
              </Button>
              {row.imageUrl && (
                <Button variant="outline" onClick={() => setStage("edit")}>Edit current</Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              This photo will be applied to all {row.skuCount > 0 ? row.skuCount : ""} SKUs sharing this cabinet code.
            </p>

            {/* Category / Sub-category quick-edit */}
            <div className="rounded-md border bg-muted/40 p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cabinet classification</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Category</label>
                  <select
                    className="h-8 w-full rounded-md border bg-background px-2 text-sm"
                    value={cat}
                    onChange={(e) => setCat(e.target.value)}
                  >
                    <option value="">— none —</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Sub-category</label>
                  <select
                    className="h-8 w-full rounded-md border bg-background px-2 text-sm"
                    value={subCat}
                    onChange={(e) => setSubCat(e.target.value)}
                  >
                    <option value="">— none —</option>
                    {subCategories.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              {(cat !== (row.category ?? "") || subCat !== (row.subCategory ?? "")) && (
                <Button
                  size="sm" variant="outline" className="w-full text-xs"
                  disabled={updateCabinet.isPending}
                  onClick={async () => { await saveMetaIfChanged(); toast.success("Classification updated"); }}
                >
                  {updateCabinet.isPending ? "Saving…" : "Save classification"}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <ImageEditor
            file={file}
            existingUrl={file ? null : row.imageUrl}
            onCancel={() => setStage("pick")}
            onSave={doSave}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function SkuImageManager() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [editRow, setEditRow] = useState<MasterRow | null>(null);
  const [showBatch, setShowBatch] = useState(false);
  const [page, setPage] = useState(0);

  const CATEGORIES = ["Accessory", "Base", "Corners", "Panels & Fillers", "Tall", "Vanity", "Wall"];

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 0 whenever filters change
  useEffect(() => { setPage(0); }, [debounced, category, onlyMissing]);

  // Stabilize query input with useMemo so React Query correctly detects changes
  const queryInput = useMemo(
    () => ({ search: debounced || undefined, category, onlyMissing, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    [debounced, category, onlyMissing, page]
  );

  const list = trpc.skuImages.masterList.useQuery(queryInput);

  const items = (list.data?.items ?? []) as MasterRow[];

  // Group by category → subCategory
  const grouped = useMemo(() => {
    const catMap = new Map<string, Map<string, MasterRow[]>>();
    for (const r of items) {
      const cat = r.category || "Unassigned";
      const sub = r.subCategory || "General";
      if (!catMap.has(cat)) catMap.set(cat, new Map());
      const subMap = catMap.get(cat)!;
      if (!subMap.has(sub)) subMap.set(sub, []);
      subMap.get(sub)!.push(r);
    }
    const catOrder = ["Base", "Wall", "Tall", "Vanity", "Corners", "Panels & Fillers", "Accessory", "Unassigned"];
    const sortedCats = Array.from(catMap.entries()).sort(([a], [b]) => {
      const ai = catOrder.indexOf(a) === -1 ? 99 : catOrder.indexOf(a);
      const bi = catOrder.indexOf(b) === -1 ? 99 : catOrder.indexOf(b);
      return ai - bi;
    });
    const result: { cat: string; sub: string; rows: MasterRow[] }[] = [];
    for (const [cat, subMap] of sortedCats) {
      const sortedSubs = Array.from(subMap.entries()).sort(([a], [b]) => a.localeCompare(b));
      for (const [sub, rows] of sortedSubs) {
        result.push({ cat, sub, rows });
      }
    }
    return result;
  }, [items]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search master code or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={category ?? ""}
          onChange={(e) => setCategory(e.target.value || undefined)}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={onlyMissing} onCheckedChange={(v) => setOnlyMissing(Boolean(v))} />
          Needs photo
        </label>
        <Button variant={showBatch ? "default" : "outline"} onClick={() => setShowBatch((s) => !s)}>
          <Upload className="mr-2 h-4 w-4" /> Batch upload
        </Button>
      </div>

      {showBatch && <BatchUploader onDone={() => setShowBatch(false)} />}

      {list.isLoading ? (
        <div className="flex items-center gap-2 py-10 text-muted-foreground">
          <Spinner /> Loading products…
        </div>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">No products match.</p>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ cat, sub, rows }) => (
            <div key={`${cat}-${sub}`}>
              <div className="mb-3 border-b pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{cat}</span>
                <h3 className="text-sm font-semibold text-foreground">
                  {sub} <span className="font-normal text-xs text-muted-foreground">· {rows.length}</span>
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {rows.map((r: MasterRow) => (
                  <button
                    key={r.cabinetId}
                    onClick={() => setEditRow(r)}
                    className="group overflow-hidden rounded-lg border bg-card text-left transition hover:shadow-md"
                  >
                    <div className="relative aspect-square bg-muted">
                      {r.imageUrl ? (
                        <img src={r.imageUrl} alt={r.masterCode} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          <ImageIcon className="h-6 w-6" />
                        </div>
                      )}
                      {!r.imageUrl && (
                        <span className="absolute right-1 top-1 rounded bg-amber-500/90 px-1 text-[10px] font-medium text-white">
                          no photo
                        </span>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="truncate text-xs font-semibold">{r.masterCode}</p>
                      <p className="truncate text-[11px] text-muted-foreground leading-tight">{r.description}</p>
                      {r.skuCount > 0 && (
                        <p className="text-[10px] text-muted-foreground/60">{r.skuCount} SKUs</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {list.data && list.data.total > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t pt-4">
              <p className="text-xs text-muted-foreground">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, list.data.total)} of {list.data.total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => { setPage((p) => p - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                >
                  ← Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page + 1} of {Math.ceil(list.data.total / PAGE_SIZE)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(page + 1) * PAGE_SIZE >= list.data.total}
                  onClick={() => { setPage((p) => p + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                >
                  Next →
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {editRow && <MasterEditDialog row={editRow} onClose={() => setEditRow(null)} />}
    </div>
  );
}
