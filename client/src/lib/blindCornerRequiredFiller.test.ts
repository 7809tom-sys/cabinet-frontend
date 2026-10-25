import { describe, expect, it } from "vitest";
import {
  BLIND_CORNER_FILLER_WIDTH_IN,
  COUNTERTOP_DEPTH_IN,
  blindCornerRearCountertopExtensionIn,
  countertopSurfaces,
  hasCollision,
  normalizeWallBlindCornerRequiredFillers,
  placedFootprint,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import { buildRequiredBlindCornerFiller, isRequiredBlindCornerFillerGroupId, removePlacedCabinetWithRequiredBlindCornerFiller, requiredBlindCornerFillerGroupId, requiresConfiguredBlindCornerFiller } from "./blindCornerRequiredFiller";

const room: RoomData = { width: 144, depth: 120 };
const fillerCatalog = [{
  id: 501,
  masterCode: "BF-3",
  description: '3" Base Filler',
  category: "Accessories & Trim",
  subCategory: "Filler",
  width: 3,
  height: 34.5,
  depth: null,
  catalogImageUrl: null,
}];
const wallFillerCatalog = [{
  id: 342,
  masterCode: "F342",
  description: '3" × 42" Wall Filler',
  category: "Accessories & Trim",
  subCategory: "Filler",
  width: 3,
  height: 42,
  depth: 0.75,
  catalogImageUrl: null,
}];
const thirtyInchWallFiller = {
  ...wallFillerCatalog[0],
  id: 330,
  masterCode: "F330",
  description: '3" × 30" Wall Filler',
  height: 30,
};

function bbc(patch: Partial<PlacedCabinet> = {}): PlacedCabinet {
  return {
    uid: "bbc",
    cabinetId: 36,
    masterCode: "BBC-36",
    description: '36" Blind Corner Base Cabinet',
    placement: "base",
    x: 0,
    y: 0,
    width: 36,
    height: 34.5,
    depth: 24,
    rotation: 0,
    numberOfDoors: 1,
    numberOfDrawers: 1,
    swing: "right",
    pullMin: 3,
    pullMax: 6,
    blindPull: 3,
    ...patch,
  };
}

function wbc(patch: Partial<PlacedCabinet> = {}): PlacedCabinet {
  return {
    uid: "wbc",
    cabinetId: 2742,
    masterCode: "WBC-27-42",
    description: '27" Blind Corner Wall Cabinet',
    placement: "wall",
    x: 0,
    y: 0,
    width: 27,
    height: 42,
    depth: 12,
    mountBottom: 54,
    rotation: 0,
    numberOfDoors: 1,
    numberOfDrawers: 0,
    swing: "right",
    fillerRequired: true,
    ...patch,
  };
}

describe("mandatory BBC filler", () => {
	  it.each([
	    ["top-left", bbc({ x: 0, y: 3, rotation: 0 }), 0, 27, 90, "left"],
	    ["top-right", bbc({ x: 108, y: 3, rotation: 0, swing: "left" }), 120, 27, 90, "left"],
	    ["bottom-left", bbc({ x: 0, y: 93, rotation: 0 }), 0, 90, 90, "right"],
	    ["bottom-right", bbc({ x: 108, y: 93, rotation: 0, swing: "left" }), 120, 90, 90, "right"],
	    ["left-top", bbc({ x: 3, y: 0, rotation: 90 }), 27, 0, 0, "left"],
	    ["left-bottom", bbc({ x: 3, y: 84, rotation: 90, swing: "left" }), 27, 96, 0, "left"],
	    ["right-top", bbc({ x: 117, y: 0, rotation: 90, swing: "left" }), 114, 0, 0, "right"],
	    ["right-bottom", bbc({ x: 117, y: 84, rotation: 90 }), 114, 96, 0, "right"],
	  ] as const)("places a catalog-backed three-inch filler on the perpendicular adjoining run at %s", (_label, cabinet, x, y, rotation, fillerPlacementMode) => {
    const result = buildRequiredBlindCornerFiller(cabinet, room, fillerCatalog, () => "required-filler", 330011);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.filler).toMatchObject({
      uid: "required-filler",
      cabinetId: 501,
      masterCode: "BF-3",
      x,
      y,
      rotation,
      width: BLIND_CORNER_FILLER_WIDTH_IN,
      depth: 24,
      height: 34.5,
	      styleId: 330011,
	      fillerPlacementMode,
      fillerPieceGroupId: "bbc-required-filler-bbc",
      fillerTotalWidth: 3,
    });
  });

  it("refuses to invent a filler when the selected line has no sellable three-inch source item", () => {
    expect(buildRequiredBlindCornerFiller(bbc(), room, [], () => "none", 330011)).toEqual({
      ok: false,
      reason: "missing-catalog-filler",
    });
  });

	  it.each(["BBC-42", "BBC-48"])("applies the same required filler rule to %s", (masterCode) => {
	    const width = Number(masterCode.split("-")[1]);
	    const cabinet = bbc({ uid: masterCode.toLowerCase(), masterCode, width, nominalWidth: width, x: 0, y: 3 });
	    const result = buildRequiredBlindCornerFiller(cabinet, room, fillerCatalog, () => `${masterCode}-filler`, 330011);
	    expect(result.ok).toBe(true);
	    if (!result.ok) return;
	    expect(result.filler).toMatchObject({ x: 0, y: 27, width: 3, depth: 24, cabinetId: 501, masterCode: "BF-3" });
	  });

  it.each([3, 4, 5, 6])("keeps the required filler fixed at the corner while a top-wall BBC pulls %i inches along its own wall", (pull) => {
    const cabinet = bbc({ x: pull, y: 0, blindPull: pull, wallId: "top", wallOffset: pull });
    const result = buildRequiredBlindCornerFiller(cabinet, room, fillerCatalog, () => `fixed-${pull}`, 330011);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.filler).toMatchObject({ x: 0, y: 24, rotation: 90, width: 3, depth: 24 });
  });

  it("fills exactly between the BBC open front and the adjoining cabinet with edge contact and zero physical overlap", () => {
    const cabinet = bbc({ x: 0, y: 3, rotation: 0 });
    const result = buildRequiredBlindCornerFiller(cabinet, room, fillerCatalog, () => "between", 330011);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const adjoining = bbc({
      uid: "neighbor",
      cabinetId: 18,
      masterCode: "B-18",
      description: '18" Base Cabinet',
      x: 0,
      y: 30,
      width: 18,
      rotation: 90,
      numberOfDrawers: 0,
      pullMin: null,
      pullMax: null,
      blindPull: null,
    });
    expect(result.filler.y).toBe(cabinet.y + 24);
    expect(adjoining.y).toBe(result.filler.y + BLIND_CORNER_FILLER_WIDTH_IN);
	    expect(placedFootprint(cabinet)).toEqual({ w: 36, d: 24 });
	    expect(placedFootprint(result.filler)).toEqual({ w: 24, d: 3 });
	    expect(placedFootprint(adjoining)).toEqual({ w: 24, d: 18 });
	    expect(hasCollision(result.filler, [cabinet])).toBe(false);
	    expect(hasCollision(result.filler, [adjoining])).toBe(false);
    expect(hasCollision({ ...adjoining, y: 29 }, [result.filler])).toBe(true);
  });

	  it("removes the BBC and its mandatory filler together when either member is deleted", () => {
	    const cabinet = bbc({ uid: "assembly", x: 0, y: 3 });
	    const required = buildRequiredBlindCornerFiller(cabinet, room, fillerCatalog, () => "assembly-filler", 330011);
	    expect(required.ok).toBe(true);
	    if (!required.ok) return;
	    const neighbor = bbc({ uid: "keep", masterCode: "B-18", description: '18" Base Cabinet', width: 18, x: 60 });
	    const assembly = [cabinet, required.filler, neighbor];
	    expect(removePlacedCabinetWithRequiredBlindCornerFiller(assembly, cabinet.uid)).toEqual([neighbor]);
	    expect(removePlacedCabinetWithRequiredBlindCornerFiller(assembly, required.filler.uid)).toEqual([neighbor]);
	  });

	  it("survives saved-design JSON round-trip with catalog and billing identity intact", () => {
	    const cabinet = bbc({ uid: "saved-bbc", x: 0, y: 3, styleId: 330011 });
	    const required = buildRequiredBlindCornerFiller(cabinet, room, fillerCatalog, () => "saved-bbc-filler", 330011);
	    expect(required.ok).toBe(true);
	    if (!required.ok) return;
	    const restored = JSON.parse(JSON.stringify([cabinet, required.filler])) as PlacedCabinet[];
	    expect(restored[1]).toMatchObject({
	      uid: "saved-bbc-filler",
	      cabinetId: 501,
	      masterCode: "BF-3",
	      styleId: 330011,
	      fillerBillingRole: "primary",
	      fillerPieceGroupId: "bbc-required-filler-saved-bbc",
	      fillerTotalWidth: 3,
	      width: 3,
	      depth: 24,
	    });
	  });
});

describe("mandatory WBC integrated face filler", () => {
	  it("requires the configured three-inch integrated filler for a WBC without giving it BBC pull behavior", () => {
	    expect(requiresConfiguredBlindCornerFiller(wbc({ fillerRequired: true }))).toBe(true);
	    expect(requiresConfiguredBlindCornerFiller(wbc({ fillerRequired: false }))).toBe(false);
	    expect(requiresConfiguredBlindCornerFiller(bbc())).toBe(true);
	  });

	  it("selects the height-matched real F342 instead of a 30-inch filler for WBC-27-42", () => {
	    const cabinet = wbc();
	    const result = buildRequiredBlindCornerFiller(cabinet, room, [thirtyInchWallFiller, ...wallFillerCatalog], () => "height-match", 330002);
	    expect(result.ok).toBe(true);
	    if (!result.ok) return;
	    expect(result.filler).toMatchObject({ cabinetId: 342, masterCode: "F342", height: 42, nominalHeight: 42 });
	  });

  it.each([
    ["top", wbc({ x: 0, y: 0, rotation: 0 })],
    ["right", wbc({ x: 132, y: 0, rotation: 90 })],
    ["bottom", wbc({ x: 117, y: 108, rotation: 0 })],
    ["left", wbc({ x: 0, y: 93, rotation: 90 })],
  ] as const)("keeps real F342 attached to the %s-wall WBC face with no second physical footprint", (_wall, cabinet) => {
    const result = buildRequiredBlindCornerFiller(cabinet, room, wallFillerCatalog, () => `${cabinet.uid}-f342`, 330002);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.filler).toMatchObject({
      uid: `${cabinet.uid}-f342`,
      cabinetId: 342,
      masterCode: "F342",
      placement: "wall",
      x: cabinet.x,
      y: cabinet.y,
      rotation: cabinet.rotation,
      width: 3,
      depth: 0,
      height: 42,
      mountBottom: 54,
      styleId: 330002,
      fillerPieceGroupId: `wbc-required-filler-${cabinet.uid}`,
      fillerPlacementMode: "left",
      fillerForCabinetUid: cabinet.uid,
      fillerBillingRole: "primary",
      integratedWallBlindFiller: true,
    });
    expect(placedFootprint(result.filler)).toEqual({ w: 0, d: 0 });
    expect(hasCollision(result.filler, [cabinet])).toBe(false);
    expect(requiredBlindCornerFillerGroupId(cabinet)).toBe(`wbc-required-filler-${cabinet.uid}`);
    expect(isRequiredBlindCornerFillerGroupId(result.filler.fillerPieceGroupId)).toBe(true);
  });

  it("upgrades the owner-reported saved BBC-style WBC filler into an integrated left-of-door attachment on restore", () => {
    const cabinet = wbc({ uid: "saved-wbc", x: 132, y: 24, rotation: 90 });
    const legacyFiller: PlacedCabinet = {
      uid: "legacy-f342",
      cabinetId: 342,
      masterCode: "F342",
      description: '3" Wall Filler — required BBC clearance',
      placement: "wall",
      x: 120,
      y: 51,
      width: 3,
      depth: 12,
      height: 42,
      mountBottom: 54,
      rotation: 0,
      numberOfDoors: 0,
      numberOfDrawers: 0,
      fillerPieceGroupId: "bbc-required-filler-saved-wbc",
      fillerBillingRole: "primary",
      fillerTotalWidth: 3,
      fillerPlacementMode: "right",
    };
    const restored = normalizeWallBlindCornerRequiredFillers([cabinet, legacyFiller]);
    expect(restored[0]).toBe(cabinet);
    expect(restored[1]).toMatchObject({
      cabinetId: 342,
      masterCode: "F342",
      x: cabinet.x,
      y: cabinet.y,
      rotation: cabinet.rotation,
      depth: 0,
      fillerPieceGroupId: "wbc-required-filler-saved-wbc",
      fillerPlacementMode: "left",
      fillerForCabinetUid: cabinet.uid,
      integratedWallBlindFiller: true,
    });
    expect(removePlacedCabinetWithRequiredBlindCornerFiller(restored, cabinet.uid)).toEqual([]);
    expect(removePlacedCabinetWithRequiredBlindCornerFiller(restored, legacyFiller.uid)).toEqual([]);
  });
});

describe("pulled BBC countertop wall coverage", () => {
  it.each([
    ["top", bbc({ x: 0, y: 3, rotation: 0 }), { x: 0, y: 0, width: 36, depth: COUNTERTOP_DEPTH_IN + 3 }],
    ["bottom", bbc({ x: 0, y: 93, rotation: 0 }), { x: 0, y: 120 - COUNTERTOP_DEPTH_IN - 3, width: 36, depth: COUNTERTOP_DEPTH_IN + 3 }],
    ["left", bbc({ x: 3, y: 0, rotation: 90 }), { x: 0, y: 0, width: COUNTERTOP_DEPTH_IN + 3, depth: 36 }],
    ["right", bbc({ x: 117, y: 0, rotation: 90 }), { x: 144 - COUNTERTOP_DEPTH_IN - 3, y: 0, width: COUNTERTOP_DEPTH_IN + 3, depth: 36 }],
  ])("extends the countertop back to the %s wall while leaving the cabinet body pulled three inches", (_label, cabinet, expected) => {
    expect(blindCornerRearCountertopExtensionIn(cabinet, room)).toBe(3);
    expect(countertopSurfaces([cabinet], room)[0]).toMatchObject(expected);
  });

	  it.each([
	    ["top", bbc({ x: 0, y: 6, rotation: 0, blindPull: 6 }), { y: 0, depth: COUNTERTOP_DEPTH_IN + 6 }],
	    ["right", bbc({ x: 114, y: 0, rotation: 90, blindPull: 6 }), { x: 144 - COUNTERTOP_DEPTH_IN - 6, width: COUNTERTOP_DEPTH_IN + 6 }],
	  ])("covers the maximum six-inch rear pull at the %s wall", (_label, cabinet, expected) => {
	    expect(blindCornerRearCountertopExtensionIn(cabinet, room)).toBe(6);
	    expect(countertopSurfaces([cabinet], room)[0]).toMatchObject(expected);
	  });
});
