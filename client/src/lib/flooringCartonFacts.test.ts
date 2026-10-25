import { describe, expect, it } from "vitest";
import { flooringCartonFacts, formatCartonFact } from "./flooringCartonFacts";

describe("flooring carton facts", () => {
  it("reads the supplier description when coverageSqFt is empty", () => {
    expect(flooringCartonFacts({
      category: "Flooring",
      subCategory: "Planks & Flooring",
      name: "Aviles 20mil Dryback",
      description: "Aviles 20mil Dryback - 17pc/box 41.99sqft/box",
      coverageSqFt: null,
    })).toEqual({ piecesPerBox: 17, sqFtPerBox: 41.99 });
  });

  it("accepts the SF/box wording used on other planks", () => {
    expect(flooringCartonFacts({
      category: "Flooring",
      description: "Astoria 22mil Vinyl Flooring - 5pc/box 18.86 SF/box",
    })).toEqual({ piecesPerBox: 5, sqFtPerBox: 18.86 });
    expect(flooringCartonFacts({
      category: "Flooring",
      description: "Bahia 12mil Vinyl Flooring - 12 pc/box 28.36 sq ft/box",
    })).toEqual({ piecesPerBox: 12, sqFtPerBox: 28.36 });
  });

  it("prefers a real coverageSqFt over the description", () => {
    expect(flooringCartonFacts({
      category: "Flooring",
      description: "12pc/box 28.36 SF/box",
      coverageSqFt: "23.5",
    })).toEqual({ piecesPerBox: 12, sqFtPerBox: 23.5 });
  });

  it("returns dashes-ready nulls instead of a 20 sq ft guess", () => {
    expect(flooringCartonFacts({
      category: "Flooring",
      subCategory: "Planks & Flooring",
      description: "Color only",
      coverageSqFt: null,
    })).toEqual({ piecesPerBox: null, sqFtPerBox: null });
    expect(formatCartonFact(null)).toBe("—");
    expect(formatCartonFact(41.99)).toBe("41.99");
  });

  it("does not treat a sink description as flooring carton math", () => {
    expect(flooringCartonFacts({
      category: "Sinks & Faucets",
      description: "12pc/box 28.36 SF/box",
    })).toBeNull();
  });
});
