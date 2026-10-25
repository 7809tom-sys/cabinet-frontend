import { useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import {
  Upload,
  Camera,
  ScanLine,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ImageIcon,
  ShoppingCart,
  FileText,
} from "lucide-react";
import { CsvImportDialog } from "@/components/design/CsvImportDialog";
import { buildPhotoCartItems } from "@/lib/photoToCartItems";

type MatchRow = {
  rawCode: string;
  quantity: number;
  matched: boolean;
  confidence: "exact" | "normalized" | "fuzzy" | "none";
  cabinetId: number | null;
  masterCode: string | null;
  description: string | null;
  category: string | null;
  candidates: string[];
};

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const MAX_SCAN_EDGE = 2200;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

async function prepareScanImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file (photo or scan).");
  }
  if (file.size <= MAX_BYTES) return readFileAsDataUrl(file);

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("This photo could not be prepared for scanning."));
      img.src = objectUrl;
    });
    const scale = Math.min(1, MAX_SCAN_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare the image.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const prepared = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    if (!prepared || prepared.size > MAX_BYTES) {
      throw new Error("Image is still too large. Crop it to the cabinet list and try again.");
    }
    return readFileAsDataUrl(new File([prepared], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" }));
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function PhotoToCart() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { addItem, lockedDistributorId, clear } = useCart();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [rows, setRows] = useState<MatchRow[] | null>(null);
  const [styleId, setStyleId] = useState<string>("");
  const [tier, setTier] = useState<"wholesale" | "contractor">("contractor");
  const [csvImportOpen, setCsvImportOpen] = useState(false);

  const stylesQuery = trpc.doorStyles.list.useQuery(undefined);
  const styleOptions = useMemo(
    () =>
      (stylesQuery.data ?? []).map((s: any) => ({
        id: s.id as number,
        label: [s.ourName, s.doorStyle, s.color].filter(Boolean).join(" · "),
      })),
    [stylesQuery.data],
  );

  const extractMut = trpc.ocr.extractFromImage.useMutation({
    onSuccess: (res) => {
      setRows(res.matches as MatchRow[]);
      const { matched, unmatched } = res.summary;
      if (matched === 0) {
        toast.error("No cabinet codes recognized", {
          description: "Try a clearer photo or a typed list.",
        });
      } else {
        toast.success(`Read ${matched} item${matched === 1 ? "" : "s"}`, {
          description: unmatched > 0 ? `${unmatched} need your review` : "All matched to the catalog",
        });
      }
    },
    onError: (err) => {
      toast.error("Couldn't read the image", { description: err.message });
    },
  });

  async function onPick(file: File | undefined) {
    if (!file) return;
    try {
      const url = await prepareScanImage(file);
      setPreview(url);
      setDataUrl(url);
      setFilename(file.name);
      setRows(null);
    } catch (error) {
      toast.error("Photo could not be prepared", {
        description: error instanceof Error ? error.message : "Choose another photo and try again.",
      });
    }
  }

  function runExtraction() {
    if (!dataUrl) return;
    extractMut.mutate({ imageDataUrl: dataUrl, filename: filename || undefined });
  }

  function updateQty(idx: number, qty: number) {
    setRows((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], quantity: Math.max(1, Math.floor(qty || 1)) };
      return next;
    });
  }

  function removeRow(idx: number) {
    setRows((prev) => (prev ? prev.filter((_, i) => i !== idx) : prev));
  }

  const matched = rows?.filter((r) => r.matched) ?? [];
  const unmatched = rows?.filter((r) => !r.matched) ?? [];
  const selectedStyle = styleOptions.find((s) => String(s.id) === styleId);

  function addAllToCart() {
    if (!selectedStyle) {
      toast.error("Choose a door style first", {
        description: "All items in one order share a single door style.",
      });
      return;
    }
    if (matched.length === 0) {
      toast.error("Nothing matched to add yet.");
      return;
    }
    // Supplier-lock: colors/styles mix freely, but the cart must stay within one
    // supplier. Photo-to-Cart lines carry distributorId = null (unresolved at
    // OCR time), so they're never blocked by the distributor lock; however if
    // the cart already holds items from a known supplier we still surface a
    // clear-and-restart option so the user can choose a clean slate.
    const cartItems = buildPhotoCartItems(matched, selectedStyle, tier);
    if (cartItems.length === 0) {
      toast.error("Nothing matched to add yet.");
      return;
    }
    if (lockedDistributorId != null) {
      toast.warning(`Your cart already has items`, {
        description: `Clear the cart to start a new order with ${selectedStyle.label}, or keep adding to the current one?`,
        action: {
          label: "Clear cart & add",
          onClick: () => {
            clear();
            setTimeout(() => {
              for (const item of cartItems) addItem(item);
              toast.success(`Added ${matched.length} item${matched.length === 1 ? "" : "s"} to cart`, {
                description: `Door style: ${selectedStyle.label}`,
              });
              navigate("/cart");
            }, 0);
          },
        },
      });
      return;
    }
    for (const item of cartItems) addItem(item);
    toast.success(`Added ${matched.length} item${matched.length === 1 ? "" : "s"} to cart`, {
      description: `Door style: ${selectedStyle.label}`,
    });
    navigate("/cart");
  }

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="container max-w-2xl py-16 text-center">
        <ScanLine className="h-12 w-12 mx-auto mb-4 text-primary" />
        <h1 className="font-serif text-3xl font-bold mb-2">Photo to Cart</h1>
        <p className="text-muted-foreground mb-6">
          Sign in to upload a cabinet list or floor plan and let us build your cart automatically.
        </p>
        <Button onClick={() => (window.location.href = getLoginUrl())}>Sign in to continue</Button>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold flex items-center gap-2">
            <ScanLine className="h-7 w-7 text-primary" />
            Photo to Cart
          </h1>
          <p className="text-muted-foreground mt-1">
            Upload a photo or scan of your cabinet list, quote, or floor plan. We'll read the cabinet
            codes and build your cart for review.
          </p>
        </div>
        <button
          onClick={() => setCsvImportOpen(true)}
          className="shrink-0 flex items-center gap-2 rounded-lg border border-[#d4a75a]/60 bg-[#d4a75a]/10 px-3 py-2 text-sm font-semibold text-[#1a2744] hover:bg-[#d4a75a]/20 transition-colors"
        >
          <FileText className="h-4 w-4" />
          Import from 2020 Design (CSV)
        </button>
      </div>
      <CsvImportDialog open={csvImportOpen} onOpenChange={setCsvImportOpen} />

      {/* Upload */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">1. Upload your list</CardTitle>
        </CardHeader>
        <CardContent>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              onPick(e.target.files?.[0]);
              e.currentTarget.value = "";
            }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              onPick(e.target.files?.[0]);
              e.currentTarget.value = "";
            }}
          />
          {!preview ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="rounded-xl border-2 border-primary/50 bg-primary/5 px-5 py-10 flex flex-col items-center justify-center gap-3 text-primary hover:border-primary hover:bg-primary/10 transition-colors"
              >
                <Camera className="h-9 w-9" />
                <span className="font-semibold">Take photo / Scan now</span>
                <span className="text-xs text-muted-foreground">Use your phone camera for a handwritten list</span>
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-xl border-2 border-dashed border-border px-5 py-10 flex flex-col items-center justify-center gap-3 hover:border-primary/60 hover:bg-muted/40 transition-colors"
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="font-semibold">Choose saved photo</span>
                <span className="text-xs text-muted-foreground">JPG, PNG, or a phone screenshot</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden border bg-muted/30">
                <img src={preview} alt="Uploaded list" className="max-h-80 w-full object-contain" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => cameraRef.current?.click()}>
                  <Camera className="h-4 w-4 mr-1.5" /> Take another photo
                </Button>
                <Button variant="outline" onClick={() => fileRef.current?.click()}>
                  <ImageIcon className="h-4 w-4 mr-1.5" /> Choose another
                </Button>
                <Button onClick={runExtraction} disabled={extractMut.isPending}>
                  {extractMut.isPending ? (
                    <>
                      <Spinner className="h-4 w-4 mr-1.5" /> Reading…
                    </>
                  ) : (
                    <>
                      <ScanLine className="h-4 w-4 mr-1.5" /> Read cabinet codes
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {rows && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>2. Review what we found</span>
              <span className="text-sm font-normal text-muted-foreground">
                {matched.length} matched · {unmatched.length} to review
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {matched.length > 0 && (
              <div className="space-y-2">
                {matched.map((r, i) => {
                  const idx = rows.indexOf(r);
                  return (
                    <div
                      key={`${r.masterCode}-${i}`}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">
                          {r.masterCode}{" "}
                          {r.confidence === "fuzzy" && (
                            <Badge variant="outline" className="ml-1 text-xs">
                              best guess
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {r.description} · {r.category}
                        </div>
                      </div>
                      <Input
                        type="number"
                        min={1}
                        value={r.quantity}
                        onChange={(e) => updateQty(idx, Number(e.target.value))}
                        className="w-20"
                        aria-label={`Quantity for ${r.masterCode}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(idx)}
                        aria-label={`Remove ${r.masterCode}`}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {unmatched.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                  Couldn't match these — check the code or add manually later
                </div>
                {unmatched.map((r, i) => (
                  <div
                    key={`${r.rawCode}-${i}`}
                    className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3"
                  >
                    <span className="font-mono text-sm">{r.rawCode}</span>
                    {r.candidates.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        Did you mean: {r.candidates.join(", ")}?
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-auto"
                      onClick={() => removeRow(rows.indexOf(r))}
                      aria-label={`Dismiss ${r.rawCode}`}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {matched.length === 0 && unmatched.length === 0 && (
              <p className="text-sm text-muted-foreground">No items. Try a clearer image.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Style + add */}
      {rows && matched.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">3. Pick a door style &amp; add to cart</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Every order ships in one door style. Choose the style for this list — pricing is
              confirmed on your quote.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <Select value={styleId} onValueChange={setStyleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a door style" />
                </SelectTrigger>
                <SelectContent>
                  {styleOptions.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={tier} onValueChange={(v) => setTier(v as "wholesale" | "contractor")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contractor">Contractor pricing</SelectItem>
                  <SelectItem value="wholesale">Wholesale pricing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="lg" onClick={addAllToCart} disabled={!selectedStyle}>
              <ShoppingCart className="h-4 w-4 mr-2" />
              Add {matched.length} item{matched.length === 1 ? "" : "s"} to cart
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
