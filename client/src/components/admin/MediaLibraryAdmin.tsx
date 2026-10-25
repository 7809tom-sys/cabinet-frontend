import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { FolderOpen, Search, Copy, ExternalLink, Trash2, Upload, ImageIcon, Plus, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MediaPickerProps {
  /** When provided, renders as a picker (shows "Select" button per image). */
  onPick?: (url: string) => void;
  /** Currently selected URL — highlighted in picker mode. */
  selectedUrl?: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MediaLibraryAdmin({ onPick, selectedUrl }: MediaPickerProps) {
  const [search, setSearch]               = useState("");
  const [activeFolder, setActiveFolder]   = useState<string | undefined>(undefined);
  const [deleteId, setDeleteId]           = useState<number | null>(null);
  const [replaceId, setReplaceId]         = useState<number | null>(null);
  const [replacePreview, setReplacePreview] = useState<string | null>(null);
  const [replaceData, setReplaceData]     = useState<string | null>(null);
  const [replaceMime, setReplaceMime]     = useState("image/png");
  const replaceFileRef                    = useRef<HTMLInputElement>(null);
  const [uploadOpen, setUploadOpen]       = useState(false);
  const [uploadLabel, setUploadLabel]     = useState("");
  const [uploadFolder, setUploadFolder]   = useState("Cabinet Drawings");
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadData, setUploadData]       = useState<string | null>(null);
  const [uploadMime, setUploadMime]       = useState("image/png");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const utils = trpc.useUtils();

  const { data: foldersData } = trpc.mediaLibrary.folders.useQuery(undefined, {
    staleTime: 30_000,
  });
  const folders = foldersData ?? [];

  const { data, isLoading } = trpc.mediaLibrary.list.useQuery(
    { search: search || undefined, folder: activeFolder },
    { staleTime: 10_000 }
  );
  const images = data?.items ?? [];

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const uploadMutation = trpc.mediaLibrary.upload.useMutation({
    onSuccess: () => {
      toast.success("Image uploaded successfully");
      setUploadOpen(false);
      setUploadLabel("");
      setUploadPreview(null);
      setUploadData(null);
      utils.mediaLibrary.list.invalidate();
      utils.mediaLibrary.folders.invalidate();
    },
    onError: (e) => toast.error(`Upload failed: ${e.message}`),
  });

  const replaceMutation = trpc.mediaLibrary.replace.useMutation({
    onSuccess: () => {
      toast.success("Image replaced");
      setReplaceId(null);
      setReplacePreview(null);
      setReplaceData(null);
      utils.mediaLibrary.list.invalidate();
    },
    onError: (e) => toast.error(`Replace failed: ${e.message}`),
  });

  const deleteMutation = trpc.mediaLibrary.delete.useMutation({
    onSuccess: () => {
      toast.success("Image deleted");
      setDeleteId(null);
      utils.mediaLibrary.list.invalidate();
      utils.mediaLibrary.folders.invalidate();
    },
    onError: (e) => toast.error(`Delete failed: ${e.message}`),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadMime(file.type || "image/png");
    if (!uploadLabel) setUploadLabel(file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " "));
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setUploadPreview(result);
      setUploadData(result);
    };
    reader.readAsDataURL(file);
  }

  function handleUploadSubmit() {
    if (!uploadData || !uploadLabel.trim()) {
      toast.error("Please select a file and enter a label");
      return;
    }
    uploadMutation.mutate({
      label:       uploadLabel.trim(),
      folder:      uploadFolder.trim() || "General",
      dataBase64:  uploadData,
      contentType: uploadMime,
    });
  }

  function handleReplaceFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setReplaceMime(file.type || "image/png");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setReplacePreview(result);
      setReplaceData(result);
    };
    reader.readAsDataURL(file);
  }

  function handleReplaceSubmit() {
    if (!replaceData || replaceId === null) {
      toast.error("Please select a replacement file");
      return;
    }
    replaceMutation.mutate({ id: replaceId, dataBase64: replaceData, contentType: replaceMime });
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url).then(() => toast.success("URL copied"));
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold">Media Library</h2>
          <Badge variant="secondary">{data?.total ?? 0} images</Badge>
        </div>
        <Button size="sm" onClick={() => setUploadOpen(true)} className="gap-1.5">
          <Upload className="h-4 w-4" />
          Upload Image
        </Button>
      </div>

      {/* Folder tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveFolder(undefined)}
          className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
            activeFolder === undefined
              ? "bg-amber-500 text-white border-amber-500"
              : "bg-transparent text-muted-foreground border-border hover:border-amber-400"
          }`}
        >
          All
        </button>
        {folders.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFolder(f === activeFolder ? undefined : f)}
            className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
              activeFolder === f
                ? "bg-amber-500 text-white border-amber-500"
                : "bg-transparent text-muted-foreground border-border hover:border-amber-400"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search images…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <ImageIcon className="h-12 w-12 opacity-30" />
          <p className="text-sm">No images found</p>
          <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Upload your first image
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {images.map((img) => {
            const isSelected = img.url === selectedUrl;
            return (
              <Card
                key={img.id}
                className={`group relative overflow-hidden cursor-default transition-all ${
                  isSelected ? "ring-2 ring-amber-500" : "hover:ring-1 hover:ring-amber-300"
                }`}
              >
                <div className="aspect-square bg-white flex items-center justify-center p-2">
                  <img
                    src={img.url}
                    alt={img.label}
                    className="max-h-full max-w-full object-contain"
                    loading="lazy"
                  />
                </div>
                <CardContent className="p-2 space-y-1">
                  <p className="text-xs font-medium truncate" title={img.label}>{img.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{img.folder}</p>
                </CardContent>

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                  {onPick ? (
                    <Button
                      size="sm"
                      className={`w-full text-xs ${isSelected ? "bg-amber-500 hover:bg-amber-600" : ""}`}
                      onClick={() => onPick(img.url)}
                    >
                      {isSelected ? "✓ Selected" : "Select"}
                    </Button>
                  ) : null}
                  <div className="flex gap-1.5">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7"
                      title="Copy URL"
                      onClick={() => copyUrl(img.url)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7"
                      title="Open in new tab"
                      onClick={() => window.open(img.url, "_blank")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7"
                      title="Replace image file"
                      onClick={() => { setReplaceId(img.id); setReplacePreview(null); setReplaceData(null); }}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-7 w-7"
                      title="Delete"
                      onClick={() => setDeleteId(img.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 bg-amber-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                    ✓
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Image</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* File picker */}
            <div
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-amber-400 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadPreview ? (
                <img src={uploadPreview} alt="preview" className="max-h-40 mx-auto object-contain rounded" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="h-8 w-8 opacity-40" />
                  <p className="text-sm">Click to select an image</p>
                  <p className="text-xs">PNG, JPG, WebP, SVG</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Label */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Label</label>
              <Input
                placeholder="e.g. Base – Single Door / Drawer"
                value={uploadLabel}
                onChange={(e) => setUploadLabel(e.target.value)}
              />
            </div>

            {/* Folder */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Folder</label>
              <Input
                placeholder="e.g. Cabinet Drawings"
                value={uploadFolder}
                onChange={(e) => setUploadFolder(e.target.value)}
                list="folder-suggestions"
              />
              <datalist id="folder-suggestions">
                {folders.map((f) => <option key={f} value={f} />)}
                <option value="Cabinet Drawings" />
                <option value="General" />
              </datalist>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button
              onClick={handleUploadSubmit}
              disabled={uploadMutation.isPending || !uploadData}
            >
              {uploadMutation.isPending ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Replace Dialog */}
      <Dialog open={replaceId !== null} onOpenChange={(o) => { if (!o) { setReplaceId(null); setReplacePreview(null); setReplaceData(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Replace Image</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Upload a new file to replace this image. The URL stays the same — all cabinets using it will automatically show the new image.</p>
            <div
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-amber-400 transition-colors"
              onClick={() => replaceFileRef.current?.click()}
            >
              {replacePreview ? (
                <img src={replacePreview} alt="preview" className="max-h-40 mx-auto object-contain rounded" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <RefreshCw className="h-8 w-8 opacity-40" />
                  <p className="text-sm">Click to select replacement image</p>
                  <p className="text-xs">PNG, JPG, WebP, SVG</p>
                </div>
              )}
              <input
                ref={replaceFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleReplaceFileChange}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplaceId(null)}>Cancel</Button>
            <Button
              onClick={handleReplaceSubmit}
              disabled={replaceMutation.isPending || !replaceData}
            >
              {replaceMutation.isPending ? "Replacing…" : "Replace Image"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Image?</AlertDialogTitle>
              <AlertDialogDescription>
              This removes only the Media Library record. Images still used by a cabinet, catalog item, saved design, or other stored content are protected and cannot be deleted.
              </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteId !== null && deleteMutation.mutate({ id: deleteId })}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
