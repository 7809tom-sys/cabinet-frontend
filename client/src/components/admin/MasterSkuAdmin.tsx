/**
 * Master SKU Alias Program — Admin UI
 *
 * Three-tab interface for managing duplicate cabinet codes across suppliers:
 *  - Suggestions: AI-generated merge candidates awaiting human review
 *  - Aliases:     Current alias→master mappings with conflict status
 *  - Rules:       Matching rule configuration (weight sliders, enable/disable)
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  XCircle,
  Trash2,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Search,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Suggestions Tab ──────────────────────────────────────────────────────────

function SuggestionsTab() {
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "dismissed" | "all">(
    "pending"
  );
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = trpc.masterSku.listSuggestions.useQuery({
    status: statusFilter,
    page,
    pageSize: 50,
  });

  const utils = trpc.useUtils();

  const approve = trpc.masterSku.approveSuggestion.useMutation({
    onSuccess: () => {
      toast.success("Suggestion approved — alias created");
      utils.masterSku.listSuggestions.invalidate();
      utils.masterSku.listAliases.invalidate();
      utils.masterSku.summaryCounts.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const dismiss = trpc.masterSku.dismissSuggestion.useMutation({
    onSuccess: () => {
      toast.success("Suggestion dismissed");
      utils.masterSku.listSuggestions.invalidate();
      utils.masterSku.summaryCounts.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const approveAll = trpc.masterSku.approveAll.useMutation({
    onSuccess: (result) => {
      toast.success(`Approved ${result.approved} suggestion${result.approved !== 1 ? "s" : ""} — aliases created`);
      utils.masterSku.listSuggestions.invalidate();
      utils.masterSku.listAliases.invalidate();
      utils.masterSku.summaryCounts.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const scoreColor = (score: number) => {
    if (score >= 90) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    if (score >= 80) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
  };

  const statusBadge = (status: string) => {
    if (status === "approved")
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Approved</Badge>;
    if (status === "dismissed")
      return <Badge variant="secondary">Dismissed</Badge>;
    return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Pending</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {(["pending", "approved", "dismissed", "all"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? "default" : "outline"}
            onClick={() => {
              setStatusFilter(s);
              setPage(1);
            }}
            className="capitalize"
          >
            {s}
          </Button>
        ))}
        {data && (
          <span className="text-sm text-muted-foreground self-center">
            {data.total} result{data.total !== 1 ? "s" : ""}
          </span>
        )}
        {statusFilter === "pending" && (data?.total ?? 0) > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                className="ml-auto gap-1.5 bg-green-700 hover:bg-green-800 text-white"
                disabled={approveAll.isPending}
              >
                {approveAll.isPending ? (
                  <Spinner className="h-3.5 w-3.5" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Approve All ({data?.total ?? 0})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Approve all {data?.total ?? 0} pending suggestions?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will create alias mappings for all pending suggestions at once. Distributors
                  whose pricing uses these alias codes will immediately appear on the matching product
                  pages. Conflicts will be flagged for review.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-green-700 hover:bg-green-800"
                  onClick={() => approveAll.mutate({ minScore: 0 })}
                >
                  Approve All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : !data?.rows.length ? (
        <div className="text-center py-12 text-muted-foreground">
          No {statusFilter === "all" ? "" : statusFilter} suggestions found.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alias Code</TableHead>
                <TableHead></TableHead>
                <TableHead>Master Code</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono font-semibold">{row.aliasCode}</TableCell>
                  <TableCell>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                  <TableCell className="font-mono font-semibold text-[var(--color-navy)]">
                    {row.masterCode}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("font-mono text-xs", scoreColor(row.similarityScore))}>
                      {row.similarityScore}%
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs text-sm text-muted-foreground">
                    {row.reason ?? "—"}
                  </TableCell>
                  <TableCell>{statusBadge(row.status)}</TableCell>
                  <TableCell className="text-right">
                    {row.status === "pending" && (
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/20"
                          disabled={approve.isPending}
                          onClick={() => approve.mutate({ id: row.id })}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-muted-foreground"
                          disabled={dismiss.isPending}
                          onClick={() => dismiss.mutate({ id: row.id })}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Dismiss
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {data && data.total > 50 && (
        <div className="flex gap-2 justify-center">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm self-center text-muted-foreground">
            Page {page} of {Math.ceil(data.total / 50)}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= Math.ceil(data.total / 50)}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Aliases Tab ──────────────────────────────────────────────────────────────

function AliasesTab() {
  const [search, setSearch] = useState("");
  const [conflictOnly, setConflictOnly] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading } = trpc.masterSku.listAliases.useQuery({
    search: search || undefined,
    conflictOnly: conflictOnly || undefined,
    page,
    pageSize: 50,
  });

  const utils = trpc.useUtils();

  const deleteAlias = trpc.masterSku.deleteAlias.useMutation({
    onSuccess: () => {
      toast.success("Alias deleted");
      utils.masterSku.listAliases.invalidate();
      utils.masterSku.summaryCounts.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      {/* Search + filter bar */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search alias or master code…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Button
          size="sm"
          variant={conflictOnly ? "default" : "outline"}
          className="gap-2"
          onClick={() => {
            setConflictOnly((v) => !v);
            setPage(1);
          }}
        >
          <AlertTriangle className="h-4 w-4" />
          Conflicts only
        </Button>
        {data && (
          <span className="text-sm text-muted-foreground self-center">
            {data.total} alias{data.total !== 1 ? "es" : ""}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : !data?.rows.length ? (
        <div className="text-center py-12 text-muted-foreground">
          No aliases found. Approve suggestions to create aliases.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alias Code</TableHead>
                <TableHead></TableHead>
                <TableHead>Master Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono font-semibold">{row.aliasCode}</TableCell>
                  <TableCell>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                  <TableCell className="font-mono font-semibold text-[var(--color-navy)]">
                    {row.masterCode}
                  </TableCell>
                  <TableCell>
                    {row.conflictStatus === "conflict" ? (
                      <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Conflict
                      </Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        OK
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs text-sm text-muted-foreground truncate">
                    {row.notes ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete alias?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove the mapping{" "}
                            <strong className="font-mono">{row.aliasCode}</strong> →{" "}
                            <strong className="font-mono">{row.masterCode}</strong>. This action
                            cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteAlias.mutate({ id: row.id })}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {data && data.total > 50 && (
        <div className="flex gap-2 justify-center">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm self-center text-muted-foreground">
            Page {page} of {Math.ceil(data.total / 50)}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= Math.ceil(data.total / 50)}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Rules Tab ────────────────────────────────────────────────────────────────

function RulesTab() {
  const { data: rules, isLoading } = trpc.masterSku.listRules.useQuery();
  const utils = trpc.useUtils();

  const updateRule = trpc.masterSku.updateRule.useMutation({
    onSuccess: () => utils.masterSku.listRules.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!rules?.length) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-muted-foreground">
          No matching rules configured yet. Rules guide the AI similarity detection.
        </p>
        <p className="text-sm text-muted-foreground">
          Default rules are seeded automatically when the first AI scan runs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Matching rules control how the AI scan weighs different similarity signals. Higher weight =
        more influence on the final similarity score.
      </p>
      <div className="rounded-md border divide-y">
        {rules.map((rule) => (
          <div key={rule.id} className="p-4 flex items-start gap-4">
            <Switch
              checked={rule.enabled}
              onCheckedChange={(enabled) => updateRule.mutate({ id: rule.id, enabled })}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{rule.ruleName}</span>
                {!rule.enabled && (
                  <Badge variant="secondary" className="text-xs">
                    Disabled
                  </Badge>
                )}
              </div>
              {rule.description && (
                <p className="text-sm text-muted-foreground mt-0.5">{rule.description}</p>
              )}
            </div>
            <div className="flex items-center gap-3 min-w-[180px]">
              <span className="text-sm text-muted-foreground w-12 text-right">
                Weight: {rule.weight}
              </span>
              <Slider
                min={1}
                max={10}
                step={1}
                value={[rule.weight]}
                onValueChange={([val]) => updateRule.mutate({ id: rule.id, weight: val })}
                disabled={!rule.enabled}
                className="w-24"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MasterSkuAdmin() {
  const [activeTab, setActiveTab] = useState("suggestions");

  const { data: counts } = trpc.masterSku.summaryCounts.useQuery();
  const utils = trpc.useUtils();

  const triggerScan = trpc.masterSku.triggerAiScan.useMutation({
    onSuccess: (result) => {
      toast.success(
        `AI scan complete — ${result.inserted} new suggestion${result.inserted !== 1 ? "s" : ""} added`
      );
      utils.masterSku.listSuggestions.invalidate();
      utils.masterSku.summaryCounts.invalidate();
    },
    onError: (err) => toast.error(`Scan failed: ${err.message}`),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">Master SKU Alias Program</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage duplicate cabinet codes across suppliers. AI detects potential duplicates; you
            approve or dismiss them.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Summary badges */}
          {counts && (
            <>
              {counts.pendingSuggestions > 0 && (
                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 gap-1">
                  <Sparkles className="h-3 w-3" />
                  {counts.pendingSuggestions} pending
                </Badge>
              )}
              {counts.conflictAliases > 0 && (
                <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {counts.conflictAliases} conflict{counts.conflictAliases !== 1 ? "s" : ""}
                </Badge>
              )}
              <Badge variant="outline" className="gap-1">
                {counts.totalAliases} alias{counts.totalAliases !== 1 ? "es" : ""}
              </Badge>
            </>
          )}

          {/* Run AI Scan button */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="gap-2 bg-[var(--color-navy)] hover:bg-[var(--color-navy)]/90">
                <Sparkles className="h-4 w-4" />
                Run AI Scan
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Run AI Duplicate Scan?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will analyze the entire cabinet catalog for potential duplicate SKU codes
                  across suppliers. The AI will generate new pending suggestions for your review.
                  This may take 10–30 seconds and will use LLM credits.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => triggerScan.mutate()}
                  disabled={triggerScan.isPending}
                >
                  {triggerScan.isPending ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Scanning…
                    </span>
                  ) : (
                    "Run Scan"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="suggestions" className="gap-2">
            Suggestions
            {counts?.pendingSuggestions ? (
              <Badge className="ml-1 h-5 min-w-5 px-1.5 text-xs bg-blue-500 text-white">
                {counts.pendingSuggestions}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="aliases" className="gap-2">
            Aliases
            {counts?.conflictAliases ? (
              <Badge className="ml-1 h-5 min-w-5 px-1.5 text-xs bg-red-500 text-white">
                {counts.conflictAliases}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="suggestions" className="mt-6">
          <SuggestionsTab />
        </TabsContent>

        <TabsContent value="aliases" className="mt-6">
          <AliasesTab />
        </TabsContent>

        <TabsContent value="rules" className="mt-6">
          <RulesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
