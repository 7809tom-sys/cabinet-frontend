import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Already-sent links use /api/shared-3d-view/<token>?view=...
 * vercel.json rewrites /api/:path* to Railway, and the API then meta-refreshes
 * to its own host, which does not serve the page. A redirect has to win before
 * that rewrite and keep the camera query.
 */
describe("old shared 3D links redirect on the public site", () => {
  const vercel = JSON.parse(readFileSync(new URL("../../../vercel.json", import.meta.url), "utf8")) as {
    redirects: Array<{ source: string; destination: string; permanent?: boolean }>;
    rewrites: Array<{ source: string; destination: string }>;
  };

  it("sends /api/shared-3d-view/:token to /3d/:token before the API rewrite", () => {
    const redirect = vercel.redirects.find((entry) => entry.source === "/api/shared-3d-view/:token");
    expect(redirect).toEqual({
      source: "/api/shared-3d-view/:token",
      destination: "/3d/:token",
      permanent: false,
    });
    // Vercel applies redirects before rewrites. The destination has no query
    // of its own, so the incoming ?view= camera string is kept.
    expect(redirect?.destination.includes("?")).toBe(false);
    expect(vercel.redirects[0]?.source).toBe("/api/shared-3d-view/:token");
    const apiRewrite = vercel.rewrites.find((entry) => entry.source === "/api/:path*");
    expect(apiRewrite?.destination).toContain("railway.app/api/:path*");
    expect(vercel.rewrites.some((entry) => entry.source === "/api/shared-3d-view/:token")).toBe(false);
  });
});
