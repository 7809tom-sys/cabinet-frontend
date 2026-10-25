import { describe, it, expect } from "vitest";
import { makeQrDataUrl } from "./qr";

describe("makeQrDataUrl", () => {
  it("encodes a URL into a PNG data URL", async () => {
    const url = await makeQrDataUrl("https://cabinetdealz.com/design");
    expect(url.startsWith("data:image/png;base64,")).toBe(true);
    // A non-trivial QR payload should produce a reasonably sized PNG.
    expect(url.length).toBeGreaterThan(200);
  });

  it("produces different codes for different links", async () => {
    const a = await makeQrDataUrl("https://cabinetdealz.com/design");
    const b = await makeQrDataUrl("https://cabinetdealz.com/store/acme");
    expect(a).not.toEqual(b);
  });
});
