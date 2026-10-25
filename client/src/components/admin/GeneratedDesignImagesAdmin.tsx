import { useMemo, useState } from "react";
import { CheckCircle2, FileImage, ImageIcon, Loader2, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type GeneratedImage = {
  source: "deterministic" | "gemini";
  sourceId: number;
  sourceKey: string;
  sourceLabel: string;
  imageUrl: string;
  createdAt: Date;
  designId: number | null;
  designName: string;
  cabinetStyleId: number | null;
  cabinetName: string | null;
  customerName: string | null;
  originatorName: string;
  carousel: { sceneId: number; styleId: number; active: boolean } | null;
};

type AdminStyle = { id: number; ourName: string; aliasName: string | null; isActive: boolean };

function displayStyleName(style: AdminStyle) {
  return style.aliasName?.trim() || style.ourName;
}

function dateLabel(value: Date) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Internal review folder for completed images that came directly from a locked
 * Designer plan. The approval switch is intentionally separate from generation:
 * no generated image becomes a public room scene until an administrator chooses
 * the correct cabinet finish and enables it here.
 */
export function GeneratedDesignImagesAdmin() {
  const utils = trpc.useUtils();
  const [styleBySource, setStyleBySource] = useState<Record<string, string>>({});
  const { data, isLoading } = trpc.generatedDesignImages.list.useQuery();
  const { data: rawStyles } = trpc.doorStyles.listForAdmin.useQuery();
  const styles = useMemo(
    () => ((rawStyles ?? []) as unknown as AdminStyle[]).filter((style) => style.isActive).sort((left, right) => displayStyleName(left).localeCompare(displayStyleName(right))),
    [rawStyles],
  );
  const images = (data?.items ?? []) as GeneratedImage[];

  const setCarousel = trpc.generatedDesignImages.setRoomSceneCarousel.useMutation({
    onSuccess: (result) => {
      toast.success(result.active ? "Image approved for the room-scene carousel" : "Image removed from the room-scene carousel");
      utils.generatedDesignImages.list.invalidate();
      utils.doorStyles.featured.invalidate();
      utils.doorStyles.list.invalidate();
      utils.doorStyles.listForAdmin.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  function selectedStyleId(image: GeneratedImage) {
    const chosen = styleBySource[image.sourceKey];
    if (chosen) return Number(chosen);
    return image.carousel?.styleId ?? image.cabinetStyleId ?? null;
  }

  function setCarouselActive(image: GeneratedImage, active: boolean) {
    const styleId = selectedStyleId(image);
    if (!styleId) {
      toast.error("Choose the cabinet finish before adding a generated image to the room-scene carousel.");
      return;
    }
    setCarousel.mutate({ source: image.source, sourceId: image.sourceId, styleId, active });
  }

  return (
    <div className="space-y-5" data-testid="generated-design-images-admin">
      <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-sky-50">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg"><FileImage className="h-5 w-5 text-indigo-700" />Generated Design Images</CardTitle>
              <CardDescription className="mt-1 max-w-3xl">A review folder for images generated from locked Designer plans. Each card shows the design, selected cabinet finish, customer when a verified image request supplied one, and the person who originated the design.</CardDescription>
            </div>
            <Badge variant="secondary" className="bg-indigo-100 text-indigo-900">{images.length} completed image{images.length === 1 ? "" : "s"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0 text-xs text-indigo-950">
          An image remains private until the **Room-scene carousel** switch is enabled for a selected door style. Enabling it adds the exact generated file to that style’s active room-scene carousel; changing the selected finish moves it there, so one exact kitchen image cannot appear as more than one cabinet finish. Disabling it removes it from public display without deleting the generated image or its design record.
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex min-h-52 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading completed design images…</div>
      ) : images.length === 0 ? (
        <Card className="border-dashed"><CardContent className="flex min-h-52 flex-col items-center justify-center gap-3 text-center text-muted-foreground"><ImageIcon className="h-10 w-10 opacity-40" /><p className="font-medium">No completed generated design images yet</p><p className="max-w-md text-sm">Generate an exact 3D final render or a completed administrator Google/Gemini test. It will appear here automatically for review.</p></CardContent></Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {images.map((image) => {
            const targetStyleId = selectedStyleId(image);
            const active = Boolean(image.carousel?.active && image.carousel.styleId === targetStyleId);
            return (
              <Card key={image.sourceKey} className="overflow-hidden border-slate-200 shadow-sm" data-testid={`generated-design-image-${image.source}-${image.sourceId}`}>
                <div className="grid md:grid-cols-[minmax(220px,42%)_1fr]">
                  <div className="min-h-56 bg-slate-100 p-2">
                    <img src={image.imageUrl} alt={`${image.designName} generated image`} className="h-full min-h-56 w-full rounded-md object-cover" loading="lazy" />
                  </div>
                  <CardContent className="space-y-4 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold leading-tight">{image.designName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Generated {dateLabel(image.createdAt)}</p>
                      </div>
                      <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-800"><Sparkles className="mr-1 h-3 w-3" />{image.sourceLabel}</Badge>
                    </div>

                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                      <dt className="text-muted-foreground">Cabinet finish</dt><dd className="font-medium">{image.cabinetName ?? "No finish identified"}</dd>
                      <dt className="text-muted-foreground">Customer</dt><dd>{image.customerName ?? "Not provided"}</dd>
                      <dt className="text-muted-foreground">Originator</dt><dd className="flex items-center gap-1"><UserRound className="h-3.5 w-3.5 text-muted-foreground" />{image.originatorName}</dd>
                      <dt className="text-muted-foreground">Design record</dt><dd>{image.designId ? `#${image.designId}` : "Current-design snapshot"}</dd>
                    </dl>

                    <div className="space-y-2 border-t pt-3">
                      <Label htmlFor={`generated-style-${image.sourceKey}`} className="text-xs font-semibold">Cabinet finish for room-scene carousel</Label>
                      <Select value={targetStyleId ? String(targetStyleId) : undefined} onValueChange={(value) => setStyleBySource((current) => ({ ...current, [image.sourceKey]: value }))}>
                        <SelectTrigger id={`generated-style-${image.sourceKey}`} data-testid={`generated-image-style-${image.source}-${image.sourceId}`}><SelectValue placeholder="Choose cabinet finish" /></SelectTrigger>
                        <SelectContent>
                          {styles.map((style) => <SelectItem key={style.id} value={String(style.id)}>{displayStyleName(style)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium">Room-scene carousel</p>
                          <p className="text-xs text-muted-foreground">{active ? "Active on the selected finish" : "Private until approved"}</p>
                        </div>
                        <Switch
                          data-testid={`generated-image-carousel-${image.source}-${image.sourceId}`}
                          checked={active}
                          disabled={setCarousel.isPending || !targetStyleId}
                          onCheckedChange={(checked) => setCarouselActive(image, checked)}
                          aria-label={`Show ${image.designName} in the room-scene carousel`}
                        />
                      </div>
                      {active && <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Approved and active in the room-scene carousel.</div>}
                    </div>
                  </CardContent>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
