import { describe, it, expect } from "vitest";
import { computeRenderReadiness, type RenderReadinessInput } from "./renderReadiness";

const base: RenderReadinessInput = {
  cabinetCount: 3,
  builtInFlooringId: "oak-natural",
  hasSurfaceFlooring: false,
  builtInCountertop: true,
  hasSurfaceCountertop: false,
  hasSinkWithFaucet: true,
  hasSurfaceSink: false,
  hasSurfaceFaucet: false,
};

describe("computeRenderReadiness", () => {
  it("is ready when cabinets + flooring + countertop + sink&faucet are all present", () => {
    const r = computeRenderReadiness(base);
    expect(r.ready).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.message).toBe("");
  });

  it("blocks and lists everything on an empty design", () => {
    const r = computeRenderReadiness({
      cabinetCount: 0,
      builtInFlooringId: null,
      hasSurfaceFlooring: false,
      builtInCountertop: false,
      hasSurfaceCountertop: false,
      hasSinkWithFaucet: false,
      hasSurfaceSink: false,
      hasSurfaceFaucet: false,
    });
    expect(r.ready).toBe(false);
    expect(r.missing).toEqual([
      "at least one cabinet",
      "flooring",
      "a countertop",
      "a sink & faucet",
    ]);
    expect(r.message).toBe(
      "Add at least one cabinet, flooring, a countertop, and a sink & faucet to generate your 3D view."
    );
  });

  it("accepts a Pelican flooring pick instead of the built-in flooring", () => {
    const r = computeRenderReadiness({ ...base, builtInFlooringId: null, hasSurfaceFlooring: true });
    expect(r.ready).toBe(true);
  });

  it("accepts a Pelican countertop pick instead of the built-in countertop", () => {
    const r = computeRenderReadiness({ ...base, builtInCountertop: false, hasSurfaceCountertop: true });
    expect(r.ready).toBe(true);
  });

  it("accepts Pelican sink + faucet picks instead of a placed sink with faucet", () => {
    const r = computeRenderReadiness({
      ...base,
      hasSinkWithFaucet: false,
      hasSurfaceSink: true,
      hasSurfaceFaucet: true,
    });
    expect(r.ready).toBe(true);
  });

  it("still blocks when a Pelican sink is picked but no faucet", () => {
    const r = computeRenderReadiness({
      ...base,
      hasSinkWithFaucet: false,
      hasSurfaceSink: true,
      hasSurfaceFaucet: false,
    });
    expect(r.ready).toBe(false);
    expect(r.missing).toEqual(["a sink & faucet"]);
  });

  it("builds a two-item message with 'and'", () => {
    const r = computeRenderReadiness({
      ...base,
      builtInFlooringId: null,
      hasSurfaceFlooring: false,
      builtInCountertop: false,
      hasSurfaceCountertop: false,
    });
    expect(r.message).toBe("Add flooring and a countertop to generate your 3D view.");
  });
});
