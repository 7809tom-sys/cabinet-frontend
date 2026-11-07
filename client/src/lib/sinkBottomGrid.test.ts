import { describe, expect, it } from "vitest";
import {
  bottomGridsForSink,
  bottomGridSinkModels,
  isBottomGridProduct,
  sinkModelCode,
} from "./sinkBottomGrid";

const grid = (id: number, name: string, sellPrice = 72.56, isActive = true) => ({ id, name, sellPrice, isActive });

describe("Pelican sink bottom grids", () => {
  it("reads the one or more sink models a grid name covers", () => {
    expect(bottomGridSinkModels("PL-FC3018SB Bottom Grid")).toEqual(["PL-FC3018SB"]);
    expect(bottomGridSinkModels("pl-100 bottom grid")).toEqual(["PL-100"]);
    expect(bottomGridSinkModels("PL-FC3018SB (old) Bottom Grid")).toEqual(["PL-FC3018SB"]);
    // Pelican sells one grid for several sink models and names each one.
    expect(bottomGridSinkModels("PL-VS7030/PL-VS3070 Bottom Grid")).toEqual(["PL-VS7030", "PL-VS3070"]);
    expect(bottomGridSinkModels("PL-HA108/PL-HA108 ADA Bottom Grid")).toEqual(["PL-HA108"]);
    expect(bottomGridSinkModels("PL-HA126/PL-HA126ADA Bottom Grid")).toEqual(["PL-HA126"]);
    expect(bottomGridSinkModels("PL-VS6040/PL-VS4060/PL-VT6040 Bottom Grid"))
      .toEqual(["PL-VS6040", "PL-VS4060", "PL-VT6040"]);
    expect(bottomGridSinkModels("PL-FC3018SB 16g")).toBeNull();
    expect(bottomGridSinkModels("Basket Strainer Drain")).toBeNull();
    expect(isBottomGridProduct({ name: "PL-300 Bottom Grid", subCategory: "Sink & Faucet Accessories" })).toBe(true);
    expect(isBottomGridProduct({ name: "PL-VS3218 16g", subCategory: "Sinks" })).toBe(false);
  });

  it("strips the finish, gauge, radius, or ADA suffix off a chosen sink SKU", () => {
    expect(sinkModelCode("PL-FC3018SB 16g")).toBe("PL-FC3018SB");
    expect(sinkModelCode("PL-HA108 ADA R0 18g")).toBe("PL-HA108");
    expect(sinkModelCode("PL-HA109 R0 16g")).toBe("PL-HA109");
    expect(sinkModelCode(null)).toBeNull();
  });

  it("returns only the grid made for the chosen sink model", () => {
    const grids = [
      grid(1, "PL-FC3018SB Bottom Grid"),
      grid(2, "PL-FC3318DB Bottom Grid", 87.08),
      grid(3, "PL-300 Bottom Grid", 78.37),
    ];
    expect(bottomGridsForSink("PL-FC3018SB 16g", grids).map((g) => g.id)).toEqual([1]);
    expect(bottomGridsForSink("PL-FC3318DB 18g", grids).map((g) => g.id)).toEqual([2]);
    // A sink with no matching grid offers nothing rather than a near neighbour.
    expect(bottomGridsForSink("PL-VS3218 16g", grids)).toEqual([]);
    expect(bottomGridsForSink(null, grids)).toEqual([]);
  });

  it("offers a shared grid to every sink model it names", () => {
    const grids = [grid(1, "PL-VS7030/PL-VS3070 Bottom Grid", 72.56)];
    expect(bottomGridsForSink("PL-VS7030 16g", grids).map((g) => g.id)).toEqual([1]);
    expect(bottomGridsForSink("PL-VS3070 18g", grids).map((g) => g.id)).toEqual([1]);
    expect(bottomGridsForSink("PL-VS3018 16g", grids)).toEqual([]);
  });

  it("prefers the current grid over a retired '(old)' row and skips unpriced or inactive rows", () => {
    const grids = [
      grid(1, "PL-FC3018SB (old) Bottom Grid", 64.82),
      grid(2, "PL-FC3018SB Bottom Grid", 72.56),
      grid(3, "PL-FC3318DB Bottom Grid", 0),
      grid(4, "PL-300 Bottom Grid", 78.37, false),
    ];
    expect(bottomGridsForSink("PL-FC3018SB", grids).map((g) => g.id)).toEqual([2]);
    expect(bottomGridsForSink("PL-FC3318DB", grids)).toEqual([]);
    expect(bottomGridsForSink("PL-300", grids)).toEqual([]);
  });
});
