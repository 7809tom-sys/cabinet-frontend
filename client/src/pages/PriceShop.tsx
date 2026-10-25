import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function PriceShop() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: layout } = trpc.priceShop.getLayout.useQuery();
  const { data: styles, isLoading } = trpc.priceShop.priceAllStyles.useQuery();
  const [search, setSearch] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<(typeof filteredStyles)[number] | null>(null);

  const filteredStyles = useMemo(() => {
    if (!styles) return [];
    if (!search.trim()) return styles;
    const q = search.toLowerCase();
    return styles.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.doorStyle || "").toLowerCase().includes(q) ||
        (s.finish || "").toLowerCase().includes(q) ||
        (s.color || "").toLowerCase().includes(q)
    );
  }, [styles, search]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-16">
        <div className="container max-w-6xl">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <Badge variant="outline" className="text-amber-400 border-amber-400/40 mb-4">
                Compare Every Style
              </Badge>
              <h1 className="text-4xl font-bold mb-4">
                Price Shop
              </h1>
              <p className="text-slate-300 text-lg mb-2">
                See what a standard 19-linear-foot L-shaped kitchen costs in every door style we carry.
              </p>
              <p className="text-slate-400 text-sm">
                Same cabinets, same layout — the only variable is the door style. Compare apples to apples.
              </p>
            </div>
            {/* Layout diagram */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-amber-400 mb-3 uppercase tracking-wider">
                The 19'L Layout
              </h3>
              <p className="text-xs text-slate-400 mb-4">90" × 138" — 12 cabinets total</p>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {layout?.items.map((item, i) => (
                  <div
                    key={i}
                    className="bg-white/10 rounded px-2 py-1.5 flex justify-between items-center"
                  >
                    <span className="text-slate-200 truncate">{item.label}</span>
                    {item.qty > 1 && (
                      <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">
                        ×{item.qty}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

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
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStyles.map((style) => (
              <Card
                key={style.styleId}
                className="cursor-pointer hover:shadow-lg transition-shadow border-border/60 hover:border-amber-500/40"
                onClick={() => setSelectedStyle(style)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    {style.thumbnailImageUrl ? (
                      <img
                        src={style.thumbnailImageUrl}
                        alt={style.name || ""}
                        className="w-14 h-14 rounded-md object-cover border"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-md bg-muted flex items-center justify-center text-muted-foreground text-xs">
                        No img
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">
                        {style.name || style.styleCode}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground truncate">
                        {[style.doorStyle, style.finish, style.color]
                          .filter(Boolean)
                          .join(" • ")}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between">
                    <div>
                      {style.totalPrice ? (
                        <>
                          <p className="text-2xl font-bold text-foreground">
                            ${Number(style.totalPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          {isAdmin && style.totalCost && (
                            <p className="text-xs text-emerald-600 font-medium">
                              Cost: ${Number(style.totalCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">total for 19'L layout</p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Price unavailable</p>
                      )}
                    </div>
                    {style.completeness < 1 && (
                      <Badge variant="outline" className="text-amber-600 border-amber-600/40 text-xs">
                        {Math.round(style.completeness * 100)}% available
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && filteredStyles.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg">No styles match your search.</p>
            <Button variant="ghost" className="mt-2" onClick={() => setSearch("")}>
              Clear search
            </Button>
          </div>
        )}
      </section>

      {/* Breakdown Dialog */}
      <Dialog open={!!selectedStyle} onOpenChange={(open) => !open && setSelectedStyle(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedStyle?.thumbnailImageUrl && (
                <img
                  src={selectedStyle.thumbnailImageUrl}
                  alt=""
                  className="w-10 h-10 rounded-md object-cover border"
                />
              )}
              <div>
                <span>{selectedStyle?.name || selectedStyle?.styleCode}</span>
                <p className="text-xs font-normal text-muted-foreground">
                  {[selectedStyle?.doorStyle, selectedStyle?.finish, selectedStyle?.color]
                    .filter(Boolean)
                    .join(" • ")}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cabinet</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Unit</TableHead>
                  <TableHead className="text-right">Line Total</TableHead>
                  {isAdmin && <TableHead className="text-right text-emerald-700">Your Cost</TableHead>}
                  {isAdmin && <TableHead className="text-right text-emerald-700">Cost Total</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedStyle?.breakdown.map((item, i) => (
                  <TableRow key={i} className={!item.available ? "opacity-50" : ""}>
                    <TableCell className="text-sm">{item.label}</TableCell>
                    <TableCell className="text-center">{item.qty}</TableCell>
	                    <TableCell className={`text-right ${item.available ? "" : "text-rose-700 font-medium"}`}>
	                      {item.unitPrice ? `$${Number(item.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "Unavailable"}
	                    </TableCell>
	                    <TableCell className={`text-right font-medium ${item.available ? "" : "text-rose-700"}`}>
	                      {item.lineTotal ? `$${Number(item.lineTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "Unavailable"}
	                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right text-emerald-700">
                        {item.unitCost ? `$${Number(item.unitCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"}
                      </TableCell>
                    )}
                    {isAdmin && (
                      <TableCell className="text-right text-emerald-700 font-medium">
                        {item.lineCost ? `$${Number(item.lineCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 pt-4 border-t flex justify-between items-center">
              <span className="font-semibold">Total</span>
              <div className="text-right">
                <span className="text-xl font-bold">
                  {selectedStyle?.totalPrice
                    ? `$${Number(selectedStyle.totalPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : "—"}
                </span>
                {isAdmin && selectedStyle?.totalCost && (
                  <p className="text-sm text-emerald-700 font-medium">
                    Cost: ${Number(selectedStyle.totalCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {selectedStyle.totalPrice && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({Math.round((1 - Number(selectedStyle.totalCost) / Number(selectedStyle.totalPrice)) * 100)}% margin)
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
