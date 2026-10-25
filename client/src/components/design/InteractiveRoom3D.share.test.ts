import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");

describe("customer saved kitchen-image sharing", () => {
  it("shares only the image already present in the completed result popup and reuses native sharing with copy fallback", () => {
    expect(source).toContain("const shareSavedKitchenImage = async () => {");
    expect(source).toContain("if (!photoRenderUrl) return;");
    expect(source).toContain("await shareUrl(");
    expect(source).toContain("photoRenderUrl,");
    expect(source).toContain("View my Cabinet Dealz kitchen image, prepared from my saved kitchen plan.");
    expect(source).toContain("Share image");
  });

  it("keeps the Share image control separate from the administrator-only Google test popup", () => {
    expect(source).toContain("{!isPhotoQualityTest && <Button type=\"button\" variant=\"outline\" onClick={() => void shareSavedKitchenImage()}>");
    expect(source).toContain('data-testid="gemini-image-test-result"');
  });
});
