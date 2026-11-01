import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveCabinetFaceImages } from "./doorFaceRecognition";
import { DLC_FR26_CATALOG } from "./dlcFr26Catalog.generated";
import { findDlcFinishForStyle, normalizeFinishName } from "./dlcFr26Mapping";
import { resolveDoorFinishHex } from "../client/src/lib/doorStyleAppearance";
import { RESTORED_DOOR_LIGHTS, DARK_STAIN_DOOR_LIGHTS } from "./doorRenderLights";
import { DLC_FRAME_DETAIL, dlcFrameStrips, dlcFaceGrainRepeat, dlcPhotoLightCompensation, dlcFaceProportions, dlcFaceTextureWindow } from "./dlcFr26Textures";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dl = (ourName: string, styleCode: string | null = null, extra: Record<string, unknown> = {}) => ({
  distributorId: 450001, ourName, styleCode, doorSampleImageUrl: "/manus-storage/raw-photo.jpg", drawerSampleImageUrl: null, ...extra,
});

describe("DL style -> DLC_FR26 finish", () => {
  it("Cyber Grey faces use the frame-free grain, door and drawer as different files, never a photo crop", () => {
    const plan = resolveCabinetFaceImages(dl("Cyber Grey", "DL-CG"), "base");
    expect(plan.doorUrl).toBe("/textures/dlc-fr26/grain/cyber-grey.png");
    expect(plan.drawerUrl).toBe("/textures/dlc-fr26/grain/cyber-grey-drawer.png");
    expect(plan.drawerUrl).not.toBe(plan.doorUrl);
    expect(plan.doorUrl).not.toMatch(/\/(door|drawer)\//);
    expect(plan.drawerUrl).not.toMatch(/\/(door|drawer)\//);
    expect(plan.sourceKind).toBe("split");
  });

  it("Driftwood has a drawer face too (its own grain patch, not the door file and not a solid colour)", () => {
    const plan = resolveCabinetFaceImages(dl("Driftwood", "DL-DW"), "base");
    expect(plan.doorUrl).toBe("/textures/dlc-fr26/grain/driftwood.png");
    expect(plan.drawerUrl).toBe("/textures/dlc-fr26/grain/driftwood-drawer.png");
    expect(plan.drawerUrl).not.toBe(plan.doorUrl);
    expect(plan.dlcCrop?.drawerSolidColor).toBeNull();
  });

  it("European White Oak faces use the real 1024px vertical grain with its normal map and a colour tint", () => {
    const plan = resolveCabinetFaceImages(dl("European White Oak", "DL-EWO"), "base");
    expect(plan.doorUrl).toBe("/textures/dlc-fr26/grain/ewo-v.jpg");
    expect(plan.drawerUrl).toBe("/textures/dlc-fr26/grain/ewo-v.jpg");
    expect(plan.dlcCrop?.normalUrl).toBe("/textures/dlc-fr26/grain/ewo-v-nm.png");
    expect(plan.dlcCrop?.tintHex).toMatch(/^#[0-9a-f]{6}$/);
    expect(plan.dlcCrop?.grainUrl).toBe("/textures/dlc-fr26/grain/ewo-v.jpg");
    for (const f of ["ewo-v.jpg", "ewo-v-nm.png"]) expect(fs.existsSync(path.join(repo, "client/public/textures/dlc-fr26/grain", f)), f).toBe(true);
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
  it("every face grain file ships in client/public (and the patches match the processed copies)", () => {
    for (const e of DLC_FR26_CATALOG) {
      for (const url of [e.faceDoor, e.faceDrawer, e.grain]) expect(fs.existsSync(path.join(repo, "client", "public", url)), url).toBe(true);
      if (e.slug === "ewo") continue;
      for (const [url, name] of [[e.faceDoor, `${e.slug}.png`], [e.faceDrawer, `${e.slug}-drawer.png`]] as const) {
        expect(fs.readFileSync(path.join(repo, "client", "public", url)).equals(fs.readFileSync(path.join(repo, "data", "dlc-fr26", "processed", "grain", name))), url).toBe(true);
      }
    }
    expect(DLC_FR26_CATALOG.filter((e) => !e.grainFrameFree).map((e) => e.slug)).toEqual(["peccan"]);
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

describe("DL sides, end panels and skins match the door finish", () => {
  const solid = (slug: string) => DLC_FR26_CATALOG.find((e) => e.slug === slug)!.solidColor;
  it("the finish colour used for sides/skins is the door colour, even when a stale light-grey hex is stored", () => {
    for (const [name, code, slug] of [["Cyber Grey", "DL-CG", "cyber-grey"], ["Driftwood", "DL-DW", "driftwood"]] as const) {
      const style = dl(name, code, { color: "#d9dde3", finish: "Painted" });
      expect(resolveDoorFinishHex(style), name).toBe(solid(slug));
      expect(resolveCabinetFaceImages(style, "base").dlcCrop?.solidColor, name).toBe(solid(slug));
    }
  });
  it("sides are never white, light grey or light blue for any mapped finish that is itself dark or coloured", () => {
    const lum = (h: string) => 0.2126 * parseInt(h.slice(1, 3), 16) + 0.7152 * parseInt(h.slice(3, 5), 16) + 0.0722 * parseInt(h.slice(5, 7), 16);
    expect(lum(solid("cyber-grey"))).toBeLessThan(120);
    expect(lum(solid("driftwood"))).toBeLessThan(140);
    expect(lum(solid("slim-shaker-ebony"))).toBeLessThan(60);
  });
  it("non-DL and unmapped styles keep their own colour", () => {
    expect(resolveDoorFinishHex({ distributorId: 12, ourName: "Cyber Grey", color: "#336699" })).toBe("#336699");
    expect(resolveDoorFinishHex(dl("Champagne Mist", "DL-CM", { color: "#c9b99a" }))).toBe("#c9b99a");
  });
  it("3D: DLC cabinets use the door colour for every structural surface and never the door photo on ends or sides", () => {
    const src = fs.readFileSync(path.join(repo, "client/src/components/design/InteractiveRoom3D.tsx"), "utf8");
    expect(src).toMatch(/if \(dlcDoorFinish\) color = dlcDoorFinish;/);
    expect(src).toMatch(/exposedSidesMatchDoorFace === true && Boolean\(doorTexture\) && !dlcDoorFinish/);
    expect(src).toMatch(/threeDDecorativeEndIsDoor\(sku\) && !dlcDoorFinish/);
  });
});

describe("sides carry the door's grain, and photo materials are not over-lit", () => {
  const src = () => fs.readFileSync(path.join(repo, "client/src/components/design/InteractiveRoom3D.tsx"), "utf8");
  it("Versa Shaker (style 600011 in the live DB) is mapped by name/code, never by style id", () => {
    const plan = resolveCabinetFaceImages({ ...dl("Versa Shaker", "DL-VS"), id: 600011 }, "base");
    expect(plan.dlcCrop?.slug).toBe("versa-shaker");
    // the same id with another name must not become Versa Shaker, and Cyber Grey stays Cyber Grey
    expect(resolveCabinetFaceImages({ ...dl("Cyber Grey", "DL-CG"), id: 600011 }, "base").dlcCrop?.slug).toBe("cyber-grey");
    expect(findDlcFinishForStyle({ ...dl("Versa Shaker", "DL-VS"), id: 600011 })?.door).toMatch(/versa-shaker\.png$/);
  });
  it("the plan hands sides a grain patch and the same colour as the door", () => {
    const plan = resolveCabinetFaceImages(dl("Versa Shaker", "DL-VS"), "base");
    expect(plan.dlcCrop?.grainUrl).toBe("/textures/dlc-fr26/grain/versa-shaker.png");
    expect(plan.dlcCrop?.solidColor).toBe(DLC_FR26_CATALOG.find((e) => e.slug === "versa-shaker")!.solidColor);
    expect(resolveCabinetFaceImages(dl("Peccan", "DL-PC"), "base").dlcCrop?.grainUrl).toBeNull();
  });
  it("light compensation cancels the rig's light sum (tone mapping off) and stays in range", () => {
    const std = dlcPhotoLightCompensation(RESTORED_DOOR_LIGHTS);
    expect(std.linear).toBeGreaterThan(0.45);
    expect(std.linear).toBeLessThan(0.6);
    expect(std.hex).toMatch(/^#([0-9a-f]{2})\1\1$/);
    const dark = dlcPhotoLightCompensation(DARK_STAIN_DOOR_LIGHTS);
    expect(dark.linear).toBeGreaterThan(std.linear);
    expect(dark.linear).toBeLessThanOrEqual(1);
  });
  it("no tone mapping on DLC photo materials: faces, rails, drawers, and sides without a grain patch", () => {
    const s = src();
    expect((s.match(/toneMapped: false/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(s).toMatch(/material\.toneMapped = false;/);
    expect(s).toMatch(/material\.color\.multiplyScalar\(dlcPhotoComp\.linear\)/);
  });
  it("3D applies the grain to structural surfaces (mirrored, sRGB) and the tint to every photo material", () => {
    const s = src();
    expect(s).toMatch(/dlcSideGrain: true/);
    expect(s).toMatch(/MirroredRepeatWrapping/);
    expect(s).toMatch(/applyStructuralFinishBase\(finishColor, _sampleTexture\);\s*applyDlcGrain\(\);/);
    expect((s.match(/color\.set\(dlcPhotoTint\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(s).toMatch(/color: dlcPhotoTint, map, \.\.\.doorFinishSurface/);
  });
});

describe("grain faces: no photo frame lines on any face", () => {
  const src = () => fs.readFileSync(path.join(repo, "client/src/components/design/InteractiveRoom3D.tsx"), "utf8");
  it("no mapped DL style hands a face a door or drawer photo crop", () => {
    for (const e of DLC_FR26_CATALOG) {
      for (const url of [e.faceDoor, e.faceDrawer]) expect(url, e.slug).not.toMatch(/\/textures\/dlc-fr26\/(door|drawer)\//);
      const plan = resolveCabinetFaceImages({ distributorId: 450001, ourName: e.names[0], styleCode: null }, "base");
      if (plan.dlcCrop) {
        expect(plan.doorUrl, e.slug).not.toMatch(/\/(door|drawer)\//);
        expect(plan.drawerUrl, e.slug).not.toMatch(/\/(door|drawer)\//);
      }
    }
  });
  it("grain tiles at its physical size without stretching: repeat is face size over tile size, both axes", () => {
    const crop = { doorSize: [141, 308] as [number, number], drawerSize: null, drawerSolidColor: null, solidColor: "#aa7a61", grainUrl: null, faceTileIn: [6, 12] as [number, number], faceTileDrawerIn: [4, 8] as [number, number] };
    const cab = { widthIn: 30, heightIn: 34.5, isWall: false };
    const d = dlcFaceGrainRepeat("door", crop, cab)!;
    const p = dlcFaceProportions("door", cab);
    expect(d.repeatX * 6).toBeCloseTo(p.widthIn, 5);
    expect(d.repeatY * 12).toBeCloseTo(p.heightIn, 5);
    const dr = dlcFaceGrainRepeat("drawer", crop, cab)!;
    expect(dr.repeatX * 4).toBeCloseTo(30, 5);
    expect(dr.repeatY * 8).toBeCloseTo(6, 5);
    expect(dlcFaceGrainRepeat("door", { ...crop, faceTileIn: undefined }, cab)).toBeNull();
  });
  it("3D tiles grain faces mirrored, gives the drawer its own texture, and loads the EWO normal map", () => {
    const s = src();
    expect(s).toMatch(/dlcFaceGrainRepeat\("door"/);
    expect(s).toMatch(/dlcFaceGrainRepeat\("drawer"/);
    expect(s).toMatch(/dlcDoorGrain \? THREE\.MirroredRepeatWrapping/);
    expect(s).toMatch(/dlcDrawerGrain \? THREE\.MirroredRepeatWrapping/);
    expect(s).toMatch(/separateFace: Boolean\(surfaceTextures\?\.faceCrop\?\.faceTileDrawerIn\)/);
    expect(s).toMatch(/material\.normalMap = normal/);
  });
});

describe("Driftwood polish: softer grain, more defined frames", () => {
  const src = () => fs.readFileSync(path.join(repo, "client/src/components/design/InteractiveRoom3D.tsx"), "utf8");
  it("only Driftwood's grain is softened (the only finish with an unusually high light/dark swing)", () => {
    expect(DLC_FR26_CATALOG.filter((e) => e.grainSoftened).map((e) => e.slug)).toEqual(["driftwood"]);
  });
  it("frame strips: shadows on the top and left of the opening, highlights on the bottom and right, all inside it", () => {
    const strips = dlcFrameStrips(1.0, 2.0);
    const shadows = strips.filter((t) => t.kind === "shadow");
    const highs = strips.filter((t) => t.kind === "highlight");
    expect(shadows).toHaveLength(DLC_FRAME_DETAIL.shadow.length * 2);
    expect(highs).toHaveLength(2);
    for (const t of shadows) expect(t.y > 0 || t.x < 0).toBe(true); // top (y>0) or left (x<0)
    for (const t of highs) expect(t.y < 0 || t.x > 0).toBe(true); // bottom or right
    for (const t of strips) {
      expect(Math.abs(t.x) + t.w / 2).toBeLessThanOrEqual(0.5 + 1e-9 + (t.w === 1 ? 0 : 0));
      expect(Math.abs(t.y) + t.h / 2).toBeLessThanOrEqual(1.0 + 1e-9);
      expect(t.opacity).toBeGreaterThan(0);
      expect(t.opacity).toBeLessThan(0.3); // translucent: the finish is not darkened
    }
  });
  it("tiny openings get no strips; rails stand 20% proud", () => {
    expect(dlcFrameStrips(0.03, 1)).toEqual([]);
    expect(DLC_FRAME_DETAIL.railDepth / DLC_FRAME_DETAIL.standardRailDepth).toBeCloseTo(1.2, 1);
  });
  it("3D draws the strips only for DL frames that are not raised or glass, deepens the rails, and staggers grain", () => {
    const s = src();
    expect(s).toMatch(/if \(dlcDoorFinish && !raisedProfile && !forceGlassFrame\)/);
    expect(s).toMatch(/dlcDoorFinish \? DLC_FRAME_DETAIL\.railDepth : DLC_FRAME_DETAIL\.standardRailDepth/);
    expect(s).toMatch(/dlcStagger\?\.offsetX/);
    expect(s).toMatch(/dlcDrawerStagger\?\.offsetX/);
    expect(s).toMatch(/normal\.offset\.copy\(doorTexture\.offset\)/);
  });
});
