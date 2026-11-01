import { trpc } from "@/lib/trpc";

export const PELICAN_PRODUCT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export const PELICAN_PRODUCT_IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type PelicanProductImageContentType = (typeof PELICAN_PRODUCT_IMAGE_CONTENT_TYPES)[number];

export type PelicanProductImageTarget = "catalog" | "designer" | "both" | "roomScene";

export type UploadPelicanProductImageInput = {
  id: number;
  dataBase64: string;
  contentType: PelicanProductImageContentType;
  /** `catalog` writes imageUrl, `designer` writes materialImageUrl, `roomScene` writes roomSceneImageUrl, `both` writes catalog and Designer. */
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
  /** Absent until the backend follow-up that stores the room scene photo. */
  roomSceneImageUrl?: string | null;
  width: number;
  height: number;
};

/** Missing `roomSceneImageUrl` is null. Non-strings from an older payload are null too. */
export function pelicanRoomSceneImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

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

const STORED_IMAGE_PREFIX = "/manus-storage/";

export function isHttpImageUrl(value: string | null | undefined): boolean {
  return /^https?:\/\//i.test((value ?? "").trim());
}

/** Stored upload keys look like `/manus-storage/pelican/products/<id>/<ts>-<id>_<hash>.webp`. */
export function isStoredPelicanImagePath(value: string | null | undefined): boolean {
  const path = (value ?? "").trim();
  if (!path.startsWith(STORED_IMAGE_PREFIX)) return false;
  const rest = path.slice(STORED_IMAGE_PREFIX.length);
  return rest.length > 0 && !rest.includes("..") && !/[\s?#\\]/.test(rest);
}

export function httpImageUrlOrBlank(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  return isHttpImageUrl(trimmed) ? trimmed : "";
}

export type PelicanItemSavePhotos = {
  /** Omit `imageUrl` when the catalog photo is a stored upload. `updateProduct.imageUrl` accepts only http(s). */
  imageUrl?: string | null;
  /** Optional. A stored Designer photo may be sent; leave it out to keep the current value. */
  materialImageUrl?: string | null;
  /** Sent only when the room scene photo changed. Omit to leave the stored value alone. */
  roomSceneImageUrl?: string | null;
  error?: string;
};

/**
 * The pasted Image URL field is http(s) only. An uploaded `/manus-storage/...`
 * catalog photo is not sent back through `updateProduct.imageUrl`. When that
 * paste field was not edited, `imageUrl` is omitted so the save does not
 * restore the previous catalog URL.
 */
export function pelicanItemSavePhotos(input: {
  pastedImageUrl: string;
  pastedImageUrlBaseline: string;
  storedImageUrl: string | null;
  storedMaterialImageUrl: string | null;
  storedRoomSceneImageUrl?: string | null;
  roomSceneImageUrlBaseline?: string | null;
}): PelicanItemSavePhotos {
  const pasted = input.pastedImageUrl.trim();
  const baseline = input.pastedImageUrlBaseline.trim();
  if (pasted && !isHttpImageUrl(pasted)) {
    return { error: "Image URL must start with http:// or https://." };
  }
  const storedImage = (input.storedImageUrl ?? "").trim();
  const pasteChanged = pasted !== baseline;
  let imageUrl: string | null | undefined;
  if (pasteChanged) {
    imageUrl = pasted || null;
  } else if (isStoredPelicanImagePath(storedImage)) {
    imageUrl = undefined;
  } else if (isHttpImageUrl(storedImage)) {
    imageUrl = storedImage;
  } else {
    imageUrl = pasted || null;
  }
  const material = (input.storedMaterialImageUrl ?? "").trim();
  const materialImageUrl = isStoredPelicanImagePath(material) || isHttpImageUrl(material) ? material : undefined;
  const roomScene = pelicanRoomSceneImageUrl(input.storedRoomSceneImageUrl);
  const roomSceneBaseline = pelicanRoomSceneImageUrl(input.roomSceneImageUrlBaseline);
  const roomSceneImageUrl = roomScene === roomSceneBaseline ? undefined : roomScene;
  return {
    imageUrl,
    materialImageUrl,
    ...(roomSceneImageUrl !== undefined ? { roomSceneImageUrl } : {}),
  };
}

/** Preview the saved, border-trimmed URL from the upload response. */
export function trimmedPelicanPhotoUrl(
  target: "catalog" | "designer" | "roomScene",
  result: Pick<UploadPelicanProductImageResult, "url" | "materialImageUrl" | "imageUrl" | "roomSceneImageUrl">,
): string | null {
  const specific = target === "catalog"
    ? result.imageUrl
    : target === "designer"
      ? result.materialImageUrl
      : result.roomSceneImageUrl;
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
