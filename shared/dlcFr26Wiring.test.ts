import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveCabinetFaceImages } from "./doorFaceRecognition";
import { DLC_FR26_CATALOG } from "./dlcFr26Catalog.generated";
import { findDlcFinishForStyle, normalizeFinishName } from "./dlcFr26Mapping";
import { dlcFaceProportions, dlcFaceTextureWindow } from "./dlcFr26Textures";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dl = (ourName: string, styleCode: string | null = null, extra: Record<string, unknown> = {}) => ({
  distributorId: 450001, ourName, styleCode, doorSampleImageUrl: "/manus-storage/raw-photo.jpg", drawerSampleImageUrl: null, ...extra,
});

describe("DL style -> DLC_FR26 finish", () => {
  it("Cyber Grey resolves to the processed door and drawer PNGs, as different files", () => {
    const plan = resolveCabinetFaceImages(dl("Cyber Grey", "DL-CG"), "base");
    expect(plan.doorUrl).toBe("/textures/dlc-fr26/door/cyber-grey.png");
    expect(plan.drawerUrl).toBe("/textures/dlc-fr26/drawer/cyber-grey.png");
    expect(plan.drawerUrl).not.toBe(plan.doorUrl);
    expect(plan.sourceKind).toBe("split");
    expect(plan.dlcCrop?.drawerSolidColor).toBeNull();
  });

  it("Driftwood resolves to a door PNG and has NO drawer image: a solid colour instead", () => {
    const plan = resolveCabinetFaceImages(dl("Driftwood", "DL-DW"), "base");
    expect(plan.doorUrl).toBe("/textures/dlc-fr26/door/driftwood.png");
    expect(plan.drawerUrl).toBeNull();
    expect(plan.drawerUrl).not.toBe(plan.doorUrl);
    expect(plan.dlcCrop?.drawerSolidColor).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("matches by name alone (no code) and through the spelling aliases", () => {
    const slug = (n: string) => findDlcFinishForStyle(dl(n))?.slug;
    expect(slug("Cyber Grey")).toBe("cyber-grey");
    expect(slug("Cyber Gray")).toBe("cyber-grey");
    expect(slug("Dove Grey")).toBe("dove-gray");
    expect(slug("Dove Gray")).toBe("dove-gray");
    expect(slug("Peccan")).toBe("peccan");
    expect(slug("Pecan")).toBe("peccan");
    expect(slug("Expresso Shaker")).toBe("expresso-shaker");
    expect(slug("Espresso Shaker")).toBe("expresso-shaker");
    expect(slug("EWO")).toBe("ewo");
    expect(slug("European White Oak")).toBe("ewo");
    expect(normalizeFinishName("  Grey-Shaker ")).toBe("grey shaker");
  });

  it("leaves MC / Midnight Cove, the placeholder, and unknown DL styles unmapped", () => {
    expect(findDlcFinishForStyle(dl("Midnight Cove", "DL-MC"))).toBeNull();
    expect(findDlcFinishForStyle(dl("MC"))).toBeNull();
    expect(findDlcFinishForStyle(dl("IMG"))).toBeNull();
    expect(findDlcFinishForStyle(dl("Champagne Mist", "DL-CM"))).toBeNull();
    expect(DLC_FR26_CATALOG.some((e) => /img/i.test(e.slug))).toBe(false);
  });

  it("unmapped styles and other distributors are unchanged", () => {
    const unmapped = { distributorId: 450001, ourName: "Champagne Mist", doorSampleImageUrl: "/a.jpg", drawerSampleImageUrl: "/b.jpg" };
    const plan = resolveCabinetFaceImages(unmapped, "base");
    expect(plan).toEqual({ sourceKind: "split", doorUrl: "/a.jpg", drawerUrl: "/b.jpg", sections: 2, drawerTextureApplied: true, grainRotation: 0 });
    const other = { distributorId: 12, ourName: "Cyber Grey", styleCode: "ZZ-1", doorSampleImageUrl: "/a.jpg", drawerSampleImageUrl: "/b.jpg" };
    expect(findDlcFinishForStyle(other)).toBeNull();
    expect(resolveCabinetFaceImages(other, "base").doorUrl).toBe("/a.jpg");
  });

  it("wall cabinets never get a drawer image", () => {
    const plan = resolveCabinetFaceImages(dl("Cyber Grey", "DL-CG"), "wall");
    expect(plan.drawerUrl).toBeNull();
    expect(plan.sections).toBe(1);
  });
});

describe("texture files ship with the build", () => {
  it("every catalog URL is a real file in client/public (Vite's publicDir) and matches the processed crop", () => {
    expect(fs.readFileSync(path.join(repo, "vite.config.ts"), "utf8")).toMatch(/publicDir:\s*path\.resolve\(import\.meta\.dirname, "client", "public"\)/);
    for (const e of DLC_FR26_CATALOG) {
      for (const [url, face] of [[e.door, "door"], [e.drawer, "drawer"]] as const) {
        if (!url) continue;
        const pub = path.join(repo, "client", "public", url);
        expect(fs.existsSync(pub), url).toBe(true);
        expect(fs.readFileSync(pub).equals(fs.readFileSync(path.join(repo, "data", "dlc-fr26", "processed", face, `${e.slug}.png`))), url).toBe(true);
      }
    }
  });
  it("if a build exists, the textures are in dist/public too", () => {
    const dist = path.join(repo, "dist", "public");
    if (!fs.existsSync(dist)) return;
    for (const e of DLC_FR26_CATALOG) expect(fs.existsSync(path.join(dist, e.door)), e.door).toBe(true);
  });
  it("enhanced crops are not published", () => {
    expect(fs.existsSync(path.join(repo, "client", "public", "textures", "dlc-fr26", "enhanced"))).toBe(false);
  });
});

describe("fit, don't stretch", () => {
  const cab = { widthIn: 30, heightIn: 34.5, isWall: false };
  it("door and drawer windows match the front's proportions and stay inside the crop", () => {
    const cg = DLC_FR26_CATALOG.find((e) => e.slug === "cyber-grey")!;
    const crop = { doorSize: cg.doorSize, drawerSize: cg.drawerSize, drawerSolidColor: null };
    for (const face of ["door", "drawer"] as const) {
      const w = dlcFaceTextureWindow(face, crop, cab)!;
      const size = face === "door" ? crop.doorSize : crop.drawerSize!;
      const p = dlcFaceProportions(face, cab);
      expect((w.repeatX * size[0]) / (w.repeatY * size[1])).toBeCloseTo(p.widthIn / p.heightIn, 4);
      expect(w.offsetX + w.repeatX).toBeLessThanOrEqual(1 + 1e-9);
      expect(w.offsetY + w.repeatY).toBeLessThanOrEqual(1 + 1e-9);
      expect(w.repeatX).toBeLessThanOrEqual(1);
      expect(w.repeatY).toBeLessThanOrEqual(1);
    }
  });
  it("no drawer crop means no drawer window", () => {
    const dw = DLC_FR26_CATALOG.find((e) => e.slug === "driftwood")!;
    expect(dlcFaceTextureWindow("drawer", { doorSize: dw.doorSize, drawerSize: null, drawerSolidColor: "#78726d" }, cab)).toBeNull();
  });
});

describe("renderer and Designer are connected", () => {
  const read = (f: string) => fs.readFileSync(path.join(repo, f), "utf8");
  it("InteractiveRoom3D fits crops instead of repeat 1,1 and gives a crop-less drawer a solid colour", () => {
    const s = read("client/src/components/design/InteractiveRoom3D.tsx");
    expect(s).toMatch(/dlcFaceTextureWindow\("door"/);
    expect(s).toMatch(/dlcFaceTextureWindow\("drawer"/);
    expect(s).toMatch(/drawerFrontSolidColor/);
    expect(s).toMatch(/faceCrop: cabinetFaceCrops\?\.\[cabinet\.uid\]/);
  });
  it("DesignTool never hands a DLC drawer the door image and passes the crops down", () => {
    const s = read("client/src/pages/DesignTool.tsx");
    expect(s).toMatch(/if \(plan\.dlcCrop\) return plan\.drawerUrl;/);
    expect(s.match(/cabinetFaceCrops=\{threeDCabinetFaceCrops\}/g)).toHaveLength(2);
    expect(s.match(/catalogFaceCrop=\{activeFaceCrop\}/g)).toHaveLength(2);
  });
});
