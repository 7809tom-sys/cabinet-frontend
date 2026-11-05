/**
 * Pallet photo capture used when an order is marked shipped.
 *
 * The storage procedure (`orders.uploadPalletPhoto`) lives in the cabinet-backend
 * draft. Until it exists on the deployed backend this module keeps the UI usable:
 * the prompt renders, Skip works, and an upload attempt surfaces the backend's
 * message instead of breaking the shipping action.
 */
import type { AdminOrderRow } from "@/lib/adminOrderRow";

export const PALLET_PHOTO_ACCEPT = "image/*";

/** Mobile browsers open the camera; desktop opens a file picker. */
export const PALLET_PHOTO_CAPTURE = "environment" as const;

export const PALLET_PHOTO_MAX_BYTES = 15 * 1024 * 1024;

export type PalletPhotoRef = {
  url: string;
  uploadedAt?: string | Date | null;
  uploadedBy?: string | null;
};

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Client-side guard so an oversized photo fails fast with a readable message. */
export function palletPhotoValidation(file: { size: number; type?: string | null } | null | undefined): string | null {
  if (!file) return "Choose a photo of the pallet first.";
  if (file.size <= 0) return "That photo is empty. Take the picture again.";
  if (file.size > PALLET_PHOTO_MAX_BYTES) {
    return `That photo is ${formatBytes(file.size)}. Use a photo under ${formatBytes(PALLET_PHOTO_MAX_BYTES)}.`;
  }
  if (file.type && !file.type.startsWith("image/")) return "Only photos can be attached.";
  return null;
}

/**
 * Photos already attached to the order. The backend field name is not deployed
 * yet, so read the likely names and otherwise fall back to the shipment trail.
 */
export function adminOrderPalletPhotos(order: AdminOrderRow): PalletPhotoRef[] {
  const record = order as AdminOrderRow & {
    palletPhotoUrl?: string | null;
    palletPhotoUrls?: string[] | null;
    shipments?: Array<{
      status?: string | null;
      shippedAt?: string | Date | null;
      carrier?: string | null;
      trackingNumber?: string | null;
      palletPhotoUrl?: string | null;
      palletPhotos?: string[] | null;
    }>;
  };
  const urls: PalletPhotoRef[] = [];
  const push = (url: string | null | undefined) => {
    const trimmed = (url ?? "").trim();
    if (trimmed && !urls.some((row) => row.url === trimmed)) urls.push({ url: trimmed });
  };
  push(record.palletPhotoUrl);
  for (const url of record.palletPhotoUrls ?? []) push(url);
  for (const shipment of record.shipments ?? []) {
    push(shipment.palletPhotoUrl);
    for (const url of shipment.palletPhotos ?? []) push(url);
  }
  return urls;
}

/** Read the file the admin picked as base64 so it matches the backend's upload shape. */
export function readPalletPhoto(file: File): Promise<{ base64: string; mimeType: string; fileName: string; sizeBytes: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that photo. Try taking it again."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      if (comma < 0) {
        reject(new Error("Could not read that photo. Try taking it again."));
        return;
      }
      resolve({
        base64: result.slice(comma + 1),
        mimeType: file.type || "image/jpeg",
        fileName: file.name || "pallet-photo.jpg",
        sizeBytes: file.size,
      });
    };
    reader.readAsDataURL(file);
  });
}
