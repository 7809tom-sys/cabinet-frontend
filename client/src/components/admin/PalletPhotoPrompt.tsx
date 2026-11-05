import { useRef, useState } from "react";
import { Camera, ImagePlus, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import {
  PALLET_PHOTO_ACCEPT,
  PALLET_PHOTO_CAPTURE,
  formatBytes,
  palletPhotoValidation,
  readPalletPhoto,
} from "@/lib/orderPalletPhoto";

export type PalletPhotoUploadInput = {
  base64: string;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
};

type UploadState = { status: "idle" } | { status: "uploading" } | { status: "done"; url: string | null };

/**
 * Prominent prompt shown when an order is marked shipped. The photo is optional
 * (Skip is always available) but the prompt asks clearly, and a mobile browser
 * opens the camera directly through the capture hint.
 */
export default function PalletPhotoPrompt({
  onSkip,
  onUpload,
  uploadUnavailableReason,
}: {
  onSkip: () => void;
  /** Returns the stored photo URL, or null when the backend cannot attach it yet. */
  onUpload: (photo: PalletPhotoUploadInput) => Promise<{ url: string | null }>;
  uploadUnavailableReason?: string | null;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [state, setState] = useState<UploadState>({ status: "idle" });

  const choose = (next: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(next);
    setPreviewUrl(next ? URL.createObjectURL(next) : null);
  };

  const upload = async () => {
    const problem = palletPhotoValidation(file);
    if (problem || !file) {
      toast.error(problem ?? "Choose a photo of the pallet first.");
      return;
    }
    setState({ status: "uploading" });
    try {
      const photo = await readPalletPhoto(file);
      const result = await onUpload(photo);
      setState({ status: "done", url: result.url });
      if (!result.url && uploadUnavailableReason) toast.message(uploadUnavailableReason);
    } catch (error) {
      setState({ status: "idle" });
      toast.error(error instanceof Error ? error.message : "Could not upload that photo.");
    }
  };

  return (
    <div
      className="rounded-lg border-2 border-primary/40 bg-primary/5 p-4"
      data-testid="pallet-photo-prompt"
      role="region"
      aria-label="Pallet photo"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Camera className="h-4 w-4 text-primary" />
            Take a photo of the pallet
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Photograph the finished pallet before it leaves. The photo is attached to this order so
            anyone can see exactly how it shipped. You can skip this and add it later from the order page.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground"
          aria-label="Skip the pallet photo"
          onClick={onSkip}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={cameraRef}
          type="file"
          accept={PALLET_PHOTO_ACCEPT}
          capture={PALLET_PHOTO_CAPTURE}
          className="sr-only"
          aria-label="Take a photo of the pallet"
          data-testid="pallet-photo-camera-input"
          onChange={(event) => choose(event.target.files?.[0] ?? null)}
        />
        <input
          ref={fileRef}
          type="file"
          accept={PALLET_PHOTO_ACCEPT}
          className="sr-only"
          aria-label="Upload a pallet photo"
          data-testid="pallet-photo-file-input"
          onChange={(event) => choose(event.target.files?.[0] ?? null)}
        />
        <Button type="button" size="sm" className="gap-1.5" onClick={() => cameraRef.current?.click()}>
          <Camera className="h-4 w-4" />
          Take photo
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
          <ImagePlus className="h-4 w-4" />
          Choose a file
        </Button>
        {file && (
          <span className="text-xs text-muted-foreground" data-testid="pallet-photo-selected">
            {file.name || "Photo"} · {formatBytes(file.size)}
          </span>
        )}
      </div>

      {previewUrl && (
        <div className="mt-3">
          <Label className="text-xs text-muted-foreground">Preview</Label>
          <img
            src={previewUrl}
            alt="Selected pallet photo"
            className="mt-1 max-h-56 w-auto rounded-md border object-contain"
            data-testid="pallet-photo-preview"
          />
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          onClick={upload}
          disabled={state.status === "uploading" || !file}
          data-testid="pallet-photo-upload"
        >
          {state.status === "uploading" ? <Spinner className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
          Attach photo
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onSkip} data-testid="pallet-photo-skip">
          Skip for now
        </Button>
        {state.status === "done" && (
          <span className="text-xs font-medium text-emerald-700" data-testid="pallet-photo-saved">
            Photo attached to this order.
          </span>
        )}
      </div>
    </div>
  );
}
