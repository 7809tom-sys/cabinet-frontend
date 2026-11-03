/**
 * Tom's color-pipeline debugging: the `?colorTrace=1` recorder.
 *
 * The trace has to answer "which layer won, what overrode it, and what hex each
 * surface actually got" without changing anything. These tests pin the recorder's
 * behaviour, its admin-only gate, and the mismatch signal that makes the Brewers
 * test meaningful.
 */
import { describe, expect, it } from "vitest";
import { colorTraceEnabled, colorTraceToText, createColorTraceRecorder } from "./colorTrace";
import { resolveDoorColor } from "@shared/doorColorResolve";

describe("the color trace is admin-only and opt-in", () => {
  it("turns on only for an admin with ?colorTrace=1", () => {
    expect(colorTraceEnabled({ search: "?colorTrace=1", isAdmin: true })).toBe(true);
    expect(colorTraceEnabled({ search: "colorTrace=1", isAdmin: true })).toBe(true);
    expect(colorTraceEnabled({ search: "?colorTrace=true", isAdmin: true })).toBe(true);
  });

  it("never turns on for a shopper, or without the flag", () => {
    expect(colorTraceEnabled({ search: "?colorTrace=1", isAdmin: false })).toBe(false);
    expect(colorTraceEnabled({ search: "", isAdmin: true })).toBe(false);
    expect(colorTraceEnabled({ search: "?colorTrace=0", isAdmin: true })).toBe(false);
    expect(colorTraceEnabled({ search: null, isAdmin: true })).toBe(false);
  });
});

describe("the trace records the whole pipeline for a cabinet", () => {
  const style = {
    id: 330021,
    styleCode: "SH",
    ourName: "Shaker Honey",
    color: "#c8a040",
    renderHex: "#d9c9a3",
    approvedVersionId: 42,
  };
  const identity = { cabinetUid: "cab-1", masterCode: "SB30", styleId: 330021, styleCode: "SH" };

  it("records accepted run, saved color, candidates, the winner, and each surface", () => {
    let now = 1000;
    const recorder = createColorTraceRecorder(() => (now += 10));
    const decision = resolveDoorColor(style);
    recorder.recordResolver(identity, decision, "2026-11-03T20:03:00Z");
    recorder.override(identity, { key: "override.savedDesign", detail: "design cabinetFinish #111111", hex: "#111111" });
    recorder.surface(identity, "front", "#d9c9a3");
    recorder.surface(identity, "box", "#d9c9a3");
    recorder.surface(identity, "sides", "#d9c9a3");
    recorder.surface(identity, "skin", "#d9c9a3");
    const trace = recorder.finish();

    expect(trace.cabinets).toHaveLength(1);
    const keys = trace.cabinets[0]!.steps.map((step) => step.key);
    expect(keys).toContain("style.accepted");
    expect(keys).toContain("style.saved");
    expect(keys).toContain("candidates.fallback");
    expect(keys).toContain("layer.won");
    expect(keys).toContain("override.savedDesign");
    expect(keys).toContain("surface.front");
    expect(keys).toContain("surface.box");
    // Timestamps are ordered so a person can read the sequence.
    const times = trace.cabinets[0]!.steps.map((step) => step.atMs);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(trace.mismatches).toEqual([]);
    expect(trace.cabinets[0]!.surfacesAgree).toBe(true);
  });

  it("names the surface mismatch, which is the whole point", () => {
    const recorder = createColorTraceRecorder();
    const decision = resolveDoorColor(style);
    recorder.recordResolver(identity, decision);
    recorder.surface(identity, "front", "#d9c9a3");
    recorder.surface(identity, "box", "#c8a040");
    const trace = recorder.finish();
    expect(trace.cabinets[0]!.surfacesAgree).toBe(false);
    expect(trace.mismatches).toHaveLength(1);
    expect(trace.mismatches[0]!.surfaces.map((entry) => entry.surface)).toEqual(["front", "box"]);
    expect(colorTraceToText(trace)).toContain("MISMATCH");
  });

  it("says what won, and what a later override replaced it with", () => {
    const recorder = createColorTraceRecorder();
    recorder.recordResolver(identity, resolveDoorColor(style));
    recorder.override(identity, { key: "override.cabinetFinish", detail: "saved design forced #000000", hex: "#000000" });
    const trace = recorder.finish();
    const won = trace.cabinets[0]!.steps.find((step) => step.key === "layer.won")!;
    // `style` carries an approvedVersionId, so this is the accepted render.
    expect(won.detail).toContain("accepted-render");
    expect(won.hex).toBe("#d9c9a3");
    const accepted = trace.cabinets[0]!.steps.find((step) => step.key === "style.accepted")!;
    expect(accepted.detail).toContain("#d9c9a3");
    expect(accepted.source).toBe("accepted-render");
    const override = trace.cabinets[0]!.steps.find((step) => step.key === "override.cabinetFinish")!;
    expect(override.hex).toBe("#000000");
  });

  it("names a hand-set render hex as such when no run was accepted", () => {
    const recorder = createColorTraceRecorder();
    recorder.recordResolver(identity, resolveDoorColor({ ...style, approvedVersionId: null }));
    const won = recorder.finish().cabinets[0]!.steps.find((step) => step.key === "layer.won")!;
    expect(won.detail).toContain("render-hex");
    expect(won.hex).toBe("#d9c9a3");
  });

  it("handles a style with no accepted run", () => {
    const recorder = createColorTraceRecorder();
    recorder.recordResolver(identity, resolveDoorColor({ ...style, renderHex: null, approvedVersionId: null }));
    const trace = recorder.finish();
    const accepted = trace.cabinets[0]!.steps.find((step) => step.key === "style.accepted")!;
    expect(accepted.detail).toMatch(/No accepted door-rendering run/);
    expect(accepted.hex).toBeNull();
  });

  it("renders a readable console block", () => {
    const recorder = createColorTraceRecorder();
    recorder.recordResolver(identity, resolveDoorColor(style));
    recorder.surface(identity, "front", "#d9c9a3");
    const text = colorTraceToText(recorder.finish());
    expect(text).toContain("[colorTrace]");
    expect(text).toContain("SB30");
    expect(text).toContain("front=#d9c9a3");
  });
});
