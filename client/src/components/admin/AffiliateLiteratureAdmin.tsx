import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { BookOpen, Download, FileText, Trash2, Upload } from "lucide-react";

const CATEGORIES = ["Sales", "Marketing", "Pricing", "Training", "Legal", "General"] as const;

function formatBytes(value: number | null) {
  if (!value) return "—";
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AffiliateLiteratureAdmin() {
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: items, isLoading } = trpc.affiliateLiterature.adminList.useQuery();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("Sales");
  const [isPublished, setIsPublished] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const upload = trpc.affiliateLiterature.adminUpload.useMutation({
    onSuccess: () => {
      toast.success("Affiliate literature added to the library");
      utils.affiliateLiterature.adminList.invalidate();
      setTitle("");
      setDescription("");
      setCategory("Sales");
      setIsPublished(false);
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (error) => toast.error(error.message),
  });
  const update = trpc.affiliateLiterature.adminUpdate.useMutation({
    onSuccess: () => utils.affiliateLiterature.adminList.invalidate(),
    onError: (error) => toast.error(error.message),
  });
  const remove = trpc.affiliateLiterature.adminDelete.useMutation({
    onSuccess: () => {
      toast.success("Literature removed");
      utils.affiliateLiterature.adminList.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

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
      mimeType: selectedFile.type || "application/octet-stream",
      dataBase64,
      isPublished,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold"><BookOpen className="h-5 w-5 text-primary" /> Affiliate Literature Library</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Keep sales brochures, pricing guides, training documents, and other affiliate-ready literature in one searchable administration area. Files are stored in secure object storage; this page manages the catalog record and publication status.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Add literature</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="affiliate-literature-title">Title</Label><Input id="affiliate-literature-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Affiliate Portal Sales Brochure" /></div>
            <div className="space-y-1.5"><Label htmlFor="affiliate-literature-description">Description</Label><Textarea id="affiliate-literature-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What this document helps the affiliate explain." rows={4} /></div>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="affiliate-literature-category">Category</Label><select id="affiliate-literature-category" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={category} onChange={(event) => setCategory(event.target.value as (typeof CATEGORIES)[number])}>{CATEGORIES.map((option) => <option key={option}>{option}</option>)}</select></div>
            <div className="space-y-1.5"><Label htmlFor="affiliate-literature-file">Document</Label><Input id="affiliate-literature-file" ref={fileRef} type="file" accept=".pdf,.docx,.xlsx,.pptx,.txt,application/pdf" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} /></div>
            <label className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"><span><span className="block font-medium">Publish to affiliate library</span><span className="text-xs text-muted-foreground">Leave off while the document is still being reviewed.</span></span><Switch checked={isPublished} onCheckedChange={setIsPublished} /></label>
            <Button type="button" className="gap-2" onClick={handleUpload} disabled={upload.isPending || !selectedFile || !title.trim()}><Upload className="h-4 w-4" />{upload.isPending ? "Uploading…" : "Add to library"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Library contents</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : !items?.length ? (
            <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">No affiliate literature has been added yet.</div>
          ) : (
            <div className="divide-y divide-border rounded-md border">
              {items.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <FileText className="h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-[220px] flex-1"><div className="font-medium">{item.title}</div><div className="text-xs text-muted-foreground">{item.filename} · {formatBytes(item.sizeBytes)} · {item.category}</div>{item.description && <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</div>}</div>
                  <Badge variant={item.isPublished ? "default" : "outline"}>{item.isPublished ? "Published" : "Draft"}</Badge>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={item.isPublished} onCheckedChange={(value) => update.mutate({ id: item.id, isPublished: value })} /> Publish</label>
                  <Button asChild size="sm" variant="outline" className="gap-1.5"><a href={item.url} target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5" /> Open</a></Button>
                  <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => remove.mutate({ id: item.id })} aria-label={`Delete ${item.title}`}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
