import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PELICAN_PRODUCT_IMAGE_MAX_BYTES,
  pelicanCatalogImageUrlIsValid,
  trimmedPelicanPhotoUrl,
  validatePelicanProductImageFile,
} from "./pelicanProductImageUpload";

describe("Pelican product image upload", () => {
  it("accepts jpeg, png, and webp up to 10 MB and rejects anything else", () => {
    expect(validatePelicanProductImageFile({ type: "image/jpeg", size: 1200, name: "slab.jpg" })).toEqual({ ok: true, contentType: "image/jpeg" });
    expect(validatePelicanProductImageFile({ type: "image/jpg", size: 1200, name: "slab.jpg" })).toEqual({ ok: true, contentType: "image/jpeg" });
    expect(validatePelicanProductImageFile({ type: "image/png", size: PELICAN_PRODUCT_IMAGE_MAX_BYTES, name: "slab.png" })).toEqual({ ok: true, contentType: "image/png" });
    expect(validatePelicanProductImageFile({ type: "", size: 1200, name: "slab.webp" })).toEqual({ ok: true, contentType: "image/webp" });
    expect(validatePelicanProductImageFile({ type: "application/octet-stream", size: 1200, name: "slab.jpeg" })).toEqual({ ok: true, contentType: "image/jpeg" });
    expect(validatePelicanProductImageFile({ type: "image/gif", size: 1200, name: "slab.gif" })).toMatchObject({ ok: false, message: "Use a JPEG, PNG, or WebP photo." });
    expect(validatePelicanProductImageFile({ type: "image/png", size: PELICAN_PRODUCT_IMAGE_MAX_BYTES + 1, name: "slab.png" })).toMatchObject({ ok: false, message: "Photos must be 10 MB or smaller." });
    expect(validatePelicanProductImageFile({ type: "image/png", size: 0, name: "slab.png" })).toMatchObject({ ok: false, message: "Choose a photo to upload." });
  });

  it("keeps pasted http URLs and same-origin storage paths for the catalog field", () => {
    expect(pelicanCatalogImageUrlIsValid("")).toBe(true);
    expect(pelicanCatalogImageUrlIsValid("https://cdn.example/slab.jpg")).toBe(true);
    expect(pelicanCatalogImageUrlIsValid("/manus-storage/pelican/uploads/trimmed.webp")).toBe(true);
    expect(pelicanCatalogImageUrlIsValid("slab.jpg")).toBe(false);
    expect(pelicanCatalogImageUrlIsValid("//cdn.example/slab.jpg")).toBe(false);
  });

  it("previews the returned trimmed URL for the uploaded slot", () => {
    const result = {
      url: "/manus-storage/pelican/uploads/trimmed.webp",
      imageUrl: "/manus-storage/pelican/uploads/catalog.webp",
      materialImageUrl: "/manus-storage/pelican/uploads/designer.webp",
    };
    expect(trimmedPelicanPhotoUrl("catalog", result)).toBe(result.imageUrl);
    expect(trimmedPelicanPhotoUrl("designer", result)).toBe(result.materialImageUrl);
    expect(trimmedPelicanPhotoUrl("designer", { ...result, materialImageUrl: null })).toBe(result.url);
    expect(trimmedPelicanPhotoUrl("catalog", { url: "  ", imageUrl: null, materialImageUrl: result.materialImageUrl })).toBeNull();
  });

  it("casts the upload mutation until AppRouter includes it", () => {
    const source = readFileSync(new URL("./pelicanProductImageUpload.ts", import.meta.url), "utf8");
    expect(source).toContain("Cast until AppRouter includes it");
    expect(source).toContain("uploadProductImage");
    expect(source).toContain('target: PelicanProductImageTarget');
    expect(source).not.toContain("gemini");
    expect(source).not.toContain("banana");
  });
});