import { useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Reads a File into a base64 data URL, downscaling very large photos so the
 * upload payload stays reasonable (longest edge ~1600px).
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.onload = () => {
      const src = String(reader.result);
      const img = new Image();
      img.onerror = () => resolve(src); // fall back to original if decode fails
      img.onload = () => {
        const MAX = 1600;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        if (scale >= 1) {
          resolve(src);
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

/** Small green check shown when a style's sample photo has been verified. */
export function VerifiedCheck({ verified }: { verified: boolean }) {
  if (!verified) return null;
  return (
    <span
      title="Sample photo verified"
      className="inline-flex items-center text-emerald-600"
      aria-label="Sample photo verified"
    >
      <CheckCircle2 className="h-4 w-4" />
    </span>
  );
}

interface Props {
  styleId: number;
  styleName: string;
  /** Compact icon-only button for dense lists. */
  compact?: boolean;
  onDone?: () => void;
}

/**
 * "Wrong door — upload correct photo" control. Picks an image (camera on
 * mobile), sends it to doorStyles.submitCorrection. For admins the live sample
 * updates immediately; non-admins create a pending correction for review.
 */
export default function DoorPhotoCorrectButton({ styleId, styleName, compact, onDone }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const utils = trpc.useUtils();

  const submit = trpc.doorStyles.submitCorrection.useMutation({
    onSuccess: (res) => {
      if (res.applied) {
        toast.success(`Updated the sample photo for ${styleName}.`);
      } else {
        toast.success(`Photo submitted for ${styleName} — pending admin review.`);
      }
      utils.doorStyles.listForAdmin.invalidate();
      utils.doorStyles.featured.invalidate();
      utils.doorStyles.listCorrections.invalidate();
      onDone?.();
    },
    onError: (e) => toast.error(e.message),
    onSettled: () => setBusy(false),
  });

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      submit.mutate({ styleId, imageDataUrl: dataUrl });
    } catch (err) {
      setBusy(false);
      toast.error(err instanceof Error ? err.message : "Could not process the image.");
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPick}
      />
      <Button
        type="button"
        size={compact ? "icon" : "sm"}
        variant="outline"
        className={compact ? "h-8 w-8" : "h-8"}
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        title="Wrong door? Upload the correct photo"
        aria-label="Upload correct door photo"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Camera className="h-4 w-4" />
        )}
        {!compact && <span className="ml-1.5">Fix photo</span>}
      </Button>
    </>
  );
}
