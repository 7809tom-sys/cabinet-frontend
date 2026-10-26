import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type PublicSceneGroup = {
  name: string;
  description: string | null;
  photos: Array<{ id: number; imageUrl: string; isCover?: boolean }>;
};

export function PublicRoomSceneLightbox({
  open,
  onOpenChange,
  title,
  scenes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  scenes: PublicSceneGroup[];
}) {
  const photos = scenes.flatMap((scene) => scene.photos.map((photo) => ({ ...photo, sceneName: scene.name, description: scene.description })));
  const [index, setIndex] = useState(0);
  const current = photos[Math.min(index, Math.max(0, photos.length - 1))];
  const move = (direction: -1 | 1) => setIndex((value) => (value + direction + photos.length) % photos.length);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (next) setIndex(0); onOpenChange(next); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {current ? (
          <div className="space-y-3">
            <img src={current.imageUrl} alt={`${current.sceneName} room scene`} className="max-h-[60vh] w-full rounded-md object-contain bg-muted" />
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{current.sceneName}</p>
                {current.description && <p className="text-sm text-muted-foreground">{current.description}</p>}
              </div>
              {photos.length > 1 && (
                <div className="flex items-center gap-2">
                  <Button type="button" size="icon" variant="outline" aria-label="Previous room photo" onClick={() => move(-1)}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="text-xs text-muted-foreground">{Math.min(index, photos.length - 1) + 1} / {photos.length}</span>
                  <Button type="button" size="icon" variant="outline" aria-label="Next room photo" onClick={() => move(1)}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
          </div>
        ) : <p className="text-sm text-muted-foreground">No room photos yet.</p>}
      </DialogContent>
    </Dialog>
  );
}

export function PublicRoomSceneStrip({
  title,
  scenes,
}: {
  title: string;
  scenes: PublicSceneGroup[];
}) {
  const [open, setOpen] = useState(false);
  const [sceneName, setSceneName] = useState<string | null>(null);
  if (scenes.length === 0) return null;
  const visible = sceneName ? scenes.filter((scene) => scene.name === sceneName) : scenes;
  return (
    <div data-testid="public-room-scenes" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Room scenes</p>
        <Button type="button" size="sm" variant="outline" onClick={() => { setSceneName(null); setOpen(true); }}>View photos</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {scenes.map((scene) => {
          const cover = scene.photos.find((photo) => photo.isCover) ?? scene.photos[0];
          if (!cover) return null;
          return (
            <button key={scene.name} type="button" className="overflow-hidden rounded-lg border border-border bg-card text-left" onClick={() => { setSceneName(scene.name); setOpen(true); }}>
              <img src={cover.imageUrl} alt={`${scene.name} room scene`} className="h-28 w-full object-cover" />
              <div className="space-y-1 p-2">
                <p className="text-sm font-medium">{scene.name}</p>
                {scene.description && <p className="line-clamp-2 text-xs text-muted-foreground">{scene.description}</p>}
                <p className="text-[11px] text-muted-foreground">{scene.photos.length} photo{scene.photos.length === 1 ? "" : "s"}</p>
              </div>
            </button>
          );
        })}
      </div>
      <PublicRoomSceneLightbox open={open} onOpenChange={setOpen} title={title} scenes={visible} />
    </div>
  );
}
