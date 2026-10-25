/**
 * MediaPicker — shared image picker for admin panels.
 *
 * Usage:
 *   <MediaPicker
 *     value={imageUrl}
 *     onChange={(url) => setImageUrl(url)}
 *     label="Room Scene Image"
 *   />
 *
 * The picker opens a dialog with:
 *   - A grid of existing media library images (click to select)
 *   - An upload button to add a new image (auto-added to library)
 *   - Search filter
 */

import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ImageIcon, Upload, X, Check, Search, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 60;

interface MediaPickerProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

export function MediaPicker({ value, onChange, label, placeholder, className }: MediaPickerProps) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  // fileRef: hidden input for "Upload New" button (outside dialog)
  const fileRef = useRef<HTMLInputElement>(null);
  // fileRef2: hidden input for "Upload & Select" button (inside dialog)
  const fileRef2 = useRef<HTMLInputElement>(null);

  const { data, isLoading, refetch } = trpc.mediaLibrary.list.useQuery(
    { page, limit: PAGE_SIZE, search: search || undefined },
    { enabled: open }
  );

  const uploadMut = trpc.mediaLibrary.upload.useMutation();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleSearch = useCallback(() => {
    setSearch(searchInput);
    setPage(0);
  }, [searchInput]);

  const handleSelect = (url: string) => {
    onChange(url);
    setOpen(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataBase64 = reader.result as string;
        const { url } = await uploadMut.mutateAsync({
          label: file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " "),
          dataBase64,
          contentType: file.type || "image/jpeg",
        });
        toast.success("Image uploaded to library");
        onChange(url);
        setOpen(false);
        refetch();
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (fileRef2.current) fileRef2.current.value = "";
    }
  };

  return (
    <div className={className}>
      {label && <Label className="mb-1.5 block text-sm">{label}</Label>}

      {/* Current value preview */}
      <div className="flex items-start gap-2">
        <div className="relative shrink-0">
          {value ? (
            <div className="w-20 h-20 rounded-lg border border-border overflow-hidden bg-muted/30">
              <img
                src={value}
                alt="Selected"
                className="h-full w-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-lg border border-dashed border-border bg-muted/20 flex flex-col items-center justify-center gap-1">
              <ImageIcon className="w-5 h-5 text-muted-foreground" />
              <span className="text-[9px] text-muted-foreground">No image</span>
            </div>
          )}
          {value && (
            <button
              onClick={() => onChange("")}
              className="absolute -top-1.5 -right-1.5 rounded-full bg-background border border-border p-0.5 text-muted-foreground hover:text-destructive transition-colors shadow-sm"
              title="Clear image"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder ?? "/manus-storage/... or https://..."}
            className="text-xs font-mono h-8"
          />
          <div className="flex gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => setOpen(true)}
            >
              <ImageIcon className="w-3 h-3" />
              Browse Library
            </Button>
            {/* Hidden file input for "Upload New" (outside dialog) */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleUpload}
              disabled={uploading}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? <Spinner className="w-3 h-3" /> : <Upload className="w-3 h-3" />}
              Upload New
            </Button>
          </div>
        </div>
      </div>

      {/* Library Dialog */}
	      <Dialog open={open} onOpenChange={setOpen}>
	        <DialogContent className="!flex h-[min(88dvh,44rem)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-4xl flex-col overflow-hidden p-4 sm:h-[min(88dvh,44rem)] sm:w-[min(56rem,calc(100vw-2rem))] sm:max-w-none sm:p-6">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-muted-foreground" />
              Media Library
              <Badge variant="secondary" className="text-xs font-normal ml-1">{total} images</Badge>
            </DialogTitle>
          </DialogHeader>

          {/* Search + Upload */}
	          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
	            <div className="flex min-w-0 flex-1 gap-1.5">
              <Input
                placeholder="Search by filename…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
	              className="h-9 min-w-0 text-sm"
              />
	              <Button size="sm" variant="outline" className="h-9 shrink-0 gap-1.5" onClick={handleSearch}>
                <Search className="w-3.5 h-3.5" />
                Search
              </Button>
            </div>
            {/* Hidden file input for "Upload & Select" (inside dialog) */}
            <input
              ref={fileRef2}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleUpload}
              disabled={uploading}
            />
            <Button
              type="button"
              variant="default"
              size="sm"
	              className="h-9 w-full shrink-0 gap-1.5 sm:w-auto"
              disabled={uploading}
              onClick={() => fileRef2.current?.click()}
            >
              {uploading ? <Spinner className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
              {uploading ? "Uploading…" : "Upload & Select"}
            </Button>
          </div>

          {/* Image grid */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Spinner className="w-6 h-6" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                <ImageIcon className="w-10 h-10 opacity-30" />
                <p className="text-sm">
                  {search ? "No images match your search" : "No images in library yet — upload one above"}
                </p>
              </div>
            ) : (
	              <div className="grid grid-cols-2 gap-2 p-1 min-[420px]:grid-cols-3 sm:grid-cols-5 md:grid-cols-6">
                {items.map((item) => {
                  const isSelected = value === item.url;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item.url)}
                      className={`relative group rounded-lg overflow-hidden border-2 transition-all aspect-square bg-muted/30 hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary ${
                        isSelected ? "border-primary ring-2 ring-primary" : "border-transparent"
                      }`}
                      title={item.label ?? item.url}
                    >
                      <img
                        src={item.url}
                        alt={item.label ?? ""}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          const t = e.target as HTMLImageElement;
                          t.style.display = "none";
                          t.parentElement!.classList.add("bg-muted/50");
                        }}
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <Check className="w-5 h-5 text-primary drop-shadow" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-[9px] text-white truncate opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.label ?? item.url.split("/").pop()}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm shrink-0 border-t border-border pt-3">
              <span className="text-muted-foreground text-xs">
                Page {page + 1} of {totalPages} ({total} total)
              </span>
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

	          <DialogFooter className="shrink-0 border-t border-border pt-2">
	            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
