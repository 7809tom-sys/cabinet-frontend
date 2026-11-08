import { describe, expect, it } from "vitest";
import {
  isCatalogPhotoUrl,
  isWebPageUrl,
  pelicanItemSavePhotos,
} from "./pelicanProductImageUpload";

const PRODUCT_PAGE = "https://buildpelican.com/products/pl-02141";
const UPLOADED = "/manus-storage/pelican/products/464/1794095942868-041e0946_93ab6a4f.webp";
const UPLOADED_DESIGNER = "/manus-storage/pelican/products/464/1794094999999-bbbbbbbb_designer.webp";

describe("A product page link is not a catalog photo", () => {
  it("recognises the Pelican product page from the report", () => {
    expect(isWebPageUrl(PRODUCT_PAGE)).toBe(true);
    expect(isCatalogPhotoUrl(PRODUCT_PAGE)).toBe(false);
    expect(isWebPageUrl("https://buildpelican.com/collections/bathroom-sinks")).toBe(true);
    expect(isWebPageUrl("https://buildpelican.com/products/pl-02141?_pos=1&_psq=PL-02141")).toBe(true);
  });

  it("still accepts real image URLs, including CDN routes and query strings", () => {
    for (const url of [
      "https://buildpelican.com/cdn/shop/files/PL-02141.png?v=1776715778",
      "https://cdn.shopify.com/s/files/1/0624/4476/5324/files/PL-02141_A.jpg",
      "https://example.com/photo.webp",
      "https://example.com/images/room.jpg?width=1200",
    ]) {
      expect(isWebPageUrl(url), url).toBe(false);
      expect(isCatalogPhotoUrl(url), url).toBe(true);
    }
  });

  it("refuses to save a page link where a photo belongs", () => {
    const result = pelicanItemSavePhotos({
      pastedImageUrl: PRODUCT_PAGE,
      pastedImageUrlBaseline: "",
      storedImageUrl: null,
      storedMaterialImageUrl: null,
    });
    expect(result.error).toBeTruthy();
    expect(result.error).toMatch(/web page, not an image/i);
    expect(result.imageUrl).toBeUndefined();
  });
});

describe("An uploaded photo survives Save", () => {
  it("is never overwritten by the page link in the Image URL field", () => {
    // Exactly the reported state: a page link sits in the field, the regular
    // photo and the Designer photo were both uploaded, and Save is pressed.
    const result = pelicanItemSavePhotos({
      pastedImageUrl: PRODUCT_PAGE,
      pastedImageUrlBaseline: "",
      storedImageUrl: UPLOADED,
      storedMaterialImageUrl: UPLOADED_DESIGNER,
    });
    // The page link is rejected, so Save stops instead of clobbering the upload.
    expect(result.error).toBeTruthy();
  });

  it("keeps the stored upload when the field is empty and the baseline is empty", () => {
    const result = pelicanItemSavePhotos({
      pastedImageUrl: "",
      pastedImageUrlBaseline: "",
      storedImageUrl: UPLOADED,
      storedMaterialImageUrl: UPLOADED_DESIGNER,
    });
    expect(result.error).toBeUndefined();
    // Omitted: the backend already holds the uploaded catalog photo.
    expect(result.imageUrl).toBeUndefined();
    expect(result.materialImageUrl).toBe(UPLOADED_DESIGNER);
  });

  it("refuses to write a stored page link back as a catalog photo", () => {
    // Reopening an item whose stored catalog photo is the page link must not
    // write that link back as an image. Save stops with the same clear message
    // rather than storing a URL no browser can render.
    const result = pelicanItemSavePhotos({
      pastedImageUrl: PRODUCT_PAGE,
      pastedImageUrlBaseline: PRODUCT_PAGE,
      storedImageUrl: PRODUCT_PAGE,
      storedMaterialImageUrl: "",
    });
    expect(result.error).toMatch(/web page, not an image/i);
    expect(result.imageUrl).toBeUndefined();
  });

  it("clears a bad stored page link when the field is emptied on purpose", () => {
    const result = pelicanItemSavePhotos({
      pastedImageUrl: "",
      pastedImageUrlBaseline: PRODUCT_PAGE,
      storedImageUrl: PRODUCT_PAGE,
      storedMaterialImageUrl: "",
    });
    expect(result.error).toBeUndefined();
    expect(result.imageUrl).toBeNull();
  });

  it("lets an edited, genuine image URL replace the current photo", () => {
    const result = pelicanItemSavePhotos({
      pastedImageUrl: "https://example.com/new-photo.jpg",
      pastedImageUrlBaseline: "",
      storedImageUrl: PRODUCT_PAGE,
      storedMaterialImageUrl: "",
    });
    expect(result.error).toBeUndefined();
    expect(result.imageUrl).toBe("https://example.com/new-photo.jpg");
  });

  it("still saves a stored Designer photo, and omits an empty one", () => {
    const withDesigner = pelicanItemSavePhotos({
      pastedImageUrl: "",
      pastedImageUrlBaseline: "",
      storedImageUrl: UPLOADED,
      storedMaterialImageUrl: UPLOADED_DESIGNER,
    });
    expect(withDesigner.materialImageUrl).toBe(UPLOADED_DESIGNER);

    const withoutDesigner = pelicanItemSavePhotos({
      pastedImageUrl: "",
      pastedImageUrlBaseline: "",
      storedImageUrl: UPLOADED,
      storedMaterialImageUrl: "",
    });
    expect(withoutDesigner.materialImageUrl).toBeUndefined();
  });

  it("does not save a page link as a Designer photo either", () => {
    const result = pelicanItemSavePhotos({
      pastedImageUrl: "",
      pastedImageUrlBaseline: "",
      storedImageUrl: UPLOADED,
      storedMaterialImageUrl: PRODUCT_PAGE,
    });
    expect(result.materialImageUrl).toBeUndefined();
  });
});
