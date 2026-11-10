import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import realCatalog from "../client/src/lib/__fixtures__/autoDesignRealCatalog.json";
import {
  FAIRCREST_NOVEMBER_2026_DOOR_STYLES,
  FAIRCREST_NOVEMBER_2026_GUIDE,
  faircrestDesignerDescription,
  faircrestDoorCount,
  isFaircrestBathRow,
  reconcileFaircrestCatalog,
  type FaircrestCatalogRow,
} from "./faircrestNovember2026";

const faircrest = realCatalog["330011"] as {
  base: FaircrestCatalogRow[];
  wall: FaircrestCatalogRow[];
  accessory: FaircrestCatalogRow[];
  november2026Additions?: FaircrestCatalogRow[];
};
const existing = [
  ...faircrest.base,
  ...faircrest.wall,
  ...faircrest.accessory,
  ...(faircrest.november2026Additions ?? []),
];

describe("Faircrest November 2026 guide", () => {
  it("lists the 13 door styles and their codes from the edition", () => {
    expect(FAIRCREST_NOVEMBER_2026_DOOR_STYLES.map((style) => style.code)).toEqual([
      "WS", "CC", "PS", "FS", "MBS", "CS", "ASP", "GV", "DN", "WPG", "NG", "HS", "RH",
    ]);
    expect(FAIRCREST_NOVEMBER_2026_DOOR_STYLES.find((style) => style.code === "ASP")).toMatchObject({
      name: "Aspen White",
      family: "Raised Panel",
    });
    expect(FAIRCREST_NOVEMBER_2026_DOOR_STYLES.find((style) => style.code === "NG")?.name).toBe("Winchester Grey");
    expect(FAIRCREST_NOVEMBER_2026_GUIDE.length).toBeGreaterThanOrEqual(332);
  });

  it("keeps a 24 inch standard base at two doors and a 21 inch base at one", () => {
    const base24 = FAIRCREST_NOVEMBER_2026_GUIDE.find((sku) => sku.code === "B24");
    const base21 = FAIRCREST_NOVEMBER_2026_GUIDE.find((sku) => sku.code === "B21");
    expect(faircrestDoorCount(base24!)).toBe(2);
    expect(faircrestDoorCount(base21!)).toBe(1);
    expect(faircrestDesignerDescription({
      code: "RB3DB24",
      name: "Range base cabinet",
      section: "Base",
      width: 24,
      height: 34.5,
      depth: 24,
      doors: 2,
      drawers: 2,
    })).not.toMatch(/range base|RB3DB/i);
  });
});

describe("reconcile the Faircrest catalog already in the repo", () => {
  const report = reconcileFaircrestCatalog(existing);
  const byCode = new Map(report.rows.map((row) => [row.masterCode, row]));

  it("does not delete or rename a code that was already in the catalog", () => {
    for (const row of existing) {
      expect(byCode.has(row.masterCode)).toBe(true);
    }
    expect(report.absentFromGuide).toContain("BT9");
    expect(byCode.get("BT9")?.description).toBe(existing.find((row) => row.masterCode === "BT9")?.description);
  });

  it("already contains the guide SKUs and does not need another correction pass", () => {
    expect(byCode.has("TB09")).toBe(true);
    expect(byCode.has("FHB24")).toBe(true);
    expect(byCode.has("DB12")).toBe(true);
    expect(byCode.has("UC2496")).toBe(true);
    expect(byCode.get("CDB36")?.numberOfDrawers).toBe(3);
    expect(byCode.get("UOC3384")?.numberOfDrawers).toBe(3);
    expect(byCode.get("PGWDC30")?.depth).toBe("0.750");
    expect(byCode.get("WEP1542")?.width).toBe("3.000");
    expect(byCode.get("B24")?.numberOfDoors).toBe(2);
    expect(byCode.get("B12")?.numberOfDoors).toBe(1);
    expect(byCode.get("WSC30")?.numberOfDrawers).toBe(5);
    expect(byCode.get("WSC30")?.numberOfDoors).toBe(0);
    expect(report.added).toEqual([]);
    expect(report.corrected).toEqual([]);
    expect(report.unpricedAdded).toEqual([]);
    expect(report.notOfferedInRusticHickory).toEqual([]);
  });

  it("leaves vanity and ADA rows alone and still reports the guide's differences", () => {
    const before = existing.find((row) => row.masterCode === "V2121");
    expect(isFaircrestBathRow(before!)).toBe(true);
    expect(byCode.get("V2121")).toEqual(before);
    expect(report.vanityDifferences.some((entry) => entry.code === "V2121" || entry.code.startsWith("VS"))).toBe(true);
    expect(report.added.some((code) => code.startsWith("ADA") || code.startsWith("VDB"))).toBe(false);
  });

  it("partitions every resulting row into added, corrected, or unchanged", () => {
    expect(report.added.length + report.corrected.length + report.unchanged.length).toBe(report.rows.length);
    expect(new Set([...report.added, ...report.corrected, ...report.unchanged]).size).toBe(report.rows.length);
  });
});

describe("door style side catalog", () => {
  const styles = JSON.parse(readFileSync(new URL("./fixtures/doorStyleSideCatalog.json", import.meta.url), "utf8")) as Array<{
    distributorId: number;
    styleCode: string;
    ourName: string;
    doorStyle?: string;
  }>;
  const faircrestStyles = styles.filter((style) => style.distributorId === 210001);

  it("includes Aspen White and the Winchester Grey code NG", () => {
    expect(faircrestStyles.map((style) => style.styleCode).sort()).toEqual(
      ["ASP", "CC", "CS", "DN", "FS", "GV", "HS", "MBS", "NG", "PS", "RH", "WPG", "WS"].sort(),
    );
    expect(faircrestStyles.find((style) => style.styleCode === "ASP")).toMatchObject({
      ourName: "Aspen White",
      doorStyle: "Raised Panel",
    });
    expect(faircrestStyles.find((style) => style.ourName === "Winchester Grey")?.styleCode).toBe("NG");
  });
});
