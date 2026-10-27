import { useMemo, useState } from "react";
import { Streamdown } from "streamdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, CheckCircle2, Circle, Copy, Download, ExternalLink, PlayCircle,
} from "lucide-react";
import { resourceMatchesQuery, youtubeNocookieEmbed, type AffiliateResourceMeta } from "@shared/affiliateResources";
import { SCRIPT_SITUATIONS } from "@shared/affiliateResources";

export type EducationResource = {
  id: number;
  type: "script" | "guide" | "video" | "pdf" | "social" | "link";
  title: string;
  body: string | null;
  url: string | null;
  category: string;
  meta: AffiliateResourceMeta | null;
  featured: boolean;
  sortOrder: number;
  hasFile: boolean;
  hasThumbnail: boolean;
  mimeType: string | null;
  filename: string | null;
  createdAt?: Date | string | null;
};

export type LiteratureCard = {
  id: number;
  title: string;
  description: string | null;
  category: string;
  url: string;
  filename: string;
};

type Progress = { resourceId: number; completed: boolean; progressPercent: number };
type Section = "start" | "scripts" | "guides" | "videos" | "printed" | "social" | "tips";
type SignedFile = { url: string; mimeType: string | null; filename: string | null };

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => {
      copyText(value).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }).catch(() => {});
    }}>
      <Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : label}
    </Button>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">{label}</p>;
}

export function AffiliateResourceBrowser({
  section,
  items,
  literature,
  progress,
  query,
  storeName,
  logoUrl,
  storefrontUrl,
  onToggleComplete,
  onVideoProgress,
  onRequestFile,
}: {
  section: Section;
  items: EducationResource[];
  literature: LiteratureCard[];
  progress: Progress[];
  query: string;
  storeName: string;
  logoUrl: string | null;
  storefrontUrl: string;
  onToggleComplete: (resource: EducationResource, completed: boolean) => void;
  onVideoProgress: (resource: EducationResource, progressPercent: number, completed: boolean) => void;
  onRequestFile: (id: number, kind: "file" | "thumbnail") => Promise<SignedFile>;
}) {
  const visible = useMemo(
    () => items.filter((item) => resourceMatchesQuery(item, query)),
    [items, query],
  );
  const progressFor = (id: number) => progress.find((row) => row.resourceId === id);

  if (section === "start") {
    const steps = visible.filter((item) => item.type === "link" && item.category === "start-here");
    const done = steps.filter((step) => progressFor(step.id)?.completed).length;
    return (
      <div className="space-y-4" data-testid="start-here">
        <p className="text-sm text-muted-foreground">Work through the published checklist. Your progress is saved to your login.</p>
        {steps.length ? <p className="text-sm font-medium">{done} of {steps.length} complete</p> : null}
        {steps.length ? steps.map((step) => {
          const complete = Boolean(progressFor(step.id)?.completed);
          return (
            <button
              key={step.id}
              type="button"
              className="flex w-full items-start gap-3 rounded-lg border border-border p-4 text-left hover:bg-muted/40"
              onClick={() => onToggleComplete(step, !complete)}
            >
              {complete ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /> : <Circle className="mt-0.5 h-5 w-5 text-muted-foreground" />}
              <span>
                <span className="block font-medium text-sm">{step.title}</span>
                {step.body ? <span className="mt-1 block text-sm text-muted-foreground whitespace-pre-wrap">{step.body}</span> : null}
              </span>
            </button>
          );
        }) : <Empty label="Nothing is published in Start Here yet." />}
      </div>
    );
  }

  if (section === "scripts") return <Scripts items={visible.filter((item) => item.type === "script")} />;
  if (section === "guides") return <Guides items={visible.filter((item) => item.type === "guide")} />;
  if (section === "videos") {
    return (
      <Videos
        items={visible.filter((item) => item.type === "video")}
        progressFor={progressFor}
        onVideoProgress={onVideoProgress}
      />
    );
  }
  if (section === "printed") {
    return (
      <Printed
        items={visible.filter((item) => item.type === "pdf")}
        literature={literature.filter((item) => resourceMatchesQuery({ title: item.title, body: item.description, category: item.category }, query))}
        storeName={storeName}
        logoUrl={logoUrl}
        onRequestFile={onRequestFile}
      />
    );
  }
  if (section === "social") {
    return (
      <SocialPosts
        items={visible.filter((item) => item.type === "social")}
        storefrontUrl={storefrontUrl}
        onRequestFile={onRequestFile}
      />
    );
  }
  return <Tips items={visible.filter((item) => item.type === "link" && ["tip", "faq", "whats-new"].includes(item.category))} />;
}

function Scripts({ items }: { items: EducationResource[] }) {
  const [situation, setSituation] = useState("all");
  const shown = items.filter((item) => situation === "all" || item.category === situation);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <FilterButton active={situation === "all"} onClick={() => setSituation("all")}>All</FilterButton>
        {SCRIPT_SITUATIONS.map((item) => (
          <FilterButton key={item.id} active={situation === item.id} onClick={() => setSituation(item.id)}>{item.label}</FilterButton>
        ))}
      </div>
      {shown.length ? shown.map((item) => (
        <article key={item.id} className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-medium text-sm">{item.title}</h3>
              <Badge variant="outline" className="mt-1">{item.category}</Badge>
            </div>
            <CopyButton value={item.body ?? item.title} />
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground">{item.body}</pre>
        </article>
      )) : <Empty label="Nothing is published for that situation yet." />}
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-full border px-3 py-1 text-xs ${active ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>
      {children}
    </button>
  );
}

function Guides({ items }: { items: EducationResource[] }) {
  const [openId, setOpenId] = useState<number | null>(items[0]?.id ?? null);
  const open = items.find((item) => item.id === openId) ?? null;
  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <div className="space-y-2">
        {items.map((item) => (
          <button key={item.id} type="button" onClick={() => setOpenId(item.id)} className={`block w-full rounded-lg border px-3 py-2 text-left text-sm ${open?.id === item.id ? "border-primary" : "border-border"}`}>
            {item.title}
          </button>
        ))}
        {!items.length ? <Empty label="Nothing is published in Training Guides yet." /> : null}
      </div>
      {open ? (
        <article className="rounded-lg border border-border p-4">
          <h3 className="font-semibold">{open.title}</h3>
          <div className="prose prose-sm mt-3 max-w-none">
            <Streamdown>{open.body ?? ""}</Streamdown>
          </div>
        </article>
      ) : null}
    </div>
  );
}

function Videos({
  items,
  progressFor,
  onVideoProgress,
}: {
  items: EducationResource[];
  progressFor: (id: number) => Progress | undefined;
  onVideoProgress: (resource: EducationResource, progressPercent: number, completed: boolean) => void;
}) {
  const featured = items.find((item) => item.featured) ?? items[0];
  const rest = items.filter((item) => item.id !== featured?.id);
  return (
    <div className="space-y-4">
      {featured ? <VideoCard item={featured} featured progress={progressFor(featured.id)} onVideoProgress={onVideoProgress} /> : <Empty label="Nothing is published in Video Training yet." />}
      {rest.map((item) => <VideoCard key={item.id} item={item} progress={progressFor(item.id)} onVideoProgress={onVideoProgress} />)}
    </div>
  );
}

function VideoCard({
  item,
  featured = false,
  progress,
  onVideoProgress,
}: {
  item: EducationResource;
  featured?: boolean;
  progress?: Progress;
  onVideoProgress: (resource: EducationResource, progressPercent: number, completed: boolean) => void;
}) {
  const [start, setStart] = useState(0);
  const embed = youtubeNocookieEmbed(item.url, start);
  const percent = progress?.progressPercent ?? 0;
  return (
    <article className="rounded-lg border border-border p-4 space-y-3" data-testid={featured ? "featured-video" : undefined}>
      <div className="flex items-center gap-2">
        {featured ? <Badge>Featured</Badge> : null}
        <h3 className="font-medium">{item.title}</h3>
      </div>
      {embed ? (
        <iframe
          key={`${item.id}-${start}`}
          title={item.title}
          src={embed}
          className="aspect-video w-full rounded-md border border-border"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <p className="rounded-md bg-muted px-3 py-4 text-sm text-muted-foreground">An admin still needs to add the YouTube link for this placeholder.</p>
      )}
      {item.body ? <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.body}</p> : null}
      {item.meta?.chapters?.length ? (
        <div className="flex flex-wrap gap-2">
          {item.meta.chapters.map((chapter) => (
            <button key={`${chapter.label}-${chapter.startSeconds}`} type="button" className="rounded-full border border-border px-3 py-1 text-xs" onClick={() => setStart(chapter.startSeconds)}>
              {chapter.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-muted-foreground" htmlFor={`progress-${item.id}`}>Watched {percent}%</label>
        <input
          id={`progress-${item.id}`}
          type="range"
          min={0}
          max={100}
          value={percent}
          aria-label={`Watched progress for ${item.title}`}
          onChange={(event) => {
            const next = Number(event.target.value);
            onVideoProgress(item, next, next >= 90);
          }}
        />
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => onVideoProgress(item, 100, true)}>
          <PlayCircle className="h-3.5 w-3.5" /> Mark watched
        </Button>
      </div>
    </article>
  );
}

function Printed({
  items,
  literature,
  storeName,
  logoUrl,
  onRequestFile,
}: {
  items: EducationResource[];
  literature: LiteratureCard[];
  storeName: string;
  logoUrl: string | null;
  onRequestFile: (id: number, kind: "file" | "thumbnail") => Promise<SignedFile>;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  return (
    <div className="space-y-4" data-testid="printed-materials">
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Printed Materials</p>
        <p className="mt-1">No Cura catalog was found in this project. Brochures, spec sheets, and door-style cards show up here after an admin publishes them.</p>
        {logoUrl ? (
          <p className="mt-2">Your store logo is on file for {storeName}. Uploaded PDFs download as provided. The business card and phone strip in Share & Promote already use your store name.</p>
        ) : (
          <p className="mt-2">Add a logo in Customize Store if you want it on the business card in Share & Promote. Uploaded PDFs download as provided.</p>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <article key={item.id} className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-medium text-sm">{item.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{item.category}</p>
              </div>
              {logoUrl ? <img src={logoUrl} alt="" className="h-8 w-8 rounded object-contain" /> : null}
            </div>
            {item.body ? <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.body}</p> : null}
            <div className="flex flex-wrap gap-2">
              {item.hasFile ? (
                <>
                  <Button type="button" size="sm" variant="outline" onClick={() => onRequestFile(item.id, "file").then((file) => setPreviewUrl(file.url))}>Preview</Button>
                  <Button type="button" size="sm" className="gap-1.5" onClick={() => onRequestFile(item.id, "file").then((file) => {
                    const anchor = document.createElement("a");
                    anchor.href = file.url;
                    anchor.target = "_blank";
                    anchor.rel = "noopener noreferrer";
                    anchor.download = file.filename ?? "resource";
                    anchor.click();
                  })}>
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                </>
              ) : <span className="text-xs text-muted-foreground">No file uploaded yet.</span>}
            </div>
          </article>
        ))}
        {literature.map((item) => (
          <article key={`lit-${item.id}`} className="rounded-lg border border-border p-4 space-y-3">
            <h3 className="font-medium text-sm">{item.title}</h3>
            <p className="text-xs text-muted-foreground">{item.category}</p>
            {item.description ? <p className="text-sm text-muted-foreground">{item.description}</p> : null}
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary">
              <ExternalLink className="h-3.5 w-3.5" /> Open published literature
            </a>
          </article>
        ))}
      </div>
      {!items.length && !literature.length ? <Empty label="Nothing is published in Printed Materials yet." /> : null}
      {previewUrl ? (
        <iframe title="PDF preview" src={previewUrl} className="h-[480px] w-full rounded-md border border-border" />
      ) : null}
    </div>
  );
}

function SocialPosts({
  items,
  storefrontUrl,
  onRequestFile,
}: {
  items: EducationResource[];
  storefrontUrl: string;
  onRequestFile: (id: number, kind: "file" | "thumbnail") => Promise<SignedFile>;
}) {
  const captions = items.filter((item) => item.category === "caption" || item.category === "general" || !["calendar", "platform-tip"].includes(item.category));
  const calendar = items.filter((item) => item.category === "calendar");
  const tips = items.filter((item) => item.category === "platform-tip");
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-4">
        <p className="text-sm font-medium">Your storefront</p>
        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{storefrontUrl}</p>
        <div className="mt-2"><CopyButton value={storefrontUrl} label="Copy storefront link" /></div>
      </div>
      {captions.map((item) => {
        const tags = item.meta?.hashtags?.join(" ") ?? "";
        return (
          <article key={item.id} className="rounded-lg border border-border p-4 space-y-3">
            <h3 className="font-medium text-sm">{item.title}</h3>
            <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground">{item.body}</pre>
            {tags ? <p className="text-sm">{tags}</p> : null}
            <div className="flex flex-wrap gap-2">
              <CopyButton value={[item.body, tags].filter(Boolean).join("\n\n")} label="Copy caption" />
              {tags ? <CopyButton value={tags} label="Copy hashtags" /> : null}
              {item.hasFile ? (
                <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => onRequestFile(item.id, "file").then((file) => {
                  const anchor = document.createElement("a");
                  anchor.href = file.url;
                  anchor.download = file.filename ?? "social";
                  anchor.click();
                })}>
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              ) : null}
            </div>
          </article>
        );
      })}
      {calendar.map((item) => (
        <article key={item.id} className="rounded-lg border border-border p-4">
          <h3 className="font-medium text-sm">Posting calendar</h3>
          <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{item.body}</p>
        </article>
      ))}
      {tips.map((item) => (
        <article key={item.id} className="rounded-lg border border-border p-4">
          <h3 className="font-medium text-sm">{item.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{item.body}</p>
        </article>
      ))}
      {!items.length ? <Empty label="Nothing is published in Social Media yet." /> : null}
    </div>
  );
}

function Tips({ items }: { items: EducationResource[] }) {
  const groups = [
    { id: "tip", title: "Sales tips" },
    { id: "faq", title: "FAQ" },
    { id: "whats-new", title: "What's new" },
  ];
  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const rows = items.filter((item) => item.category === group.id);
        return (
          <section key={group.id} className="space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2"><BookOpen className="h-4 w-4" /> {group.title}</h3>
            {rows.length ? rows.map((item) => (
              <article key={item.id} className="rounded-lg border border-border p-4">
                <h4 className="font-medium text-sm">{item.title}</h4>
                {item.body ? <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{item.body}</p> : null}
              </article>
            )) : <Empty label={`Nothing is published in ${group.title} yet.`} />}
          </section>
        );
      })}
    </div>
  );
}
