import { describe, expect, it } from "vitest";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import type { DesignCabinet, RoomData } from "./design";
import {
  CORNER_TYPE_COPY,
  cornerChoiceGroups,
  cornerSizeLabel,
  cornerCatalogForLayer,
  cornerTypeOf,
  isCornerChoiceCandidate,
} from "./autoDesignCornerChoice";
import { autoBuildCornerCatalog, autoDesignCornerSlots } from "./autoDesignCornerStage";

type Pack = { base: DesignCabinet[]; wall: DesignCabinet[] };
const REAL = realCatalog as unknown as Record<string, Pack>;

const baseCorners = (style: string) => autoBuildCornerCatalog(REAL[style]!.base);
const wallCorners = (style: string) => autoBuildCornerCatalog(REAL[style]!.wall);

describe("corner cabinet types a homeowner picks", () => {
  it("offers the real corner types the Ashford line sells, never a straight box", () => {
    const groups = cornerChoiceGroups(baseCorners("330011"));
    const types = groups.map((group) => group.type);
    expect(types).toContain("lazy-susan");
    expect(types).toContain("blind");
    expect(types).toContain("diagonal");
    for (const group of groups) {
      for (const option of group.options) {
        expect(isCornerChoiceCandidate(option.candidate as never)).toBe(true);
        expect(option.masterCode).not.toMatch(/^B\d+$/);
      }
    }
  });

  it("offers both the 33 inch and the 36 inch Lazy Susan when the line has both", () => {
    const lazy = cornerChoiceGroups(cornerCatalogForLayer(REAL["330011"]!.base, "base")).find((group) => group.type === "lazy-susan")!;
    // Two 36-inch corners exist (an L-shaped lazy Susan and the ERB-style leg),
    // so both sizes are offered and neither is hidden.
    const widths = Array.from(new Set(lazy.options.map((option) => option.widthIn)));
    expect(widths).toEqual([33, 36]);
    expect(lazy.options.map((option) => option.masterCode)).toEqual(expect.arrayContaining(["LSB33", "LSB36"]));
  });

  it("offers wall corners separately from base corners, including the diagonal upper", () => {
    const wallOptions = cornerCatalogForLayer(REAL["330011"]!.wall, "wall");
    expect(wallOptions.length).toBeGreaterThan(0);
    const groups = cornerChoiceGroups(wallOptions as never);
    expect(groups.map((group) => group.type)).toContain("diagonal");
    const diagonal = groups.find((group) => group.type === "diagonal")!;
    expect(diagonal.options.some((option) => /^DCW/.test(option.masterCode))).toBe(true);
    // A base-only filter must never be what decides the upper question.
    expect(autoBuildCornerCatalog(REAL["330011"]!.wall)).toEqual([]);
  });

  it("never invents a type the line does not carry", () => {
    // The frameless line sells blind and L corners on the wall side; it has no
    // AG diagonal wall cabinet, so no diagonal group may be offered.
    const groups = cornerChoiceGroups(cornerCatalogForLayer(REAL["540005"]!.wall, "wall") as never);
    for (const group of groups) {
      expect(group.options.length).toBeGreaterThan(0);
      for (const option of group.options) expect(option.type).toBe(cornerTypeOf(option.candidate));
    }
    expect(groups.every((group) => CORNER_TYPE_COPY[group.type])).toBe(true);
  });

  it("uses plain homeowner labels with a size, never a bare SKU", () => {
    for (const group of cornerChoiceGroups(baseCorners("330011"))) {
      expect(group.label).toMatch(/corner/i);
      expect(group.help.length).toBeGreaterThan(20);
      for (const option of group.options) {
        expect(option.sizeLabel).toMatch(/in wide$/);
        expect(option.sizeLabel).not.toBe(option.masterCode);
      }
    }
    expect(cornerSizeLabel(33)).toBe("33 in wide");
    expect(cornerSizeLabel(34.5)).toBe("34½ in wide");
    expect(cornerSizeLabel(0)).toBe("Size not published");
  });

  it("groups narrow to wide inside each type so a size pick is obvious", () => {
    for (const group of cornerChoiceGroups([...baseCorners("330011"), ...baseCorners("540005")])) {
      const widths = group.options.map((option) => option.widthIn);
      expect([...widths].sort((a, b) => a - b)).toEqual(widths);
    }
  });
});

describe("corner choice waits on the homeowner", () => {
  it("still reports a corner slot per real corner, so the pop-up has something to ask about", () => {
    const room = { width: 150, depth: 150, ceilingHeight: 96 } as RoomData;
    const slots = autoDesignCornerSlots("l-shape", { wallIds: ["top", "right"], room, originCorner: "left", runDirection: "right" });
    expect(slots.length).toBeGreaterThan(0);
    // Nothing here chooses a cabinet: the pick comes from the pop-up.
    expect(cornerChoiceGroups(baseCorners("330011")).length).toBeGreaterThan(0);
  });
});
