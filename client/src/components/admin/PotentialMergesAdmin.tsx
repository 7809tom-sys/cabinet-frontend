/**
 * PotentialMergesAdmin
 * Two modes:
 *   1. Auto-suggested duplicates (codes match when hyphens removed, or alias overlap)
 *   2. Manual merge: search for any two cabinets and merge them
 * Shows catalog images side-by-side, dimensions, and blind-corner warnings.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowLeftRight,
  Check,
  X,
  GitMerge,
  Search,
  AlertTriangle,
  ImageIcon,
} from "lucide-react";

type CabinetInfo = {
  id: number;
  masterCode: string;
  description: string | null;
  category: string | null;
  catalogImageUrl: string | null;
  width: string | null;
  height: string | null;
  depth: string | null;
};

type Candidate = {
  key: string;
  cabinetA: CabinetInfo;
  cabinetB: CabinetInfo;
  reason: string;
};

function isBlindCorner(cab: CabinetInfo): boolean {
  const code = cab.masterCode.toUpperCase();
  const desc = (cab.description ?? "").toUpperCase();
  return (
    code.includes("BBC") ||
    code.includes("BLC") ||
    code.includes("WBC") ||
    code.includes("BLIND") ||
    desc.includes("BLIND CORNER") ||
    desc.includes("BLIND BASE")
  );
}

function CabinetCard({
  cab,
  role,
}: {
  cab: CabinetInfo;
  role: "keep" | "remove";
}) {
  const isKeep = role === "keep";
  return (
    <div
      className={`flex gap-3 p-2 rounded-lg border ${
        isKeep
          ? "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800/50"
          : "border-red-200 bg-red-50/30 dark:bg-red-950/10 dark:border-red-800/40 opacity-75"
      }`}
    >
      {/* Image */}
      <div className="w-16 h-16 shrink-0 rounded bg-muted flex items-center justify-center overflow-hidden">
        {cab.catalogImageUrl ? (
          <img
            src={cab.catalogImageUrl}
            alt={cab.masterCode}
            className="w-full h-full object-contain"
          />
        ) : (
          <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
        )}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge
            className={
              isKeep
                ? "bg-emerald-600 text-white hover:bg-emerald-600 font-mono text-xs"
                : "bg-red-500/80 text-white hover:bg-red-500/80 font-mono text-xs line-through"
            }
          >
            {cab.masterCode}
          </Badge>
          {cab.category && (
            <Badge variant="outline" className="text-xs">
              {cab.category}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {isKeep ? "← KEEP" : "→ DEACTIVATE"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1 truncate">
          {cab.description ?? "No description"}
        </p>
        <p className="text-xs text-muted-foreground/70 mt-0.5">
          {cab.width ?? "?"}"W × {cab.height ?? "?"}"H × {cab.depth ?? "?"}"D
        </p>
      </div>
    </div>
  );
}

function MergeCard({
  candidate,
  isSwapped,
  isPending,
  onSwap,
  onAccept,
  onDismiss,
}: {
  candidate: Candidate;
  isSwapped: boolean;
  isPending: boolean;
  onSwap: () => void;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const canonical = isSwapped ? candidate.cabinetB : candidate.cabinetA;
  const duplicate = isSwapped ? candidate.cabinetA : candidate.cabinetB;
  const showBlindWarning = isBlindCorner(canonical) || isBlindCorner(duplicate);

  return (
    <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10 dark:border-amber-800/40">
      <CardContent className="pt-4 pb-4 space-y-3">
        {/* Side-by-side comparison */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CabinetCard cab={canonical} role="keep" />
          <CabinetCard cab={duplicate} role="remove" />
        </div>

        {/* Reason */}
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Reason: {candidate.reason}
        </p>

        {/* Blind corner warning */}
        {showBlindWarning && (
          <div className="flex items-start gap-2 p-2 rounded bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700">
            <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              <strong>Blind corner cabinet:</strong> Physical dimensions may vary
              by distributor. After merging, check distributor overrides if
              dimensions differ.
            </p>
          </div>
        )}

        {/* Dimension mismatch warning */}
        {canonical.width !== duplicate.width ||
        canonical.height !== duplicate.height ||
        canonical.depth !== duplicate.depth ? (
          <div className="flex items-start gap-2 p-2 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <AlertTriangle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              <strong>Dimensions differ:</strong> Keeper is {canonical.width}"×
              {canonical.height}"×{canonical.depth}" vs {duplicate.width}"×
              {duplicate.height}"×{duplicate.depth}". The keeper's dimensions
              will be used as master.
            </p>
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2 text-xs gap-1"
            title="Swap which cabinet is the canonical one"
            disabled={isPending}
            onClick={onSwap}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Swap
          </Button>
          <Button
            size="sm"
            className="h-8 px-3 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={isPending}
            onClick={onAccept}
          >
            {isPending ? (
              <Spinner className="h-3.5 w-3.5" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Merge
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2 text-xs gap-1 text-muted-foreground"
            disabled={isPending}
            onClick={onDismiss}
          >
            <X className="h-3.5 w-3.5" />
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Manual Merge Section ─── */
type SearchResult = {
  id: number;
  masterCode: string;
  description: string | null;
  category: string | null;
  width: string | null;
  height: string | null;
  depth: string | null;
  catalogImageUrl: string | null;
  isActive: boolean;
  skuCount: number;
};

function ManualMerge() {
  const utils = trpc.useUtils();
  const [searchA, setSearchA] = useState("");
  const [searchB, setSearchB] = useState("");
  const [selectedA, setSelectedA] = useState<SearchResult | null>(null);
  const [selectedB, setSelectedB] = useState<SearchResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [keepId, setKeepId] = useState<"A" | "B">("A");

  const resultsA = trpc.genericCabinets.searchForMerge.useQuery(
    { search: searchA },
    { enabled: searchA.length >= 2 }
  );
  const resultsB = trpc.genericCabinets.searchForMerge.useQuery(
    { search: searchB },
    { enabled: searchB.length >= 2 }
  );

  const acceptMerge = trpc.genericCabinets.acceptMerge.useMutation({
    onSuccess: () => {
      utils.genericCabinets.potentialMerges.invalidate();
      toast.success("Merged successfully! SKUs moved and duplicate deactivated.");
      setSelectedA(null);
      setSelectedB(null);
      setSearchA("");
      setSearchB("");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleMerge = () => {
    if (!selectedA || !selectedB) return;
    const canonicalId = keepId === "A" ? selectedA.id : selectedB.id;
    const duplicateId = keepId === "A" ? selectedB.id : selectedA.id;
    acceptMerge.mutate({ canonicalId, duplicateId });
    setConfirmOpen(false);
  };

  const showBlindWarning =
    selectedA &&
    selectedB &&
    (isBlindCorner(selectedA as CabinetInfo) ||
      isBlindCorner(selectedB as CabinetInfo));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-1">Manual Merge</h3>
        <p className="text-xs text-muted-foreground">
          Search for two cabinets you want to merge. Select one from each column,
          then choose which to keep.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Column A */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search cabinet A..."
              value={searchA}
              onChange={(e) => {
                setSearchA(e.target.value);
                setSelectedA(null);
              }}
              className="pl-9 h-9"
            />
          </div>
          {selectedA ? (
            <Card className="border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20">
              <CardContent className="p-3">
                <div className="flex gap-3">
                  <div className="w-14 h-14 shrink-0 rounded bg-muted flex items-center justify-center overflow-hidden">
                    {selectedA.catalogImageUrl ? (
                      <img
                        src={selectedA.catalogImageUrl}
                        alt={selectedA.masterCode}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge className="font-mono text-xs bg-emerald-600 text-white">
                        {selectedA.masterCode}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {selectedA.skuCount} SKUs
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {selectedA.description}
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      {selectedA.width}"W × {selectedA.height}"H ×{" "}
                      {selectedA.depth}"D
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => setSelectedA(null)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : resultsA.data && searchA.length >= 2 ? (
            <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-1">
              {resultsA.data.map((r) => (
                <button
                  key={r.id}
                  className="w-full text-left p-2 rounded hover:bg-accent flex items-center gap-2 text-xs"
                  onClick={() => setSelectedA(r)}
                >
                  <div className="w-8 h-8 shrink-0 rounded bg-muted flex items-center justify-center overflow-hidden">
                    {r.catalogImageUrl ? (
                      <img
                        src={r.catalogImageUrl}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="h-3 w-3 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-mono font-medium">
                      {r.masterCode}
                    </span>
                    <span className="text-muted-foreground ml-2 truncate">
                      {r.description}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {r.skuCount}
                  </Badge>
                </button>
              ))}
              {resultsA.data.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">
                  No results
                </p>
              )}
            </div>
          ) : null}
        </div>

        {/* Column B */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search cabinet B..."
              value={searchB}
              onChange={(e) => {
                setSearchB(e.target.value);
                setSelectedB(null);
              }}
              className="pl-9 h-9"
            />
          </div>
          {selectedB ? (
            <Card className="border-red-200 bg-red-50/30 dark:bg-red-950/10">
              <CardContent className="p-3">
                <div className="flex gap-3">
                  <div className="w-14 h-14 shrink-0 rounded bg-muted flex items-center justify-center overflow-hidden">
                    {selectedB.catalogImageUrl ? (
                      <img
                        src={selectedB.catalogImageUrl}
                        alt={selectedB.masterCode}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge className="font-mono text-xs bg-red-500 text-white">
                        {selectedB.masterCode}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {selectedB.skuCount} SKUs
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {selectedB.description}
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      {selectedB.width}"W × {selectedB.height}"H ×{" "}
                      {selectedB.depth}"D
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => setSelectedB(null)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : resultsB.data && searchB.length >= 2 ? (
            <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-1">
              {resultsB.data.map((r) => (
                <button
                  key={r.id}
                  className="w-full text-left p-2 rounded hover:bg-accent flex items-center gap-2 text-xs"
                  onClick={() => setSelectedB(r)}
                >
                  <div className="w-8 h-8 shrink-0 rounded bg-muted flex items-center justify-center overflow-hidden">
                    {r.catalogImageUrl ? (
                      <img
                        src={r.catalogImageUrl}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="h-3 w-3 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-mono font-medium">
                      {r.masterCode}
                    </span>
                    <span className="text-muted-foreground ml-2 truncate">
                      {r.description}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {r.skuCount}
                  </Badge>
                </button>
              ))}
              {resultsB.data.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">
                  No results
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Merge action area */}
      {selectedA && selectedB && (
        <div className="space-y-3 border-t pt-4">
          {showBlindWarning && (
            <div className="flex items-start gap-2 p-2 rounded bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700">
              <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-800 dark:text-yellow-200">
                <strong>Blind corner cabinet:</strong> Physical dimensions may
                vary by distributor. After merging, check distributor overrides.
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Keep:</span>
            <Button
              size="sm"
              variant={keepId === "A" ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => setKeepId("A")}
            >
              {selectedA.masterCode}
            </Button>
            <Button
              size="sm"
              variant={keepId === "B" ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => setKeepId("B")}
            >
              {selectedB.masterCode}
            </Button>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {keepId === "A" ? selectedB.masterCode : selectedA.masterCode} will
              be deactivated, its {keepId === "A" ? selectedB.skuCount : selectedA.skuCount} SKUs moved to{" "}
              {keepId === "A" ? selectedA.masterCode : selectedB.masterCode}
            </span>
          </div>

          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            disabled={acceptMerge.isPending || selectedA.id === selectedB.id}
            onClick={() => setConfirmOpen(true)}
          >
            {acceptMerge.isPending ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <GitMerge className="h-4 w-4" />
            )}
            Merge Cabinets
          </Button>

          {selectedA.id === selectedB.id && (
            <p className="text-xs text-destructive">
              Cannot merge a cabinet with itself.
            </p>
          )}
        </div>
      )}

      {/* Confirmation dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Merge</AlertDialogTitle>
            <AlertDialogDescription>
              This will move all SKUs and overrides from{" "}
              <strong>
                {keepId === "A" ? selectedB?.masterCode : selectedA?.masterCode}
              </strong>{" "}
              to{" "}
              <strong>
                {keepId === "A" ? selectedA?.masterCode : selectedB?.masterCode}
              </strong>
              , then deactivate the duplicate. This cannot be easily undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleMerge}
            >
              Merge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ─── Main Component ─── */
export default function PotentialMergesAdmin() {
  const utils = trpc.useUtils();
  const { data, isLoading, error, refetch } =
    trpc.genericCabinets.potentialMerges.useQuery();

  const [swapped, setSwapped] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const acceptMerge = trpc.genericCabinets.acceptMerge.useMutation({
    onSuccess: () => {
      utils.genericCabinets.potentialMerges.invalidate();
      toast.success(
        "Merged — SKUs moved, duplicate deactivated and aliased to the canonical cabinet."
      );
    },
    onError: (e) => toast.error(e.message),
  });

  const dismissMerge = trpc.genericCabinets.dismissMerge.useMutation({
    onSuccess: () => {
      utils.genericCabinets.potentialMerges.invalidate();
      toast.success("Dismissed — this pair won't appear again.");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleAccept = async (c: Candidate) => {
    const isSwapped = swapped[c.key];
    const canonicalId = isSwapped ? c.cabinetB.id : c.cabinetA.id;
    const duplicateId = isSwapped ? c.cabinetA.id : c.cabinetB.id;
    setPending((p) => ({ ...p, [c.key]: true }));
    try {
      await acceptMerge.mutateAsync({ canonicalId, duplicateId });
    } finally {
      setPending((p) => ({ ...p, [c.key]: false }));
    }
  };

  const handleDismiss = async (c: Candidate) => {
    setPending((p) => ({ ...p, [c.key]: true }));
    try {
      await dismissMerge.mutateAsync({ key: c.key });
    } finally {
      setPending((p) => ({ ...p, [c.key]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="suggestions" className="w-full">
        <TabsList>
          <TabsTrigger value="suggestions" className="gap-1.5">
            <GitMerge className="h-3.5 w-3.5" />
            Auto Suggestions
            {data && data.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {data.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-1.5">
            <Search className="h-3.5 w-3.5" />
            Manual Merge
          </TabsTrigger>
        </TabsList>

        <TabsContent value="suggestions" className="mt-4">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner className="h-6 w-6 text-primary" />
            </div>
          ) : error ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-destructive">
                Failed to load suggestions: {error.message}
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : !data || data.length === 0 ? (
            <div className="text-center py-16 space-y-2">
              <GitMerge className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-muted-foreground font-medium">
                No potential duplicates found.
              </p>
              <p className="text-sm text-muted-foreground">
                All cabinet codes are unique or already aliased correctly.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <GitMerge className="h-5 w-5 text-amber-500" />
                    Potential Duplicate Cabinets
                    <Badge variant="secondary">{data.length}</Badge>
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Review each pair. Merge moves all SKUs to the keeper and
                    deactivates the duplicate.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Refresh
                </Button>
              </div>

              <div className="space-y-3">
                {data.map((c) => (
                  <MergeCard
                    key={c.key}
                    candidate={c}
                    isSwapped={!!swapped[c.key]}
                    isPending={!!pending[c.key]}
                    onSwap={() =>
                      setSwapped((s) => ({ ...s, [c.key]: !s[c.key] }))
                    }
                    onAccept={() => handleAccept(c)}
                    onDismiss={() => handleDismiss(c)}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="manual" className="mt-4">
          <ManualMerge />
        </TabsContent>
      </Tabs>
    </div>
  );
}
