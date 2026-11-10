import { useRef, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Download, FileText, Lock, LockOpen, Presentation, Trash2, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import {
  AFFILIATE_LIBRARY_SWITCH_LABEL,
  LIBRARY_CATEGORIES,
  REFERENCE_LIBRARY_SWITCH_LABEL,
  affiliateLibraryToggleNote,
  inferredReferenceReason,
  isAffiliateLibraryDocument,
  isReferenceLibraryCategory,
  isReferenceLibraryDocument,
  libraryVisibilityDescription,
  type LibraryCategory,
} from "@shared/libraryVisibility";
import { toLibraryDocument, useAffiliateLiteratureAdmin, type LibraryDocument } from "@/lib/libraryAdminProcedures";
import {
  DOCUMENT_DOWNLOAD_ENABLED,
  formatUploadedLabel,
  inlineDocumentKind,
  isPowerPointFile,
} from "@shared/pptxDocument";
import { saveDocumentFromUrl } from "@/components/documents/pptxPreview";
import { PptxDeckViewer, type PptxDeckSource } from "@/components/documents/PptxDeckViewer";

function formatBytes(value: number | null) {
  if (!value) return "—";
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AffiliateLiteratureAdmin() {
  const fileRef = useRef<HTMLInputElement>(null);
  const { utils, list, upload: uploadProcedure, update: updateProcedure, remove: removeProcedure } =
    useAffiliateLiteratureAdmin();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<LibraryCategory>("Internal");
  const [reference, setReference] = useState(false);
  const [inAffiliateLibrary, setInAffiliateLibrary] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [deck, setDeck] = useState<PptxDeckSource | null>(null);

  const items = (list.data ?? []).map(toLibraryDocument);
  const literature = items.filter((item) => !isReferenceLibraryDocument(item));
  const references = items.filter((item) => isReferenceLibraryDocument(item));

  const upload = uploadProcedure.useMutation({
    onSuccess: (_result, input) => {
      toast.success(
        input.reference
          ? input.inAffiliateLibrary
            ? "Added to Reference, and published to the affiliate library"
            : "Added to Reference — not published to affiliates"
          : input.inAffiliateLibrary
            ? "Added to the internal library and to the affiliate library"
            : "Added to the internal library — admins only",
      );
      utils.affiliateLiterature.adminList.invalidate();
      setTitle("");
      setDescription("");
      setCategory("Internal");
      setReference(false);
      setInAffiliateLibrary(false);
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (error) => toast.error(error.message),
  });

  const update = updateProcedure.useMutation({
    onSuccess: (_result, input) => {
      if (input.reference !== undefined && input.inAffiliateLibrary === undefined) {
        toast.success(input.reference ? "Marked as Reference — not published unless Affiliate library is ticked" : "Moved back to affiliate literature");
      } else {
        toast.success(
          input.inAffiliateLibrary
            ? "Added to the affiliate library"
            : "Removed from the affiliate library — internal, admins only",
        );
      }
      utils.affiliateLiterature.adminList.invalidate();
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => setPendingId(null),
  });

  const remove = removeProcedure.useMutation({
    onSuccess: () => {
      toast.success("Literature removed");
      utils.affiliateLiterature.adminList.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  function toggleAffiliateLibrary(id: number, checked: boolean) {
    setPendingId(id);
    update.mutate({ id, inAffiliateLibrary: checked });
  }

  function toggleReference(id: number, checked: boolean) {
    setPendingId(id);
    update.mutate({ id, reference: checked });
  }

  function onCategory(next: LibraryCategory) {
    if (isReferenceLibraryCategory(next)) setReference(true);
    else if (isReferenceLibraryCategory(category)) setReference(false);
    setCategory(next);
  }

  /**
   * Open asks the utils proxy for a signed link. Calling `.fetch` on the
   * procedure itself is not a tRPC hook, and the client throws
   * `hooks[lastArg] is not a function` (minified: `e[i] is not a function`).
   */
  async function openDocument(item: LibraryDocument) {
    setOpeningId(item.id);
    try {
      const file = await utils.affiliateResources.adminSignedFile.fetch({ id: item.id });
      const kind = inlineDocumentKind({
        filename: item.filename || file.filename,
        mimeType: item.mimeType || file.mimeType,
        url: file.url,
      });
      if (kind) {
        setDeck({
          title: item.title,
          filename: file.filename ?? item.filename,
          mimeType: item.mimeType || file.mimeType,
          sourceUrl: file.url,
          uploadedAt: item.createdAt,
        });
        return;
      }
      window.open(file.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Could not open ${item.title}.`);
    } finally {
      setOpeningId(null);
    }
  }

  async function handleUpload() {
    if (!selectedFile || !title.trim()) {
      toast.error("Add a title and choose a document first.");
      return;
    }
    const dataBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read the selected file."));
      reader.readAsDataURL(selectedFile);
    });
    upload.mutate({
      title: title.trim(),
      description: description.trim() || null,
      category,
      filename: selectedFile.name,
      mimeType: selectedFile.type || "application/pdf",
      dataBase64,
      inAffiliateLibrary,
      reference,
    });
  }

  async function downloadDocument(item: LibraryDocument) {
    setOpeningId(item.id);
    try {
      const file = await utils.affiliateResources.adminSignedFile.fetch({ id: item.id });
      await saveDocumentFromUrl(file.url, file.filename ?? item.filename);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Could not download ${item.title}.`);
    } finally {
      setOpeningId(null);
    }
  }

  function renderItem(item: LibraryDocument) {
    const inAffiliate = isAffiliateLibraryDocument(item);
    const isReference = isReferenceLibraryDocument(item);
    const inferred = inferredReferenceReason(item);
    const toggleNote = affiliateLibraryToggleNote(item);
    const inline = inlineDocumentKind(item);
    const deckFile = isPowerPointFile(item);
    const uploadedLabel = formatUploadedLabel(item.createdAt);
    return (
      <div key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3" data-testid={`library-document-${item.id}`}>
        {deckFile ? <Presentation className="h-5 w-5 shrink-0 text-primary" /> : <FileText className="h-5 w-5 shrink-0 text-primary" />}
        <div className="min-w-[240px] flex-1">
          <div className="font-medium">
            {inline ? (
              <button type="button" className="text-left hover:underline" onClick={() => openDocument(item)}>
                {item.title}
              </button>
            ) : item.title}
            {uploadedLabel ? (
              <span className="ml-2 text-xs font-normal text-muted-foreground" data-testid={`library-uploaded-${item.id}`}>{uploadedLabel}</span>
            ) : null}
          </div>
          <div className="text-xs text-muted-foreground">{item.filename} · {formatBytes(item.sizeBytes)} · {item.category}</div>
          {item.description && <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</div>}
          {isReference && (
            <div className="mt-1 text-xs text-muted-foreground" data-testid={`library-reference-reason-${item.id}`}>
              {inferred
                ? `Reference because its ${inferred}. It stays out of the affiliate library until you tick ${AFFILIATE_LIBRARY_SWITCH_LABEL}.`
                : `Marked Reference. It stays out of the affiliate library until you tick ${AFFILIATE_LIBRARY_SWITCH_LABEL}.`}
            </div>
          )}
          {toggleNote && <div className="mt-1 text-xs text-muted-foreground" data-testid={`library-toggle-note-${item.id}`}>{toggleNote}</div>}
        </div>
        {isReference && <Badge variant="outline" data-testid={`library-reference-badge-${item.id}`}>Reference</Badge>}
        <Badge variant={inAffiliate ? "default" : "secondary"} className="gap-1" data-testid={`library-visibility-${item.id}`}>
          {inAffiliate ? <LockOpen className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
          {inAffiliate ? "Affiliate library" : "Internal"}
        </Badge>
        <label htmlFor={`library-reference-${item.id}`} className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            id={`library-reference-${item.id}`}
            checked={isReference}
            disabled={pendingId === item.id || Boolean(inferred)}
            onCheckedChange={(value) => toggleReference(item.id, value === true)}
            aria-label={`${REFERENCE_LIBRARY_SWITCH_LABEL} for ${item.title}`}
          />
          {REFERENCE_LIBRARY_SWITCH_LABEL}
        </label>
        <label htmlFor={`library-affiliate-${item.id}`} className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            id={`library-affiliate-${item.id}`}
            checked={inAffiliate}
            disabled={pendingId === item.id}
            onCheckedChange={(value) => toggleAffiliateLibrary(item.id, value === true)}
            aria-label={`${AFFILIATE_LIBRARY_SWITCH_LABEL} for ${item.title}`}
            aria-describedby={`library-visibility-help-${item.id}`}
          />
          {AFFILIATE_LIBRARY_SWITCH_LABEL}
        </label>
        <span id={`library-visibility-help-${item.id}`} className="sr-only">{libraryVisibilityDescription(item.visibility)}</span>
        {item.url ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={openingId === item.id}
            onClick={() => openDocument(item)}
            aria-label={`${inline ? "View" : "Open"} ${item.title}`}
          >
            {deckFile ? <Presentation className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
            {openingId === item.id ? "Opening…" : inline ? "View" : "Open"}
          </Button>
        ) : null}
        {DOCUMENT_DOWNLOAD_ENABLED && inline && item.url ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={openingId === item.id}
            onClick={() => downloadDocument(item)}
            aria-label={`Download ${item.title}`}
          >
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => remove.mutate({ id: item.id })} aria-label={`Delete ${item.title}`}><Trash2 className="h-4 w-4" /></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="affiliate-literature-admin">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold"><BookOpen className="h-5 w-5 text-primary" /> Literature Library</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Every document here is internal to the admin team by default. Tick <strong className="font-medium text-foreground">{AFFILIATE_LIBRARY_SWITCH_LABEL}</strong> beside a document to also show it to signed-in affiliates in their portal library; untick it to take it back. Catalogs, cost sheets, price lists, and spec books sit in <strong className="font-medium text-foreground">Reference</strong> and are not published unless you tick {AFFILIATE_LIBRARY_SWITCH_LABEL} on that item. This checkbox never puts a document on the public site, and every tick is recorded with your name and the time.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Add literature</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="affiliate-literature-title">Title</Label><Input id="affiliate-literature-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Website Improvement Proposal" /></div>
            <div className="space-y-1.5"><Label htmlFor="affiliate-literature-description">Description</Label><Textarea id="affiliate-literature-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What this document is for, and who may read it." rows={4} /></div>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="affiliate-literature-category">Category</Label><select id="affiliate-literature-category" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={category} onChange={(event) => onCategory(event.target.value as LibraryCategory)}>{LIBRARY_CATEGORIES.map((option) => <option key={option}>{option}</option>)}</select></div>
            <div className="space-y-1.5"><Label htmlFor="affiliate-literature-file">Document</Label><Input id="affiliate-literature-file" ref={fileRef} type="file" accept=".pdf,.docx,.xlsx,.pptx,.txt,application/pdf" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} /></div>
            <label htmlFor="affiliate-literature-new-reference" className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
              <span>
                <span className="block font-medium">{REFERENCE_LIBRARY_SWITCH_LABEL}</span>
                <span className="text-xs text-muted-foreground">On files this under Reference. It is not published to affiliates unless you also tick {AFFILIATE_LIBRARY_SWITCH_LABEL}.</span>
              </span>
              <Checkbox id="affiliate-literature-new-reference" checked={reference} onCheckedChange={(value) => setReference(value === true)} />
            </label>
            <label htmlFor="affiliate-literature-new-affiliate-library" className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
              <span>
                <span className="block font-medium">{AFFILIATE_LIBRARY_SWITCH_LABEL}</span>
                <span className="text-xs text-muted-foreground">Off keeps this document admin-only. On shows it to signed-in affiliates. Neither one makes it public.</span>
              </span>
              <Checkbox id="affiliate-literature-new-affiliate-library" checked={inAffiliateLibrary} onCheckedChange={(value) => setInAffiliateLibrary(value === true)} />
            </label>
            <Button type="button" className="gap-2" onClick={handleUpload} disabled={upload.isPending || !selectedFile || !title.trim()}><Upload className="h-4 w-4" />{upload.isPending ? "Uploading…" : "Add to library"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Affiliate literature</CardTitle></CardHeader>
        <CardContent>
          {list.isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : !literature.length ? (
            <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">No affiliate literature has been added yet.</div>
          ) : (
            <div className="divide-y divide-border rounded-md border" data-testid="library-section-literature">
              {literature.map(renderItem)}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Reference</CardTitle>
          <p className="text-sm text-muted-foreground">Catalogs, installation cost sheets, price lists, and spec books. These stay in the library for the admin team and are not published to affiliates unless Affiliate library is ticked on that row.</p>
        </CardHeader>
        <CardContent>
          {list.isLoading ? null : !references.length ? (
            <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground" data-testid="library-section-reference-empty">No reference documents.</div>
          ) : (
            <div className="divide-y divide-border rounded-md border" data-testid="library-section-reference">
              {references.map(renderItem)}
            </div>
          )}
        </CardContent>
      </Card>
      <PptxDeckViewer open={deck != null} deck={deck} onClose={() => setDeck(null)} />
    </div>
  );
}
