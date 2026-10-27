import { describe, expect, it } from "vitest";
import { AEF_PRINTED_GEOMETRY_MARKER } from "@shared/aefFramelessGeometry";
import { wallPlacementAt, type PlacedCabinet, type RoomData, type WallOpening } from "./design";
import { aefExposedEndRequirements } from "./aefExposedEnds";
import { selectAefEndPanel } from "./aefEndPanelStock";

const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };
const panelCatalog = [
  { id: 101, masterCode: "WEP1523", constructionMethod: AEF_PRINTED_GEOMETRY_MARKER },
  { id: 102, masterCode: "WEP1530", constructionMethod: AEF_PRINTED_GEOMETRY_MARKER },
  { id: 103, masterCode: "WEP1535", constructionMethod: AEF_PRINTED_GEOMETRY_MARKER },
  { id: 104, masterCode: "WEP1542", constructionMethod: AEF_PRINTED_GEOMETRY_MARKER },
  { id: 105, masterCode: "BEP2535", constructionMethod: AEF_PRINTED_GEOMETRY_MARKER },
];

function place(partial: {
  uid: string;
  masterCode: string;
  placement: PlacedCabinet["placement"];
  offset: number;
  width: number;
  depth: number;
  height: number;
  mountBottom?: number;
  description?: string;
  constructionMethod?: string | null;
}): PlacedCabinet {
  const spot = wallPlacementAt(partial.offset, partial.width, partial.depth, "top", room);
  return {
    uid: partial.uid,
    cabinetId: 1,
    masterCode: partial.masterCode,
    description: partial.description ?? partial.masterCode,
    placement: partial.placement,
    ...spot,
    width: partial.width,
    depth: partial.depth,
    height: partial.height,
    rotation: spot.rotation,
    mountBottom: partial.mountBottom,
    constructionMethod: partial.constructionMethod === undefined
      ? AEF_PRINTED_GEOMETRY_MARKER
      : partial.constructionMethod,
  };
}

const wallTop = (height: number) => 84 - height;

describe("AEF exposed-end panels", () => {
  it("panels one exposed wall end and skips the end butted to an equal cabinet", () => {
    const requirements = aefExposedEndRequirements([
      place({ uid: "left", masterCode: "W3030", placement: "wall", offset: 0, width: 30, depth: 13.5, height: 30.25, mountBottom: wallTop(30.25) }),
      place({ uid: "right", masterCode: "W3030", placement: "wall", offset: 30, width: 30, depth: 13.5, height: 30.25, mountBottom: wallTop(30.25) }),
    ], [], room, panelCatalog);
    expect(requirements).toEqual([
      expect.objectContaining({ cabinetUid: "right", end: "end", masterCode: "WEP1530", cabinetId: 102, pendingSku: false, depth: 14.25, height: 30.25 }),
    ]);
  });

  it("panels both ends of a cabinet with nothing covering either side", () => {
    const requirements = aefExposedEndRequirements([
      place({ uid: "open", masterCode: "W2430", placement: "wall", offset: 36, width: 24, depth: 13.5, height: 30.25, mountBottom: wallTop(30.25) }),
    ], [], room, panelCatalog);
    expect(requirements.map((requirement) => requirement.end).sort()).toEqual(["end", "start"]);
    expect(requirements.every((requirement) => requirement.masterCode === "WEP1530" && requirement.depth === 14.25)).toBe(true);
  });

  it("adds no panel when both ends are covered", () => {
    const middle = place({ uid: "middle", masterCode: "W2430", placement: "wall", offset: 30, width: 24, depth: 13.5, height: 30.25, mountBottom: wallTop(30.25) });
    const requirements = aefExposedEndRequirements([
      place({ uid: "left", masterCode: "W3030", placement: "wall", offset: 0, width: 30, depth: 13.5, height: 30.25, mountBottom: wallTop(30.25) }),
      middle,
      place({ uid: "right", masterCode: "W3030", placement: "wall", offset: 54, width: 30, depth: 13.5, height: 30.25, mountBottom: wallTop(30.25) }),
    ], [], room, panelCatalog);
    expect(requirements.filter((requirement) => requirement.cabinetUid === "middle")).toEqual([]);
  });

  it("treats a shorter or shallower neighbor as a visible side", () => {
    const tall = place({ uid: "tall-wall", masterCode: "W3640", placement: "wall", offset: 0, width: 36, depth: 13.5, height: 40.25, mountBottom: wallTop(40.25) });
    const short = place({ uid: "short-wall", masterCode: "W3030", placement: "wall", offset: 36, width: 30, depth: 13.5, height: 30.25, mountBottom: wallTop(30.25) });
    const deep = place({ uid: "deep-wall", masterCode: "W362324", placement: "wall", offset: 66, width: 36, depth: 24, height: 22.625, mountBottom: wallTop(22.625) });
    const shallow = place({ uid: "shallow-wall", masterCode: "W3023", placement: "wall", offset: 102, width: 30, depth: 13.5, height: 22.625, mountBottom: wallTop(22.625) });
    const requirements = aefExposedEndRequirements([tall, short, deep, shallow], [], room, panelCatalog);

    expect(requirements).toEqual(expect.arrayContaining([
      expect.objectContaining({ cabinetUid: "tall-wall", end: "end", masterCode: "WEP1542", stockHeight: 41.75, height: 40.25, depth: 14.25 }),
      expect.objectContaining({ cabinetUid: "deep-wall", end: "end", masterCode: "TEP3096", pendingSku: true, depth: 24.75, height: 22.625 }),
    ]));
    expect(requirements.some((requirement) => requirement.cabinetUid === "short-wall" && requirement.end === "start")).toBe(false);
    expect(requirements.some((requirement) => requirement.cabinetUid === "shallow-wall" && requirement.end === "start")).toBe(false);
    expect(requirements.find((requirement) => requirement.cabinetUid === "deep-wall")?.masterCode.startsWith("WEP")).toBe(false);
  });

  it("panels the side next to an appliance", () => {
    const requirements = aefExposedEndRequirements([
      place({ uid: "beside-fridge", masterCode: "W3030", placement: "wall", offset: 0, width: 30, depth: 13.5, height: 30.25, mountBottom: wallTop(30.25) }),
      place({ uid: "fridge", masterCode: "FRIDGE-36", placement: "appliance", offset: 30, width: 36, depth: 30, height: 70, description: "36 inch Refrigerator" }),
    ], [], room, panelCatalog);
    expect(requirements).toEqual(expect.arrayContaining([
      expect.objectContaining({ cabinetUid: "beside-fridge", end: "end", masterCode: "WEP1530" }),
    ]));
    expect(requirements.some((requirement) => requirement.cabinetUid === "fridge")).toBe(false);
  });

  it("uses BEP2535 on a base end and cuts it to the cabinet", () => {
    const requirements = aefExposedEndRequirements([
      place({ uid: "base", masterCode: "B24", placement: "base", offset: 0, width: 24, depth: 24, height: 34.75, mountBottom: 0 }),
    ], [], room, panelCatalog);
    expect(requirements).toEqual([
      expect.objectContaining({ cabinetUid: "base", end: "end", masterCode: "BEP2535", cabinetId: 105, pendingSku: false, stockHeight: 35.25, height: 34.75, depth: 24.75 }),
    ]);
  });

  it("flags TEP3096 for a tall cabinet when that sheet is not in the catalog", () => {
    const requirements = aefExposedEndRequirements([
      place({ uid: "pantry", masterCode: "T2484", placement: "tall", offset: 0, width: 24, depth: 24, height: 84.5, mountBottom: 0 }),
    ], [], room, panelCatalog);
    expect(requirements).toEqual([
      expect.objectContaining({
        cabinetUid: "pantry", end: "end", masterCode: "TEP3096", cabinetId: null, pendingSku: true,
        stockWidth: 29.875, stockHeight: 96, height: 84.5, depth: 24.75,
      }),
    ]);
    expect(requirements[0].description).toContain("unpriced");
  });

  it("uses a catalog TEP3096 for a 24-inch refrigerator wall and does not duplicate a window end", () => {
    const window: WallOpening = { uid: "win", kind: "window", side: "top", offset: 48, width: 36, sill: 42, height: 36 };
    const catalog = [...panelCatalog, { id: 106, masterCode: "TEP3096", constructionMethod: AEF_PRINTED_GEOMETRY_MARKER }];
    const requirements = aefExposedEndRequirements([
      place({ uid: "bridge", masterCode: "W362324", placement: "wall", offset: 0, width: 44.25, depth: 24, height: 22.625, mountBottom: wallTop(22.625) }),
    ], [window], room, catalog);
    const ends = requirements.filter((requirement) => requirement.cabinetUid === "bridge");
    expect(ends).toHaveLength(1);
    expect(ends[0]).toMatchObject({ end: "end", windowUid: "win", masterCode: "TEP3096", cabinetId: 106, pendingSku: false, depth: 24.75, height: 22.625 });
  });

  it("lets a butted filler hide the end and ignores framed cabinets", () => {
    const framed = place({
      uid: "framed", masterCode: "W3642", placement: "wall", offset: 24, width: 36, depth: 12, height: 42, mountBottom: 42,
      constructionMethod: "framed",
    });
    const covered = place({ uid: "covered", masterCode: "W3030", placement: "wall", offset: 0, width: 30, depth: 13.5, height: 30.25, mountBottom: wallTop(30.25) });
    const filler = place({
      uid: "filler", masterCode: "OF330", placement: "wall", offset: 30, width: 3, depth: 0.75, height: 30.25, mountBottom: wallTop(30.25),
      description: "3 inch Filler Overlay",
    });
    expect(aefExposedEndRequirements([framed], [], room, panelCatalog)).toEqual([]);
    expect(aefExposedEndRequirements([covered, filler], [], room, panelCatalog).some((requirement) => requirement.cabinetUid === "covered" && requirement.end === "end")).toBe(false);
  });

  it("falls back to a catalog BP9642 only when TEP3096 is absent and the cabinet is no taller than 42 inches", () => {
    const catalog = [...panelCatalog, { id: 107, masterCode: "BP9642", constructionMethod: AEF_PRINTED_GEOMETRY_MARKER }];
    const wall = selectAefEndPanel("wall", 24, 22.625, catalog);
    const tall = selectAefEndPanel("tall", 24, 84.5, catalog);
    expect(wall).toMatchObject({ masterCode: "BP9642", cabinetId: 107, pendingSku: false, height: 22.625, depth: 24.75 });
    expect(tall).toMatchObject({ masterCode: "TEP3096", cabinetId: null, pendingSku: true, height: 84.5 });
  });
});
