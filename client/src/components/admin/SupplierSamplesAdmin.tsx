/**
 * Pull the Preston door samples and colours from the manufacturer's catalog.
 *
 * Tom, Nov 13 2026: "milestone is truth". The sync lives in the backend
 * (doorStyles.importSupplierSamples); this is the button, so nobody has to paste a
 * fetch call into a browser console to import a catalogue.
 *
 * Dry run first, always: it fetches and measures every style and shows the hex it
 * read, then writes nothing until the operator confirms.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type SampleRow = {
  id: number;
  name: string;
  ok: boolean;
  hex: string | null;
  imageUrl: string | null;
  note: string;
};

type SampleResult = {
  dryRun: boolean;
  total: number;
  written: number;
  failed: number;
  results: SampleRow[];
};

/**
 * The procedure ships in the paired cabinet-backend PR, so the client types may not
 * carry it yet. Cast until AppRouter includes it, then delete this shape.
 */
const supplierSampleProcedure = trpc as unknown as {
  doorStyles: {
    importSupplierSamples: {
      useMutation: (options?: {
        onSuccess?: (result: SampleResult) => void;
        onError?: (error: { message?: string }) => void;
      }) => { mutate: (input: { dryRun: boolean }) => void };
    };
  };
};

export default function SupplierSamplesAdmin() {
  const [result, setResult] = useState<SampleResult | null>(null);
  const [busy, setBusy] = useState(false);

  const run = supplierSampleProcedure.doorStyles.importSupplierSamples.useMutation({
    onSuccess: (next) => {
      setResult(next);
      setBusy(false);
      toast.success(next.dryRun
        ? `Dry run: ${next.total} styles read, nothing written.`
        : `Wrote ${next.written} styles from the supplier catalog.`);
    },
    onError: (error) => {
      setBusy(false);
      toast.error("The supplier import did not run", { description: error.message });
    },
  });

  const start = (dryRun: boolean) => {
    setBusy(true);
    run.mutate({ dryRun });
  };

  return (
    <div className="mb-4 rounded-lg border border-slate-300 bg-slate-50/60 px-4 py-3" data-testid="supplier-samples-admin">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">Milestone door samples</p>
          <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
            Reads each Preston style&apos;s own door image from the manufacturer&apos;s catalog, measures its
            colour, stores the image and writes both fields on the style. A dry run fetches and measures
            every style and changes nothing.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => start(true)} data-testid="supplier-samples-dry-run">
            {busy && result == null ? "Reading…" : "Dry run"}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy || !result || !result.dryRun}
            onClick={() => start(false)}
            data-testid="supplier-samples-write"
          >
            Write to catalog
          </Button>
        </div>
      </div>

      {result && (
        <div className="mt-3 space-y-2" data-testid="supplier-samples-result">
          <p className="text-xs text-slate-700">
            {result.dryRun ? "Dry run" : "Written"}: {result.total} styles, {result.written} readable,{" "}
            {result.failed} failed.
            {result.dryRun ? " Nothing has been saved yet — press Write to catalog to keep these values." : ""}
          </p>
          <div className="max-h-64 overflow-auto rounded border border-slate-200 bg-white">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-100 text-left">
                <tr>
                  <th className="px-2 py-1">Style</th>
                  <th className="px-2 py-1">Measured</th>
                  <th className="px-2 py-1">Note</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-2 py-1 whitespace-nowrap">
                      {row.name} <span className="text-muted-foreground">#{row.id}</span>
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      {row.hex ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block h-3 w-3 rounded border border-slate-300" style={{ backgroundColor: row.hex }} />
                          {row.hex}
                        </span>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">none</Badge>
                      )}
                    </td>
                    <td className="px-2 py-1 text-muted-foreground">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
