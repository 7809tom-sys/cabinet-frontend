import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DLC_GRAIN_TEXTURES, dlcFaceFile, fitWithoutStretch, validateDlcManifest, type DlcManifest } from "./dlcFr26Textures";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "dlc-fr26");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8")) as DlcManifest & {
  finishes: Array<DlcManifest["finishes"][number] & { doorBox: number[]; drawerBox: number[] | null; outerTrim: Record<string, number>; sourceSize: number[]; reveal: { bandStart: number; bandEnd: number } | null }>;
};

describe("DLC_FR26 manifest", () => {
  it("has 20 finishes and excludes the IMG.jpg placeholder", () => {
    expect(manifest.finishes).toHaveLength(20);
    expect(manifest.skipped.map((s) => s.file.toLowerCase())).toContain("img.jpg");
    expect(validateDlcManifest(manifest)).toEqual([]);
  });

  it("crops before texturing: door and drawer boxes sit inside the trimmed area and never overlap the reveal", () => {
    for (const e of manifest.finishes) {
      const [dl, dt, dr, db] = e.doorBox;
      expect(dt, e.slug).toBeGreaterThan(e.outerTrim.top - 1);
      expect(db, e.slug).toBeLessThanOrEqual(e.sourceSize[1] - e.outerTrim.bottom);
      expect(dl, e.slug).toBeGreaterThanOrEqual(e.outerTrim.left);
      expect(dr, e.slug).toBeLessThanOrEqual(e.sourceSize[0] - e.outerTrim.right);
      expect(e.outerTrim.top, e.slug).toBeGreaterThanOrEqual(3);
      expect(e.outerTrim.left, e.slug).toBeGreaterThanOrEqual(3);
      if (e.drawerBox && e.reveal) {
        expect(e.drawerBox[3], e.slug).toBeLessThan(e.reveal.bandStart);
        expect(e.doorBox[1], e.slug).toBeGreaterThan(e.reveal.bandEnd);
      }
    }
  });

  it("keeps door and drawer as separate surfaces, never reusing the door photo for a drawer", () => {
    for (const e of manifest.finishes) {
      expect(dlcFaceFile(e, "door"), e.slug).toMatch(/processed\/door\//);
      const drawer = dlcFaceFile(e, "drawer");
      if (e.hasDrawerFront) expect(drawer, e.slug).toMatch(/processed\/drawer\//);
      else expect(drawer, e.slug).toBeNull();
    }
    const driftwood = manifest.finishes.find((e) => e.slug === "driftwood")!;
    expect(driftwood.hasDrawerFront).toBe(false);
  });

  it("never resamples: crop sizes equal their boxes, and processed files exist", () => {
    for (const e of manifest.finishes) {
      const [l, t, r, b] = e.doorBox;
      expect(e.door.size, e.slug).toEqual([r - l, b - t]);
      expect(fs.existsSync(path.join(root, e.door.file)), e.slug).toBe(true);
      expect(fs.existsSync(path.join(root, e.sourceFile)), e.slug).toBe(true);
    }
  });

  it("enhanced variants stay within the colour limits and are only used when switched on", () => {
    for (const e of manifest.finishes) {
      expect(e.door.enhanced?.withinLimits, e.slug).toBe(true);
      expect(dlcFaceFile(e, "door")).toBe(e.door.file);
      expect(dlcFaceFile(e, "door", { enhanced: true })).toBe(e.door.enhanced!.file);
    }
  });

  it("flags soft photos for a higher-res replacement", () => {
    const soft = manifest.finishes.filter((e) => e.softness.tier === "soft").map((e) => e.slug);
    for (const s of ["cyber-grey", "expresso-shaker", "grey-shaker"]) expect(soft).toContain(s);
  });
});

describe("grain textures", () => {
  it("EWO grain files and normal maps exist in the source copy", () => {
    for (const f of Object.values(DLC_GRAIN_TEXTURES.ewo)) expect(fs.existsSync(path.join(root, f)), f).toBe(true);
  });
});

describe("fitWithoutStretch", () => {
  it("is uniform (no stretch) and stays inside the image", () => {
    const f = fitWithoutStretch(140, 240, 18, 30);
    expect(f.repeatX * 140 / (f.repeatY * 240)).toBeCloseTo(18 / 30, 5);
    expect(f.offsetX + f.repeatX).toBeLessThanOrEqual(1 + 1e-9);
    expect(f.offsetY + f.repeatY).toBeLessThanOrEqual(1 + 1e-9);
  });
  it("crops the longer side when the face is wider than the image", () => {
    const f = fitWithoutStretch(140, 240, 30, 10);
    expect(f.repeatX).toBe(1);
    expect(f.repeatY).toBeLessThan(1);
  });
  it("falls back safely on bad input", () => {
    expect(fitWithoutStretch(0, 10, 1, 1)).toEqual({ offsetX: 0, offsetY: 0, repeatX: 1, repeatY: 1 });
  });
});

describe("validateDlcManifest", () => {
  it("catches a drawer that reuses the door file and a placeholder", () => {
    const bad: DlcManifest = {
      skipped: [],
      finishes: [{ slug: "x", sourceFile: "source/finishes/IMG.jpg", hasDrawerFront: true, door: { file: "a.png", size: [1, 1] }, drawer: { file: "a.png", size: [1, 1] }, softness: { tier: "sharp" }, flags: [] }],
    };
    expect(validateDlcManifest(bad)).toHaveLength(2);
  });
});
