import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, XCircle, AlertTriangle, Pencil, Search } from "lucide-react";
import {
  CABINET_ATTENTION_EDITOR_LINK_ATTRIBUTES,
  cabinetConfigQuickEditUrl,
  cabinetDesignerCoverageGapEditUrl,
} from "@shared/cabinetConfigReview";

const CATEGORIES = [
  "Base",
  "Wall",
  "Tall",
  "Corner",
  "Pantry",
  "Vanity",
  "ADA",
  "Accessory",
];

export function DesignerCoverageAdmin() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [gapsOnly, setGapsOnly] = useState(
    () => new URLSearchParams(window.location.search).get("gapsOnly") === "1",
  );
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search
  const handleSearch = (v: string) => {
    setSearch(v);
    clearTimeout((handleSearch as any)._t);
    (handleSearch as any)._t = setTimeout(() => setDebouncedSearch(v), 350);
  };

  const { data, isLoading } = trpc.cabinets.adminDesignerCoverage.useQuery({
    search: debouncedSearch || undefined,
    category: category !== "all" ? category : undefined,
    gapsOnly,
  });

  const cabinets = data?.cabinets ?? [];
  const styles = data?.styles ?? [];

  // Group styles by distributorId for column headers
  const stylesByDist = useMemo(() => {
    const map: Record<number, typeof styles> = {};
    for (const s of styles) {
      if (!map[s.distributorId]) map[s.distributorId] = [];
      map[s.distributorId].push(s);
    }
    return map;
  }, [styles]);

  const distIds = Object.keys(stylesByDist).map(Number);

  // Summary stats
  const totalCabinets = cabinets.length;
  const withGaps = cabinets.filter((c) => c.hasGaps).length;
  const fullyCovered = totalCabinets - withGaps;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">Designer Coverage</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Shows which door styles each cabinet has SKU coverage for. A{" "}
          <span className="text-red-500 font-medium">red ✗</span> means no
          published, available SKU exists for that style — the cabinet won't
          appear in the designer when that style is selected. Click a red mark
          to edit that exact cabinet and style connection.
        </p>
      </div>

      {/* Summary cards */}
      {!isLoading && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold">{totalCabinets}</div>
            <div className="text-xs text-muted-foreground">Total Cabinets</div>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 p-3 text-center">
            <div className="text-2xl font-bold text-green-600">
              {fullyCovered}
            </div>
            <div className="text-xs text-muted-foreground">
              Fully Covered
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3 text-center">
            <div className="text-2xl font-bold text-amber-600">{withGaps}</div>
            <div className="text-xs text-muted-foreground">Have Gaps</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search code or description…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2" aria-describedby="missing-coverage-only-help">
          <Switch
            id="missing-coverage-only"
            data-testid="coverage-missing-only-toggle"
            checked={gapsOnly}
            onCheckedChange={setGapsOnly}
          />
          <Label htmlFor="missing-coverage-only" className="text-sm font-medium cursor-pointer">
            Missing coverage only
          </Label>
          <span id="missing-coverage-only-help" className="sr-only">Show only cabinets missing at least one available, published style connection.</span>
        </div>
      </div>

      {gapsOnly && !isLoading && (
        <p role="status" className="text-sm font-medium text-amber-800 dark:text-amber-300">
          Showing only cabinets with missing coverage.
        </p>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading coverage data…
        </div>
      ) : cabinets.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {gapsOnly
            ? "No cabinets with coverage gaps found."
            : "No cabinets found."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-xs">
            <thead>
              {/* Distributor group header */}
              <tr className="bg-muted/50 border-b">
                <th
                  className="sticky left-0 z-10 bg-muted/80 px-3 py-2 text-left font-semibold min-w-[220px]"
                  rowSpan={2}
                >
                  Cabinet
                </th>
                <th
                  className="px-2 py-1 text-center font-semibold min-w-[60px]"
                  rowSpan={2}
                >
                  Cat.
                </th>
                <th
                  className="px-2 py-1 text-center font-semibold min-w-[70px]"
                  rowSpan={2}
                >
                  Designer
                </th>
                <th
                  className="px-2 py-1 text-center font-semibold min-w-[80px]"
                  rowSpan={2}
                >
                  Coverage
                </th>
                {distIds.map((did) => (
                  <th
                    key={did}
                    colSpan={stylesByDist[did].length}
                    className="px-2 py-1 text-center font-semibold border-l"
                  >
                    Line {did === 1 ? "A" : did === 2 ? "B" : "C"}
                    <span className="text-muted-foreground font-normal ml-1">
                      ({stylesByDist[did].length} styles)
                    </span>
                  </th>
                ))}
              </tr>
              {/* Style name header */}
              <tr className="bg-muted/30 border-b">
                {distIds.map((did) =>
                  stylesByDist[did].map((s, i) => (
                    <th
                      key={s.id}
                      className={`px-1 py-1 text-center font-normal text-muted-foreground whitespace-nowrap max-w-[80px] overflow-hidden text-ellipsis ${i === 0 ? "border-l" : ""}`}
                      title={s.featuredLabel || s.ourName}
                    >
                      {(s.featuredLabel || s.ourName).slice(0, 10)}
                      {(s.featuredLabel || s.ourName).length > 10 ? "…" : ""}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {cabinets.map((cab, idx) => {
                const pct = Math.round(
                  (cab.coveredCount / cab.totalStyles) * 100
                );
                const hasGap = cab.hasGaps;
                return (
                  <tr
                    key={cab.id}
                    className={`border-b transition-colors hover:bg-muted/30 ${
                      idx % 2 === 0 ? "" : "bg-muted/10"
                    } ${hasGap ? "bg-amber-50/30 dark:bg-amber-950/10" : ""}`}
                  >
                    {/* Cabinet info */}
                    <td className="sticky left-0 z-10 bg-inherit px-3 py-1.5 min-w-[220px]">
                      <div className="flex items-center gap-2">
                        {hasGap ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="font-mono font-semibold text-xs">
                            {cab.masterCode}
                          </div>
                          <div className="text-muted-foreground truncate max-w-[160px]">
                            {cab.description}
                          </div>
                        </div>
                        <Button asChild variant="outline" size="sm" className="ml-auto h-7 shrink-0 gap-1 px-2 text-[11px]">
                          <a
                            href={cabinetConfigQuickEditUrl(cab.id)}
                            aria-label={`Edit Cabinet Config for ${cab.masterCode}`}
                            {...CABINET_ATTENTION_EDITOR_LINK_ATTRIBUTES}
                          >
                            <Pencil className="h-3 w-3" />Edit
                          </a>
                        </Button>
                      </div>
                    </td>
                    {/* Category */}
                    <td className="px-2 py-1.5 text-center">
                      <Badge variant="outline" className="text-[10px] px-1">
                        {cab.category}
                      </Badge>
                    </td>
                    {/* showInDesigner */}
                    <td className="px-2 py-1.5 text-center">
                      {cab.showInDesigner ? (
                        <span className="text-green-600 font-medium">Yes</span>
                      ) : (
                        <span className="text-muted-foreground">No</span>
                      )}
                    </td>
                    {/* Coverage % */}
                    <td className="px-2 py-1.5 text-center">
                      <span
                        className={`font-semibold ${
                          pct === 100
                            ? "text-green-600"
                            : pct >= 50
                              ? "text-amber-600"
                              : "text-red-600"
                        }`}
                      >
                        {pct}%
                      </span>
                      <div className="text-muted-foreground text-[10px]">
                        {cab.coveredCount}/{cab.totalStyles}
                      </div>
                    </td>
                    {/* Per-style coverage dots */}
                    {distIds.map((did, di) =>
                      stylesByDist[did].map((s, si) => {
                        const has = cab.coverage[s.id];
                        return (
                          <td
                            key={s.id}
                            className={`px-1 py-1.5 text-center ${si === 0 ? "border-l" : ""}`}
                            title={`${cab.masterCode} × ${s.featuredLabel || s.ourName}: ${has ? "✓ covered" : "✗ missing — open the editor"}`}
                          >
                            {has ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mx-auto" />
                            ) : (
                              <Button asChild variant="ghost" size="icon" className="h-6 w-6 rounded-sm text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40">
                                <a
                                  href={cabinetDesignerCoverageGapEditUrl(cab.masterCode, cab.id, s.id, s.distributorId)}
                                  aria-label={`Edit missing ${s.featuredLabel || s.ourName} SKU for ${cab.masterCode}`}
                                  {...CABINET_ATTENTION_EDITOR_LINK_ATTRIBUTES}
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                            )}
                          </td>
                        );
                      })
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Has published
          SKU for that style
        </span>
        <span className="flex items-center gap-1">
          <XCircle className="h-3.5 w-3.5 text-red-400" /> No SKU — hidden from
          designer when that style is selected
        </span>
        <span className="flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Cabinet has
          at least one gap
        </span>
      </div>
    </div>
  );
}
