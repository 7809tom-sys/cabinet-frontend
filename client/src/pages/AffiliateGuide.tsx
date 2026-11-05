import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, BookOpen, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useSeo } from "@/hooks/useSeo";
import NotFound from "@/pages/NotFound";
import { AFFILIATE_GUIDES, affiliateGuideBySlug, affiliateGuidePath, loadAffiliateGuideBody } from "@/lib/affiliateGuides";

// Markdown highlighting pulls in shiki; load it only once a guide body exists.
const Streamdown = lazy(() => import("streamdown").then((mod) => ({ default: mod.Streamdown })));

function downloadMarkdown(slug: string, markdown: string) {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slug}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * The published `/affiliate/guide/<file>` training guides. Bookmarked and
 * printed link targets from the original Marketing Hub must keep resolving,
 * so the markdown ships with the client and renders on this route.
 */
export function AffiliateGuideViewer({ slug }: { slug: string }) {
  const guide = affiliateGuideBySlug(slug);
  const [body, setBody] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useSeo({
    title: guide ? `${guide.title} — Affiliate Training Guide` : "Affiliate Training Guide",
    description: guide?.description ?? "CabinetDealz affiliate sales training guides.",
    canonical: `${typeof window !== "undefined" ? window.location.origin : "https://www.cabinetdealz.com"}${affiliateGuidePath(slug)}`,
    skip: !guide,
  });

  useEffect(() => {
    if (!guide) return;
    let active = true;
    setBody(null);
    setError(false);
    loadAffiliateGuideBody(guide.slug)
      .then((markdown) => {
        if (!active) return;
        if (markdown === null) setError(true);
        else setBody(markdown);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [guide?.slug]);

  if (!guide) return <NotFound />;

  return (
    <div className="max-w-3xl mx-auto px-4 py-12" data-testid="affiliate-guide">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/affiliate?section=marketing">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" /> Marketing Hub
          </Button>
        </Link>
        {body !== null ? (
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => downloadMarkdown(guide.slug, body)}>
            <Download className="h-3.5 w-3.5" /> Download markdown
          </Button>
        ) : null}
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Affiliate training guide</p>
      <h1 className="mt-1 text-3xl font-bold text-foreground">{guide.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{guide.description}</p>

      {error ? (
        <p className="mt-8 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          This guide could not be loaded. Try again, or open it from the Marketing Hub.
        </p>
      ) : body === null ? (
        <div className="flex justify-center py-12"><Spinner className="h-6 w-6 text-primary" /></div>
      ) : (
        <article className="prose prose-sm mt-8 max-w-none" data-testid="affiliate-guide-body">
          <Suspense fallback={<p className="whitespace-pre-wrap text-sm">{body}</p>}>
            <Streamdown>{body}</Streamdown>
          </Suspense>
        </article>
      )}

      {body !== null && !error ? (
        <nav className="mt-10 border-t border-border pt-6" aria-label="Other training guides">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <BookOpen className="h-4 w-4" /> Other training guides
          </h2>
          <ul className="mt-3 space-y-2">
            {AFFILIATE_GUIDES.filter((item) => item.slug !== guide.slug).map((item) => (
              <li key={item.slug}>
                <Link href={affiliateGuidePath(item.slug)} className="text-sm text-primary hover:underline">
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}

export default function AffiliateGuidePage() {
  const params = useParams<{ slug: string }>();
  const raw = params.slug ?? "";
  let slug = raw;
  try {
    slug = decodeURIComponent(raw);
  } catch {
    slug = raw;
  }
  return <AffiliateGuideViewer slug={slug} />;
}
