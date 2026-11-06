import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  FAIRCREST_2020_ALIASES,
  FAIRCREST_2020_BLIND_CORNER_NOTE,
  FAIRCREST_2020_DECIDED_UNMAPPED,
  FAIRCREST_2020_DISTINCT_CODES,
  FAIRCREST_2020_NEEDS_RESEARCH,
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
    expect(faircrest2020MasterCode("WBC2730")).toBe("WBC2430");
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
      "WBC2430",
      "WBC2430L",
      "WBC2430R",
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
    expect(faircrest2020MasterCode("WBC2736L")).toBe("WBC2436");
    expect(faircrest2020MasterCode("LS3612-L")).toBe("LS3612");
    expect(faircrest2020MasterCode("WAC1230L")).toBe("WAC1230");
    // A trailing letter that is part of the code is not a hand.
    expect(faircrest2020MasterCode("BES")).toBeNull();
    expect(faircrest2020MasterCode("WS")).toBeNull();
  });

  it("goes the other way, Faircrest code -> our rows", () => {
    expect(faircrest2020OurCodes("WOS0930")).toEqual(["WEOS0930", "WOES0930"]);
    expect(faircrest2020OurCodes("WOS1230")).toEqual(["WEOS1230", "WOES1230"]);
    // LZS3612 joined this family when Tom confirmed LZS = Lazy Susan.
    expect(faircrest2020OurCodes("LS3612")).toEqual([
      "LS36",
      "LS3612",
      "LSB36",
      "LZS3612",
    ]);
    expect(faircrest2020OurCodes("LS3612-L")).toEqual([
      "LS36",
      "LS3612",
      "LSB36",
      "LZS3612",
    ]);
    expect(faircrest2020OurCodes("TB09")).toEqual([
      "B9FH",
      "BFH9",
      "BT09",
      "BT9",
      "BT9FH",
      "TB9",
    ]);
    expect(faircrest2020OurCodes("WBC2442-R")).toEqual(["WBC2742"]);
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

  it("never resolves BBC42 to any Faircrest code (Tom: Faircrest has no 42 blind corner)", () => {
    // Decided, not open: BBC42 has no Faircrest equivalent at all.
    expect(faircrest2020MasterCode("BBC42")).toBeNull();
    expect(faircrest2020MasterCodes("BBC42")).toEqual([]);
    expect(faircrest2020AliasFor("BBC42")).toBeNull();
    // The specific codes it must NOT be confused with. B42 is a plain base, not
    // a blind corner, and BBC42 has no Faircrest match at all (Tom).
    for (const faircrestCode of [
      "B42",
      "BCB42L",
      "BCB42R",
      "BCB42",
      "BBC42L",
      "BBC42R",
    ]) {
      expect(faircrest2020SameCabinet("BBC42", faircrestCode)).toBe(false);
      expect(faircrest2020OurCodes(faircrestCode)).not.toContain("BBC42");
      expect(faircrest2020MasterCode(faircrestCode)).not.toBe("BBC42");
    }
    // B42 never resolves to BBC42 in either direction.
    expect(faircrest2020MasterCode("B42")).toBeNull();
    expect(faircrest2020SameCabinet("B42", "BBC42")).toBe(false);
    // It is a settled decision, not an open question.
    expect(
      FAIRCREST_2020_NEEDS_TOM.some((entry) => entry.ourCode === "BBC42"),
    ).toBe(false);
    const decided = FAIRCREST_2020_DISTINCT_CODES.find(
      (entry) => entry.ourCode === "BBC42",
    );
    expect(decided).toBeDefined();
    expect(decided?.why).toMatch(/does NOT have a 42" blind corner/);
    expect(decided?.why).toMatch(/must never resolve to any Faircrest code/);
    // The name still defines the cabinet: BBC42 IS a 42" base blind corner.
    expect(decided?.why).toMatch(/base blind corner, 42" wide/);
    expect(decided?.why).toMatch(/Treat it as a blind corner by name/);
    // BBC42 and B42 are different cabinets in different areas: never merged.
    expect(decided?.why).toMatch(
      /BBC42 \(base blind corner\) and B42 \(standard base\) are two different cabinets/,
    );
    expect(decided?.why).toMatch(
      /never be merged or aliased in either direction/,
    );
    // The app already classifies it by code; this module only says it has no
    // Faircrest equivalent. (Blind-corner detection lives in design.ts.)
    expect(faircrest2020MasterCode("BBC42")).toBeNull();
    // BBC36 is a different cabinet and still maps normally.
    expect(faircrest2020MasterCode("BBC36")).toBe("BBC36");
  });

  it("resolves BBC45 to Faircrest BCB45-HMS with the hand preserved (Tom confirmed)", () => {
    // Tom: our BBC45 IS Faircrest's 45" blind corner box with half-moon swing-out.
    expect(faircrest2020MasterCode("BBC45")).toBe("BCB45-HMS");
    expect(faircrest2020AliasFor("BBC45")).toMatchObject({
      ourCode: "BBC45",
      faircrestCode: "BCB45-HMS",
      hands: ["L", "R"],
      family: "blind-corner-base",
    });
    // BCB45-HMS + hands spells Faircrest's two codes exactly.
    expect(faircrest2020MasterCodes("BBC45")).toEqual([
      "BCB45-HMS",
      "BCB45-HMSL",
      "BCB45-HMSR",
    ]);
    // Handed in, handed out: the hand is preserved, never dropped.
    expect(faircrest2020MasterCode("BBC45-L")).toBe("BCB45-HMS");
    expect(faircrest2020MasterCode("BBC45-R")).toBe("BCB45-HMS");
    expect(faircrest2020MasterCode("BCB45-HMSL")).toBe("BCB45-HMS");
    expect(faircrest2020MasterCode("BCB45-HMSR")).toBe("BCB45-HMS");
    // …and the hand survives the round trip in both directions.
    expect(faircrest2020OurCodes("BCB45-HMSL")).toEqual(["BBC45"]);
    expect(faircrest2020OurCodes("BCB45-HMSR")).toEqual(["BBC45"]);
    expect(faircrest2020SameCabinet("BBC45", "BCB45-HMSL")).toBe(true);
    expect(faircrest2020SameCabinet("BBC45", "BCB45-HMSR")).toBe(true);
    expect(faircrest2020SameCabinet("BBC45", "BBC45-L")).toBe(true);
    // The banded BBC2-48R box is NOT this cabinet and stays unmapped.
    expect(faircrest2020MasterCode("BBC2-48R")).toBeNull();
    expect(faircrest2020OurCodes("BBC2-48R")).toEqual([]);
    expect(faircrest2020SameCabinet("BBC45", "BBC2-48R")).toBe(false);
    // BBC45 is no longer an open question.
    expect(
      FAIRCREST_2020_NEEDS_TOM.some((entry) => entry.ourCode === "BBC45"),
    ).toBe(false);
    // BBC36 and BBC42 are untouched by this.
    expect(faircrest2020MasterCode("BBC36")).toBe("BBC36");
    expect(faircrest2020MasterCode("BBC42")).toBeNull();
  });

  it("records that blind corners are straight cabinets with a 3-inch filler", () => {
    // Note only: no geometry, filler logic or Auto Design changes come from here.
    expect(FAIRCREST_2020_BLIND_CORNER_NOTE).toMatch(/straight cabinets/);
    expect(FAIRCREST_2020_BLIND_CORNER_NOTE).toMatch(/3-inch filler/);
    expect(FAIRCREST_2020_BLIND_CORNER_NOTE).toMatch(/opposite side/);
    expect(FAIRCREST_2020_BLIND_CORNER_NOTE).toMatch(
      /standard for blind corners/,
    );
    // Every blind code in the map carries the note, so the rule travels with it.
    const blind = FAIRCREST_2020_ALIASES.filter((entry) =>
      entry.family.startsWith("blind-corner"),
    );
    expect(blind.map((entry) => entry.ourCode).sort()).toEqual([
      "BBC36",
      "BBC45",
      "WBC2730",
      "WBC2736",
      "WBC2742",
    ]);
    for (const entry of blind) {
      expect(entry.evidence).toMatch(/straight cabinet/i);
      expect(entry.evidence).toMatch(/3-inch filler/);
      expect(entry.evidence).toMatch(/opposite side/);
    }
  });

  it("maps the 27 wall blind corners onto Faircrest's 24/27 band (Tom decided)", () => {
    // Tom: our 27" wall blind corners are the 24/27 band codes, hands L/R.
    for (const [our, faircrest] of [
      ["WBC2730", "WBC2430"],
      ["WBC2736", "WBC2436"],
      ["WBC2742", "WBC2442"],
    ] as const) {
      expect(faircrest2020MasterCode(our)).toBe(faircrest);
      expect(faircrest2020AliasFor(our)).toMatchObject({
        faircrestCode: faircrest,
        hands: ["L", "R"],
        family: "blind-corner-wall",
      });
      // BCB…+hand spells Faircrest's left and right exactly.
      expect(faircrest2020MasterCodes(our)).toEqual([
        faircrest,
        `${faircrest}L`,
        `${faircrest}R`,
      ]);
      // Handed on our side too, and the hand survives both directions.
      expect(faircrest2020MasterCode(`${our}-L`)).toBe(faircrest);
      expect(faircrest2020MasterCode(`${our}-R`)).toBe(faircrest);
      expect(faircrest2020MasterCode(`${faircrest}L`)).toBe(faircrest);
      expect(faircrest2020OurCodes(`${faircrest}L`)).toEqual([our]);
      expect(faircrest2020SameCabinet(our, `${faircrest}R`)).toBe(true);
    }
    // The old identity spelling no longer stands in for the Faircrest code.
    expect(faircrest2020MasterCode("WBC2730")).not.toBe("WBC2730");
    // The band question is settled, not open.
    expect(
      FAIRCREST_2020_NEEDS_TOM.some((entry) =>
        /WBC2430|blind corner band/i.test(entry.ourCode),
      ),
    ).toBe(false);
    // Only the 24/27 band is claimed; the 33/36 band is not.
    expect(faircrest2020MasterCode("WBC3630")).not.toBe("WBC2730");
  });

  it("maps CSB36 to Faircrest DCSB36 with hands L/R (Tom decided)", () => {
    expect(faircrest2020MasterCode("CSB36")).toBe("DCSB36");
    expect(faircrest2020AliasFor("CSB36")).toMatchObject({
      ourCode: "CSB36",
      faircrestCode: "DCSB36",
      hands: ["L", "R"],
      family: "corner-sink-base",
    });
    // DCSB36 + hands spells Faircrest's left and right exactly.
    expect(faircrest2020MasterCodes("CSB36")).toEqual([
      "DCSB36",
      "DCSB36L",
      "DCSB36R",
    ]);
    // Handed both ways, hand preserved.
    expect(faircrest2020MasterCode("CSB36-L")).toBe("DCSB36");
    expect(faircrest2020MasterCode("CSB36-R")).toBe("DCSB36");
    expect(faircrest2020MasterCode("DCSB36-L")).toBe("DCSB36");
    expect(faircrest2020MasterCode("DCSB36-R")).toBe("DCSB36");
    expect(faircrest2020OurCodes("DCSB36-L")).toEqual(["CSB36"]);
    expect(faircrest2020OurCodes("DCSB36-R")).toEqual(["CSB36"]);
    expect(faircrest2020SameCabinet("CSB36", "DCSB36-L")).toBe(true);
    // Corner sink bases are the same cabinet across all distributors.
    expect(faircrest2020AliasFor("CSB36")?.evidence).toMatch(
      /same cabinet across all distributors/,
    );
    // The other sink corners are different cabinets and stay unmapped.
    for (const code of ["DSB33R", "BCS33-FHD", "BCS33-FHD-L"]) {
      expect(faircrest2020MasterCode(code)).toBeNull();
      expect(faircrest2020OurCodes(code)).toEqual([]);
      expect(faircrest2020SameCabinet("CSB36", code)).toBe(false);
    }
    // No longer an open question.
    expect(
      FAIRCREST_2020_NEEDS_TOM.some((entry) => entry.ourCode === "CSB36"),
    ).toBe(false);
  });

  it("maps the base microwaves by width (Tom decided)", () => {
    // 27" body -> BMC27; BM27 and BMC271DWR are the same cabinet.
    expect(faircrest2020MasterCode("BMC27")).toBe("BMC27");
    expect(faircrest2020MasterCode("BM27")).toBe("BMC27");
    // BMC271DWR is BMC27 with its standard bottom drawer spelled out.
    expect(faircrest2020MasterCode("BMC271DWR")).toBe("BMC27");
    expect(faircrest2020SameCabinet("BMC271DWR", "BMC27")).toBe(true);
    expect(faircrest2020SameCabinet("BM27", "BMC27")).toBe(true);
    // 30" body -> BMC30; MB30 and BMW30 are our spellings of it.
    expect(faircrest2020MasterCode("BMC30")).toBe("BMC30");
    expect(faircrest2020MasterCode("MB30")).toBe("BMC30");
    expect(faircrest2020MasterCode("BMW30")).toBe("BMC30");
    expect(faircrest2020SameCabinet("MB30", "BMC30")).toBe(true);
    expect(faircrest2020SameCabinet("BMW30", "BMC30")).toBe(true);
    // Width is the only difference, so the two bodies never collapse together.
    expect(faircrest2020SameCabinet("BMC27", "BMC30")).toBe(false);
    expect(faircrest2020MasterCode("BMC27")).not.toBe("BMC30");
    // No hands on this family: a base microwave is not left/right handed.
    expect(faircrest2020AliasFor("BMC27")?.hands).toEqual([]);
    // Every base microwave has that drawer as standard, the note must say so.
    for (const code of [
      "BMC27",
      "BM27",
      "BMC271DWR",
      "BMC30",
      "MB30",
      "BMW30",
    ]) {
      expect(faircrest2020AliasFor(code)?.evidence).toMatch(/drawer/i);
    }
    expect(faircrest2020AliasFor("BMC27")?.evidence).toMatch(
      /drawer at the bottom as standard/,
    );
    // No longer an open question.
    expect(
      FAIRCREST_2020_NEEDS_TOM.some((entry) =>
        /BMC27|BMW30|BM27/.test(entry.ourCode),
      ),
    ).toBe(false);
  });

  it("maps BSR9 to Faircrest BSR9 as a spice pull-out, never a tray base (Tom)", () => {
    // Tom's rule: T = tray, S = spice. BSR9 is a spice pull-out.
    expect(faircrest2020MasterCode("BSR9")).toBe("BSR9");
    expect(faircrest2020AliasFor("BSR9")).toMatchObject({
      ourCode: "BSR9",
      faircrestCode: "BSR9",
      family: "spice-pullout",
      hands: [],
    });
    // It looks like a BT9 but is NOT a tray base: no link in either direction.
    for (const bt of ["BT9", "BT09", "TB9", "TB09", "BFH9", "B9FH", "BT9FH"]) {
      expect(faircrest2020SameCabinet("BSR9", bt)).toBe(false);
      expect(faircrest2020OurCodes(bt)).not.toContain("BSR9");
      expect(faircrest2020MasterCode(bt)).not.toBe("BSR9");
      expect(faircrest2020OurCodes("BSR9")).not.toContain(bt);
    }
    // The description says what it is: spice rack / pull-out, same look as BT9.
    const note = faircrest2020AliasFor("BSR9")?.evidence ?? "";
    expect(note).toMatch(/9" base spice rack/);
    expect(note).toMatch(/spice pull-out/);
    expect(note).toMatch(/same look as a BT9/);
    expect(note).toMatch(/"S" means spice/);
    // Static drawing: no interactive pull-out exists in this app.
    expect(note).toMatch(/no interactive pull-out/);
    expect(note).toMatch(/draws as a static cabinet/);
    // Not in the open list any more, and the settled spice codes still map.
    expect(
      FAIRCREST_2020_NEEDS_TOM.some((entry) => /\bBSR9\b/.test(entry.ourCode)),
    ).toBe(false);
    expect(faircrest2020MasterCode("BSR12")).toBe("BSR12");
    expect(faircrest2020MasterCode("BSD6")).toBe("BSD6");
  });

  it("keeps the BT9 alias fixture free of BSR9", () => {
    // T = tray, S = spice: BSR9 must not sit in BT9's alias cell.
    const source = readFileSync(
      new URL("./catalogCodeSearch.test.ts", import.meta.url),
      "utf8",
    );
    expect(source).toMatch(/BT9_ALIASES/);
    expect(source).not.toMatch(/BT09; BSR9/);
    expect(source).not.toMatch(/BSR9; FHB09/);
  });

  it("maps the wider tray bases by width, hands L/R (Tom decided)", () => {
    expect(faircrest2020MasterCode("BT12")).toBe("TB12");
    expect(faircrest2020MasterCode("BT15")).toBe("TB15");
    for (const [our, faircrest] of [
      ["BT12", "TB12"],
      ["BT15", "TB15"],
    ] as const) {
      expect(faircrest2020AliasFor(our)).toMatchObject({
        faircrestCode: faircrest,
        hands: ["L", "R"],
        family: "tray-base",
      });
      expect(faircrest2020MasterCodes(our)).toEqual([
        faircrest,
        `${faircrest}L`,
        `${faircrest}R`,
      ]);
      // Handed both ways, hand preserved.
      expect(faircrest2020MasterCode(`${our}-L`)).toBe(faircrest);
      expect(faircrest2020MasterCode(`${faircrest}R`)).toBe(faircrest);
      expect(faircrest2020OurCodes(`${faircrest}L`)).toEqual([our]);
      // A tray base has a tray/divider in the middle.
      expect(faircrest2020AliasFor(our)?.evidence).toMatch(
        /tray\/divider in the middle/,
      );
      // The image is shared between standard and full-height; the option picked
      // in the designer decides which one applies.
      expect(faircrest2020AliasFor(our)?.evidence).toMatch(
        /image is the same whether it is the standard base or the full-height version/,
      );
      expect(faircrest2020AliasFor(our)?.evidence).toMatch(
        /depends on the option the customer picked in the designer/,
      );
      expect(faircrest2020AliasFor(our)?.evidence).toMatch(
        /U\.S\. Cabinet Depot/,
      );
    }
    // Widths stay distinct from each other and from the 9.
    expect(faircrest2020SameCabinet("BT12", "BT15")).toBe(false);
    expect(faircrest2020SameCabinet("BT12", "BT9")).toBe(false);
    expect(faircrest2020MasterCode("BT9")).toBe("TB09");
    // Settled, not open.
    expect(
      FAIRCREST_2020_NEEDS_TOM.some((entry) => /TB12|TB15/.test(entry.ourCode)),
    ).toBe(false);
  });

  it("aliases WRC3015 to Faircrest LWR3015 without touching its own row or price", () => {
    // Tom reversed the old hold: code-level Faircrest lookup only.
    expect(faircrest2020MasterCode("WRC3015")).toBe("LWR3015");
    expect(faircrest2020AliasFor("WRC3015")).toMatchObject({
      ourCode: "WRC3015",
      faircrestCode: "LWR3015",
      family: "wall-wine-rack",
    });
    expect(faircrest2020SameCabinet("WRC3015", "LWR3015")).toBe(true);
    // No hand: a wall wine rack is not left/right handed.
    expect(faircrest2020AliasFor("WRC3015")?.hands).toEqual([]);
    // The reverse direction does NOT claim WRC3015 as an alias of LWR3015's row;
    // each code keeps its own catalog row (0230 split them for pricing).
    expect(faircrest2020OurCodes("LWR3015")).toContain("WRC3015");
    // Settled, not open.
    expect(
      FAIRCREST_2020_NEEDS_TOM.some((entry) => entry.ourCode === "WRC3015"),
    ).toBe(false);
    // Evidence records the safeguard: our master code stays WRC3015.
    expect(faircrest2020AliasFor("WRC3015")?.evidence).toMatch(
      /master code still reads WRC3015/,
    );
    expect(faircrest2020AliasFor("WRC3015")?.evidence).toMatch(
      /nothing is written to sku_master_aliases/,
    );
  });

  it("maps LZS to the Lazy Susan codes, hands L/R (Tom confirmed)", () => {
    // Tom: LZS = Lazy Susan.
    expect(faircrest2020MasterCode("LZS33")).toBe("LS3312");
    expect(faircrest2020MasterCode("LZS3612")).toBe("LS3612");
    for (const [our, faircrest] of [
      ["LZS33", "LS3312"],
      ["LZS3612", "LS3612"],
    ] as const) {
      expect(faircrest2020AliasFor(our)).toMatchObject({
        faircrestCode: faircrest,
        hands: ["L", "R"],
        family: "lazy-susan-corner",
      });
      expect(faircrest2020MasterCodes(our)).toEqual([
        faircrest,
        `${faircrest}L`,
        `${faircrest}R`,
      ]);
      // Handed both ways, hand preserved.
      expect(faircrest2020MasterCode(`${our}-L`)).toBe(faircrest);
      expect(faircrest2020MasterCode(`${faircrest}R`)).toBe(faircrest);
      expect(faircrest2020OurCodes(`${faircrest}L`)).toContain(our);
    }
    // Same Faircrest code as the LSB rows, so they are one cabinet family.
    expect(faircrest2020SameCabinet("LZS33", "LSB33")).toBe(true);
    expect(faircrest2020SameCabinet("LZS3612", "LSB36")).toBe(true);
    // Widths stay distinct.
    expect(faircrest2020SameCabinet("LZS33", "LZS3612")).toBe(false);
    // No longer an open question.
    expect(
      FAIRCREST_2020_NEEDS_TOM.some((entry) => /LZS/.test(entry.ourCode)),
    ).toBe(false);
  });

  it("keeps SP09 open and SP2436 in the research/conflict list, both unmapped", () => {
    // Neither may ever resolve.
    for (const code of ["SP09", "SP2436"]) {
      expect(faircrest2020MasterCode(code)).toBeNull();
      expect(faircrest2020AliasFor(code)).toBeNull();
      expect(faircrest2020OurCodes(code)).toEqual([]);
      expect(faircrest2020EquivalentCodes(code)).toEqual([code]);
      expect(hasFaircrest2020Alias(code)).toBe(false);
    }
    // They are not secretly each other, or anything else.
    expect(faircrest2020SameCabinet("SP09", "SP2436")).toBe(false);
    // SP09 stays in the open needs-Tom list.
    expect(
      FAIRCREST_2020_NEEDS_TOM.some((entry) => entry.ourCode === "SP09"),
    ).toBe(true);
    // SP2436 lives in the separate research/conflict list instead.
    expect(
      FAIRCREST_2020_NEEDS_TOM.some((entry) => /SP2436/.test(entry.ourCode)),
    ).toBe(false);
    const research = FAIRCREST_2020_NEEDS_RESEARCH.find(
      (entry) => entry.ourCode === "SP2436",
    );
    expect(research).toBeDefined();
    expect(research?.needs).toMatch(/must be mapped|Nothing may be mapped/);
    // Every research entry is also inert.
    for (const entry of FAIRCREST_2020_NEEDS_RESEARCH) {
      expect(faircrest2020MasterCode(entry.ourCode)).toBeNull();
    }
  });

  it("keeps MW2436 and MWD2448 in the research list, never mapped by size (Tom)", () => {
    for (const code of ["MW2436", "MWD2448"]) {
      expect(faircrest2020MasterCode(code)).toBeNull();
      expect(faircrest2020AliasFor(code)).toBeNull();
      expect(faircrest2020OurCodes(code)).toEqual([]);
      expect(hasFaircrest2020Alias(code)).toBe(false);
      const research = FAIRCREST_2020_NEEDS_RESEARCH.find(
        (entry) => entry.ourCode === code,
      );
      expect(research).toBeDefined();
      // The research note must name both sources to check.
      expect(research?.needs).toMatch(/actual package/);
      expect(research?.needs).toMatch(/DL spec book/);
      expect(research?.known).toMatch(/decorative-door microwave/);
      expect(research?.known).toMatch(/template/);
    }
    // They must not be confused with the microwave codes that ARE mapped.
    expect(faircrest2020SameCabinet("MW2436", "MW3030")).toBe(false);
    expect(faircrest2020SameCabinet("MWD2448", "MW3042")).toBe(false);
    expect(faircrest2020MasterCode("MW3030")).toBeNull(); // already our own code
    // The mapped base microwaves are untouched.
    expect(faircrest2020MasterCode("BMC27")).toBe("BMC27");
    // Not in the open needs-Tom list: this is a research item, not a decision.
    expect(
      FAIRCREST_2020_NEEDS_TOM.some((entry) =>
        /MW2436|MWD2448/.test(entry.ourCode),
      ),
    ).toBe(false);
  });

  it("records ESR1 and WAS as decided-unmapped, and keeps them unresolvable", () => {
    // ESR1 is a drawing setting, not a cabinet.
    for (const code of ["ESR1", "WAS1224", "WAS1260", "WAS1230L"]) {
      expect(faircrest2020MasterCode(code)).toBeNull();
      expect(faircrest2020AliasFor(code)).toBeNull();
      expect(hasFaircrest2020Alias(code)).toBe(false);
    }
    const esr1 = FAIRCREST_2020_DECIDED_UNMAPPED.find(
      (entry) => entry.ourCode === "ESR1",
    );
    expect(esr1).toBeDefined();
    expect(esr1?.faircrest).toMatch(/drawing setting/);
    expect(esr1?.faircrest).toMatch(/not a cabinet/);
    expect(esr1?.why).toMatch(/drawing setting only/);

    const was = FAIRCREST_2020_DECIDED_UNMAPPED.find(
      (entry) => entry.ourCode === "WAS1224-WAS1260",
    );
    expect(was).toBeDefined();
    // WAS is a CABINET, not a shelf.
    expect(was?.faircrest).toMatch(/wall angle CABINET/);
    expect(was?.faircrest).toMatch(/not shelves/);
    expect(was?.faircrest).not.toMatch(/shelf family/);
    expect(was?.why).toMatch(/do not sell|no SKU/);
    // Neither is an open question any more.
    expect(
      FAIRCREST_2020_NEEDS_TOM.some((entry) =>
        /ESR1|WAS12/.test(entry.ourCode),
      ),
    ).toBe(false);
    for (const entry of FAIRCREST_2020_DECIDED_UNMAPPED) {
      expect(faircrest2020MasterCode(entry.ourCode)).toBeNull();
    }
  });

  it("maps BSR12 to Faircrest BSR12, the 12 spice pull-out base (Tom)", () => {
    expect(faircrest2020MasterCode("BSR12")).toBe("BSR12");
    expect(faircrest2020AliasFor("BSR12")).toMatchObject({
      ourCode: "BSR12",
      faircrestCode: "BSR12",
      family: "spice-pullout",
      hands: [],
    });
    expect(faircrest2020SameCabinet("BSR12", "BSR12")).toBe(true);
    // BSR12 is a spice pull-out, NOT the 9" tall base BSR9 and not BT9.
    expect(faircrest2020SameCabinet("BSR12", "BSR9")).toBe(false);
    expect(faircrest2020SameCabinet("BSR12", "BT9")).toBe(false);
    expect(faircrest2020MasterCode("BSR9")).toBe("BSR9");
    // No interactive pull-out: this is a code and description only.
    expect(faircrest2020AliasFor("BSR12")?.evidence).toMatch(/pull-out base/);
    // Settled; BSP6 stays open, BSD6 is settled separately.
    expect(
      FAIRCREST_2020_NEEDS_TOM.some((entry) => /\bBSR12\b/.test(entry.ourCode)),
    ).toBe(false);
    expect(faircrest2020MasterCode("BSD6")).toBe("BSD6");
  });

  it("maps BSD6 to Faircrest BSD6, the base spice drawer (Tom)", () => {
    expect(faircrest2020MasterCode("BSD6")).toBe("BSD6");
    expect(faircrest2020AliasFor("BSD6")).toMatchObject({
      ourCode: "BSD6",
      faircrestCode: "BSD6",
      family: "spice-pullout",
      hands: [],
    });
    expect(faircrest2020SameCabinet("BSD6", "BSD6")).toBe(true);
    // BSD6 is the 5-drawer spice cabinet, not the pull-out bases or BSR9.
    expect(faircrest2020SameCabinet("BSD6", "BSR12")).toBe(false);
    expect(faircrest2020SameCabinet("BSD6", "BSR9")).toBe(false);
    expect(faircrest2020SameCabinet("BSD6", "BT9")).toBe(false);
    // Settled; SP09 stays the only open spice code, and BSP6 is the same cabinet.
    expect(
      FAIRCREST_2020_NEEDS_TOM.some((entry) => /\bBSD6\b/.test(entry.ourCode)),
    ).toBe(false);
    expect(faircrest2020MasterCode("BSP6")).toBe("BSD6");
    expect(faircrest2020MasterCode("SP09")).toBeNull();
    expect(
      FAIRCREST_2020_NEEDS_TOM.some((entry) => /\bSP09\b/.test(entry.ourCode)),
    ).toBe(true);
  });

  it("never matches a wine rack on a guessed measurement (Tom's exact-measurement rule)", () => {
    // These are 30W x 18H racks; no confirmed Faircrest wine code is 30 x 18.
    for (const code of ["WRC3018", "LWR3018", "WXR3018", "WWC630"]) {
      expect(faircrest2020MasterCode(code)).toBeNull();
      expect(faircrest2020AliasFor(code)).toBeNull();
      expect(hasFaircrest2020Alias(code)).toBe(false);
    }
    // WCC3018 is 30 x 18 but its description never says wine: no guess.
    expect(faircrest2020MasterCode("WCC3018")).toBeNull();
    expect(faircrest2020SameCabinet("WRC3018", "WCC3018")).toBe(false);
    // WWR630 is the near candidate for WWC630, and is deliberately not mapped.
    expect(faircrest2020SameCabinet("WWC630", "WWR630")).toBe(false);
    expect(faircrest2020OurCodes("WWR630")).toEqual([]);
    // The 30x15 rack Tom settled earlier is unaffected.
    expect(faircrest2020MasterCode("WRC3015")).toBe("LWR3015");
    // The notes carry the family facts and the never-guess rule.
    const rack = FAIRCREST_2020_NEEDS_TOM.find((entry) =>
      entry.ourCode.startsWith("WRC3018"),
    );
    expect(rack?.why).toMatch(/never guess/);
    expect(rack?.why).toMatch(/lattice insert/);
    expect(rack?.why).toMatch(/flipped/);
  });

  it("maps BSP6 to Faircrest BSD6, the same cabinet as BSD6 (Tom)", () => {
    // Tom: BSP6 = 6" spice cabinet with five drawers, same as BSD6.
    expect(faircrest2020MasterCode("BSP6")).toBe("BSD6");
    expect(faircrest2020AliasFor("BSP6")).toMatchObject({
      ourCode: "BSP6",
      faircrestCode: "BSD6",
      family: "spice-pullout",
      hands: [],
    });
    // Both of our codes name the one Faircrest cabinet.
    expect(faircrest2020MasterCode("BSD6")).toBe("BSD6");
    expect(faircrest2020SameCabinet("BSP6", "BSD6")).toBe(true);
    expect(faircrest2020OurCodes("BSD6")).toEqual(["BSP6", "BSD6"].sort());
    // Still not the 9" tall base or the pull-out bases.
    expect(faircrest2020SameCabinet("BSP6", "BSR9")).toBe(false);
    expect(faircrest2020SameCabinet("BSP6", "BSR12")).toBe(false);
    expect(faircrest2020SameCabinet("BSP6", "BT9")).toBe(false);
    // The note states the cabinet and the drawer count.
    expect(faircrest2020AliasFor("BSP6")?.evidence).toMatch(
      /6" spice cabinet with five drawers/,
    );
    expect(faircrest2020AliasFor("BSP6")?.evidence).toMatch(
      /SAME cabinet as BSD6/,
    );
    // Settled: no longer open. SP09 is the only spice code still open.
    expect(
      FAIRCREST_2020_NEEDS_TOM.some((entry) => /\bBSP6\b/.test(entry.ourCode)),
    ).toBe(false);
    expect(faircrest2020MasterCode("SP09")).toBeNull();
  });

  it("documents SP09 and BSR9 as one cabinet, without adding the alias", () => {
    // Documentation only: no alias yet, SP09 must not resolve to anything.
    expect(faircrest2020MasterCode("SP09")).toBeNull();
    expect(faircrest2020AliasFor("SP09")).toBeNull();
    expect(hasFaircrest2020Alias("SP09")).toBe(false);
    // SP09 and SPO9 are different cabinets.
    expect(faircrest2020SameCabinet("SP09", "SPO9")).toBe(false);
    expect(faircrest2020MasterCode("SPO9")).toBeNull();
    // The note records Tom's confirmation, the lettering rule and the SPO9
    // distinction. It must still make clear no alias exists yet.
    const entry = FAIRCREST_2020_NEEDS_TOM.find(
      (row) => row.ourCode === "SP09",
    );
    expect(entry).toBeDefined();
    // Tom confirmed SP09 and BSR9 are the same cabinet, one item, two codes.
    expect(entry?.why).toMatch(
      /Tom confirmed SP09 and BSR9 are the SAME cabinet/,
    );
    expect(entry?.why).toMatch(/9" spice pull-out/);
    expect(entry?.why).toMatch(/written under two codes/);
    expect(entry?.why).toMatch(/one item, not two configurations/);
    // Tom's lettering rule: T = tray, S = spice.
    expect(entry?.why).toMatch(/T = tray and S = spice/);
    expect(entry?.why).toMatch(
      /BT9 is the tray base and BSR9 is the spice unit/,
    );
    // Carried by every supplier, and still not SPO9.
    expect(entry?.why).toMatch(/carried by every supplier/);
    expect(entry?.why).toMatch(/NOT the same as SPO9/);
    // No alias was added: the note says so and the candidate is not "pending".
    expect(entry?.why).toMatch(/NO alias is added yet/);
    expect(entry?.faircrestCandidate).toMatch(/BSR9/);
    expect(entry?.faircrestCandidate).not.toMatch(/pending Tom confirmation/);
    // BSR9 itself is not aliased to SP09 backwards.
    expect(faircrest2020OurCodes("BSR9")).not.toContain("SP09");
    expect(faircrest2020MasterCode("BSR9")).toBe("BSR9");
  });

  it("documents BT9 / FH9 / FHB9 / 9FH / B9 as one cabinet, without mapping the extras", () => {
    // Documentation only: the added spellings must not gain aliases here.
    for (const code of ["FH9", "FHB9", "9FH", "B9"]) {
      expect(faircrest2020MasterCode(code)).toBeNull();
      expect(faircrest2020AliasFor(code)).toBeNull();
    }
    // BT9 still resolves to Faircrest TB09 as before.
    expect(faircrest2020MasterCode("BT9")).toBe("TB09");
    // The note records Tom's confirmation and flags the extras as doc-only.
    const note = faircrest2020AliasFor("BT9")?.evidence ?? "";
    expect(note).toMatch(/BT9, FH9, FHB9, 9FH and B9 are all the same cabinet/);
    expect(note).toMatch(/under multiple codes/);
    expect(note).toMatch(/not mapped by this PR/);
    // The lettering rule still governs: BSR9 is spice, not this tray/base family.
    expect(faircrest2020SameCabinet("BT9", "BSR9")).toBe(false);
  });

  it("records WWC630 as a 5-spot wine cabinet and keeps it open", () => {
    // No mapping change: WWC630 stays in NEEDS_TOM and resolves to nothing.
    expect(faircrest2020MasterCode("WWC630")).toBeNull();
    expect(hasFaircrest2020Alias("WWC630")).toBe(false);
    expect(
      FAIRCREST_2020_NEEDS_TOM.some((entry) => entry.ourCode === "WWC630"),
    ).toBe(true);
    const entry = FAIRCREST_2020_NEEDS_TOM.find(
      (row) => row.ourCode === "WWC630",
    );
    expect(entry).toBeDefined();
    // Tom's description of the cabinet.
    expect(entry?.why).toMatch(/wine cabinet with five spots for wine holes/);
    // Both readings are valid: the two dimensions are orientations, not a conflict.
    expect(entry?.why).toMatch(/VERTICALLY or HORIZONTALLY/);
    expect(entry?.why).toMatch(/6" W x 30" H/);
    expect(entry?.why).toMatch(/30" W x 6" H/);
    expect(entry?.why).toMatch(
      /both readings are valid depending on orientation/,
    );
    expect(entry?.why).toMatch(/five bottles fit in either orientation/);
    expect(entry?.why).toMatch(/NOT mapped/);
    // The near candidate is still only a candidate.
    expect(entry?.faircrestCandidate).toBe("WWR630");
    expect(faircrest2020SameCabinet("WWC630", "WWR630")).toBe(false);
  });

  it("ships a separate opt-in SQL file to clean a live BSR9 -> BT9 alias", () => {
    const sql = readFileSync(
      new URL("../docs/sql/0267_bsr9_spice_not_tray.tidb.sql", import.meta.url),
      "utf8",
    );
    // It must name BSR9 and BT9 and be delete-only (no inserts, no price writes).
    expect(sql).toContain("'BSR9'");
    expect(sql).toContain("'BT9'");
    expect(sql).toMatch(/DELETE FROM cabinet_dealz\.sku_master_aliases/);
    expect(sql).not.toMatch(/\bINSERT\b/i);
    expect(sql).not.toMatch(/\bUPDATE\b/i);
    // Every table reference is schema-qualified, one statement per line.
    expect(sql).not.toMatch(/IF\s+NOT\s+EXISTS/i);
    for (const line of sql.split("\n")) {
      if (/^\s*(SELECT|DELETE|INSERT|UPDATE)\b/i.test(line)) {
        expect(line).toMatch(/cabinet_dealz\./);
      }
    }
  });

  it("leaves every 'needs Tom' mapping inert", () => {
    for (const entry of FAIRCREST_2020_NEEDS_TOM) {
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
    expect(faircrest2020MasterCode("SP09")).toBeNull();
    expect(faircrest2020MasterCode("BSR9")).toBe("BSR9");
    expect(faircrest2020MasterCode("MW2436")).toBeNull();
    expect(faircrest2020MasterCode("MWD2448")).toBeNull();
  });

  it("resolves ER36 / ER 36 / ER-36 to Faircrest BER36 (Tom confirmed)", () => {
    for (const code of ["ER36", "ER 36", "ER-36", "er36", " er-36 "]) {
      expect(faircrest2020MasterCode(code)).toBe("BER36");
    }
    expect(faircrest2020AliasFor("ER36")).toMatchObject({
      ourCode: "ER36",
      faircrestCode: "BER36",
      hands: ["L", "R"],
      family: "pie-cut-corner",
    });
    // Handed forms resolve through the base, both spellings.
    expect(faircrest2020MasterCode("ER36-L")).toBe("BER36");
    expect(faircrest2020MasterCode("BER36-R")).toBe("BER36");
    expect(faircrest2020SameCabinet("ER36", "BER36")).toBe(true);
    expect(faircrest2020SameCabinet("ER-36", "ERB36")).toBe(true);
    // ER33 was NOT resolved by Tom, so it stays open.
    expect(faircrest2020MasterCode("ER33")).toBeNull();
    expect(faircrest2020MasterCode("ER 33")).toBeNull();
    // ER36 is no longer an open question.
    expect(
      FAIRCREST_2020_NEEDS_TOM.some((entry) => entry.ourCode === "ER36"),
    ).toBe(false);
  });

  it("resolves LS3612 to itself as the Lazy Susan 36 (Tom confirmed)", () => {
    // Tom: LS3612 = Lazy Susan 36, and it is Faircrest's own code.
    expect(faircrest2020MasterCode("LS3612")).toBe("LS3612");
    expect(faircrest2020AliasFor("LS3612")).toMatchObject({
      ourCode: "LS3612",
      faircrestCode: "LS3612",
      hands: ["L", "R"],
      family: "lazy-susan-corner",
    });
    // The 12" door height is family-wide, not an LS3612 special case, so the
    // note must not present it as LS3612's own attribute.
    expect(faircrest2020AliasFor("LS3612")?.evidence).toMatch(/Lazy Susan 36/);
    expect(faircrest2020AliasFor("LS3612")?.evidence).toMatch(
      /12" door height is standard across the Lazy Susan family/,
    );
    expect(faircrest2020MasterCodes("LS3612")).toEqual([
      "LS3612",
      "LS3612L",
      "LS3612R",
    ]);
    // Every spelling of ours that names it still does.
    for (const code of ["LSB36", "LS36", "LS-36", "ls 36", "LS3612"]) {
      expect(faircrest2020MasterCode(code)).toBe("LS3612");
    }
    expect(faircrest2020SameCabinet("LSB36", "LS3612")).toBe(true);
    expect(faircrest2020SameCabinet("LS-36", "LS3612-L")).toBe(true);
    // LS36 is the same cabinet, written without the 12" door-front callout.
    expect(faircrest2020AliasFor("LS36")?.evidence).toMatch(
      /without the 12" door-front callout/,
    );
    expect(faircrest2020SameCabinet("LS36", "LS3612")).toBe(true);
    // The 12 is settled, so it is no longer a needs-Tom number.
    expect(
      FAIRCREST_2020_NEEDS_TOM.some((entry) =>
        /LS3612|LS3312/.test(entry.ourCode),
      ),
    ).toBe(false);
  });

  it("resolves ER2430 / ERW2430 style wall easy reach to Faircrest WER (Tom confirmed)", () => {
    // Tom: Faircrest WER = Wall Easy Reach, 24" wide, L/R.
    for (const [our, faircrest] of [
      ["ER2430", "WER2430"],
      ["ER2436", "WER2436"],
      ["ER2442", "WER2442"],
      ["ERW2430", "WER2430"],
      ["ERW2436", "WER2436"],
      ["ERW2442", "WER2442"],
      ["ER 2436", "WER2436"],
      ["ERW-2442", "WER2442"],
    ] as const) {
      expect(faircrest2020MasterCode(our)).toBe(faircrest);
      // -L/-R handing is preserved on both sides.
      expect(faircrest2020MasterCode(`${our}-L`)).toBe(faircrest);
      expect(faircrest2020MasterCode(`${our}-R`)).toBe(faircrest);
    }
    expect(faircrest2020AliasFor("ERW2436")).toMatchObject({
      faircrestCode: "WER2436",
      hands: ["L", "R"],
      family: "wall-easy-reach-corner",
    });
    expect(faircrest2020SameCabinet("ER2430", "WER2430-R")).toBe(true);
    expect(faircrest2020SameCabinet("ERW2430", "WER2430")).toBe(true);
    // Faircrest has no 35" or 40" wall easy reach, so those stay unmapped.
    expect(faircrest2020MasterCode("WER2435")).toBeNull();
    expect(faircrest2020MasterCode("WER2440")).toBeNull();
    expect(faircrest2020MasterCode("ER2435")).toBeNull();
    expect(faircrest2020MasterCode("ER2440")).toBeNull();
  });

  it("collapses every full-height base 9 spelling to Faircrest TB09 (Tom confirmed)", () => {
    // Tom overrode the earlier BT9FH exclusion: all of these are one cabinet.
    for (const code of [
      "BFH9",
      "B9FH",
      "BT9FH",
      "BT9",
      "BT09",
      "TB9",
      "TB09",
    ]) {
      expect(faircrest2020MasterCode(code)).toBe("TB09");
      // Handing preserved on every spelling.
      expect(faircrest2020MasterCode(`${code}-L`)).toBe("TB09");
      expect(faircrest2020MasterCode(`${code}-R`)).toBe("TB09");
    }
    expect(faircrest2020AliasFor("BT9FH")).toMatchObject({
      faircrestCode: "TB09",
      hands: ["L", "R"],
      family: "full-height-base-9",
    });
    expect(faircrest2020SameCabinet("BT9FH", "BT09")).toBe(true);
    expect(faircrest2020SameCabinet("BFH9", "TB09-L")).toBe(true);
    expect(faircrest2020OurCodes("TB09")).toEqual([
      "B9FH",
      "BFH9",
      "BT09",
      "BT9",
      "BT9FH",
      "TB9",
    ]);
    // BT9PO is a different cabinet and stays out of the full-height collapse.
    expect(faircrest2020MasterCode("BT9PO")).toBeNull();
  });

  it("keeps SPO9 and BT9PO distinct, and maps no spice unit onto BT9PO", () => {
    // Tom: SPO9 = Spice Pullout 9, its own code, NOT an alias of BT9PO.
    expect(faircrest2020MasterCode("SPO9")).toBeNull();
    expect(faircrest2020MasterCode("BT9PO")).toBeNull();
    expect(faircrest2020SameCabinet("SPO9", "BT9PO")).toBe(false);
    expect(faircrest2020SameCabinet("SPO9", "BT9")).toBe(false);
    // The Faircrest base-9 spice/pantry pullouts are NOT regular base-9 pullouts,
    // so none of them may resolve to BT9PO (or anything else).
    for (const code of ["B9-SP", "B9SP", "BPP9"]) {
      expect(faircrest2020MasterCode(code)).toBeNull();
      expect(faircrest2020OurCodes(code)).not.toContain("BT9PO");
    }
    // Both codes are recorded as settled-distinct so nobody folds them later.
    const distinct = FAIRCREST_2020_DISTINCT_CODES.map(
      (entry) => entry.ourCode,
    );
    expect(distinct).toContain("SPO9");
    expect(distinct).toContain("BT9PO");
    // SPO9 looks like a BT9 from the front; the note must say so.
    const spo9 = FAIRCREST_2020_DISTINCT_CODES.find(
      (entry) => entry.ourCode === "SPO9",
    );
    expect(spo9?.why).toMatch(/three spice shelves/);
    expect(spo9?.why).toMatch(/looks the same as a BT9/);
  });

  it("adds no interactive pull-out behaviour or metadata for any pullout code", () => {
    // The app does not animate or open a pull-out; these are aliases and
    // descriptions only. No entry may carry behaviour-ish keys, and the module
    // exports no such API.
    const moduleSource = readFileSync(
      new URL("./faircrest2020Aliases.ts", import.meta.url),
      "utf8",
    );
    for (const forbidden of [
      "pullOut",
      "pulloutOpen",
      "animate",
      "animation",
      "openDrawer",
      "openDoor",
      "interactive",
      "mechanism",
      "onPull",
    ]) {
      expect(moduleSource).not.toMatch(new RegExp(`\\b${forbidden}\\s*:`));
    }
    // Every entry stays the same shape: codes, family, hands, evidence.
    for (const entry of FAIRCREST_2020_ALIASES) {
      expect(Object.keys(entry).sort()).toEqual(
        [
          "evidence",
          "faircrestCode",
          "family",
          "ourCode",
          ...(entry.hands ? ["hands"] : []),
        ].sort(),
      );
    }
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
