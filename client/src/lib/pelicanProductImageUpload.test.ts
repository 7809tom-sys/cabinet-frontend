import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PELICAN_PRODUCT_IMAGE_MAX_BYTES,
  pelicanItemSavePhotos,
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

  it("does not send a stored catalog upload back through updateProduct.imageUrl", () => {
    const stored = "/manus-storage/pelican/products/42/1710000000000-42_ab12cd34.webp";
    const designer = "/manus-storage/pelican/products/42/1710000000001-42_ff00aa11.webp";
    expect(pelicanItemSavePhotos({
      pastedImageUrl: "",
      pastedImageUrlBaseline: "",
      storedImageUrl: stored,
      storedMaterialImageUrl: designer,
    })).toEqual({ imageUrl: undefined, materialImageUrl: designer });
    expect(pelicanItemSavePhotos({
      pastedImageUrl: "https://old.example/catalog.jpg",
      pastedImageUrlBaseline: "https://old.example/catalog.jpg",
      storedImageUrl: stored,
      storedMaterialImageUrl: designer,
    })).toEqual({ imageUrl: undefined, materialImageUrl: designer });
    expect(pelicanItemSavePhotos({
      pastedImageUrl: "https://cdn.example/replacement.jpg",
      pastedImageUrlBaseline: "",
      storedImageUrl: stored,
      storedMaterialImageUrl: null,
    })).toEqual({ imageUrl: "https://cdn.example/replacement.jpg", materialImageUrl: undefined });
    expect(pelicanItemSavePhotos({
      pastedImageUrl: "",
      pastedImageUrlBaseline: "https://old.example/catalog.jpg",
      storedImageUrl: "https://old.example/catalog.jpg",
      storedMaterialImageUrl: null,
    })).toEqual({ imageUrl: null, materialImageUrl: undefined });
    expect(pelicanItemSavePhotos({
      pastedImageUrl: stored,
      pastedImageUrlBaseline: "",
      storedImageUrl: stored,
      storedMaterialImageUrl: null,
    })).toEqual({ error: "Image URL must start with http:// or https://." });
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