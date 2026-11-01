import { trpc } from "@/lib/trpc";

export const PELICAN_PRODUCT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export const PELICAN_PRODUCT_IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type PelicanProductImageContentType = (typeof PELICAN_PRODUCT_IMAGE_CONTENT_TYPES)[number];

export type PelicanProductImageTarget = "catalog" | "designer" | "both";

export type UploadPelicanProductImageInput = {
  id: number;
  dataBase64: string;
  contentType: PelicanProductImageContentType;
  /** `catalog` writes imageUrl, `designer` writes materialImageUrl, `both` writes both. */
  target: PelicanProductImageTarget;
  /**
   * Sent with the same meaning as `target`. The paired backend still defaults
   * these to true; each slot sets them explicitly so one photo cannot overwrite
   * the other column if `target` is not read yet.
   */
  useAsDesignerPhoto?: boolean;
  alsoSetCatalogImage?: boolean;
};

export type UploadPelicanProductImageResult = {
  url: string;
  materialImageUrl: string | null;
  imageUrl: string | null;
};

export type PelicanProductImageFile = {
  type: string;
  size: number;
  name?: string;
};

export type PelicanProductImageValidation =
  | { ok: true; contentType: PelicanProductImageContentType }
  | { ok: false; message: string };

const EXTENSION_CONTENT_TYPES: Record<string, PelicanProductImageContentType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function contentTypeFromName(name: string | undefined): PelicanProductImageContentType | null {
  const extension = name?.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_CONTENT_TYPES[extension] ?? null;
}

export function validatePelicanProductImageFile(file: PelicanProductImageFile): PelicanProductImageValidation {
  const declared = file.type === "image/jpg" ? "image/jpeg" : file.type;
  const declaredAllowed = (PELICAN_PRODUCT_IMAGE_CONTENT_TYPES as readonly string[]).includes(declared);
  const fromName = contentTypeFromName(file.name);
  const contentType: PelicanProductImageContentType | null = declaredAllowed
    ? declared as PelicanProductImageContentType
    : (!file.type || file.type === "application/octet-stream") && fromName
      ? fromName
      : null;
  if (!contentType) {
    return { ok: false, message: "Use a JPEG, PNG, or WebP photo." };
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, message: "Choose a photo to upload." };
  }
  if (file.size > PELICAN_PRODUCT_IMAGE_MAX_BYTES) {
    return { ok: false, message: "Photos must be 10 MB or smaller." };
  }
  return { ok: true, contentType };
}

export function readPelicanProductImageBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The photo could not be read."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}

/** Pasted catalog URLs stay http(s). Uploads may also return a same-origin storage path. */
export function pelicanCatalogImageUrlIsValid(value: string): boolean {
  const imageUrl = value.trim();
  if (!imageUrl) return true;
  if (/^https?:\/\//i.test(imageUrl)) return true;
  return imageUrl.startsWith("/") && !imageUrl.startsWith("//");
}

/** Preview the saved, border-trimmed URL from the upload response. */
export function trimmedPelicanPhotoUrl(
  target: "catalog" | "designer",
  result: Pick<UploadPelicanProductImageResult, "url" | "materialImageUrl" | "imageUrl">,
): string | null {
  const specific = target === "catalog" ? result.imageUrl : result.materialImageUrl;
  const value = (specific || result.url || "").trim();
  return value || null;
}

type UploadMutation = {
  mutateAsync: (input: UploadPelicanProductImageInput) => Promise<UploadPelicanProductImageResult>;
  isPending: boolean;
};

// `pelican.uploadProductImage` ships in the paired cabinet-backend PR.
// Cast until AppRouter includes it. This frontend typechecks before that
// procedure exists; the call itself works only after the backend is deployed.
export function useUploadPelicanProductImage(): UploadMutation {
  const client = trpc as unknown as {
    pelican: {
      uploadProductImage: {
        useMutation: () => UploadMutation;
      };
    };
  };
  return client.pelican.uploadProductImage.useMutation();
}
