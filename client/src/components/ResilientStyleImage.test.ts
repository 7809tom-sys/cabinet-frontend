import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResilientStyleImage, doorStylePhotoUrl, styleImageRetryUrl } from "./ResilientStyleImage";

describe("failed cabinet-style image retry", () => {
  it("retries the identical authentic extensionless room-scene path through a fresh URL", () => {
    const url = "/manus-storage/media-library/1785260582020_classic_cream_room_scene_18c5ad57";
    expect(styleImageRetryUrl(url, "first")).toBe(`${url}?cd-image-retry-nonce=first`);
    expect(styleImageRetryUrl(url, "second")).toBe(`${url}?cd-image-retry-nonce=second`);
  });

  it("preserves an existing query rather than changing a style's source", () => {
    expect(styleImageRetryUrl("/manus-storage/style-image?size=full", "one two")).toBe("/manus-storage/style-image?size=full&cd-image-retry-nonce=one%20two");
    expect(styleImageRetryUrl("data:image/png;base64,abc", "ignored")).toBe("data:image/png;base64,abc");
  });

  it("uses the app-owned image path only for the same authentic media-library photo", () => {
    const original = "/manus-storage/media-library/1785260582020_classic_cream_room_scene_18c5ad57";
    const mapped = "/api/door-style-photo/1785260582020_classic_cream_room_scene_18c5ad57";
    expect(doorStylePhotoUrl(original)).toBe(mapped);
    expect(styleImageRetryUrl(doorStylePhotoUrl(original), "new")).toBe(`${mapped}?cd-image-retry-nonce=new`);
    expect(doorStylePhotoUrl("https://example.com/kitchen.jpg")).toBe("https://example.com/kitchen.jpg");
    expect(doorStylePhotoUrl("/manus-storage/media-library/other?size=small")).toBe("/manus-storage/media-library/other?size=small");
    expect(doorStylePhotoUrl("/manus-storage/private/example.jpg")).toBe("/manus-storage/private/example.jpg");
  });

  it("starts with the original fast catalog photo, not the recovery endpoint", () => {
    const original = "/manus-storage/media-library/1785260582020_classic_cream_room_scene_18c5ad57";
    const html = renderToStaticMarkup(createElement(ResilientStyleImage, {
      src: original,
      alt: "Aura Cream kitchen",
      style: { ourName: "Aura Cream", color: "#F2E8D0" },
      className: "scene",
    }));
    expect(html).toContain(original);
    expect(html).not.toContain("/api/door-style-photo/");
  });
});
