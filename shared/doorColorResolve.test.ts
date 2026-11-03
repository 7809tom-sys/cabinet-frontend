import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import catalog from "./fixtures/doorStyleSideCatalog.json";
import { brandDoorSurfaceHex } from "./shakerDoorBlueprint";
import {
  DOOR_COLOR_AGREE_DELTA_E,
  PRE_PAINT_MATCH_ORIGINALS,
  demotedSwatchRow,
  hueFamily,
  resolveDoorColor,
  summarizeDoorColors,
  type DoorColorInput,
} from "./doorColorResolve";

const styles = catalog as DoorColorInput[];

describe("door color precedence", () => {
  it("keeps Stone Gray #8d8f92 and does not brand-snap it", () => {
    const stone = styles.find((style) => style.id === 360001)!;
    const decision = resolveDoorColor(stone);
    expect(decision.appliedHex).toBe("#8d8f92");
    expect(decision.candidateSource).toBe("swatch-table");
    expect(decision.appliedCategory).toBe("paint");
    expect(decision.usesGrain).toBe(false);
    expect(decision.appliedHex).not.toBe(brandDoorSurfaceHex("#8d8f92"));
    expect(hueFamily(decision.appliedHex)).toBe("neutral");
  });

  it("keeps a stored Slate Rift hex gray", () => {
    const named = resolveDoorColor({ ourName: "Slate Rift", color: "#555553", doorStyle: "Shaker" });
    expect(named.appliedHex).not.toBe("#244338");
    expect(named.appliedHex).not.toBe("#dedac6");
    expect(hueFamily(named.appliedHex)).toBe("neutral");
    const stored = resolveDoorColor({ ourName: "Stored Hex", color: "#555553", doorStyle: "Shaker" });
    expect(stored.appliedHex).toBe("#555553");
    // A color an admin actually saved on the style outranks the hardcoded swatch
    // and WalzCraft tables. Those exist only for a style with nothing saved.
    expect(stored.appliedSource).toBe("catalog-color");
  });

  it("lets a hand-set render hex win, and a style switch changes the color", () => {
    const stone = styles.find((style) => style.id === 360001)!;
    const sage = styles.find((style) => style.id === 330005)!;
    expect(resolveDoorColor(stone).appliedHex).not.toBe(resolveDoorColor(sage).appliedHex);
    const edited = resolveDoorColor({ ...stone, renderHex: "#555553" });
    expect(edited.appliedHex).toBe("#555553");
    expect(edited.appliedSource).toBe("render-hex");
    expect(edited.candidateSource).toBe("render-hex");
    const cleared = resolveDoorColor({ ...stone, renderHex: null });
    expect(cleared.appliedHex).toBe("#8d8f92");
  });

  it("uses a WalzCraft primary shade only when no render hex or swatch exists", () => {
    const decision = resolveDoorColor({
      id: 999001,
      distributorId: 210001,
      supplierBrandName: "Faircrest",
      styleCode: "NG",
      ourName: "Unlisted Winchester",
      doorStyle: "Shaker",
    });
    expect(decision.layers.swatch).toBeNull();
    expect(decision.candidateSource).toBe("walzcraft");
    expect(decision.candidateHex).toBe("#8e8e88");
    expect(hueFamily(decision.appliedHex)).toBe("neutral");
    expect(decision.appliedHex).not.toBe("#244338");
  });

  it("uses the saved catalog color ahead of the hardcoded tables", () => {
    const decision = resolveDoorColor({
      id: 999002,
      ourName: "No Sheet",
      color: "#336699",
      doorStyle: "Shaker",
    });
    expect(decision.candidateSource).toBe("catalog-color");
    expect(decision.appliedHex).toBe("#336699");
    expect(decision.appliedHex).not.toBe(brandDoorSurfaceHex("#336699"));
  });

  it("falls back to the pre-209 estimate only when nothing at all is saved", () => {
    const decision = resolveDoorColor({ id: 999003, ourName: "No Sheet", doorStyle: "Shaker" });
    expect(decision.layers.catalogColor).toBeNull();
    expect(["pre-209", "estimator", "swatch-table", "walzcraft"]).toContain(decision.candidateSource);
    expect(decision.appliedHex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("flags a swatch the estimator rejects and keeps the pre-209 color", () => {
    const versa = styles.find((style) => style.id === 600004)!;
    const decision = resolveDoorColor(versa);
    expect(decision.candidateSource).toBe("swatch-table");
    expect(decision.review.needsColorReview).toBe(true);
    expect(decision.review.keptBecause).toBe("estimator-disagreed");
    expect(decision.appliedSource).toBe("pre-209");
    expect(decision.appliedHex).toBe(decision.pre209Hex);
    expect(decision.review.deltaE).toBeGreaterThan(DOOR_COLOR_AGREE_DELTA_E);
  });

  it("covers every catalog door and never paints the brand snap", () => {
    const summary = summarizeDoorColors(styles);
    expect(summary.doors).toBe(styles.length);
    expect(summary.swatchTableRows).toBe(123);
    expect(summary.agreed + summary.flagged + summary.noSecondOpinion).toBe(summary.doors);
    const brand = new Set(["#dedac6", "#fffdf9", "#f6f3ed", "#244338", "#d7a46c"]);
    for (const style of styles) {
      const decision = resolveDoorColor(style);
      const snapped = brandDoorSurfaceHex(decision.candidateHex);
      if (decision.candidateHex !== snapped) {
        expect(decision.appliedHex, style.ourName ?? "").not.toBe(snapped);
      }
      expect(brand.has(decision.appliedHex) && decision.candidateHex !== decision.appliedHex).toBe(false);
    }
  });

  it("reads the committed ColorPatterns files as the WalzCraft source", () => {
    const csv = readFileSync(new URL("../data/door-colors/ColorPatterns_Faircrest.csv", import.meta.url), "utf8");
    expect(csv).toContain("color1_hex");
    expect(csv).toContain("Winchester Grey");
    const table = readFileSync(new URL("../data/door-colors/swatch-hex.json", import.meta.url), "utf8");
    expect(table).toContain("360001");
    expect(table).toContain("#8d8f92");
  });

  it("never applies the demoted paint-match row for Shaker Honey", () => {
    // Tom: #c8a040 was a nearest paint-chip match, not the door's color. The row is
    // demoted in swatch-hex.json and must never be a candidate or an applied value.
    const honey = styles.find((style) => style.id === 330021)!;
    expect(demotedSwatchRow(honey)?.hex).toBe("#c8a040");
    for (const input of [
      honey,
      { ...honey, color: null },
      { ...honey, color: undefined },
      { id: 330021, styleCode: "SH", ourName: "Shaker Honey", doorStyle: "Shaker" },
    ]) {
      const decision = resolveDoorColor(input as DoorColorInput);
      expect(decision.layers.swatch, JSON.stringify(input)).toBeNull();
      expect(decision.appliedHex, JSON.stringify(input)).not.toBe("#c8a040");
    }
  });

  it("keeps the paint match out of every other style's decision too", () => {
    // Sweep the catalog: no door may apply a demoted row's hex through the table.
    for (const style of styles) {
      const decision = resolveDoorColor(style);
      const demoted = demotedSwatchRow(style);
      if (!demoted) continue;
      expect(decision.appliedHex, style.ourName ?? "").not.toBe(demoted.hex);
    }
  });

  it("states the pre-paint-match original for the styles the paint match overwrote", () => {
    for (const [id, original] of Object.entries(PRE_PAINT_MATCH_ORIGINALS)) {
      const style = styles.find((item) => item.id === Number(id));
      if (!style) continue;
      const decision = resolveDoorColor({ ...style, renderHex: null });
      expect(decision.appliedHex, style.ourName ?? "").toBe(original.hex);
      expect(decision.appliedCategory, style.ourName ?? "").toBe(original.category);
    }
  });
});
