import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { AFFILIATE_RESOURCE_TYPES, type AffiliateResourceType } from "@shared/affiliateResources";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";

type Draft = {
  id?: number;
  type: AffiliateResourceType;
  title: string;
  body: string;
  url: string;
  category: string;
  featured: boolean;
  isPublished: boolean;
  hashtags: string;
  chapters: string;
  durationSeconds: string;
};

const EMPTY: Draft = {
  type: "guide",
  title: "",
  body: "",
  url: "",
  category: "general",
  featured: false,
  isPublished: false,
  hashtags: "",
  chapters: "",
  durationSeconds: "",
};

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

function parseChapters(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [label, seconds] = line.split("|");
    return { label: (label ?? "").trim(), startSeconds: Number(seconds ?? 0) || 0 };
  }).filter((chapter) => chapter.label);
}

export default function AffiliateResourcesAdmin() {
  const utils = trpc.useUtils();
  const list = trpc.affiliateResources.adminList.useQuery();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const save = trpc.affiliateResources.adminSave.useMutation({
    onSuccess: () => {
      toast.success("Resource saved");
      utils.affiliateResources.adminList.invalidate();
      setDraft(EMPTY);
      setFile(null);
      setThumbnail(null);
    },
    onError: (error) => toast.error(error.message),
  });
  const setPublished = trpc.affiliateResources.adminSetPublished.useMutation({
    onSuccess: () => utils.affiliateResources.adminList.invalidate(),
    onError: (error) => toast.error(error.message),
  });
  const reorder = trpc.affiliateResources.adminReorder.useMutation({
    onSuccess: () => utils.affiliateResources.adminList.invalidate(),
    onError: (error) => toast.error(error.message),
  });
  const remove = trpc.affiliateResources.adminDelete.useMutation({
    onSuccess: () => {
      toast.success("Resource removed");
      utils.affiliateResources.adminList.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  async function submit() {
    if (!draft.title.trim()) {
      toast.error("Add a title.");
      return;
    }
    const dataBase64 = file ? await readFile(file) : undefined;
    const thumbnailBase64 = thumbnail ? await readFile(thumbnail) : undefined;
    save.mutate({
      id: draft.id,
      type: draft.type,
      title: draft.title.trim(),
      body: draft.body,
      url: draft.url.trim() || null,
      category: draft.category.trim() || "general",
      featured: draft.featured,
      isPublished: draft.isPublished,
      meta: {
        hashtags: draft.hashtags.split(",").map((tag) => tag.trim()).filter(Boolean),
        chapters: parseChapters(draft.chapters),
        durationSeconds: draft.durationSeconds ? Number(draft.durationSeconds) : null,
        placeholder: !draft.url.trim(),
      },
      ...(dataBase64 ? { filename: file?.name, mimeType: file?.type || "application/octet-stream", dataBase64 } : {}),
      ...(thumbnailBase64 ? { thumbnailFilename: thumbnail?.name, thumbnailMimeType: thumbnail?.type || "image/png", thumbnailBase64 } : {}),
    });
  }

  const items = list.data ?? [];

  function dropOn(targetId: number) {
    if (dragId == null || dragId === targetId) return;
    const ids = items.map((item) => item.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    reorder.mutate({ ids: next });
    setDragId(null);
  }

  return (
    <div className="space-y-6" data-testid="affiliate-resources-admin">
      <div>
        <h2 className="text-xl font-semibold">Affiliate Resources</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Publish scripts, guides, videos, PDFs, and social posts for the Marketing Hub. New files stay in private storage and are shared with affiliates through signed links. Leave items unpublished until the placeholder text is replaced.
        </p>
      </div>
      <div className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span>Type</span>
          <select className="w-full rounded-md border border-border bg-background px-3 py-2" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as AffiliateResourceType })}>
            {AFFILIATE_RESOURCE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>Category</span>
          <Input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} placeholder="phone, designer, brochure, faq…" />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span>Title</span>
          <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span>Body (markdown)</span>
          <Textarea rows={6} value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span>URL</span>
          <Input value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} placeholder="https:// — YouTube link for videos" />
        </label>
        <label className="space-y-1 text-sm">
          <span>Hashtags (comma separated)</span>
          <Input value={draft.hashtags} onChange={(event) => setDraft({ ...draft, hashtags: event.target.value })} />
        </label>
        <label className="space-y-1 text-sm">
          <span>Duration seconds</span>
          <Input value={draft.durationSeconds} onChange={(event) => setDraft({ ...draft, durationSeconds: event.target.value })} />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span>Chapters, one per line: Label | start seconds</span>
          <Textarea rows={3} value={draft.chapters} onChange={(event) => setDraft({ ...draft, chapters: event.target.value })} />
        </label>
        <label className="space-y-1 text-sm">
          <span>File</span>
          <Input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.mp4,.webm,.txt,application/pdf,video/mp4" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </label>
        <label className="space-y-1 text-sm">
          <span>Thumbnail</span>
          <Input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => setThumbnail(event.target.files?.[0] ?? null)} />
        </label>
        <div className="flex items-center gap-2">
          <Switch checked={draft.featured} onCheckedChange={(featured) => setDraft({ ...draft, featured })} id="featured" />
          <Label htmlFor="featured">Featured</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={draft.isPublished} onCheckedChange={(isPublished) => setDraft({ ...draft, isPublished })} id="published" />
          <Label htmlFor="published">Published</Label>
        </div>
        <div className="md:col-span-2">
          <Button type="button" onClick={submit} disabled={save.isPending}>{save.isPending ? "Saving…" : draft.id ? "Update resource" : "Add resource"}</Button>
        </div>
      </div>
      {list.isLoading ? <Spinner className="h-6 w-6" /> : null}
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={item.id}
            draggable
            onDragStart={() => setDragId(item.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => dropOn(item.id)}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
          >
            <div>
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.type} · {item.category}</p>
            </div>
            <div className="flex items-center gap-2">
              {item.featured ? <Badge>Featured</Badge> : null}
              <Badge variant={item.isPublished ? "default" : "outline"}>{item.isPublished ? "Published" : "Draft"}</Badge>
              <Switch checked={item.isPublished} aria-label={`Publish ${item.title}`} onCheckedChange={(isPublished) => setPublished.mutate({ id: item.id, isPublished })} />
              <Button type="button" size="icon" variant="ghost" aria-label="Move up" onClick={() => {
                if (index === 0) return;
                const ids = items.map((row) => row.id);
                [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
                reorder.mutate({ ids });
              }}><ChevronUp className="h-4 w-4" /></Button>
              <Button type="button" size="icon" variant="ghost" aria-label="Move down" onClick={() => {
                if (index === items.length - 1) return;
                const ids = items.map((row) => row.id);
                [ids[index + 1], ids[index]] = [ids[index], ids[index + 1]];
                reorder.mutate({ ids });
              }}><ChevronDown className="h-4 w-4" /></Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setDraft({
                id: item.id,
                type: item.type,
                title: item.title,
                body: item.body ?? "",
                url: item.url ?? "",
                category: item.category,
                featured: item.featured,
                isPublished: item.isPublished,
                hashtags: item.meta?.hashtags?.join(", ") ?? "",
                chapters: item.meta?.chapters?.map((chapter) => `${chapter.label} | ${chapter.startSeconds}`).join("\n") ?? "",
                durationSeconds: item.meta?.durationSeconds ? String(item.meta.durationSeconds) : "",
              })}>Edit</Button>
              <Button type="button" size="icon" variant="ghost" aria-label={`Delete ${item.title}`} onClick={() => remove.mutate({ id: item.id })}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
