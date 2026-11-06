import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  FAIRCREST_2020_ALIASES,
  FAIRCREST_2020_NEEDS_TOM,
  faircrest2020AliasFor,
  faircrest2020CodeKey,
  faircrest2020EquivalentCodes,
  faircrest2020HandCodes,
  faircrest2020MasterCode,
  faircrest2020MasterCodes,
  faircrest2020OurCodes,
  faircrest2020SameCabinet,
  hasFaircrest2020Alias,
  resolveFaircrest2020CatalogCode,
} from "./faircrest2020Aliases";

describe("Faircrest 2020 alias map", () => {
  it("resolves the wall open shelf spellings onto Faircrest WOS", () => {
    expect(faircrest2020MasterCode("WEOS0930")).toBe("WOS0930");
    expect(faircrest2020MasterCode("WEOS0936")).toBe("WOS0936");
    expect(faircrest2020MasterCode("WEOS0942")).toBe("WOS0942");
    // The misspelling Tom called out.
    expect(faircrest2020MasterCode("WOES0930")).toBe("WOS0930");
    expect(faircrest2020MasterCode("WOES1230")).toBe("WOS1230");
    expect(faircrest2020MasterCode("weos-09-30")).toBe("WOS0930");
  });

  it("keeps the whole WOS ladder Faircrest publishes, without inventing sizes", () => {
    for (const width of ["09", "12", "18", "24", "30"]) {
      for (const height of ["24", "30", "36", "42", "48", "54", "60"]) {
        expect(faircrest2020MasterCode(`WEOS${width}${height}`)).toBe(
          `WOS${width}${height}`,
        );
      }
    }
    // 31" is not on the ladder, and neither is a 31" high shelf.
    expect(faircrest2020MasterCode("WEOS3130")).toBeNull();
    expect(faircrest2020MasterCode("WEOS0931")).toBeNull();
    // A typo with the wrong number of digits stays unresolved.
    expect(faircrest2020MasterCode("WEOS930")).toBeNull();
  });

  it("resolves the flagged specialty families", () => {
    expect(faircrest2020MasterCode("LSB36")).toBe("LS3612");
    expect(faircrest2020MasterCode("LSB33")).toBe("LS3312");
    expect(faircrest2020MasterCode("LS-36")).toBe("LS3612");
    expect(faircrest2020MasterCode("LS3612")).toBe("LS3612");
    expect(faircrest2020MasterCode("BER36")).toBe("BER36");
    expect(faircrest2020MasterCode("BER33")).toBe("BER33");
    expect(faircrest2020MasterCode("ERB36")).toBe("BER36");
    expect(faircrest2020MasterCode("ERB33")).toBe("BER33");
    expect(faircrest2020MasterCode("DCW2430")).toBe("WDC2430");
    expect(faircrest2020MasterCode("AG2418")).toBe("AG2418");
    expect(faircrest2020MasterCode("BT9")).toBe("TB09");
    expect(faircrest2020MasterCode("BBC36")).toBe("BBC36");
    expect(faircrest2020MasterCode("WBC2730")).toBe("WBC2730");
    expect(faircrest2020MasterCode("WER2430")).toBe("WER2430");
    expect(faircrest2020MasterCode("AW1230")).toBe("WAC1230");
  });

  it("carries Faircrest's left/right split instead of hiding it", () => {
    expect(faircrest2020MasterCodes("LSB36")).toEqual([
      "LS3612",
      "LS3612L",
      "LS3612R",
    ]);
    expect(faircrest2020MasterCodes("WBC2730")).toEqual([
      "WBC2730",
      "WBC2730L",
      "WBC2730R",
    ]);
    expect(faircrest2020MasterCodes("AG2418")).toEqual([
      "AG2418",
      "AG2418L",
      "AG2418R",
    ]);
    expect(faircrest2020AliasFor("AW1230")?.hands).toEqual(["L", "R"]);
    // A mechanically named open shelf keeps its plain code; no hand is invented.
    expect(faircrest2020MasterCodes("WEOS1230")).toEqual(["WOS1230"]);
    expect(faircrest2020HandCodes("WAC1230", ["L", "R"])).toEqual([
      "WAC1230L",
      "WAC1230R",
    ]);
    expect(faircrest2020HandCodes("WAC1230", undefined)).toEqual([]);
  });

  it("resolves handed spellings of either side through the base", () => {
    expect(faircrest2020MasterCode("BBC36-R")).toBe("BBC36");
    expect(faircrest2020MasterCode("WBC2736L")).toBe("WBC2736");
    expect(faircrest2020MasterCode("LS3612-L")).toBe("LS3612");
    expect(faircrest2020MasterCode("WAC1230L")).toBe("WAC1230");
    // A trailing letter that is part of the code is not a hand.
    expect(faircrest2020MasterCode("BES")).toBeNull();
    expect(faircrest2020MasterCode("WS")).toBeNull();
  });

  it("goes the other way, Faircrest code -> our rows", () => {
    expect(faircrest2020OurCodes("WOS0930")).toEqual(["WEOS0930", "WOES0930"]);
    expect(faircrest2020OurCodes("WOS1230")).toEqual(["WEOS1230", "WOES1230"]);
    expect(faircrest2020OurCodes("LS3612")).toEqual([
      "LS36",
      "LS3612",
      "LSB36",
    ]);
    expect(faircrest2020OurCodes("LS3612-L")).toEqual([
      "LS36",
      "LS3612",
      "LSB36",
    ]);
    expect(faircrest2020OurCodes("TB09")).toEqual(["BT9"]);
    expect(faircrest2020OurCodes("WBC2742-R")).toEqual(["WBC2742"]);
  });

  it("never resolves a Faircrest WOS size we do not spell", () => {
    // Faircrest's ladder includes 10" and 21" widths; no mapping table row names
    // them, so nothing resolves to our catalog.
    expect(faircrest2020AliasFor("WOS1030")).toBeNull();
    // The mechanical ladder spelling is offered for search, but it names no
    // cabinet until a catalog row carries it.
    expect(faircrest2020OurCodes("WOS1030")).toEqual(["WEOS1030", "WOES1030"]);
    expect(faircrest2020EquivalentCodes("WOS1030")).toEqual([
      "WEOS1030",
      "WOES1030",
      "WOS1030",
    ]);
    expect(faircrest2020OurCodes("WOS0931")).toEqual([]);
  });

  it("leaves every 'needs Tom' mapping inert", () => {
    for (const entry of FAIRCREST_2020_NEEDS_TOM) {
      // A entry may document an open detail on a mapping that IS confirmed; the
      // rest are open code mappings and must not resolve.
      if (entry.codeMappingExists) continue;
      for (const code of entry.ourCode.match(/[A-Z]{1,4}\d{2,4}/g) ?? []) {
        expect(faircrest2020MasterCode(code)).toBeNull();
      }
    }
    // Prose rows (no bare code) are notes, not mappings.
    for (const entry of FAIRCREST_2020_NEEDS_TOM) {
      if (/^[A-Z]{1,4}\d{2,4}$/.test(entry.ourCode)) {
        expect(faircrest2020MasterCode(entry.ourCode)).toBeNull();
      }
    }
    // Spot checks on the specific rows that could have been guessed.
    expect(faircrest2020MasterCode("BBC42")).toBeNull();
    expect(faircrest2020MasterCode("BBC45")).toBeNull();
    expect(faircrest2020MasterCode("CSB36")).toBeNull();
    expect(faircrest2020MasterCode("ER36")).toBeNull();
    expect(faircrest2020MasterCode("WRC3015")).toBeNull();
    expect(faircrest2020MasterCode("LZS3612")).toBeNull();
    expect(faircrest2020MasterCode("SP09")).toBeNull();
    expect(faircrest2020MasterCode("BSR9")).toBeNull();
    expect(faircrest2020MasterCode("BSD6")).toBeNull();
    expect(faircrest2020MasterCode("TB15")).toBeNull();
    expect(faircrest2020MasterCode("MW2436")).toBeNull();
    expect(faircrest2020MasterCode("MWD2448")).toBeNull();
    expect(faircrest2020MasterCode("BMC27")).toBeNull();
  });

  it("does not alias the KitchenCrest open-end line onto Faircrest WOS", () => {
    // The review calls OE630/OE636/OE642 a different line book.
    expect(faircrest2020MasterCode("OE630")).toBeNull();
    expect(faircrest2020MasterCode("OE636")).toBeNull();
    expect(faircrest2020MasterCode("OE642")).toBeNull();
  });

  it("keeps unrelated codes unresolved", () => {
    expect(faircrest2020MasterCode("B24")).toBeNull();
    expect(faircrest2020MasterCode("W3030")).toBeNull();
    expect(faircrest2020MasterCode("")).toBeNull();
    expect(faircrest2020MasterCode(null)).toBeNull();
    expect(faircrest2020AliasFor("   ")).toBeNull();
    expect(faircrest2020OurCodes("")).toEqual([]);
    expect(hasFaircrest2020Alias("B24")).toBe(false);
    expect(hasFaircrest2020Alias("WEOS0930")).toBe(true);
  });

  it("hands out both directions in one list for search", () => {
    expect(faircrest2020EquivalentCodes("WEOS0930")).toEqual([
      "WEOS0930",
      "WOES0930",
      "WOS0930",
    ]);
    expect(faircrest2020EquivalentCodes("WOS0930")).toEqual([
      "WEOS0930",
      "WOES0930",
      "WOS0930",
    ]);
    expect(faircrest2020EquivalentCodes("B24")).toEqual(["B24"]);
    expect(faircrest2020EquivalentCodes("")).toEqual([]);
  });

  it("compares two spellings of one cabinet", () => {
    expect(faircrest2020SameCabinet("WEOS0930", "WOS0930")).toBe(true);
    expect(faircrest2020SameCabinet("WOS0930", "WOES0930")).toBe(true);
    expect(faircrest2020SameCabinet("LSB36", "LS3612-R")).toBe(true);
    expect(faircrest2020SameCabinet("LSB36", "LSB33")).toBe(false);
    expect(faircrest2020SameCabinet("WEOS0930", "WEOS0936")).toBe(false);
    expect(faircrest2020SameCabinet("B24", "B27")).toBe(false);
    expect(faircrest2020SameCabinet("", "WOS0930")).toBe(false);
  });

  it("resolves one raw code against a catalog, and refuses ambiguity", () => {
    const catalog = [
      { id: 1, masterCode: "WEOS0930" },
      { id: 2, masterCode: "LSB36" },
      { id: 3, masterCode: "B24" },
    ];
    expect(resolveFaircrest2020CatalogCode("WOS0930", catalog)?.id).toBe(1);
    expect(resolveFaircrest2020CatalogCode("WOES0930", catalog)?.id).toBe(1);
    expect(resolveFaircrest2020CatalogCode("LSB36", catalog)?.id).toBe(2);
    expect(resolveFaircrest2020CatalogCode("LS3612-R", catalog)?.id).toBe(2);
    expect(resolveFaircrest2020CatalogCode("B24", catalog)?.id).toBe(3);
    expect(resolveFaircrest2020CatalogCode("WOS1230", catalog)).toBeNull();
    // Two rows that both sell LS3612 must never be guessed between.
    const ambiguous = [...catalog, { id: 4, masterCode: "LS36" }];
    expect(resolveFaircrest2020CatalogCode("LS3612", ambiguous)).toBeNull();
  });

  it("normalizes whitespace, case and separators everywhere", () => {
    expect(faircrest2020CodeKey("  weos-09-30 ")).toBe("WEOS0930");
    expect(faircrest2020MasterCode("weos 09 30")).toBe("WOS0930");
    expect(faircrest2020MasterCode("w.o.e.s.0930")).toBe("WOS0930");
  });

  it("keeps every confirmed entry internally consistent", () => {
    const ourCodes = new Set<string>();
    for (const entry of FAIRCREST_2020_ALIASES) {
      expect(entry.ourCode.trim()).toBe(entry.ourCode);
      expect(entry.faircrestCode.trim()).toBe(entry.faircrestCode);
      expect(entry.evidence.trim().length).toBeGreaterThan(20);
      // One entry per one of our codes, so resolution is deterministic.
      expect(ourCodes.has(entry.ourCode)).toBe(false);
      ourCodes.add(entry.ourCode);
      // A hand is a suffix, never baked into the base code.
      expect(entry.faircrestCode).not.toMatch(/(?:L|R)$/);
      expect(faircrest2020MasterCode(entry.ourCode)).toBe(entry.faircrestCode);
    }
  });

  it("keeps the read-only SQL check in step with the map", () => {
    const sql = readFileSync(
      new URL(
        "../docs/sql/0266_faircrest_2020_alias_check.tidb.sql",
        import.meta.url,
      ),
      "utf8",
    );
    for (const entry of FAIRCREST_2020_ALIASES) {
      expect(sql).toContain(`'${entry.ourCode}'`);
    }
    // The file must never write. It is a preview, not a migration.
    expect(sql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b/i);
    expect(sql).not.toMatch(/IF\s+NOT\s+EXISTS/i);
  });
});
