import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PANTRY_MASTER_CODES,
  pantryMasterByCode,
  pantryMasterPricesByDistributor,
} from "./pantryMasterCodes";

const sql = readFileSync(
  resolve(__dirname, "../docs/sql/0277_pantry_master_1876.tidb.sql"),
  "utf8",
);

describe("pantry master codes", () => {
  it("orders 1884 as UCB1854 plus the 30 inch stacker", () => {
    expect(pantryMasterByCode("1884")).toMatchObject({
      heightIn: 84,
      confirmedByTom: true,
      components: [
        { code: "UCB1854", role: "base" },
        { code: "W183024", role: "top" },
      ],
    });
  });

  it("adds 1890 and 1896 on the same height sum and leaves them for Tom", () => {
    expect(pantryMasterByCode("1890")?.components.map((part) => part.code)).toEqual(["UCB1854", "W183624"]);
    expect(pantryMasterByCode("1896")?.components.map((part) => part.code)).toEqual(["UCB1854", "W184224"]);
    expect(pantryMasterByCode("1890")?.confirmedByTom).toBe(false);
    expect(pantryMasterByCode("1896")?.confirmedByTom).toBe(false);
  });

  it("stacks 3DB18 on the floor under W184224 for the 76.5 inch pantry", () => {
    expect(pantryMasterByCode("1876")).toMatchObject({
      heightIn: 76.5,
      confirmedByTom: false,
      components: [
        { code: "3DB18", role: "base" },
        { code: "W184224", role: "top" },
      ],
    });
    expect(pantryMasterByCode("1876")?.components.map((part) => part.code)).not.toContain("UCB1854");
  });

  it("does not turn the regular wall code 1830 or W1830 into a pantry master", () => {
    expect(PANTRY_MASTER_CODES.map((master) => master.masterCode)).toEqual(["1884", "1890", "1896", "1876"]);
    expect(pantryMasterByCode("1830")).toBeNull();
    expect(pantryMasterByCode("W1830")).toBeNull();
    for (const master of PANTRY_MASTER_CODES) {
      expect(master.components.map((part) => part.code)).not.toContain("W1830");
      expect(master.components.map((part) => part.code)).not.toContain("W183036");
      expect(master.components.map((part) => part.code)).not.toContain("W183042");
    }
  });

  it("sums each distributor's component prices and leaves a gap NULL", () => {
    const master = pantryMasterByCode("1884")!;
    const prices = pantryMasterPricesByDistributor(master, [
      { componentCode: "UCB1854", distributorId: 1, styleId: 10, listPrice: 100.1, yourCost: 40 },
      { componentCode: "W183024", distributorId: 1, styleId: 10, listPrice: 50.2, yourCost: 20.5 },
      { componentCode: "UCB1854", distributorId: 2, styleId: 10, listPrice: 90, yourCost: 30 },
      { componentCode: "W183024", distributorId: 2, styleId: 10, listPrice: null, yourCost: 15 },
      { componentCode: "UCB1854", distributorId: 1, styleId: 11, listPrice: 80, yourCost: null },
    ]);
    expect(prices).toEqual([
      { distributorId: 1, styleId: 10, listPrice: 150.3, yourCost: 60.5 },
      { distributorId: 1, styleId: 11, listPrice: null, yourCost: null },
      { distributorId: 2, styleId: 10, listPrice: null, yourCost: 45 },
    ]);
  });
});

describe("pantry master SQL", () => {
  const executable = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  it("inserts 1876 and does not update, delete, or redefine W1830", () => {
    expect(executable.some((statement) => /^\s*UPDATE\b/i.test(statement))).toBe(false);
    expect(executable.some((statement) => /^\s*DELETE\b/i.test(statement))).toBe(false);
    const inserts = executable.filter((statement) => statement.startsWith("INSERT"));
    expect(inserts.length).toBeGreaterThan(0);
    for (const statement of inserts) expect(statement).toMatch(/WHERE NOT EXISTS/i);
    const inserted = inserts.join("\n");
    expect(inserted).toContain("'1876'");
    expect(inserted).toContain("'3DB18'");
    expect(inserted).toContain("'W184224'");
    expect(inserted).not.toContain("'UCB1854'");
    expect(executable.some((statement) => statement.includes("'W1830'"))).toBe(false);
    expect(executable.some((statement) => statement.includes("'1830'"))).toBe(false);
  });
});
