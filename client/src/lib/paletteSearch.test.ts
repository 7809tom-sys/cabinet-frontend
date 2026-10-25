import { describe, it, expect } from "vitest";
import { normalizePaletteSearch, matchesPaletteSearch } from "./paletteSearch";

const cab = (over: Partial<{ masterCode: string; description: string; width: string | null; height: string | null }> = {}) => ({
  masterCode: "DB-24-3",
  description: '24" Three Drawer Base',
  width: "24",
  height: "34.5",
  ...over,
});

describe("normalizePaletteSearch", () => {
  it("strips inch markers after a number", () => {
    expect(normalizePaletteSearch('24"')).toBe("24");
    expect(normalizePaletteSearch("24 in")).toBe("24");
    expect(normalizePaletteSearch("24inch")).toBe("24");
    expect(normalizePaletteSearch("24 inches")).toBe("24");
  });
  it("lowercases and trims", () => {
    expect(normalizePaletteSearch("  DB-24  ")).toBe("db-24");
  });
  it("does not strip the 'in' inside words like basin", () => {
    expect(normalizePaletteSearch("basin")).toBe("basin");
  });
});

describe("matchesPaletteSearch", () => {
  it("empty query matches everything", () => {
    expect(matchesPaletteSearch(cab(), "")).toBe(true);
  });
  it("matches by master code", () => {
    expect(matchesPaletteSearch(cab(), normalizePaletteSearch("db-24"))).toBe(true);
  });
  it("matches partial codes even when the typed and catalog separators differ", () => {
    expect(matchesPaletteSearch(cab(), normalizePaletteSearch("db2"))).toBe(true);
    expect(matchesPaletteSearch(cab(), normalizePaletteSearch("DB 24"))).toBe(true);
  });
  it("matches by description text", () => {
    expect(matchesPaletteSearch(cab(), normalizePaletteSearch("drawer"))).toBe(true);
  });
  it("matches a bare width number to a same-width cabinet", () => {
    // A 24"-wide wall cabinet whose code does NOT contain 24 still matches "24".
    const w = cab({ masterCode: "W2430", description: "Wall cabinet", width: "24", height: "30" });
    expect(matchesPaletteSearch(w, normalizePaletteSearch("24"))).toBe(true);
  });
  it('matches width when typed with an inch mark (24")', () => {
    const w = cab({ masterCode: "W2430", description: "Wall cabinet", width: "24", height: "30" });
    expect(matchesPaletteSearch(w, normalizePaletteSearch('24"'))).toBe(true);
  });
  it("does not match a different width", () => {
    const w = cab({ masterCode: "W3030", description: "Wall cabinet", width: "30", height: "30" });
    expect(matchesPaletteSearch(w, normalizePaletteSearch("24"))).toBe(false);
  });
  it("text+number query relies on code/description, not width", () => {
    // "db30" should NOT match a 30"-wide cabinet whose code is W3030.
    const w = cab({ masterCode: "W3030", description: "Wall cabinet", width: "30", height: "30" });
    expect(matchesPaletteSearch(w, normalizePaletteSearch("db30"))).toBe(false);
  });
});
