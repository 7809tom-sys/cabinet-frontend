import { describe, expect, it } from "vitest";
import { isBaseBlindCorner, isBlindCorner, isCornerCabinet, isPlainBaseCode } from "./design";
import { autoBuildCornerCatalog, autoDesignCornerFamily, isAutoDesignBlindCornerOption, preferredAutoDesignCorner } from "./autoDesignCornerStage";

// Tom (Oct 31): corner and blind status comes from the model code (or a stored cornerType), never from words in the
// description. A B42 is a normal base cabinet even when its description says "corner" or "blind".
const plainBases = [
  { code: "B42", description: '42" Corner Base Cabinet' },
  { code: "B42", description: '42" Blind Corner Base Cabinet' },
  { code: "B24", description: '24" Base Cabinet for the blind corner' },
  { code: "B36", description: '36" Diagonal Corner Base' },
  { code: "SB36", description: "36 inch sink base, corner" },
  { code: "DB18", description: "18 inch drawer base, lazy susan style" },
  { code: "3DB24", description: "Three drawer base, easy reach" },
];

describe("corner and blind status come from the code, not the description", () => {
  for (const { code, description } of plainBases) {
    it(`${code} (“${description}”) is a normal base: not a corner, not blind, no corner family`, () => {
      expect(isPlainBaseCode(code)).toBe(true);
      expect(isCornerCabinet(code, description)).toBe(false);
      expect(isCornerCabinet(code, description, "blind-corner")).toBe(false); // a stored type does not override a plain-base code
      expect(isBlindCorner(code, description)).toBe(false);
      expect(isBlindCorner(code, description, "blind-corner")).toBe(false);
      expect(isBaseBlindCorner({ masterCode: code, description, placement: "base", cornerType: "blind-corner" })).toBe(false);
      expect(autoDesignCornerFamily({ masterCode: code, description, cornerType: null })).toBe("other");
      expect(autoDesignCornerFamily({ masterCode: code, description, cornerType: "blind-corner" })).toBe("other");
    });
  }

  it("real corners still classify as corners", () => {
    for (const code of ["LS36", "LS3612", "LSB33", "BBC42", "BBC37/40FH", "DCB36", "DCSB36", "BER33", "ERB33", "BLB36", "CDB36", "WBC24/2730", "WDC2442", "CSB36"]) {
      expect(isCornerCabinet(code, "")).toBe(true);
    }
    expect(isPlainBaseCode("BBC42")).toBe(false);
    expect(isPlainBaseCode("BLB36")).toBe(false);
    expect(isPlainBaseCode("BER33")).toBe(false);
  });

  it("real blind corners are still blind, by code or stored type; a description alone is not enough", () => {
    expect(isBlindCorner("BBC42", "")).toBe(true);
    expect(isBlindCorner("WBC24/2730", "")).toBe(true);
    expect(isBlindCorner("XYZ36", "", "blind-corner")).toBe(true);
    expect(isBlindCorner("XYZ36", "36 inch blind corner cabinet")).toBe(false);
    expect(isBaseBlindCorner({ masterCode: "BBC42", description: "", placement: "base" })).toBe(true);
  });

  it("a stored cornerType still makes a non-prefixed row a corner, and families come from code or type only", () => {
    expect(isCornerCabinet("XYZ36", "", "l-shape")).toBe(true);
    expect(isCornerCabinet("XYZ36", "36 inch corner cabinet")).toBe(false);
    expect(autoDesignCornerFamily({ masterCode: "LS36", description: "", cornerType: null })).toBe("lazy-susan");
    expect(autoDesignCornerFamily({ masterCode: "DCB36", description: "", cornerType: null })).toBe("diagonal");
    expect(autoDesignCornerFamily({ masterCode: "BBC42", description: "", cornerType: null })).toBe("blind");
    expect(autoDesignCornerFamily({ masterCode: "XYZ36", description: "blind corner", cornerType: null })).toBe("other");
    expect(isAutoDesignBlindCornerOption({ masterCode: "B42", description: "blind corner", placement: "base", cornerType: null })).toBe(false);
  });

  it("description-only look-alikes that are not corner cabinets stay out (kits, mouldings, glass doors)", () => {
    expect(isCornerCabinet("DCFF42", "42\" Diagonal Corner Sink Front & Floor Kit")).toBe(false);
    expect(isCornerCabinet("DCSF42", "42\" Diagonal Corner Sink Front")).toBe(false);
    expect(isCornerCabinet("OCM", "Outside Corner Moulding")).toBe(false);
    expect(isCornerCabinet("PGWDC36", "Plain Glass Door Only; fits DCW243")).toBe(false);
  });

  it("Auto-Design picks the 36-inch corner, not a B42 with 'corner' in its description", () => {
    const row = (id: number, masterCode: string, width: string, description: string, cornerType: string | null = null) => ({
      id, masterCode, width, description, cornerType, placement: "base" as const, isCornerCabinet: true,
    });
    const catalog = [
      row(1, "B42", "42", '42" Blind Corner Base Cabinet'),
      row(2, "B24", "24", '24" Corner Base'),
      row(3, "LS36", "36", '36" Lazy Susan', "lazy-susan"),
      row(4, "BBC42", "42", '42" Blind Base Corner Cabinet', "blind-corner"),
    ];
    const corners = autoBuildCornerCatalog(catalog as never[]);
    expect(corners.map((c: { masterCode: string }) => c.masterCode).sort()).toEqual(["BBC42", "LS36"]);
    const picked = preferredAutoDesignCorner(corners as never[]) as { masterCode: string } | null;
    expect(picked?.masterCode).toBe("LS36");
  });
});
