import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Save, Trash2, BookOpen, ChevronDown, ChevronUp, DollarSign, TrendingUp } from "lucide-react";

type StyleResult = {
  styleId: number;
  styleCode: string | null;
  name: string | null;
  doorStyle: string | null;
  finish: string | null;
  color: string | null;
  thumbnailImageUrl: string | null;
  totalPrice: string | null;
  totalCost: string | null;
  breakdown: {
    masterCode: string;
    label: string;
    qty: number;
    unitPrice: string | null;
    lineTotal: string | null;
    unitCost: string | null;
    lineCost: string | null;
    available: boolean;
  }[];
  completeness: number;
};

export default function PriceShop10x10() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: layout } = trpc.priceShop.get10x10Layout.useQuery();
  const { data: styles, isLoading } = trpc.priceShop.price10x10Styles.useQuery();
  const { data: snapshots, refetch: refetchSnapshots } = trpc.priceShop.listSnapshots.useQuery(undefined, { enabled: isAdmin });

  const saveSnapshotMutation = trpc.priceShop.saveSnapshot.useMutation({
    onSuccess: () => { toast.success("Snapshot saved!"); refetchSnapshots(); setSaveDialogOpen(false); setSnapshotName(""); },
    onError: (e) => toast.error(e.message),
  });
  const deleteSnapshotMutation = trpc.priceShop.deleteSnapshot.useMutation({
    onSuccess: () => { toast.success("Snapshot deleted"); refetchSnapshots(); },
  });

  const [search, setSearch] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<StyleResult | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [snapshotName, setSnapshotName] = useState("");
  const [showSnapshots, setShowSnapshots] = useState(false);

  const filteredStyles = useMemo(() => {
    if (!styles) return [];
    const q = search.toLowerCase();
    if (!q) return styles;
    return styles.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.doorStyle || "").toLowerCase().includes(q) ||
        (s.finish || "").toLowerCase().includes(q) ||
        (s.color || "").toLowerCase().includes(q)
    );
  }, [styles, search]);

  const handleSaveSnapshot = () => {
    if (!snapshotName.trim() || !styles) return;
    saveSnapshotMutation.mutate({ name: snapshotName.trim(), layoutType: "10x10", data: styles });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-14">
        <div className="container max-w-6xl">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <Badge variant="outline" className="text-amber-400 border-amber-400/40 mb-4">
                Industry Standard Benchmark
              </Badge>
              <h1 className="text-4xl font-bold mb-3">10×10 Kitchen Price Shop</h1>
              <p className="text-slate-300 text-lg mb-2">
                The industry-standard 10×10 kitchen (120" × 120") priced across every door style we carry.
              </p>
              <p className="text-slate-400 text-sm">
                No trim, crown molding, or lazy Susan. Standard 30" wall cabinets. Shipping not included.
              </p>
              {isAdmin && (
                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-400/40 text-amber-400 hover:bg-amber-400/10"
                    onClick={() => setSaveDialogOpen(true)}
                    disabled={!styles || styles.length === 0}
                  >
                    <Save className="w-4 h-4 mr-1.5" />
                    Save Snapshot
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/20 text-white/70 hover:bg-white/10"
                    onClick={() => setShowSnapshots((v) => !v)}
                  >
                    <BookOpen className="w-4 h-4 mr-1.5" />
                    Saved Snapshots
                    {showSnapshots ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                  </Button>
                </div>
              )}
            </div>
            {/* Layout diagram */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-amber-400 mb-3 uppercase tracking-wider">
                The 10×10 Layout
              </h3>
              <p className="text-xs text-slate-400 mb-4">120" × 120" — 9 cabinet types</p>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {layout?.items.map((item, i) => (
                  <div key={i} className="bg-white/10 rounded px-2 py-1.5 flex justify-between items-center">
                    <span className="text-slate-200 truncate">{item.label}</span>
                    {item.qty > 1 && (
                      <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">×{item.qty}</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Saved Snapshots Panel (admin only) */}
      {isAdmin && showSnapshots && (
        <section className="bg-slate-50 dark:bg-slate-900/50 border-b border-border">
          <div className="container max-w-6xl py-6">
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Saved Snapshots</h3>
            {!snapshots || snapshots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No snapshots saved yet.</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {snapshots.filter((s) => s.layoutType === "10x10").map((snap) => (
                  <div key={snap.id} className="flex items-center justify-between bg-background border border-border rounded-lg px-4 py-3">
                    <div>
                      <p className="font-medium text-sm">{snap.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {snap.totalStyles} styles · {new Date(snap.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 h-8 w-8"
                      onClick={() => deleteSnapshotMutation.mutate({ id: snap.id })}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Search + Results */}
      <section className="container max-w-6xl py-10">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">All Styles Priced</h2>
            <p className="text-muted-foreground text-sm">
              {filteredStyles.length} style{filteredStyles.length !== 1 ? "s" : ""} available
            </p>
          </div>
          <Input
            placeholder="Search by style, finish, or color..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-52 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStyles.map((style) => {
              const margin = style.totalPrice && style.totalCost
                ? ((Number(style.totalPrice) - Number(style.totalCost)) / Number(style.totalPrice) * 100).toFixed(1)
                : null;
              return (
                <Card
                  key={style.styleId}
                  className="cursor-pointer hover:shadow-lg transition-shadow border-border/60 hover:border-amber-500/40"
                  onClick={() => setSelectedStyle(style)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      {style.thumbnailImageUrl ? (
                        <img src={style.thumbnailImageUrl} alt={style.name || ""} className="w-14 h-14 rounded-md object-cover border" />
                      ) : (
                        <div className="w-14 h-14 rounded-md bg-muted flex items-center justify-center text-muted-foreground text-xs">No img</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{style.name || style.styleCode}</CardTitle>
                        <p className="text-xs text-muted-foreground truncate">
                          {[style.doorStyle, style.finish, style.color].filter(Boolean).join(" • ")}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {style.totalPrice ? (
                        <>
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-amber-500" />
                            <span className="text-2xl font-bold">
                              ${Number(style.totalPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground ml-6">homeowner price · 10×10 layout</p>
                          {isAdmin && style.totalCost && (
                            <div className="mt-2 pt-2 border-t border-border/50 space-y-0.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Your cost</span>
                                <span className="text-xs font-semibold text-emerald-600">
                                  ${Number(style.totalCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                              {margin && (
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" /> Margin
                                  </span>
                                  <span className="text-xs font-semibold text-blue-600">{margin}%</span>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Partial availability</p>
                      )}
                    </div>
                    {style.completeness < 1 && (
                      <Badge variant="outline" className="mt-2 text-xs text-orange-500 border-orange-300">
                        {Math.round(style.completeness * 100)}% complete
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {!isLoading && filteredStyles.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-medium">No styles match your search</p>
            <p className="text-sm mt-1">Try a different search term</p>
          </div>
        )}
      </section>

      {/* Breakdown Dialog */}
      {selectedStyle && (
        <Dialog open={!!selectedStyle} onOpenChange={() => setSelectedStyle(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                {selectedStyle.thumbnailImageUrl && (
                  <img src={selectedStyle.thumbnailImageUrl} alt="" className="w-10 h-10 rounded object-cover border" />
                )}
                <div>
                  <div>{selectedStyle.name || selectedStyle.styleCode}</div>
                  <div className="text-sm font-normal text-muted-foreground">
                    {[selectedStyle.doorStyle, selectedStyle.finish, selectedStyle.color].filter(Boolean).join(" • ")}
                  </div>
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 border border-amber-200/50">
                  <p className="text-xs text-muted-foreground mb-1">Homeowner Price</p>
                  <p className="text-2xl font-bold text-amber-600">
                    ${Number(selectedStyle.totalPrice ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                {isAdmin && selectedStyle.totalCost && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-4 border border-emerald-200/50">
                    <p className="text-xs text-muted-foreground mb-1">Your Cost</p>
                    <p className="text-2xl font-bold text-emerald-600">
                      ${Number(selectedStyle.totalCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-emerald-500 mt-0.5">
                      Margin: ${(Number(selectedStyle.totalPrice) - Number(selectedStyle.totalCost)).toFixed(2)} ({((Number(selectedStyle.totalPrice) - Number(selectedStyle.totalCost)) / Number(selectedStyle.totalPrice) * 100).toFixed(1)}%)
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Breakdown table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cabinet</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Line Total</TableHead>
                    {isAdmin && <TableHead className="text-right text-emerald-600">Your Cost</TableHead>}
                    {isAdmin && <TableHead className="text-right text-emerald-600">Cost Total</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedStyle.breakdown.map((item, i) => (
                    <TableRow key={i} className={!item.available ? "opacity-40" : ""}>
                      <TableCell>
                        <div className="font-medium text-sm">{item.label}</div>
                        <div className="text-xs text-muted-foreground">{item.masterCode}</div>
                      </TableCell>
                      <TableCell className="text-right">{item.qty}</TableCell>
	                      <TableCell className={`text-right ${item.available ? "" : "text-rose-700 font-medium"}`}>
	                        {item.unitPrice ? `$${Number(item.unitPrice).toFixed(2)}` : "Unavailable"}
	                      </TableCell>
	                      <TableCell className={`text-right font-medium ${item.available ? "" : "text-rose-700"}`}>
	                        {item.lineTotal ? `$${Number(item.lineTotal).toFixed(2)}` : "Unavailable"}
	                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right text-emerald-600 text-sm">
                          {item.unitCost ? `$${Number(item.unitCost).toFixed(2)}` : "—"}
                        </TableCell>
                      )}
                      {isAdmin && (
                        <TableCell className="text-right text-emerald-600 text-sm font-medium">
                          {item.lineCost ? `$${Number(item.lineCost).toFixed(2)}` : "—"}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Save Snapshot Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save Price Snapshot</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Save the current 10×10 prices ({styles?.length ?? 0} styles) as a named snapshot for future reference.
            </p>
            <Input
              placeholder="e.g. July 2026 prices"
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveSnapshot()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSaveSnapshot}
              disabled={!snapshotName.trim() || saveSnapshotMutation.isPending}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {saveSnapshotMutation.isPending ? "Saving..." : "Save Snapshot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
