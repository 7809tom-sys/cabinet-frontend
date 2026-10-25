import { describe, expect, it } from "vitest";
import { catalogMediaRecoveryUrl } from "./catalogMediaImage";

describe("catalog media same-image recovery", () => {
  it("retries the approved cabinet illustration at the same media-library key through the app route", () => {
    const original = "/manus-storage/media-library/1790257199386_b12_b21_4dedff25";
    expect(catalogMediaRecoveryUrl(original, "first")).toBe("/api/catalog-media/1790257199386_b12_b21_4dedff25?cd-image-retry-nonce=first");
    expect(catalogMediaRecoveryUrl(original, "second")).not.toBe(catalogMediaRecoveryUrl(original, "first"));
  });

  it("retries the exact approved distributor B12 photo with correct image MIME instead of choosing another product", () => {
    const source = "/manus-storage/sku-images/1784390003470_ASP-B12_738a416d.jpg";
    expect(catalogMediaRecoveryUrl(source, "chrome-failure"))
      .toBe("/api/catalog-sku-photo/1784390003470_ASP-B12_738a416d.jpg?cd-image-retry-nonce=chrome-failure");
  });

  it("never proxies external, private, query-bearing, or path-traversal artwork", () => {
    for (const url of [
      "https://example.com/approved-image.png",
      "/manus-storage/private/photo.png",
      "/manus-storage/media-library/door?size=small",
      "/manus-storage/media-library/../secret",
      "data:image/png;base64,abc",
    ]) expect(catalogMediaRecoveryUrl(url, "nonce")).toBeNull();
  });
});
