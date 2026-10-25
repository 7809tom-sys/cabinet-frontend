import { useState } from "react";
import { ImageIcon, Loader2, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function dateLabel(value: string | Date | null) {
  if (!value) return "Date unavailable";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function AffiliateImageCabinet() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.affiliateGeneratedImages.list.useQuery();
  const [workingKey, setWorkingKey] = useState<string | null>(null);
  const watermark = trpc.affiliateGeneratedImages.watermark.useMutation({
    onSuccess: () => {
      toast.success("Watermark applied", { description: "The original image remains preserved." });
      utils.affiliateGeneratedImages.list.invalidate();
    },
    onError: (error) => toast.error("Could not watermark image", { description: error.message }),
    onSettled: () => setWorkingKey(null),
  });

  const images = data ?? [];
  return (
    <div className="max-w-5xl space-y-6" data-testid="affiliate-image-cabinet">
      <div>
        <h1 className="font-serif text-2xl font-bold flex items-center gap-2"><ImageIcon className="h-6 w-6 text-primary" /> Image Cabinet</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">Generated images from this affiliate storefront are kept here. Apply your saved logo watermark with one click before featuring an image in your room scenes.</p>
      </div>
      <Card className="border-indigo-200 bg-indigo-50/60">
        <CardContent className="flex items-start gap-3 p-4 text-sm text-indigo-950">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-700" />
          <div><strong>Originals stay protected.</strong> Watermarking creates a separate affiliate-owned copy in the consistent bottom-right safe area. It does not change supplier catalog images, pricing, checkout, or the saved Designer plan.</div>
        </CardContent>
      </Card>
      {isLoading ? (
        <div className="flex min-h-48 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading image cabinet…</div>
      ) : images.length === 0 ? (
        <Card className="border-dashed"><CardContent className="flex min-h-48 flex-col items-center justify-center gap-2 text-center text-muted-foreground"><Sparkles className="h-9 w-9 opacity-40" /><p className="font-medium">No affiliate-generated images yet</p><p className="max-w-md text-sm">Generate an image from this affiliate storefront’s Designer and it will appear here automatically.</p></CardContent></Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {images.map((image) => {
            const key = `${image.sourceType}:${image.id}`;
            const imageUrl = image.watermarkedUrl || image.imageUrl || "";
            return (
              <Card key={key} className="overflow-hidden">
                <div className="aspect-[16/10] bg-muted">{imageUrl ? <img src={imageUrl} alt={`${image.name ?? "Affiliate"} generated room scene`} className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Image unavailable</div>}</div>
                <CardHeader className="pb-2"><div className="flex items-start justify-between gap-2"><CardTitle className="text-base">{image.name || "Generated room scene"}</CardTitle><Badge variant="outline" className="shrink-0"><Sparkles className="mr-1 h-3 w-3" />{image.sourceType === "gemini" ? "Gemini" : "3D render"}</Badge></div><p className="text-xs text-muted-foreground">Generated {dateLabel(image.createdAt)}</p></CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">{image.watermarkedUrl ? <Badge className="bg-emerald-600"><ShieldCheck className="mr-1 h-3 w-3" />Watermarked</Badge> : <Badge variant="secondary">Original preserved</Badge>}{image.isFeatured && <Badge variant="outline">Featured in room scenes</Badge>}</div>
                  <Button type="button" className="w-full gap-2" variant={image.watermarkedUrl ? "outline" : "default"} disabled={workingKey === key || watermark.isPending} onClick={() => { setWorkingKey(key); watermark.mutate({ sourceType: image.sourceType, sourceId: image.id }); }}><Wand2 className="h-4 w-4" />{workingKey === key ? "Applying watermark…" : image.watermarkedUrl ? "Reapply watermark" : "Watermark"}</Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
