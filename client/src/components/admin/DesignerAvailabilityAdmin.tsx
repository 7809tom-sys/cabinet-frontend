import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, RefreshCw, Wrench } from "lucide-react";

type AuditCabinet = {
  id: number;
  masterCode: string;
  description: string | null;
  category: string | null;
  subCategory: string | null;
};

type AuditDistributor = { id: number; name: string };

export function DesignerAvailabilityAdmin() {
  const { data, isLoading, refetch } = trpc.skuAdmin.skuCoverageAudit.useQuery();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [fixingId, setFixingId] = useState<number | null>(null);

  const bulkFix = trpc.skuAdmin.bulkAddSkusFromTemplate.useMutation({
    onSuccess: (result) => {
      toast.success(`Fixed! Added ${result.inserted} SKUs.`);
      setFixingId(null);
      void refetch();
    },
    onError: (err: { message: string }) => {
      toast.error(`Error: ${err.message}`);
      setFixingId(null);
    },
  });

  const toggleAvailability = trpc.skuAdmin.toggleCabinetSkuAvailability.useMutation({
    onSuccess: () => { toast.success("Availability updated."); void refetch(); },
    onError: (err: { message: string }) => toast.error(`Error: ${err.message}`),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Loading SKU coverage data…
      </div>
    );
  }

  if (!data) return <p className="text-muted-foreground">No data available.</p>;

  const { missingCabinets, cabinets: allCabs, coverage, distributors, totalCombos } = data;
  const totalCabs = allCabs.length;
  const coveredCabs = totalCabs - missingCabinets.length;

  // Cabinets with partial coverage (have some SKUs but fewer than average)
  const avgCoverage = totalCombos / Math.max(coveredCabs, 1);
  const partialCabinets = (allCabs as AuditCabinet[]).filter((c) => {
    const count = (coverage as Record<number, string[]>)[c.id]?.length ?? 0;
    return count > 0 && count < avgCoverage * 0.5;
  });

  const templateOptions = (allCabs as AuditCabinet[]).filter(
    (c) => ((coverage as Record<number, string[]>)[c.id]?.length ?? 0) > 10
  );

  const handleFix = (cabinetId: number) => {
    if (!selectedTemplate) {
      toast.error("Please select a template cabinet first.");
      return;
    }
    setFixingId(cabinetId);
    bulkFix.mutate({
      targetCabinetId: cabinetId,
      templateCabinetId: parseInt(selectedTemplate),
    });
  };

  const coverageMap = coverage as Record<number, string[]>;
  const allCabsList = allCabs as AuditCabinet[];
  const distributorList = distributors as AuditDistributor[];

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{coveredCabs}</div>
            <div className="text-sm text-muted-foreground">Cabinets with SKUs</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600">{(missingCabinets as AuditCabinet[]).length}</div>
            <div className="text-sm text-muted-foreground">Missing all SKUs</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-amber-600">{partialCabinets.length}</div>
            <div className="text-sm text-muted-foreground">Partial coverage</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{totalCombos}</div>
            <div className="text-sm text-muted-foreground">Total SKU combos</div>
          </CardContent>
        </Card>
      </div>

      {/* How it works */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-blue-800 dark:text-blue-300">
            Why do cabinets disappear from the Kitchen Designer?
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
          <p>
            Each cabinet needs a <strong>distributor SKU record</strong> for every door style it should appear in.
            Without one, the cabinet is invisible in the designer when that style is selected.
          </p>
          <p>
            Use the <strong>Fix Missing SKUs</strong> button below to copy pricing from a similar cabinet (the template)
            to the missing one. This is safe — it only adds new records, never overwrites existing ones.
          </p>
        </CardContent>
      </Card>

      {/* Template selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium">Template cabinet (copy pricing from):</span>
        <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select a well-covered cabinet…" />
          </SelectTrigger>
          <SelectContent>
            {templateOptions.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.masterCode} — {coverageMap[c.id]?.length ?? 0} SKUs
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">(Only cabinets with 10+ SKUs shown as templates)</span>
      </div>

      {/* Missing cabinets */}
      {(missingCabinets as AuditCabinet[]).length > 0 && (
        <div>
          <h3 className="font-semibold text-red-600 flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4" />
            Cabinets with NO SKUs ({(missingCabinets as AuditCabinet[]).length}) — invisible in Kitchen Designer
          </h3>
          <div className="space-y-2">
            {(missingCabinets as AuditCabinet[]).map((cab) => (
              <div
                key={cab.id}
                className="flex items-center justify-between p-3 border border-red-200 rounded-lg bg-red-50 dark:bg-red-950/20"
              >
                <div>
                  <span className="font-mono font-semibold text-sm">{cab.masterCode}</span>
                  <span className="text-sm text-muted-foreground ml-2">{cab.subCategory || cab.category}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-400 text-red-700 hover:bg-red-100"
                  disabled={!selectedTemplate || fixingId === cab.id}
                  onClick={() => handleFix(cab.id)}
                >
                  {fixingId === cab.id ? (
                    <><RefreshCw className="h-3 w-3 animate-spin mr-1" /> Fixing…</>
                  ) : (
                    <><Wrench className="h-3 w-3 mr-1" /> Fix Missing SKUs</>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Partial coverage cabinets */}
      {partialCabinets.length > 0 && (
        <div>
          <h3 className="font-semibold text-amber-600 flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4" />
            Cabinets with partial coverage ({partialCabinets.length}) — may be missing from some styles
          </h3>
          <div className="space-y-2">
            {partialCabinets.map((cab) => (
              <div
                key={cab.id}
                className="flex items-center justify-between p-3 border border-amber-200 rounded-lg bg-amber-50 dark:bg-amber-950/20"
              >
                <div>
                  <span className="font-mono font-semibold text-sm">{cab.masterCode}</span>
                  <span className="text-sm text-muted-foreground ml-2">{cab.subCategory || cab.category}</span>
                  <Badge variant="outline" className="ml-2 text-xs">
                    {coverageMap[cab.id]?.length ?? 0} SKUs
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-400 text-amber-700 hover:bg-amber-100"
                  disabled={!selectedTemplate || fixingId === cab.id}
                  onClick={() => handleFix(cab.id)}
                >
                  {fixingId === cab.id ? (
                    <><RefreshCw className="h-3 w-3 animate-spin mr-1" /> Fixing…</>
                  ) : (
                    <><Wrench className="h-3 w-3 mr-1" /> Fill Gaps</>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {(missingCabinets as AuditCabinet[]).length === 0 && partialCabinets.length === 0 && (
        <div className="flex items-center gap-2 text-green-600 py-4">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">
            All cabinets have full SKU coverage — Kitchen Designer should show everything correctly.
          </span>
        </div>
      )}

      {/* Distributor toggle section */}
      <div>
        <h3 className="font-semibold mb-3">Distributor Availability by Cabinet</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Toggle whether a cabinet's SKUs are active for a specific distributor. Turning off hides the cabinet from
          that distributor's styles in the Kitchen Designer.
        </p>
        <div className="space-y-1 max-h-96 overflow-y-auto border rounded-lg p-2">
          {allCabsList.slice(0, 50).map((cab) => {
            const cabCoverage = coverageMap[cab.id] ?? [];
            const distIds = Array.from(new Set(cabCoverage.map((k: string) => parseInt(k.split(":")[0]))));
            return (
              <div
                key={cab.id}
                className="flex items-center justify-between py-1.5 px-2 hover:bg-muted/50 rounded"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs w-20">{cab.masterCode}</span>
                  <span className="text-xs text-muted-foreground">{cab.subCategory || cab.category}</span>
                </div>
                <div className="flex items-center gap-1">
                  {cabCoverage.length === 0 ? (
                    <Badge variant="destructive" className="text-xs">No SKUs</Badge>
                  ) : (
                    distributorList.map((dist) => {
                      const hasSkus = distIds.includes(dist.id);
                      return (
                        <button
                          key={dist.id}
                          title={`${dist.name}: ${hasSkus ? "Active — click to disable" : "Inactive — click to enable"}`}
                          className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
                            hasSkus
                              ? "bg-green-100 border-green-300 text-green-700 hover:bg-green-200"
                              : "bg-gray-100 border-gray-300 text-gray-400 hover:bg-gray-200"
                          }`}
                          onClick={() =>
                            toggleAvailability.mutate({
                              cabinetId: cab.id,
                              distributorId: dist.id,
                              available: !hasSkus,
                            })
                          }
                        >
                          D{dist.id}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Showing first 50 cabinets. Green = has SKUs for that distributor. Click to toggle.
        </p>
      </div>
    </div>
  );
}
