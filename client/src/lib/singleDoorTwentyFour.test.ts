import { describe, expect, it } from "vitest";
import { AEF_PRINTED_GEOMETRY_MARKER } from "@shared/aefFramelessGeometry";
import type { DesignCabinet } from "@/lib/design";
import { standardBaseDoorCount } from "@shared/genericCabinetDrawerReference";
import {
  SINGLE_DOOR_SPLIT_WIDTH_IN,
  defaultPickRows,
  isSingleDoorTwentyFourCode,
  isSingleDoorTwentyFourRow,
  singleDoorTwentyFourReport,
} from "@/lib/singleDoorTwentyFour";
import { autoBuildStraightBaseCatalog } from "@/lib/autoDesignAutoBuild";

function row(masterCode: string, width: number, doors: number, placement: "base" | "wall" = "base"): DesignCabinet {
  return {
    id: masterCode.length + width,
    masterCode,
    description: `${width}" cabinet`,
    category: placement === "base" ? "Base" : "Wall",
    subCategory: null,
    width: String(width),
    height: placement === "base" ? "34.75" : "30.25",
    depth: placement === "base" ? "24" : "13.5",
    placement,
    numberOfDoors: doors,
    numberOfDrawers: 1,
    constructionMethod: AEF_PRINTED_GEOMETRY_MARKER,
  } as DesignCabinet;
}

const book: DesignCabinet[] = [
  row("B21", 21, 1),
  row("B24S", 24, 1),
  row("B24", 24, 2),
  row("B27", 27, 2),
  row("W2430S", 24, 1, "wall"),
  row("W2430", 24, 2, "wall"),
];

describe("two doors at 24 inches and up, one door at 21 inches and under (issue #354 item 4)", () => {
  it("recognises the book's 24 inch single-door codes", () => {
    for (const code of ["B24S", "B24SFH", "SB24S", "SB24SFH", "VSB24S", "W2430S"]) {
      expect(isSingleDoorTwentyFourCode(code)).toBe(true);
    }
    for (const code of ["B24", "B21", "W2430", "W2435", "B24FH"]) {
      expect(isSingleDoorTwentyFourCode(code)).toBe(false);
    }
    expect(SINGLE_DOOR_SPLIT_WIDTH_IN).toBe(24);
  });

  it("keeps the 24 inch single-door rows in the catalog but out of the default picks", () => {
    const picked = defaultPickRows(book).map((entry) => entry.masterCode);
    expect(picked).toContain("B24");
    expect(picked).not.toContain("B24S");
    expect(picked).not.toContain("W2430S");
    expect(isSingleDoorTwentyFourRow(book.find((entry) => entry.masterCode === "B24S")!)).toBe(true);
  });

  it("keeps Auto Design on the two-door base at 24 inches", () => {
    const pool = autoBuildStraightBaseCatalog(book);
    const at24 = pool.filter((entry) => Number(entry.width) === 24);
    expect(at24.map((entry) => entry.masterCode)).toEqual(["B24"]);
  });

  it("draws the standard base reference as two doors at 24 and one at 21", () => {
    expect(standardBaseDoorCount("B21")).toBe(1);
    expect(standardBaseDoorCount("B24")).toBe(2);
    // The single-door variant is a real row, but it is not the drawn default.
    expect(standardBaseDoorCount("B24S")).toBeNull();
  });

  it("reports where the 24 inch single-door rows remain selectable", () => {
    const report = singleDoorTwentyFourReport(book);
    expect(report.map((entry) => entry.masterCode).sort()).toEqual(["B24S", "W2430S"]);
    expect(report.every((entry) => entry.stillSelectableIn.length > 0)).toBe(true);
    expect(report[0]!.stillSelectableIn.join(" ")).toMatch(/never a default/);
    expect(report[0]!.stillSelectableIn.join(" ")).toMatch(/never deleted/);
  });
});
