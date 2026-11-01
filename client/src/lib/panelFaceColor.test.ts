import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveSwatch } from "@/components/DoorStyleSwatch";
import { finishColors } from "@/lib/design";
import { matchCabinetColorName } from "@shared/cabinetColorNames";
import { RUN_PANEL_FACES, runPanelFaceColors } from "./panelFaceColor";

const RUST = "#b5603a";

describe("Forest Rust panel faces", () => {
  it("resolves every panel face of a Forest Rust run to the same rust color", () => {
    const faces = runPanelFaceColors("Forest Rust");
    const colors = RUN_PANEL_FACES.map((face) => faces[face]);
    expect(new Set(colors)).toEqual(new Set([RUST]));
    expect(finishColors("Forest Rust", "Hickory").face.toLowerCase()).toBe(RUST);
    expect(matchCabinetColorName("Forest Rust Hickory")?.toLowerCase()).toBe(RUST);
    expect(resolveSwatch({ ourName: "Forest Rust" }).face.toLowerCase()).toBe(RUST);
  });

  it("still paints forest green green, and does not use a hickory grain fallback", () => {
    expect(finishColors("Forest Green").face.toLowerCase()).not.toBe(RUST);
    expect(matchCabinetColorName("Forest Green")?.toLowerCase()).not.toBe(RUST);
    expect(finishColors("rustic hickory").face.toLowerCase()).not.toBe(RUST);
    const facePlan = readFileSync(new URL("./designerFacePlan.ts", import.meta.url), "utf8");
    expect(facePlan).not.toContain("rustic_hickory_vertical_grain");
    expect(facePlan).not.toContain("rustic hickory|forest rust");
  });
});
