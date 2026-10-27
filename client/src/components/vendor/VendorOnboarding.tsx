import { useMemo, useRef, useState } from "react";
import { FileSpreadsheet, Loader2, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useVendorOnboardingApi, type IngestResult, type SubmitDetailsResult } from "@/lib/vendorOnboardingApi";
import {
  EMPTY_ONBOARDING_SUMMARY,
  ONBOARDING_TEMPLATE,
  SUMMARY_EXPLANATIONS,
  badRequestMessage,
  conflictReviewSentence,
  draftFromRow,
  drawerFieldState,
  fieldsForRow,
  flagReasonLabel,
  flaggedRowsOnly,
  ingestInputFromPrepared,
  prepareOnboardingUpload,
  styleChoices,
  submitDetailsInput,
  type DetailDraft,
  type OnboardingDoor,
  type OnboardingRow,
  type OnboardingSummaryCounts,
  type SpecialField,
} from "@/lib/vendorOnboarding";

const SUMMARY_KEYS = ["total", "matched", "flagged", "completed", "trimHeld", "styleUnmapped"] as const;

const FIELD_LABEL: Record<string, string> = {
  distributorName: "Distributor",
  style: "Style",
  color: "Color",
  price: "Price",
  category: "Category",
  subCategory: "Subcategory",
  width: "Width",
  height: "Height",
  depth: "Depth",
  description: "Description",
  numberOfDoors: "Doors",
  numberOfDrawers: "Drawers",
};

function formatMeasure(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return `${parsed}"`;
}

export function VendorOnboarding({ distributorId }: { distributorId?: number }) {
  const api = useVendorOnboardingApi();
  const utils = api.useUtils();
  const scope = distributorId ? { distributorId } : {};
  const summary = api.vendorOnboarding.summary.useQuery(scope);
  const [uploaded, setUploaded] = useState<{ importId: number; counts: OnboardingSummaryCounts; notes: string[]; fileName: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<number[]>([]);
  const [patches, setPatches] = useState<Record<number, OnboardingRow>>({});
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [pasted, setPasted] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const sheetNotes = useRef<string[]>([]);
  const importId = uploaded?.importId ?? summary.data?.importId ?? null;
  const counts = uploaded?.counts ?? summary.data?.counts ?? EMPTY_ONBOARDING_SUMMARY;
  const flagged = api.vendorOnboarding.flagged.useQuery(
    { importId: importId ?? 0, ...scope },
    { enabled: importId != null },
  );

  const ingest = api.vendorOnboarding.ingest.useMutation({
    onSuccess: (result: IngestResult, input) => {
      setUploaded({
        importId: result.importId,
        counts: result.summary,
        notes: [...sheetNotes.current, ...result.notes],
        fileName: input.fileName ?? "spreadsheet",
      });
      setUploadError(null);
      setHiddenIds([]);
      setPatches({});
      setRowErrors({});
      setNotices([]);
      void utils.vendorOnboarding.summary.invalidate();
      void utils.vendorOnboarding.flagged.invalidate();
    },
    onError: (error) => {
      const inline = badRequestMessage(error);
      if (inline) setUploadError(inline);
      else toast.error(error.message || "The spreadsheet could not be imported.");
    },
  });

  const sendPrepared = async (file: File) => {
    setUploadError(null);
    try {
      const prepared = await prepareOnboardingUpload(file);
      if (!prepared.ok) {
        setUploadError(prepared.message);
        return;
      }
      sheetNotes.current = prepared.notes;
      ingest.mutate(ingestInputFromPrepared(prepared, distributorId));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "The spreadsheet could not be read.");
    }
  };

  const reloadLatest = () => {
    setUploaded(null);
    setHiddenIds([]);
    setPatches({});
    setRowErrors({});
    void summary.refetch();
    if (importId != null) void flagged.refetch();
  };

  const doors = flagged.data?.doors ?? [];
  const rows = flaggedRowsOnly(flagged.data?.rows ?? [])
    .filter((row) => !hiddenIds.includes(row.id))
    .map((row) => patches[row.id] ?? row);

  const rememberSubmission = (result: SubmitDetailsResult) => {
    if (result.summary) {
      setUploaded((current) => ({
        importId: result.row.importId,
        counts: result.summary,
        notes: current?.notes ?? [],
        fileName: current?.fileName ?? summary.data?.fileName ?? "Latest import",
      }));
    }
    if (result.conflictStatus === "review") {
      setNotices((current) => [...current, conflictReviewSentence(result.row.sku)]);
    }
    if (result.row.status !== "flagged") {
      setHiddenIds((current) => current.includes(result.row.id) ? current : [...current, result.row.id]);
      setPatches((current) => {
        if (current[result.row.id] == null) return current;
        const next = { ...current };
        delete next[result.row.id];
        return next;
      });
    } else {
      setPatches((current) => ({ ...current, [result.row.id]: result.row }));
    }
    setRowErrors((current) => {
      if (current[result.row.id] == null) return current;
      const next = { ...current };
      delete next[result.row.id];
      return next;
    });
    void utils.vendorOnboarding.summary.invalidate();
    void utils.vendorOnboarding.flagged.invalidate();
  };

  return (
    <div className="space-y-6" data-testid="vendor-onboarding">
      <div>
        <h2 className="text-xl font-bold">Onboarding</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a price sheet. A SKU that matches one cabinet only needs distributor, style, color, and price.
          Dimensions, type, and description come from that cabinet. Anything that does not match, matches more than one cabinet, or is missing one of those four stays on the list below.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-5 w-5" /> Spreadsheet upload
          </CardTitle>
          <CardDescription>
            CSV or TSV text is sent as uploaded. An Excel file is read in the browser and sent as rows.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" disabled={ingest.isPending} onClick={() => fileRef.current?.click()}>
              {ingest.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Choose spreadsheet
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt,.xlsx,.xls,text/csv,text/tab-separated-values"
              className="hidden"
              aria-label="Spreadsheet upload"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void sendPrepared(file);
                event.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const url = URL.createObjectURL(new Blob([ONBOARDING_TEMPLATE], { type: "text/csv" }));
                const link = document.createElement("a");
                link.href = url;
                link.download = "vendor-onboarding-template.csv";
                link.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download template
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={reloadLatest} disabled={summary.isLoading}>
              <RefreshCw className="mr-2 h-4 w-4" /> Reload latest import
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="onboarding-paste">CSV or TSV text</Label>
            <Textarea
              id="onboarding-paste"
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
              rows={4}
              className="font-mono text-xs"
              placeholder={"SKU,Style,Color,Price\nB12,Shaker,White,189.00"}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!pasted.trim() || ingest.isPending}
              onClick={() => {
                const file = new File([pasted], "pasted.csv", { type: "text/csv" });
                void sendPrepared(file);
              }}
            >
              Import pasted sheet
            </Button>
          </div>

          {uploadError && <p role="alert" className="text-sm text-destructive">{uploadError}</p>}
          {uploaded?.notes.length ? <p className="text-xs text-muted-foreground">{uploaded.notes.join(" ")}</p> : null}
          {importId != null && (
            <p className="text-xs text-muted-foreground">
              Import {importId}
              {(uploaded?.fileName ?? summary.data?.fileName) ? ` · ${uploaded?.fileName ?? summary.data?.fileName}` : ""}
            </p>
          )}
        </CardContent>
      </Card>

      {summary.error && !uploaded && <p role="alert" className="text-sm text-destructive">{summary.error.message}</p>}
      <section aria-label="Import summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SUMMARY_KEYS.map((key) => (
          <Card key={key}>
            <CardContent className="space-y-1 p-4">
              <p className="text-xs text-muted-foreground">{SUMMARY_EXPLANATIONS[key].label}</p>
              <p className="text-2xl font-semibold" data-testid={`onboarding-count-${key}`}>{counts[key]}</p>
              <p className="text-sm text-muted-foreground">{SUMMARY_EXPLANATIONS[key].explanation}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-3" data-testid="complete-these-items">
        <div>
          <h3 className="text-lg font-semibold">Complete these items</h3>
          <p className="text-sm text-muted-foreground">Only flagged rows are listed. Matched cabinets are not shown again.</p>
        </div>
        {notices.map((notice) => (
          <p key={notice} role="status" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {notice}
          </p>
        ))}
        {importId == null && !summary.isLoading && (
          <p className="text-sm text-muted-foreground">No spreadsheet has been imported for this line yet.</p>
        )}
        {flagged.isLoading && importId != null && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading flagged rows…</div>
        )}
        {flagged.error && <p role="alert" className="text-sm text-destructive">{flagged.error.message}</p>}
        {importId != null && !flagged.isLoading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing is waiting. Matched SKUs did not need more than distributor, style, color, and price.</p>
        )}
        {rows.map((row) => (
          <FlaggedRowCard
            key={`${row.importId}-${row.id}`}
            row={row}
            doors={doors}
            distributorId={distributorId}
            error={rowErrors[row.id] ?? null}
            onError={(message) => setRowErrors((current) => ({ ...current, [row.id]: message }))}
            onSubmitted={rememberSubmission}
          />
        ))}
      </section>
    </div>
  );
}

function ReadOnlyValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value || "—"}</dd>
    </div>
  );
}

function FlaggedRowCard({
  row,
  doors,
  distributorId,
  error,
  onError,
  onSubmitted,
}: {
  row: OnboardingRow;
  doors: OnboardingDoor[];
  distributorId?: number;
  error: string | null;
  onError: (message: string) => void;
  onSubmitted: (result: SubmitDetailsResult) => void;
}) {
  const api = useVendorOnboardingApi();
  const [draft, setDraft] = useState<DetailDraft>(() => draftFromRow(row));
  const fields = fieldsForRow(row);
  const styles = useMemo(() => styleChoices(doors, draft.style), [doors, draft.style]);
  const drawers = drawerFieldState({
    width: draft.width || row.inherited?.width,
    category: draft.category || row.inherited?.category,
    subCategory: draft.subCategory || row.inherited?.subCategory,
    description: draft.description || row.inherited?.description,
    masterCode: row.masterCode ?? row.sku,
    numberOfDrawers: draft.numberOfDrawers,
  });

  const setField = (field: keyof DetailDraft, value: string) => {
    setDraft((current) => {
      const next = { ...current, [field]: value };
      if (field === "style" && !current.color.trim()) {
        const door = doors.find((item) => item.name === value);
        if (door?.color) next.color = door.color;
      }
      return next;
    });
  };

  const submit = api.vendorOnboarding.submitDetails.useMutation({
    onSuccess: (result) => onSubmitted(result),
    onError: (failure) => {
      const inline = badRequestMessage(failure);
      if (inline) onError(inline);
      else toast.error(failure.message || "Could not save this row.");
    },
  });

  const save = () => {
    const prepared = submitDetailsInput(
      row,
      drawers.locked ? { ...draft, numberOfDrawers: "0" } : draft,
      distributorId,
    );
    if ("error" in prepared) {
      onError(prepared.error);
      return;
    }
    submit.mutate(prepared.input);
  };

  const inherited = row.inherited;

  return (
    <Card data-testid={`flagged-row-${row.id}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-mono">Row {row.rowNumber} · {row.sku}</CardTitle>
        <CardDescription>{flagReasonLabel(row.flagReason)}{row.message ? ` · ${row.message}` : ""}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {row.flagReason === "ambiguous" && row.candidateMasterCodes.length > 0 && (
          <p className="text-sm">
            This SKU matches more than one cabinet: {row.candidateMasterCodes.join(", ")}. It was not guessed.
          </p>
        )}
        {!row.needsFullDetails && (
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Master details, read only</p>
            {inherited ? (
              <dl className="grid gap-2 sm:grid-cols-2">
                <ReadOnlyValue label="Master" value={inherited.masterCode} />
                <ReadOnlyValue label="Type" value={[inherited.category, inherited.subCategory].filter(Boolean).join(" / ")} />
                <ReadOnlyValue label="Size" value={`${formatMeasure(inherited.width)} W × ${formatMeasure(inherited.height)} H × ${formatMeasure(inherited.depth)} D`} />
                <ReadOnlyValue label="Description" value={inherited.description ?? "—"} />
                <ReadOnlyValue label="Doors" value={inherited.numberOfDoors == null ? "—" : String(inherited.numberOfDoors)} />
                <ReadOnlyValue label="Drawers" value={inherited.numberOfDrawers == null ? "—" : String(inherited.numberOfDrawers)} />
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Master details are not available for this row.</p>
            )}
          </div>
        )}
        {!row.needsFullDetails && (
          <dl className="grid gap-2 sm:grid-cols-2">
            {(["distributorName", "style", "color", "price"] as SpecialField[])
              .filter((field) => !row.missingFields.includes(field))
              .map((field) => (
                <ReadOnlyValue
                  key={field}
                  label={FIELD_LABEL[field]}
                  value={field === "distributorName" ? row.distributorName ?? "—" : field === "style" ? row.style ?? "—" : field === "color" ? row.color ?? "—" : row.price ?? "—"}
                />
              ))}
          </dl>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((field) => (
            <FieldControl
              key={field}
              rowId={row.id}
              field={field}
              draft={draft}
              styles={styles}
              drawersLocked={field === "numberOfDrawers" && drawers.locked}
              drawersValue={drawers.value}
              onChange={setField}
            />
          ))}
        </div>
        {fields.includes("numberOfDrawers") && drawers.locked && (
          <p className="text-sm text-muted-foreground">9-inch bases never have drawers.</p>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="button" onClick={save} disabled={submit.isPending}>
          {submit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save {row.sku}
        </Button>
      </CardContent>
    </Card>
  );
}

function FieldControl({
  rowId,
  field,
  draft,
  styles,
  drawersLocked,
  drawersValue,
  onChange,
}: {
  rowId: number;
  field: string;
  draft: DetailDraft;
  styles: string[];
  drawersLocked: boolean;
  drawersValue: string;
  onChange: (field: keyof DetailDraft, value: string) => void;
}) {
  const label = FIELD_LABEL[field] ?? field;
  const id = `onboarding-${rowId}-${field}`;
  if (field === "style") {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        <select
          id={id}
          aria-label={label}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          value={draft.style}
          onChange={(event) => onChange("style", event.target.value)}
        >
          <option value="">Choose a door</option>
          {styles.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>
    );
  }
  if (field === "description") {
    return (
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={id}>{label}</Label>
        <Textarea id={id} aria-label={label} value={draft.description} onChange={(event) => onChange("description", event.target.value)} rows={2} />
      </div>
    );
  }
  const value = field === "numberOfDrawers" && drawersLocked ? drawersValue : draft[field as keyof DetailDraft];
  const numeric = field === "price" || field === "width" || field === "height" || field === "depth" || field === "numberOfDoors" || field === "numberOfDrawers";
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-label={label}
        type={numeric ? "number" : "text"}
        step={field === "price" || field === "width" || field === "height" || field === "depth" ? "0.01" : "1"}
        min={field === "numberOfDoors" || field === "numberOfDrawers" ? "0" : undefined}
        value={value}
        disabled={field === "numberOfDrawers" && drawersLocked}
        onChange={(event) => onChange(field as keyof DetailDraft, event.target.value)}
      />
    </div>
  );
}
