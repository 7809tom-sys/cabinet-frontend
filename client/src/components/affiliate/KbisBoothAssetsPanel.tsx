import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Download, ExternalLink, FileText, ImageIcon, Sparkles } from "lucide-react";
import { DOCUMENT_DOWNLOAD_ENABLED } from "@shared/pptxDocument";
import { PptxDeckViewer, type PptxDeckSource } from "@/components/documents/PptxDeckViewer";
import { saveDocumentFromUrl } from "@/components/documents/pptxPreview";
import type { EducationResource } from "@/components/affiliate/AffiliateResourcesHub";
import {
  KBIS_BOOTH_COPY_LINES,
  KBIS_BOOTH_DOCUMENTS,
  KBIS_BOOTH_FEATURED_IMAGE,
  KBIS_BOOTH_FOLDER,
  KBIS_BOOTH_IMAGES,
  KBIS_BOOTH_TAGS,
  formatAssetSize,
  isBoothDocumentUrl,
  isBoothImageUrl,
  type KbisBoothDocument,
  type KbisBoothImage,
} from "@shared/kbisBoothAssets";

type AssetFilter = "all" | "supplier-ready" | "concept-rendering" | "copy";

const FILTERS: { id: AssetFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "supplier-ready", label: KBIS_BOOTH_TAGS.supplierReady },
  { id: "concept-rendering", label: KBIS_BOOTH_TAGS.conceptRendering },
  { id: "copy", label: KBIS_BOOTH_TAGS.copy },
];

/**
 * The booth gallery reads the shipped manifest so the assets are on the page as
 * soon as this build deploys. Admin-published rows in the same category are
 * merged in afterwards, so an owner who runs SQL 0249 (or edits the category in
 * Affiliate Resources) can add or retire assets without a deploy — the manifest
 * stays the source for the ones that ship with the site.
 */
export function KbisBoothAssetsPanel({ resources, query = "" }: { resources: EducationResource[]; query?: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [filter, setFilter] = useState<AssetFilter>("all");
  const [deck, setDeck] = useState<PptxDeckSource | null>(null);

  const published = useMemo(
    () => resources.filter((item) => item.category.trim().toLowerCase() === "kbis-2027-booth"),
    [resources],
  );

  const images = useMemo(() => {
    const shipped: KbisBoothImage[] = [...KBIS_BOOTH_IMAGES];
    const known = new Set(shipped.map((image) => image.url));
    const extra: KbisBoothImage[] = published
      .filter((item) => isBoothImageUrl(item.url) && !known.has(item.url ?? ""))
      .map((item, index) => ({
        slug: `published-${item.id}`,
        file: (item.url ?? "").split("/").pop() ?? "",
        url: item.url ?? "",
        title: item.title,
        description: item.body ?? "",
        mimeType: "image/jpeg",
        sizeBytes: 0,
        conceptRendering: item.meta?.conceptRendering === true,
        supplierReady: item.meta?.supplierReady === true,
        featured: false,
        sortOrder: 1000 + index,
      }));
    return [...shipped, ...extra].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [published]);

  const documents = useMemo(() => {
    const shipped: KbisBoothDocument[] = [...KBIS_BOOTH_DOCUMENTS];
    const known = new Set(shipped.map((document) => document.url));
    const extra: KbisBoothDocument[] = published
      .filter((item) => isBoothDocumentUrl(item.url) && !known.has(item.url ?? ""))
      .map((item, index) => ({
        slug: `published-${item.id}`,
        file: (item.url ?? "").split("/").pop() ?? "",
        url: item.url ?? "",
        title: item.title,
        description: item.body ?? "",
        mimeType: "application/pdf",
        sizeBytes: 0,
        pageCount: 0,
        supplierReady: item.meta?.supplierReady === true,
        featured: false,
        sortOrder: 1000 + index,
      }));
    return [...shipped, ...extra].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [published]);

  const copyLines = useMemo(() => {
    const shipped = KBIS_BOOTH_COPY_LINES.map((line) => ({ key: line.slug, title: line.title, text: line.text }));
    const known = new Set(shipped.map((line) => line.text));
    const extra = published
      .filter((item) => !isBoothImageUrl(item.url) && !isBoothDocumentUrl(item.url) && item.body && !known.has(item.body))
      .map((item) => ({ key: `published-${item.id}`, title: item.title, text: item.body ?? "" }));
    return [...shipped, ...extra];
  }, [published]);

  const needle = query.trim().toLowerCase();
  const matchesSearch = (values: string[]) => !needle || values.join(" ").toLowerCase().includes(needle);
  /** The filter row is a tag filter: an asset shows when it carries the chosen tag. */
  const showsTag = (tags: AssetFilter[]) => filter === "all" || tags.includes(filter);

  const featured = images.find((image) => image.featured) ?? images[0] ?? KBIS_BOOTH_FEATURED_IMAGE;
  const tagsFor = (asset: { conceptRendering?: boolean; supplierReady?: boolean }): AssetFilter[] => [
    ...(asset.conceptRendering ? (["concept-rendering"] as AssetFilter[]) : []),
    ...(asset.supplierReady ? (["supplier-ready"] as AssetFilter[]) : []),
  ];

  const shownFeatured =
    showsTag(tagsFor(featured)) && matchesSearch([featured.title, featured.description, KBIS_BOOTH_FOLDER])
      ? featured
      : null;
  const shownImages = images.filter(
    (image) =>
      image.slug !== featured.slug &&
      showsTag(tagsFor(image)) &&
      matchesSearch([image.title, image.description, KBIS_BOOTH_FOLDER]),
  );
  const shownDocuments = documents.filter(
    (document) =>
      showsTag(tagsFor(document)) &&
      matchesSearch([document.title, document.description, KBIS_BOOTH_FOLDER, KBIS_BOOTH_TAGS.supplierReady]),
  );
  const shownCopyLines = copyLines.filter(
    (line) => showsTag(["copy"]) && matchesSearch([line.title, line.text]),
  );
  const empty = !shownFeatured && !shownImages.length && !shownDocuments.length && !shownCopyLines.length;

  function copy(value: string, key: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    }).catch(() => {});
  }

  return (
    <div className="space-y-6" data-testid="kbis-booth-assets">
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" /> KBIS 2027 — Kitchen &amp; Bath Industry Show, Las Vegas
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Booth artwork and documents you can reuse for show invitations, supplier conversations, local events, and
          social posts. Every image in this folder is a{" "}
          <strong className="font-medium text-foreground">concept rendering</strong> of a planned booth, not a photo of
          a built one — label it as a rendering wherever you publish it. Anything tagged{" "}
          <strong className="font-medium text-foreground">{KBIS_BOOTH_TAGS.supplierReady}</strong> can be shared with a
          potential supplier as-is.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" data-testid="kbis-booth-filters">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFilter(option.id)}
            aria-pressed={filter === option.id}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filter === option.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {empty ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          No booth asset matches that search.
        </p>
      ) : null}

      {shownFeatured ? (
        <article className="overflow-hidden rounded-lg border border-border" data-testid="kbis-booth-featured">
          <div className="bg-muted/40">
            <img src={shownFeatured.url} alt={`${shownFeatured.title} (concept rendering)`} className="w-full" loading="lazy" />
          </div>
          <div className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Featured</Badge>
              {shownFeatured.conceptRendering ? <Badge variant="outline">{KBIS_BOOTH_TAGS.conceptRendering}</Badge> : null}
              {shownFeatured.supplierReady ? <Badge variant="secondary">{KBIS_BOOTH_TAGS.supplierReady}</Badge> : null}
            </div>
            <div>
              <h3 className="font-medium">{shownFeatured.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{shownFeatured.description}</p>
            </div>
            <FileActions
              url={shownFeatured.url}
              download={shownFeatured.file}
              slug={shownFeatured.slug}
              title={shownFeatured.title}
              openLabel="Open full size"
              copied={copied}
              onCopy={copy}
            />
          </div>
        </article>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2" data-testid="kbis-booth-grid">
        {shownImages.map((image) => (
          <article key={image.slug} className="overflow-hidden rounded-lg border border-border">
            <div className="bg-muted/40">
              <img src={image.url} alt={`${image.title} (concept rendering)`} className="w-full" loading="lazy" />
            </div>
            <div className="space-y-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                {image.conceptRendering ? <Badge variant="outline">{KBIS_BOOTH_TAGS.conceptRendering}</Badge> : null}
                {image.supplierReady ? <Badge variant="secondary">{KBIS_BOOTH_TAGS.supplierReady}</Badge> : null}
              </div>
              <h3 className="text-sm font-medium">{image.title}</h3>
              <p className="text-xs text-muted-foreground">{image.description}</p>
              <FileActions
                url={image.url}
                download={image.file}
                slug={image.slug}
                title={image.title}
                openLabel="Open full size"
                copied={copied}
                onCopy={copy}
              />
            </div>
          </article>
        ))}
      </div>

      {shownDocuments.length ? (
        <section className="space-y-3" data-testid="kbis-booth-documents">
          <h3 className="text-sm font-semibold">Decks and documents</h3>
          {shownDocuments.map((document) => (
            <article key={document.slug} className="rounded-lg border border-border p-4" data-testid="kbis-booth-document">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1">
                  <FileText className="h-3 w-3" /> PDF
                </Badge>
                {document.supplierReady ? <Badge variant="secondary">{KBIS_BOOTH_TAGS.supplierReady}</Badge> : null}
                {document.pageCount ? (
                  <span className="text-xs text-muted-foreground">{document.pageCount} slides</span>
                ) : null}
                {document.sizeBytes ? (
                  <span className="text-xs text-muted-foreground">{formatAssetSize(document.sizeBytes)}</span>
                ) : null}
              </div>
              <h4 className="mt-2 text-sm font-medium">
                <button
                  type="button"
                  className="text-left hover:underline"
                  onClick={() => setDeck({
                    title: document.title,
                    filename: document.file,
                    mimeType: document.mimeType,
                    sourceUrl: document.url,
                  })}
                >
                  {document.title}
                </button>
              </h4>
              <p className="mt-1 text-sm text-muted-foreground">{document.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setDeck({
                    title: document.title,
                    filename: document.file,
                    mimeType: document.mimeType,
                    sourceUrl: document.url,
                  })}
                  aria-label={`View ${document.title}`}
                >
                  <FileText className="h-3.5 w-3.5" /> Open deck
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => copy(new URL(document.url, window.location.origin).toString(), `url-${document.slug}`)}
                  aria-label={`Copy file address for ${document.title}`}
                >
                  <Copy className="h-3.5 w-3.5" /> {copied === `url-${document.slug}` ? "Copied" : "Copy file address"}
                </Button>
                {DOCUMENT_DOWNLOAD_ENABLED ? (
                  <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={() => { void saveDocumentFromUrl(document.url, document.file); }}>
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {shownCopyLines.length ? (
        <section className="space-y-3" data-testid="kbis-booth-copy">
          <h3 className="text-sm font-semibold">Copy that goes with the booth</h3>
          {shownCopyLines.map((line) => (
            <article key={line.key} className="rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground">{line.title}</p>
              <p className="mt-1 text-sm">{line.text}</p>
              <div className="mt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => copy(line.text, line.key)}
                  aria-label={`Copy ${line.title}`}
                >
                  <Copy className="h-3.5 w-3.5" /> {copied === line.key ? "Copied" : "Copy"}
                </Button>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      <PptxDeckViewer open={deck != null} deck={deck} onClose={() => setDeck(null)} />
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <ImageIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Files live in the &ldquo;{KBIS_BOOTH_FOLDER}&rdquo; folder — the Marketing Hub tab here, and the admin Media
        Library once the owner publishes the folder. Copy a file address to use it somewhere else.
      </p>
    </div>
  );
}

function FileActions({
  url,
  download,
  slug,
  title,
  openLabel,
  copied,
  onCopy,
}: {
  url: string;
  download: string;
  slug: string;
  title: string;
  openLabel: string;
  copied: string | null;
  onCopy: (value: string, key: string) => void;
}) {
  const absoluteUrl = typeof window === "undefined" ? url : new URL(url, window.location.origin).toString();
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={() => onCopy(absoluteUrl, `url-${slug}`)}
        aria-label={`Copy file address for ${title}`}
      >
        <Copy className="h-3.5 w-3.5" /> {copied === `url-${slug}` ? "Copied" : "Copy file address"}
      </Button>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <Button type="button" size="sm" variant="ghost" className="gap-1.5">
          <ExternalLink className="h-3.5 w-3.5" /> {openLabel}
        </Button>
      </a>
      <a href={url} download={download}>
        <Button type="button" size="sm" variant="ghost" className="gap-1.5">
          <Download className="h-3.5 w-3.5" /> Download
        </Button>
      </a>
    </div>
  );
}
