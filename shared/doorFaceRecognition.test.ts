import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "vitest";
import {
  DOOR_DRAWER_SEPARATION_CLAUSE,
  NEW_DOOR_STYLE_VERIFIED,
  TORINO_REFERENCE,
  USCD_REVEAL_FALLBACK_FRACTION,
  classifyFaceSource,
  detectHorizontalReveal,
  isDoorStyleVerified,
  isFramelessDoorStyle,
  parseUscdManifest,
  planFramelessSplit,
  planUscdManifestImport,
  resolveCabinetFaceImages,
  uscdSourceNote,
} from "./doorFaceRecognition";

const fixtureRoot = path.resolve(import.meta.dirname, "fixtures");
const luminance = JSON.parse(readFileSync(path.join(fixtureRoot, "torino/row-luminance.json"), "utf8")) as Record<string, number[]>;
const manifest = JSON.parse(readFileSync(path.join(fixtureRoot, "uscd-frameless/manifest.json"), "utf8"));

describe("Torino reveal", () => {
  for (const code of TORINO_REFERENCE.codes) {
    it(`splits ${code} within a few pixels of the owner rows`, () => {
      const found = detectHorizontalReveal(luminance[code]!);
      assert.equal(found.detected, true);
      if (!found.detected) return;
      assert.ok(Math.abs(found.drawerLastRow - TORINO_REFERENCE.drawerLastRow) <= 4, `drawer ${found.drawerLastRow}`);
      assert.ok(Math.abs(found.doorStartRow - TORINO_REFERENCE.doorStartRow) <= 4, `door ${found.doorStartRow}`);
      assert.ok(found.revealStart <= TORINO_REFERENCE.revealRows[1]);
      assert.ok(found.revealEnd >= TORINO_REFERENCE.revealRows[0]);
      assert.equal(found.drawerLastRow < found.doorStartRow, true);
    });
  }

  it("does not guess 25% when the reveal is missing", () => {
    const flat = Array.from({ length: 400 }, () => 140);
    const found = detectHorizontalReveal(flat);
    assert.deepEqual(found, { detected: false, reason: "no-dip" });
    assert.equal(Math.abs(USCD_REVEAL_FALLBACK_FRACTION - 0.25) < 0.001, true);
    const plan = planFramelessSplit(
      { id: 1, styleCode: "TWP", ourName: "White Pine", supplierBrandName: "US Cabinet Depot", doorSampleImageUrl: "https://cdn.example/combined.jpg" },
      found,
    );
    assert.equal(plan.action, "manual-review");
    assert.equal(plan.reason, "undetected");
  });

  it("does not split through a thick frame rail", () => {
    const rows = Array.from({ length: 800 }, () => 180);
    for (let y = 220; y < 320; y += 1) rows[y] = 30;
    const found = detectHorizontalReveal(rows);
    assert.equal(found.detected, false);
    if (!found.detected) assert.equal(found.reason, "thick-rail");
  });

  it("splits Slim Cava in the gap between two framed pieces", () => {
    const rows = Array.from({ length: 800 }, () => 170);
    for (let y = 0; y < 160; y += 1) rows[y] = 150;
    for (let y = 160; y < 166; y += 1) rows[y] = 40;
    for (let y = 166; y < 172; y += 1) rows[y] = 250;
    for (let y = 172; y < 800; y += 1) rows[y] = 168;
    const found = detectHorizontalReveal(rows);
    assert.equal(found.detected, true);
    if (!found.detected) return;
    assert.ok(found.doorStartRow >= 172);
    assert.ok(found.drawerLastRow < 166);
    assert.ok(found.revealStart < 250 && found.revealEnd < 250);
  });
});

describe("cabinet faces", () => {
  const split = {
    styleCode: "TWP",
    doorSampleImageUrl: "https://cdn.example/door.png",
    drawerSampleImageUrl: "https://cdn.example/drawer.png",
    grainDirection: "horizontal",
  };

  it("gives a base cabinet two sections and a wall cabinet one solid door face", () => {
    const base = resolveCabinetFaceImages(split, "base");
    assert.equal(base.sections, 2);
    assert.equal(base.drawerTextureApplied, true);
    assert.equal(base.doorUrl, split.doorSampleImageUrl);
    assert.equal(base.drawerUrl, split.drawerSampleImageUrl);
    assert.equal(base.grainRotation, 0);
    const wall = resolveCabinetFaceImages(split, "wall");
    assert.equal(wall.sections, 1);
    assert.equal(wall.drawerTextureApplied, false);
    assert.equal(wall.drawerUrl, null);
    assert.equal(wall.doorUrl, split.doorSampleImageUrl);
    assert.equal(wall.grainRotation, 0);
  });

  it("does not paint a combined swatch on a wall or as a full door", () => {
    const combined = { styleCode: "TGW", doorSampleImageUrl: "https://cdn.example/swatch.jpg" };
    assert.equal(classifyFaceSource(combined), "combined");
    const wall = resolveCabinetFaceImages(combined, "wall");
    const base = resolveCabinetFaceImages(combined, "base");
    assert.equal(wall.doorUrl, null);
    assert.equal(wall.drawerTextureApplied, false);
    assert.equal(wall.sections, 1);
    assert.equal(base.doorUrl, null);
    assert.equal(base.drawerUrl, null);
  });

  it("falls a blank drawer back to the door sample for an ordinary style", () => {
    const legacy = { styleCode: "SW", ourName: "Summit White", doorSampleImageUrl: "https://cdn.example/door-only.jpg" };
    assert.equal(classifyFaceSource(legacy), "legacy-door");
    const base = resolveCabinetFaceImages(legacy, "base");
    assert.equal(base.drawerUrl, legacy.doorSampleImageUrl);
    assert.notEqual(base.drawerUrl, "/manus-storage/default-drawer-sample_4fc4653e.jpg");
    const wall = resolveCabinetFaceImages(legacy, "wall");
    assert.equal(wall.doorUrl, legacy.doorSampleImageUrl);
    assert.equal(wall.drawerTextureApplied, false);
  });

  it("hides unverified styles and treats a missing column as verified", () => {
    assert.equal(isDoorStyleVerified({ styleVerified: false }), false);
    assert.equal(isDoorStyleVerified({ styleVerified: 0 }), false);
    assert.equal(isDoorStyleVerified({ styleVerified: true }), true);
    assert.equal(isDoorStyleVerified({}), true);
    assert.equal(isDoorStyleVerified({ styleVerified: null }), true);
    assert.equal(NEW_DOOR_STYLE_VERIFIED, false);
  });
});

describe("USCD manifest import", () => {
  const parsed = parseUscdManifest(manifest);

  it("reads all 49 prepared styles without guessing files", () => {
    assert.deepEqual(parsed.errors, []);
    assert.equal(parsed.rows.length, 49);
    const twp = parsed.rows.find((row) => row.code === "TWP");
    assert.ok(twp);
    assert.equal(twp?.doorFile, "torino/TWP-white-pine/door.png");
    assert.equal(twp?.drawerFile, "torino/TWP-white-pine/drawer-front.png");
    assert.equal(twp?.collection, "torino");
    assert.equal(twp?.pdfPage, 2);
    assert.equal(twp?.sourceNote, uscdSourceNote(2));
    assert.equal(twp?.grainDirection, "horizontal");
    assert.match(DOOR_DRAWER_SEPARATION_CLAUSE, /Never merge/);
    assert.match(DOOR_DRAWER_SEPARATION_CLAUSE, /wall cabinets/i);
  });

  it("dry-runs matches, unmatched codes, missing files, and ambiguous codes", () => {
    const catalog = [
      { id: 10, styleCode: "TWP", ourName: "Torino White Pine", doorSampleImageUrl: "https://cdn.example/old-twp.jpg" },
      { id: 11, styleCode: "PGW", ourName: "Palermo Gloss White", doorSampleImageUrl: null },
      { id: 12, styleCode: "TWP", ourName: "Duplicate White Pine", doorSampleImageUrl: null },
    ];
    const files = new Set(["torino/TWP-white-pine/door.png", "palermo/PGW-gloss-white/drawer-front.png"]);
    const plan = planUscdManifestImport(parsed.rows, catalog, files);
    assert.equal(plan.ready.length, 0);
    assert.ok(plan.ambiguous.some((item) => item.row.code === "TWP" && item.styleIds.length === 2));
    assert.ok(plan.missingFiles.some((item) => item.row.code === "PGW" && item.missing.includes("door")));
    assert.ok(plan.unmatched.some((row) => row.code === "TDW"));

    const unique = planUscdManifestImport(parsed.rows.filter((row) => row.code === "PGW"), [
      { id: 11, styleCode: "pgw", ourName: "Palermo Gloss White", doorSampleImageUrl: "https://cdn.example/old.jpg" },
    ], new Set([
      "palermo/PGW-gloss-white/door.png",
      "palermo/PGW-gloss-white/drawer-front.png",
    ]));
    assert.equal(unique.ready.length, 1);
    assert.equal(unique.ready[0]?.styleId, 11);
    assert.equal(unique.ready[0]?.previousDoorUrl, "https://cdn.example/old.jpg");
    assert.equal(unique.ready[0]?.row.sourceNote, "USCD Spec Manual V8.2, page 3");
    assert.equal(isFramelessDoorStyle({ styleCode: "SSH", supplierBrandName: "Other" }), true);
    assert.equal(isFramelessDoorStyle({ styleCode: "SW", supplierBrandName: "Summit" }), false);
  });
});
