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

/**
 * A product page or other web page is not an image.
 *
 * The admin Image URL field held `https://buildpelican.com/products/pl-02141`,
 * which is the Pelican product page. Saving it as a catalog photo stores a URL
 * a browser cannot render, and it overwrote a real uploaded photo.
 *
 * A link is treated as a page when its path has no image extension and does not
 * look like a CDN image route. That is deliberately conservative: real image
 * URLs with a query string, a resize segment, or no extension at all still pass,
 * so this only rejects obvious page links.
 */
export function isWebPageUrl(value: string | null | undefined): boolean {
  const trimmed = (value ?? "").trim();
  if (!isHttpImageUrl(trimmed)) return false;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  const path = parsed.pathname.toLowerCase();
  // An image file extension anywhere at the end of the path.
  if (/\.(?:avif|bmp|gif|ico|jpe?g|png|svg|tiff?|webp)$/.test(path)) return false;
  // Shopify and similar CDNs serve images from these routes without an extension.
  if (/\/(?:cdn|files|images?|media|assets)\//.test(path)) return false;
  // A bare domain or a short page path: the product page case.
  const segments = path.split("/").filter(Boolean);
  const looksLikePage = /\/(?:products?|collections?|pages?|blogs?|shop|catalog|p?)\//.test(path)
    || segments.length <= 1;
  return looksLikePage;
}

/** A URL that can be a catalog photo: an http(s) image, not a web page. */
export function isCatalogPhotoUrl(value: string | null | undefined): boolean {
  const trimmed = (value ?? "").trim();
  return isHttpImageUrl(trimmed) && !isWebPageUrl(trimmed);
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
/**
 * What Save should send for the three photo columns.
 *
 * Rules, in order:
 *  1. An uploaded `/manus-storage/...` photo is already stored. It is never
 *     overwritten by the Image URL field. That field held a product *page*
 *     link, and sending it back replaced a real upload with an unrenderable
 *     page URL — the reported "uploaded the image and saved it but did not
 *     save" bug.
 *  2. A page link is rejected with a message instead of being saved as a photo.
 *  3. Otherwise a changed Image URL field wins, and an unchanged one leaves the
 *     current value alone.
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
  if (pasted && isWebPageUrl(pasted)) {
    return { error: "That is a web page, not an image. Use the Upload regular photo button, or paste a direct image link that ends in .jpg, .png, or .webp." };
  }
  const storedImage = (input.storedImageUrl ?? "").trim();
  const uploaded = isStoredPelicanImagePath(storedImage);
  const pasteChanged = pasted !== baseline;
  let imageUrl: string | null | undefined;
  if (uploaded) {
    // The upload is the catalog photo. Never let the field replace it.
    imageUrl = undefined;
  } else if (pasteChanged) {
    imageUrl = pasted || null;
  } else if (isHttpImageUrl(storedImage) && !isWebPageUrl(storedImage)) {
    imageUrl = storedImage;
  } else {
    // Nothing usable stored and the field was not edited: clear the page link
    // rather than save it again.
    imageUrl = pasted && isCatalogPhotoUrl(pasted) ? pasted : null;
  }
  const material = (input.storedMaterialImageUrl ?? "").trim();
  const materialImageUrl = isStoredPelicanImagePath(material) || isCatalogPhotoUrl(material) ? material : undefined;
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
