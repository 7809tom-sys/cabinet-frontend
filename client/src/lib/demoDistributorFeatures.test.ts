import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEMO_FEATURES, DEMO_SPOTLIGHT_FEATURES, FEATURE_SPOTLIGHTS } from "./demoDistributorFeatures";
import { DISTRIBUTOR_PREVIEW_SECTIONS } from "./demoDistributor";

const root = resolve(__dirname, "../../..");

describe("demo distributor feature list", () => {
  it("only lists features whose source files exist in the repo", () => {
    for (const f of DEMO_FEATURES) {
      expect(f.mirrors.length, f.id).toBeGreaterThan(0);
      for (const path of f.mirrors) expect(existsSync(resolve(root, path)), `${f.id}: ${path}`).toBe(true);
    }
  });

  it("has unique ids", () => {
    const ids = DEMO_FEATURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers all 29 distributor-accessible permission matrix rows", () => {
    const rows = new Set(DEMO_FEATURES.flatMap((f) => f.matrix ?? []));
    const expected = [1, 3, 4, 6, 7, 9, 10, 14, 24, 31, 32, 35, 36, 40, 42, 43, 44, 45, 49, 51, 57, 58, 71, 77, 85, 88, 89, 90, 97];
    expect(expected).toHaveLength(29);
    for (const n of expected) expect(rows.has(n), `matrix row ${n}`).toBe(true);
    expect(Array.from(rows).sort((a, b) => a - b)).toEqual(expected);
  });

  it("spotlights Auto Design, Contractors, Affiliates, Easy upload, the designer and the back office", () => {
    const ids = DEMO_SPOTLIGHT_FEATURES.map((f) => f.id);
    for (const id of ["auto-design", "contractors", "affiliates", "easy-upload", "designer", "back-office"]) expect(ids).toContain(id);
    for (const id of Object.keys(FEATURE_SPOTLIGHTS)) expect(DISTRIBUTOR_PREVIEW_SECTIONS as readonly string[]).toContain(id);
  });

  it("links only to demo routes", () => {
    for (const f of DEMO_FEATURES) if (f.demoHref) expect(f.demoHref.startsWith("/distributor-preview"), f.id).toBe(true);
  });

  it("copy names no supplier and makes no stats or urgency claims", () => {
    const copy = readFileSync(resolve(__dirname, "demoDistributorFeatures.ts"), "utf8")
      .split("\n").filter((l) => !l.trim().startsWith("//") && !l.includes("mirrors:")).join("\n");
    expect(copy).not.toMatch(/US Cabinet Depot|USCD|Pelican|Walzcraft|Stonecreek|Plumber'?s Choice/i);
    expect(copy).not.toMatch(/\d+%|limited time|act now|hurry|#1|best-selling/i);
  });
});
