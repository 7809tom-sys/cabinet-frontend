import { describe, expect, it } from "vitest";
import { applyForecastQuery, emptyForecastQuery, readForecastQuery } from "./salesForecastQuery";

describe("sales forecast query string", () => {
  it("keeps the 2-month and 3-month presets relative and round-trips the other filters", () => {
    const state = {
      ...emptyForecastQuery(),
      query: "oak",
      categories: ["Flooring", "Faucets"],
      doorStyles: ["Shaker"],
      preset: "2m" as const,
      savedFrom: "2020-01-01",
      qtyMin: "2",
      page: 1,
    };
    const params = applyForecastQuery(new URLSearchParams("section=forecast&as=11"), "vf", state);
    expect(params.get("section")).toBe("forecast");
    expect(params.get("as")).toBe("11");
    expect(params.get("vfRange")).toBe("2m");
    expect(params.get("vfFrom")).toBeNull();
    expect(params.get("vfCat")).toBe("Flooring,Faucets");
    expect(params.get("vfStyle")).toBe("Shaker");
    expect(readForecastQuery(params, "vf")).toMatchObject({
      query: "oak",
      categories: ["Flooring", "Faucets"],
      doorStyles: ["Shaker"],
      preset: "2m",
      savedFrom: "",
      qtyMin: "2",
      page: 1,
    });
  });

  it("treats a legacy saved-from date as a custom range", () => {
    const params = new URLSearchParams("sfFrom=2026-01-01&sfStyle=Shaker,Slab");
    expect(readForecastQuery(params, "sf")).toMatchObject({
      preset: "custom",
      savedFrom: "2026-01-01",
      doorStyles: ["Shaker", "Slab"],
    });
  });

  it("clears every forecast key without dropping unrelated params", () => {
    const params = applyForecastQuery(new URLSearchParams("vfQ=oak&vfRange=3m&section=forecast"), "vf", emptyForecastQuery());
    expect(params.toString()).toBe("section=forecast");
  });
});
