import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { seedLegalSlots, type LegalSheet } from "@shared/legalPages";
import { isSpreadsheetName, sheetFromArrayBuffer } from "@/lib/legalSheetFile";
import { useMembershipProgramProcedures } from "@/lib/membershipProgramProcedures";

function readFile(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

export default function LegalPagesOperationsAdmin() {
  const api = useMembershipProgramProcedures();
  const query = api.legalPages.list.useQuery(undefined, { retry: false });
  const utils = api.useUtils();
  const fallback = useMemo(() => seedLegalSlots("2026-11-11T00:00:00.000Z", "Site pages"), []);
  const slots = query.data?.slots?.length
    ? query.data.slots
    : fallback.map((slot) => ({
        slug: slot.slug,
        title: slot.title,
        publicPath: slot.publicPath,
        publishedVersion: slot.publishedVersion,
        versions: slot.versions.map((version) => ({
          version: version.version,
          source: version.source,
          bodyText: version.bodyText,
          fileName: version.file?.fileName ?? null,
          uploadedAt: version.uploadedAt,
          uploadedBy: version.uploadedBy,
          hasSheet: Boolean(version.sheet),
        })),
        presentation: { render: "site-page" as const, bodyText: null, file: null, sheet: null, version: 1, versionLabel: `${slot.slug}@1` },
      }));
  const [slug, setSlug] = useState(slots[0]?.slug ?? "warranty");
  const [body, setBody] = useState("");
  const [sheet, setSheet] = useState<LegalSheet | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newPath, setNewPath] = useState("");
  const active = slots.find((slot) => slot.slug === slug) ?? slots[0];

  const publish = api.legalPages.publish.useMutation({
    onSuccess: () => {
      toast.success("Published. The public page now uses this version.");
      setBody("");
      setSheet(null);
      setFileName(null);
      setFileBase64(null);
      void utils.legalPages.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const rollback = api.legalPages.rollback.useMutation({
    onSuccess: () => {
      toast.success("Rolled back. That version is public again.");
      void utils.legalPages.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const addSlot = api.legalPages.addSlot.useMutation({
    onSuccess: () => {
      toast.success("Page added.");
      setNewTitle("");
      setNewPath("");
      void utils.legalPages.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  async function onFile(file: File | undefined) {
    if (!file) return;
    const bytes = await readFile(file);
    if (active?.slug === "warranty" && isSpreadsheetName(file.name)) {
      const parsed = sheetFromArrayBuffer(bytes, file.name);
      if ("error" in parsed) {
        toast.error(parsed.error);
        return;
      }
      setSheet(parsed);
      setFileName(file.name);
      toast.success("Spreadsheet read. Saving publishes it under the warranty wording.");
      return;
    }
    if (isSpreadsheetName(file.name)) {
      const parsed = sheetFromArrayBuffer(bytes, file.name);
      if ("error" in parsed) {
        toast.error(parsed.error);
        return;
      }
      setSheet(parsed);
      setFileName(file.name);
      return;
    }
    if (file.name.toLowerCase().endsWith(".txt")) {
      setBody(new TextDecoder().decode(bytes));
      setFileName(file.name);
      return;
    }
    const binary = new Uint8Array(bytes);
    let encoded = "";
    for (let i = 0; i < binary.length; i += 1) encoded += String.fromCharCode(binary[i]);
    setFileBase64(btoa(encoded));
    setFileName(file.name);
    setMimeType(file.type || "application/octet-stream");
  }

  return (
    <div className="space-y-6" data-testid="legal-pages-operations">
      <div>
        <h2 className="font-serif text-2xl font-bold">Warranties and legal pages</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick a page, then upload the document or sheet. Saving publishes that version to the page&apos;s public address.
          Terms, privacy, and warranty wording stay on their current pages until you publish a replacement.
          The warranty spreadsheet is shown under the warranty text and does not rewrite it.
        </p>
        {query.data?.schemaMissing && (
          <p className="mt-2 text-sm text-amber-800">The legal-page tables are not in the database yet. Run docs/sql/0278_affiliate_membership_checkout.tidb.sql, then save again.</p>
        )}
      </div>

      <div className="max-w-md space-y-2">
        <Label>Page</Label>
        <Select value={active?.slug} onValueChange={setSlug}>
          <SelectTrigger aria-label="Legal page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {slots.map((slot) => (
              <SelectItem key={slot.slug} value={slot.slug}>{slot.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {active && <p className="text-xs text-muted-foreground">Public address: {active.publicPath}. Published version {active.publishedVersion}.</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="legal-body">Edit the text</Label>
        <Textarea id="legal-body" rows={8} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Paste replacement text. Leave this empty to upload a file or a warranty sheet only." />
      </div>
      <div className="space-y-2">
        <Label htmlFor="legal-file">Upload a document or sheet</Label>
        <Input
          id="legal-file"
          type="file"
          accept={active?.slug === "warranty" ? ".pdf,.docx,.txt,.csv,.xlsx,.xls" : ".pdf,.docx,.txt,.csv,.xlsx"}
          onChange={(event) => void onFile(event.target.files?.[0])}
        />
        {fileName && <p className="text-xs text-muted-foreground">Ready: {fileName}{sheet ? ` (${sheet.rows.length} data rows)` : ""}</p>}
      </div>
      <Button
        className="bg-[var(--color-navy)] text-white"
        disabled={!active || publish.isPending}
        onClick={() => active && publish.mutate({
          slug: active.slug,
          bodyText: body.trim() ? body : null,
          fileName,
          mimeType,
          fileBase64,
          sheet,
        })}
      >
        {publish.isPending ? "Publishing…" : "Save and publish"}
      </Button>

      {active && (
        <div className="space-y-2">
          <h3 className="font-semibold">Version history</h3>
          <ul className="space-y-2 text-sm">
            {active.versions.map((version) => (
              <li key={version.version} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                <span>
                  Version {version.version} · {version.source} · {version.uploadedBy} · {new Date(version.uploadedAt).toLocaleString()}
                  {version.version === active.publishedVersion ? " · public" : ""}
                  {version.hasSheet ? " · spreadsheet" : ""}
                </span>
                {version.version !== active.publishedVersion && (
                  <Button size="sm" variant="outline" disabled={rollback.isPending} onClick={() => rollback.mutate({ slug: active.slug, version: version.version })}>
                    Roll back to this
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-border p-4 space-y-3">
        <h3 className="font-semibold">Add a page</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input aria-label="New page name" placeholder="Page name" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} />
          <Input aria-label="New public address" placeholder="/your-page" value={newPath} onChange={(event) => setNewPath(event.target.value)} />
        </div>
        <Button variant="outline" disabled={addSlot.isPending} onClick={() => addSlot.mutate({ title: newTitle, publicPath: newPath })}>
          Add page
        </Button>
      </div>
    </div>
  );
}
