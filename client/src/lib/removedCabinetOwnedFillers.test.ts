import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { PlacedCabinet } from "@/lib/design";
import { removedCabinetOwnedFillers } from "./smallGapFiller";

function item(overrides: Partial<PlacedCabinet>): PlacedCabinet {
  return {
    uid: "item",
    cabinetId: 1,
    masterCode: "B24",
    description: "Base cabinet",
    placement: "base",
    x: 0,
    y: 0,
    width: 24,
    depth: 24,
    height: 34.5,
    rotation: 0,
    ...overrides,
  };
}

describe("fillers placed with a cabinet", () => {
  const b36 = item({ uid: "b36", masterCode: "B36", width: 36 });
  const b24 = item({ uid: "b24", masterCode: "B24", x: 37 });
  const b36Filler = item({ uid: "f-left", masterCode: "F342", description: "Filler", width: 1, fillerForCabinetUid: "b36", fillerAttachmentSide: "left" });
  const b24Filler = item({ uid: "f-b24", masterCode: "F342", description: "Filler", width: 1, fillerForCabinetUid: "b24" });
  const looseFiller = item({ uid: "f-loose", masterCode: "F342", description: "Filler", width: 1 });
  const placed = [b36, b24, b36Filler, b24Filler, looseFiller];

  it("returns only the fillers owned by the deleted cabinet", () => {
    expect(removedCabinetOwnedFillers(placed, new Set(["b36"])).map((filler) => filler.uid)).toEqual(["f-left"]);
  });

  it("returns the fillers of every cabinet deleted together", () => {
    expect(removedCabinetOwnedFillers(placed, new Set(["b36", "b24"])).map((filler) => filler.uid)).toEqual(["f-left", "f-b24"]);
  });

  it("leaves fillers with no recorded owner alone", () => {
    expect(removedCabinetOwnedFillers(placed, new Set(["f-loose"]))).toEqual([]);
  });
});

describe("Designer cabinet deletion", () => {
  const source = readFileSync(new URL("../pages/DesignTool.tsx", import.meta.url), "utf8");
  const start = source.indexOf("const removeCabinetsAndReleaseVoid = useCallback(");
  const body = source.slice(start, source.indexOf("const removeCabinetAndReleaseVoid = useCallback(", start));

  it("deletes the fillers placed with a cabinet, and their filler groups, with that cabinet", () => {
    expect(body).toContain("const ownedFillers = removedCabinetOwnedFillers(committed, uidSet);");
    expect(body).toContain("!ownedFillerUids.has(cabinet.uid)");
    expect(body).toContain("ownedFillerGroups.has(cabinet.fillerPieceGroupId)");
  });
});
