import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download, Database, FileSpreadsheet } from "lucide-react";

export default function FullDatabaseExport() {
  const [category, setCategory] = useState<string>("");
  const [distributorId, setDistributorId] = useState<number | null>(null);
  const [styleId, setStyleId] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);
  const utils = trpc.useUtils();

  // Load distributors for the picker
  const { data: distList = [] } = trpc.distributorAdmin.adminList.useQuery();

  // Load door styles (optionally filtered by distributor)
  const { data: allStyles = [] } = trpc.doorStyles.list.useQuery();
  const filteredStyles = useMemo(() => {
    if (!distributorId) return allStyles;
    return allStyles.filter((s: any) => s.distributorId === distributorId);
  }, [allStyles, distributorId]);

  const { data: dbCatsList } = trpc.cabinetCategories.list.useQuery();
  const categories = dbCatsList && dbCatsList.length > 0
    ? dbCatsList.map((c) => c.name)
    : ["Base", "Wall", "Tall", "ADA", "Vanity", "Accessory"];

  function handleDownload() {
    setDownloading(true);
    const input: { category?: string; distributorId?: number; styleId?: number } = {};
    if (category) input.category = category;
    if (distributorId) input.distributorId = distributorId;
    if (styleId) input.styleId = styleId;

    (utils.pricing as any).fullExport
      .fetch(input)
      .then(({ xlsx, filename, counts }: { xlsx: string; filename: string; counts: Record<string, number> }) => {
        if (!xlsx) {
          toast.error("No data to export");
          return;
        }
        const byteChars = atob(xlsx);
        const byteNums = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteNums], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        const summary = Object.entries(counts)
          .map(([k, v]) => `${v} ${k}`)
          .join(", ");
        toast.success(`Export complete: ${summary}`);
      })
      .catch((e: any) => toast.error(e?.message ?? "Export failed"))
      .finally(() => setDownloading(false));
  }

  function clearFilters() {
    setCategory("");
    setDistributorId(null);
    setStyleId(null);
  }

  const hasFilters = category || distributorId || styleId;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Full Database Export
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground max-w-xl">
          Download a complete Excel backup of all product data — cabinets, SKUs with pricing,
          door styles, and distributors. Use the filters below to narrow the export, or leave
          them empty to download everything.
        </p>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
          {/* Category */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Category</label>
            <Select
              value={category || "all"}
              onValueChange={(v) => setCategory(v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Distributor */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Distributor</label>
            <Select
              value={distributorId != null ? String(distributorId) : "all"}
              onValueChange={(v) => {
                const id = v === "all" ? null : Number(v);
                setDistributorId(id);
                setStyleId(null); // reset style when distributor changes
              }}
            >
              <SelectTrigger className="w-52">
                <SelectValue placeholder="All distributors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All distributors</SelectItem>
                {distList.map((d: any) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.brandName || d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Door Style */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Door Style</label>
            <Select
              value={styleId != null ? String(styleId) : "all"}
              onValueChange={(v) => setStyleId(v === "all" ? null : Number(v))}
            >
              <SelectTrigger className="w-52">
                <SelectValue placeholder="All styles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All styles</SelectItem>
                {filteredStyles.map((s: any) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.ourName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={handleDownload}
            disabled={downloading}
            className="gap-2 bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy)]/90"
          >
            {downloading ? <Spinner className="h-4 w-4" /> : <FileSpreadsheet className="h-4 w-4" />}
            {downloading ? "Exporting…" : "Download Export"}
          </Button>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}

          {hasFilters && (
            <Badge variant="secondary" className="text-xs">
              Filtered
            </Badge>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          The export includes 4 sheets: Cabinets, Distributor SKUs (with all pricing columns),
          Door Styles, and Distributors. All IDs are included so data can be re-imported.
        </p>
      </CardContent>
    </Card>
  );
}
