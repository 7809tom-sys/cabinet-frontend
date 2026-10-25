/**
 * CsvImportDialog — lets a customer import a 2020 Design (or any BOM) CSV/TSV
 * parts list and add matched cabinets to the cart.
 *
 * Flow:
 *   1. User drops or picks a .csv / .txt / .tsv file
 *   2. Client reads it as text and sends to trpc.ocr.parseCSV
 *   3. Server matches codes against the live catalog
 *   4. Dialog shows matched / unmatched rows with a review table
 *   5. User picks a door style, then clicks "Add to Cart"
 */
import { useRef, useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ShoppingCart,
  X,
  Info,
} from "lucide-react";
import { useLocation } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MAX_BYTES = 500 * 1024; // 500KB — CSV files are tiny

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsText(file);
  });
}

const CONFIDENCE_BADGE: Record<MatchRow["confidence"], { label: string; className: string }> = {
  exact: { label: "Exact", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  normalized: { label: "Matched", className: "bg-blue-100 text-blue-800 border-blue-200" },
  fuzzy: { label: "Fuzzy", className: "bg-amber-100 text-amber-800 border-amber-200" },
  none: { label: "No match", className: "bg-red-100 text-red-800 border-red-200" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function CsvImportDialog({ open, onOpenChange }: Props) {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { addItem, lockedDistributorId, clear } = useCart();
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const [rows, setRows] = useState<MatchRow[] | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [styleId, setStyleId] = useState<string>("");
  const [tier, setTier] = useState<"wholesale" | "contractor" | "homeowner">("contractor");
  const [isDragging, setIsDragging] = useState(false);

  const stylesQuery = trpc.doorStyles.list.useQuery(undefined, { enabled: open });
  const styleOptions = useMemo(
    () =>
      (stylesQuery.data ?? []).map((s: any) => ({
        id: s.id as number,
        label: [s.ourName, s.doorStyle, s.color].filter(Boolean).join(" · "),
      })),
    [stylesQuery.data],
  );

  const parseMut = trpc.ocr.parseCSV.useMutation({
    onSuccess: (res) => {
      setRows(res.matches as MatchRow[]);
      const { matched, unmatched } = res.summary;
      if (matched === 0) {
        toast.error("No cabinet codes recognized", {
          description: "Check that your CSV has a column with cabinet codes (e.g. B24, W3030).",
        });
      } else {
        toast.success(`Matched ${matched} item${matched === 1 ? "" : "s"}`, {
          description: unmatched > 0 ? `${unmatched} code${unmatched === 1 ? "" : "s"} not found in our catalog` : "All codes matched",
        });
      }
    },
    onError: (err) => {
      toast.error("Couldn't parse the file", { description: err.message });
    },
  });

  const matched = rows?.filter((r) => r.matched) ?? [];
  const unmatched = rows?.filter((r) => !r.matched) ?? [];
  const selectedStyle = styleOptions.find((s) => String(s.id) === styleId);

  async function onFile(file: File | undefined) {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["csv", "tsv", "txt"].includes(ext)) {
      toast.error("Please choose a .csv, .tsv, or .txt file");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("File too large", { description: "Maximum 500KB. Export a smaller list from 2020 Design." });
      return;
    }
    setFilename(file.name);
    setRows(null);
    try {
      const text = await readFileAsText(file);
      parseMut.mutate({ csvText: text });
    } catch {
      toast.error("Could not read the file");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    onFile(file);
  }

  function doAddToCart() {
    if (!selectedStyle) {
      toast.error("Choose a door style first");
      return;
    }
    if (matched.length === 0) {
      toast.error("No matched items to add");
      return;
    }

    const doAdd = () => {
      for (const r of matched) {
        addItem({
          masterCode: r.masterCode!,
          name: r.description ?? r.masterCode!,
          styleId: selectedStyle.id,
          styleLabel: selectedStyle.label,
          distributorId: null,
          tier,
          unitPrice: null,
          qty: r.quantity,
        });
      }
      toast.success(`Added ${matched.length} item${matched.length === 1 ? "" : "s"} to cart`, {
        description: `Door style: ${selectedStyle.label}`,
      });
      onOpenChange(false);
      navigate("/cart");
    };

    if (lockedDistributorId != null) {
      toast.warning("Your cart already has items", {
        description: "Clear the cart to start fresh with this import, or keep adding.",
        action: {
          label: "Clear & add",
          onClick: () => { clear(); setTimeout(doAdd, 0); },
        },
      });
      return;
    }
    doAdd();
  }

  function reset() {
    setRows(null);
    setFilename("");
    if (fileRef.current) fileRef.current.value = "";
  }

  // ── Auth gate ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#d4a75a]" />
            Import Parts List from 2020 Design
          </DialogTitle>
          <DialogDescription>
            Export your BOM (Bill of Materials) from 2020 Design as a CSV file, then upload it here.
            We'll match each cabinet code to our catalog and add them to your cart.
          </DialogDescription>
        </DialogHeader>

        {!isAuthenticated ? (
          <div className="py-8 text-center">
            <Info className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-4">Sign in to import a parts list.</p>
            <Button onClick={() => (window.location.href = getLoginUrl())}>Sign in</Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* How to export from 2020 Design */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold mb-1">How to export from 2020 Design:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-amber-800">
                <li>Open your project in 2020 Design</li>
                <li>Go to <strong>Reports → Bill of Materials</strong></li>
                <li>Click <strong>Export → CSV</strong> or <strong>Save as CSV</strong></li>
                <li>Upload that file below</li>
              </ol>
              <p className="mt-1.5 text-xs text-amber-700">
                Any CSV with a column containing cabinet codes (e.g. B24, W3030, DB24-3) will work.
              </p>
            </div>

            {/* Drop zone */}
            {!rows && (
              <div
                ref={dropRef}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors ${
                  isDragging
                    ? "border-[#d4a75a] bg-[#d4a75a]/10"
                    : "border-border hover:border-[#d4a75a]/60 hover:bg-muted/30"
                }`}
              >
                {parseMut.isPending ? (
                  <>
                    <Spinner className="h-8 w-8 text-[#d4a75a]" />
                    <p className="text-sm text-muted-foreground">Matching codes to catalog…</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <div className="text-center">
                      <p className="font-medium text-sm">Drop your CSV file here</p>
                      <p className="text-xs text-muted-foreground mt-0.5">or click to browse · .csv .tsv .txt · max 500KB</p>
                    </div>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.tsv,.txt,text/csv,text/plain,text/tab-separated-values"
                  className="sr-only"
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
              </div>
            )}

            {/* Results */}
            {rows && (
              <>
                {/* Summary bar */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-medium text-muted-foreground">
                    {filename && <span className="text-foreground">{filename} — </span>}
                    {rows.length} row{rows.length === 1 ? "" : "s"} parsed
                  </span>
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {matched.length} matched
                  </Badge>
                  {unmatched.length > 0 && (
                    <Badge className="bg-red-100 text-red-800 border-red-200">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {unmatched.length} not found
                    </Badge>
                  )}
                  <button
                    onClick={reset}
                    className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" /> Upload different file
                  </button>
                </div>

                {/* Row table */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/60 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Your Code</th>
                          <th className="text-left px-3 py-2 font-medium">Matched To</th>
                          <th className="text-left px-3 py-2 font-medium">Description</th>
                          <th className="text-right px-3 py-2 font-medium">Qty</th>
                          <th className="text-left px-3 py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {rows.map((r, i) => {
                          const conf = CONFIDENCE_BADGE[r.confidence];
                          return (
                            <tr key={i} className={r.matched ? "" : "bg-red-50/40"}>
                              <td className="px-3 py-1.5 font-mono">{r.rawCode}</td>
                              <td className="px-3 py-1.5 font-mono text-[#1a2744] font-semibold">
                                {r.masterCode ?? (
                                  <span className="text-muted-foreground italic">
                                    {r.candidates.length > 0 ? r.candidates.slice(0, 2).join(", ") + "…" : "—"}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[180px]">
                                {r.description ?? (r.candidates.length > 0 ? "Did you mean one of these?" : "Not in catalog")}
                              </td>
                              <td className="px-3 py-1.5 text-right tabular-nums">{r.quantity}</td>
                              <td className="px-3 py-1.5">
                                <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${conf.className}`}>
                                  {conf.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {unmatched.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    <AlertTriangle className="inline h-3 w-3 mr-1 text-amber-500" />
                    {unmatched.length} code{unmatched.length === 1 ? "" : "s"} not found in our catalog.
                    These won't be added to the cart. Contact us if you need help sourcing them.
                  </p>
                )}

                {/* Door style + tier selector */}
                {matched.length > 0 && (
                  <div className="space-y-3 pt-1 border-t border-border">
                    <p className="text-sm font-medium">Choose door style &amp; pricing tier for these items:</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Door Style</label>
                        <Select value={styleId} onValueChange={setStyleId}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select style…" />
                          </SelectTrigger>
                          <SelectContent>
                            {styleOptions.map((s) => (
                              <SelectItem key={s.id} value={String(s.id)}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Pricing Tier</label>
                        <Select value={tier} onValueChange={(v) => setTier(v as typeof tier)}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="homeowner">Homeowner</SelectItem>
                            <SelectItem value="contractor">Contractor</SelectItem>
                            <SelectItem value="wholesale">Wholesale</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button
                      onClick={doAddToCart}
                      disabled={!selectedStyle}
                      className="w-full bg-[#1a2744] hover:bg-[#1a2744]/90 text-white"
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Add {matched.length} item{matched.length === 1 ? "" : "s"} to Cart
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
