import { useRef } from "react";
import { ImageIcon, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/** Catalog, Designer, and room-scene uploads shared by the Pelican item editor. */
export function VendorCatalogPhotoFields({
  catalogPhotoUrl,
  designerPhotoUrl,
  roomScenePhotoUrl,
  catalogPending,
  designerPending,
  roomScenePending,
  catalogTrimmed,
  designerTrimmed,
  roomSceneTrimmed,
  designerCleanedPreviewUrl,
  designerTransparencyWarning,
  onCatalogFile,
  onDesignerFile,
  onRoomSceneFile,
}: {
  catalogPhotoUrl: string;
  designerPhotoUrl: string;
  roomScenePhotoUrl: string | null;
  catalogPending: boolean;
  designerPending: boolean;
  roomScenePending: boolean;
  catalogTrimmed: boolean;
  designerTrimmed: boolean;
  roomSceneTrimmed: boolean;
  designerCleanedPreviewUrl: string | null;
  designerTransparencyWarning: string | null;
  onCatalogFile: (file: File) => void;
  onDesignerFile: (file: File) => void;
  onRoomSceneFile: (file: File) => void;
}) {
  const catalogPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const designerPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const roomScenePhotoInputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-2">
        <Label>Current catalog photo</Label>
        <div data-testid="pelican-catalog-photo-preview" className="relative flex h-32 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {catalogPhotoUrl ? <img src={catalogPhotoUrl} alt="Current catalog photo" className="h-full w-full object-contain" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
          {catalogPending && <div className="absolute inset-0 flex items-center justify-center bg-background/70"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        </div>
        {catalogTrimmed && <p data-testid="pelican-catalog-trim-note" className="text-xs text-muted-foreground">White border trimmed automatically</p>}
        <Button type="button" variant="outline" data-testid="pelican-upload-catalog-photo" disabled={catalogPending} onClick={() => catalogPhotoInputRef.current?.click()}>
          {catalogPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Upload regular photo
        </Button>
        <input ref={catalogPhotoInputRef} data-testid="pelican-catalog-photo-input" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onCatalogFile(file); }} />
      </div>
      <div className="grid gap-2">
        <Label>Current Designer photo</Label>
        <div data-testid="pelican-designer-photo-preview" className="relative flex h-32 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {designerPhotoUrl ? <img src={designerPhotoUrl} alt="Current Designer photo" className="h-full w-full object-contain" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
          {designerPending && <div className="absolute inset-0 flex items-center justify-center bg-background/70"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        </div>
        {designerTrimmed && <p data-testid="pelican-designer-trim-note" className="text-xs text-muted-foreground">White border trimmed automatically</p>}
        {designerCleanedPreviewUrl && (
          <div data-testid="pelican-designer-cleaned-preview" className="flex items-center gap-2">
            <img
              src={designerCleanedPreviewUrl}
              alt="Cleaned Designer photo"
              className="h-16 w-16 rounded border object-contain"
              style={{
                backgroundColor: "#ffffff",
                backgroundImage: "linear-gradient(45deg, #d4d4d4 25%, transparent 25%), linear-gradient(-45deg, #d4d4d4 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d4d4d4 75%), linear-gradient(-45deg, transparent 75%, #d4d4d4 75%)",
                backgroundSize: "12px 12px",
                backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0",
              }}
            />
            <p className="text-xs text-muted-foreground">Checkerboard removed. Transparent edges upload as PNG.</p>
          </div>
        )}
        {designerTransparencyWarning && (
          <p data-testid="pelican-designer-transparency-warning" className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-950">{designerTransparencyWarning}</p>
        )}
        <Button type="button" variant="outline" data-testid="pelican-upload-designer-photo" disabled={designerPending} onClick={() => designerPhotoInputRef.current?.click()}>
          {designerPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Upload Designer photo
        </Button>
        <input ref={designerPhotoInputRef} data-testid="pelican-designer-photo-input" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onDesignerFile(file); }} />
      </div>
      <div className="grid gap-2">
        <Label>Current room scene photo</Label>
        <div data-testid="pelican-room-scene-photo-preview" className="relative flex h-32 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {roomScenePhotoUrl ? <img src={roomScenePhotoUrl} alt="Current room scene photo" className="h-full w-full object-contain" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
          {roomScenePending && <div className="absolute inset-0 flex items-center justify-center bg-background/70"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        </div>
        {roomSceneTrimmed && <p data-testid="pelican-room-scene-trim-note" className="text-xs text-muted-foreground">White border trimmed automatically</p>}
        <Button type="button" variant="outline" data-testid="pelican-upload-room-scene-photo" disabled={roomScenePending} onClick={() => roomScenePhotoInputRef.current?.click()}>
          {roomScenePending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Upload room scene photo
        </Button>
        <input ref={roomScenePhotoInputRef} data-testid="pelican-room-scene-photo-input" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onRoomSceneFile(file); }} />
      </div>
    </div>
  );
}
