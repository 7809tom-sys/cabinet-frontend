import { describe, expect, it } from "vitest";
import {
  legacySocialColumns,
  publicSocialLinks,
  sanitizeSocialLinkDrafts,
  validateSocialProfileUrl,
} from "./affiliateSocialLinks";

describe("affiliate social links", () => {
  it("accepts https profile links on the expected domain and rejects passwords", () => {
    expect(validateSocialProfileUrl("instagram", "https://instagram.com/example")).toMatchObject({ ok: true });
    expect(validateSocialProfileUrl("facebook", "http://facebook.com/example").ok).toBe(false);
    expect(validateSocialProfileUrl("facebook", "https://instagram.com/example").ok).toBe(false);
    expect(validateSocialProfileUrl("facebook", "https://user:secret@facebook.com/example").ok).toBe(false);
    expect(validateSocialProfileUrl("x", "https://x.com/example?password=nope").ok).toBe(false);
    expect(validateSocialProfileUrl("google_business", "https://g.page/example-store").ok).toBe(true);
    expect(validateSocialProfileUrl("custom", "https://example.com/store").ok).toBe(true);
  });

  it("publishes only enabled links and falls back to legacy columns when the json field is empty", () => {
    expect(publicSocialLinks([
      { id: "a", platform: "tiktok", label: "TikTok", url: "https://www.tiktok.com/@example", handle: "example", enabled: true, sortOrder: 1 },
      { id: "b", platform: "yelp", label: "Yelp", url: "https://www.yelp.com/biz/example", handle: null, enabled: false, sortOrder: 0 },
    ], { facebookUrl: "https://facebook.com/should-not-win" })).toEqual([
      { platform: "tiktok", label: "TikTok", url: "https://www.tiktok.com/@example" },
    ]);

    expect(publicSocialLinks(null, {
      facebookUrl: "https://facebook.com/legacy",
      instagramUrl: "javascript:alert(1)",
    })).toEqual([
      { platform: "facebook", label: "Facebook", url: "https://facebook.com/legacy" },
    ]);
  });

  it("stores urls and handles only", () => {
    const saved = sanitizeSocialLinkDrafts([
      { platform: "facebook", url: "https://facebook.com/example", handle: "@Example", enabled: true },
      { platform: "instagram", url: "", handle: "" },
    ]);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.links).toHaveLength(1);
    expect(saved.links[0]).not.toHaveProperty("password");
    expect(saved.links[0].handle).toBe("Example");
    expect(legacySocialColumns(saved.links).facebookUrl).toBe("https://facebook.com/example");
    expect(JSON.stringify(saved.links)).not.toMatch(/password|token/i);
  });
});
