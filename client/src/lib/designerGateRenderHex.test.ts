import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { designerGateRenderHex, resolveKitchenDoorColor } from "./acceptedDoorAppearance";

const STYLE = { id: 330002, ourName: "Classic Cream", doorStyle: "Shaker", color: "f9f7eb", renderHex: "#eae5d6", approvedVersionId: null, approvedReferenceImageUrl: null };
const NOW = "2026-11-18T20:00:00.000Z";
const withHex = { ...STYLE, doorColorSource: "hex", doorColorSourceValue: { hex: "#3a6ea5" }, doorColorSourceUpdatedAt: NOW };
const withSherwin = {
  ...STYLE,
  doorColorSource: "sherwin-williams",
  doorColorSourceValue: { finish: "paint", code: "SW 6244", label: "Naval", hex: "#2f3d4c", woodSpecies: null, grainDirection: "none", profileImageUrl: null },
  doorColorSourceUpdatedAt: NOW,
};
const accepted = { ...STYLE, renderHex: "#34363a", approvedVersionId: 9, approvedReferenceImageUrl: "/audit/approved.png" };

const gateHex = (style: typeof STYLE) => designerGateRenderHex(resolveKitchenDoorColor(style as never), style as never);

describe("designerGateRenderHex: the strict Designer gate never sees an explicit pick", () => {
  it("a confirmed hex pick is painted exactly and gives the gate nothing to check", () => {
    expect(resolveKitchenDoorColor(withHex as never).candidateSource).toBe("render-hex");
    expect(gateHex(withHex as never)).toBeNull();
  });

  it("a confirmed Sherwin-Williams pick gives the gate nothing to check", () => {
    expect(gateHex(withSherwin as never)).toBeNull();
  });

  it("an accepted render still feeds the gate, as before", () => {
    expect(gateHex(accepted)).toBe("#34363a");
  });

  it("a hand-set render hex with no pick still feeds the gate, as before", () => {
    expect(gateHex(STYLE)).toBe("#eae5d6");
  });

  it("an Original image choice does not turn the gate off for an accepted render", () => {
    const original = { ...accepted, doorColorSource: "original-image", doorColorSourceUpdatedAt: NOW };
    expect(gateHex(original as never)).toBe("#34363a");
  });

  it("no style, no gate hex", () => {
    expect(designerGateRenderHex({ candidateSource: "catalog-color", candidateHex: "#ffffff" } as never, null)).toBeNull();
  });
});

describe("DesignTool wiring", () => {
  const source = readFileSync(new URL("../pages/DesignTool.tsx", import.meta.url), "utf8");

  it("feeds the 3D Designer's doorRenderHex through designerGateRenderHex", () => {
    expect(source).toMatch(/const designDoorRenderHex = designerGateRenderHex\(designKitchenDoorColor, designStyle/);
    expect(source).toContain("doorRenderHex={designDoorRenderHex}");
    expect(source).not.toMatch(/designDoorRenderHex = designKitchenDoorColor\.candidateSource/);
  });
});
