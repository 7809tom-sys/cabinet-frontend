import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Camera, FileSpreadsheet, Keyboard, Loader2, Upload, ImageIcon, X, Barcode,
} from "lucide-react";
import { OrderReview, type ReviewLine } from "@/components/order/OrderReview";
import { BarcodeScanTab } from "@/components/order/BarcodeScanTab";
import { cartPrefillStorageKey } from "@/pages/Cart";
import { useLanguage } from "@/contexts/LanguageContext";
import { applyCartCheckoutPrefill, type CartCheckoutPrefillItem } from "@/lib/cartCheckoutPrefill";
import { resolveStoreScope } from "@/lib/affiliateContext";

type Source = "ocr" | "csv" | "manual" | "barcode";

// Read a File into a base64 data URL the vision model can ingest directly.
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function OrderBuilder() {
  const { t } = useLanguage();
	const storeScope = resolveStoreScope({
	  pathname: typeof window !== "undefined" ? window.location.pathname : "/order/new",
	  search: typeof window !== "undefined" ? window.location.search : "",
	  hostname: typeof window !== "undefined" ? window.location.hostname : "",
	});
  const [lines, setLines] = useState<ReviewLine[]>([]);
  const [source, setSource] = useState<Source>("ocr");
  const matchCodes = trpc.orders.matchCodes.useMutation();
  const prefillConsumed = useRef(false);
  const [initialStyleId, setInitialStyleId] = useState<number | null>(null);
  const [initialTier, setInitialTier] = useState<string | null>(null);
  const [kitchenDesignId, setKitchenDesignId] = useState<number | null>(null);
  const [carrierPreference, setCarrierPreference] = useState<"ups" | null>(null);

  // If the user arrived from the cart ("Request this order"), pick up the
  // prefilled {code, qty} pairs, match them, and drop straight into review.
  useEffect(() => {
    if (prefillConsumed.current) return;
    prefillConsumed.current = true;
    let raw: string | null = null;
    try {
	  const prefillKey = cartPrefillStorageKey(storeScope);
	  raw = sessionStorage.getItem(prefillKey);
	  if (raw) sessionStorage.removeItem(prefillKey);
    } catch {
      return;
    }
    if (!raw) return;
    let parsed: CartCheckoutPrefillItem[] = [];
    try {
      const decoded = JSON.parse(raw) as
        | { items: CartCheckoutPrefillItem[]; styleId: number | null; tier: string | null; kitchenDesignId?: number | null; carrierPreference?: "ups" | null }
        | CartCheckoutPrefillItem[]; // legacy format
      if (Array.isArray(decoded)) {
        parsed = decoded;
      } else {
        parsed = decoded.items;
        if (decoded.styleId) setInitialStyleId(decoded.styleId);
        if (decoded.tier) setInitialTier(decoded.tier);
        if (Number.isInteger(decoded.kitchenDesignId) && decoded.kitchenDesignId! > 0) setKitchenDesignId(decoded.kitchenDesignId!);
        if (decoded.carrierPreference === "ups") setCarrierPreference("ups");
      }
    } catch {
      return;
    }
    const items = parsed.filter((p) => p.code && p.qty > 0);
    if (items.length === 0) return;
    matchCodes.mutate(
      { items },
      {
        onSuccess: (result) => {
          setSource("manual");
          const checkoutLines = result.lines.map((line, index) => {
            const cartLine = items[index];
            return cartLine ? applyCartCheckoutPrefill(line, cartLine) : line;
          });
          setLines(checkoutLines);
          const recognizedCount = checkoutLines.filter((line) => line.matched).length;
          toast.success(t("ob_loaded_from_cart", { n: checkoutLines.length, s: checkoutLines.length > 1 ? "s" : "" }), {
            description: t("ob_matched_review", { m: recognizedCount, u: checkoutLines.length - recognizedCount }),
          });
          setTimeout(() => document.getElementById("order-review")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
        },
        onError: () => toast.error(t("ob_cart_load_err")),
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function ingest(result: { lines: ReviewLine[]; matchedCount: number; unmatchedCount: number }, src: Source) {
    if (result.lines.length === 0) {
      toast.error(t("ob_no_codes"));
      return;
    }
    setSource(src);
    setLines(result.lines);
    toast.success(t("ob_found_lines", { n: result.lines.length, s: result.lines.length > 1 ? "s" : "" }), {
      description: t("ob_matched_review", { m: result.matchedCount, u: result.unmatchedCount }),
    });
    // Smooth scroll to the review section.
    setTimeout(() => document.getElementById("order-review")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }

  const hasLines = lines.length > 0;

  return (
    <div className="container py-10 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground">{t("ob_title")}</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          {t("ob_sub")}
        </p>
      </div>

      {!hasLines && (
        <Tabs value={source} onValueChange={(v) => setSource(v as Source)} className="mb-2">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
            <TabsTrigger value="ocr" className="flex-col gap-1 py-3">
              <Camera className="h-4 w-4" /> {t("ob_tab_scan")}
            </TabsTrigger>
            <TabsTrigger value="barcode" className="flex-col gap-1 py-3">
              <Barcode className="h-4 w-4" /> {t("ob_tab_barcode")}
            </TabsTrigger>
            <TabsTrigger value="csv" className="flex-col gap-1 py-3">
              <FileSpreadsheet className="h-4 w-4" /> {t("ob_tab_csv")}
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex-col gap-1 py-3">
              <Keyboard className="h-4 w-4" /> {t("ob_tab_manual")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ocr" className="mt-6">
            <ScanTab onResult={(r) => ingest(r, "ocr")} />
          </TabsContent>
          <TabsContent value="barcode" className="mt-6">
            <BarcodeScanTab onResult={(r) => ingest(r as { lines: ReviewLine[]; matchedCount: number; unmatchedCount: number }, "barcode")} />
          </TabsContent>
          <TabsContent value="csv" className="mt-6">
            <CsvTab onResult={(r) => ingest(r, "csv")} />
          </TabsContent>
          <TabsContent value="manual" className="mt-6">
            <ManualTab onResult={(r) => ingest(r, "manual")} />
          </TabsContent>
        </Tabs>
      )}

      <div id="order-review" className="scroll-mt-20">
        {hasLines && (
          <OrderReview
            lines={lines}
            source={source}
            onLinesChange={setLines}
            onReset={() => setLines([])}
            initialStyleId={initialStyleId ?? undefined}
            kitchenDesignId={kitchenDesignId ?? undefined}
            initialTier={initialTier ?? undefined}
            carrierPreference={carrierPreference ?? undefined}
          />
        )}
      </div>
    </div>
  );
}

type ResultPayload = { lines: ReviewLine[]; matchedCount: number; unmatchedCount: number };

// ─── Scan a Photo (OCR) ─────────────────────────────────────────────────────────
function ScanTab({ onResult }: { onResult: (r: ResultPayload) => void }) {
  const { t } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  const extract = trpc.orders.extractFromImage.useMutation({
    onSuccess: (r) => onResult(r as ResultPayload),
    onError: (e) => toast.error(t("ob_img_read_err"), { description: e.message }),
  });

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("ob_choose_image_err"));
      return;
    }
    const url = await fileToDataUrl(file);
    setDataUrl(url);
    setPreview(url);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {!preview ? (
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border py-14 text-center hover:border-[var(--color-gold)] hover:bg-muted/40 transition-colors"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-navy)]/10">
            <Camera className="h-6 w-6 text-[var(--color-navy)]" />
          </div>
          <div>
            <p className="font-medium">{t("ob_take_upload")}</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("ob_take_upload_sub")}
            </p>
          </div>
        </button>
      ) : (
        <div className="space-y-4">
          <div className="relative rounded-lg overflow-hidden border border-border">
            <img src={preview} alt={t("ob_img_alt")} className="w-full max-h-80 object-contain bg-muted" />
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8"
              onClick={() => { setPreview(null); setDataUrl(null); }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => dataUrl && extract.mutate({ imageUrl: dataUrl })}
              disabled={extract.isPending || !dataUrl}
              className="bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy)]/90 gap-2"
            >
              {extract.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
              {extract.isPending ? t("ob_reading_codes") : t("ob_extract_codes")}
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
              <Upload className="h-4 w-4" /> {t("ob_choose_diff_photo")}
            </Button>
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-4">
        {t("ob_scan_tip")}
      </p>
    </div>
  );
}

// ─── Import CSV ──────────────────────────────────────────────────────────────────
function CsvTab({ onResult }: { onResult: (r: ResultPayload) => void }) {
  const { t } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState("");

  const extract = trpc.orders.extractFromCsv.useMutation({
    onSuccess: (r) => onResult(r as ResultPayload),
    onError: (e) => toast.error(t("ob_csv_read_err"), { description: e.message }),
  });

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    setCsv(text);
    toast.success(t("ob_loaded_file", { name: file.name }));
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />

      <div className="flex flex-col sm:flex-row gap-3">
        <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
          <Upload className="h-4 w-4" /> {t("ob_upload_csv")}
        </Button>
        <span className="text-sm text-muted-foreground self-center">{t("ob_or_paste")}</span>
      </div>

      <div className="space-y-1.5">
        <Textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={8}
          className="font-mono text-sm"
          placeholder={"code,qty\nB-24,2\nW-30-30,4\nDB-24-3,1\nSB-36,1"}
        />
        <p className="text-xs text-muted-foreground">
          {t("ob_csv_hint")}
        </p>
      </div>

      <Button
        onClick={() => extract.mutate({ csv })}
        disabled={extract.isPending || csv.trim().length === 0}
        className="bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy)]/90 gap-2"
      >
        {extract.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
        {extract.isPending ? t("ob_matching_codes") : t("ob_match_codes")}
      </Button>
    </div>
  );
}

// ─── Type Codes (manual) ──────────────────────────────────────────────────────────
function ManualTab({ onResult }: { onResult: (r: ResultPayload) => void }) {
  const { t } = useLanguage();
  const [text, setText] = useState("");

  const match = trpc.orders.matchCodes.useMutation({
    onSuccess: (r) => onResult(r as ResultPayload),
    onError: (e) => toast.error(t("ob_match_err"), { description: e.message }),
  });

  // Parse "CODE xN", "CODE, N", or "CODE" per line.
  function parse(): { code: string; qty: number }[] {
    return text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        // Accept "B24 x2", "B24, 2", "B24  2", "2x B24"
        let code = line;
        let qty = 1;
        const xMatch = line.match(/^(.+?)[\s,]*[x×]\s*(\d+)$/i) || line.match(/^(.+?)[\s,]+(\d+)$/);
        const leadingMatch = line.match(/^(\d+)\s*[x×]\s*(.+)$/i);
        if (xMatch) {
          code = xMatch[1].trim();
          qty = parseInt(xMatch[2], 10) || 1;
        } else if (leadingMatch) {
          qty = parseInt(leadingMatch[1], 10) || 1;
          code = leadingMatch[2].trim();
        }
        return { code, qty: Math.max(1, qty) };
      })
      .filter((r) => r.code.length > 0);
  }

  const parsedCount = parse().length;

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="space-y-1.5">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="font-mono text-sm"
          placeholder={"B24 x2\nW3030 x4\nDB24-3\nSB36"}
        />
        <p className="text-xs text-muted-foreground">
          {t("ob_manual_hint_a")} <code>B24 x2</code> {t("ob_manual_hint_b")} <code>B24, 2</code>{t("ob_manual_hint_c")}
        </p>
      </div>
      <Button
        onClick={() => match.mutate({ items: parse() })}
        disabled={match.isPending || parsedCount === 0}
        className="bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy)]/90 gap-2"
      >
        {match.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Keyboard className="h-4 w-4" />}
        {match.isPending ? t("ob_matching") : t("ob_match_n", { n: parsedCount || "", s: parsedCount === 1 ? "" : "s" })}
      </Button>
    </div>
  );
}
