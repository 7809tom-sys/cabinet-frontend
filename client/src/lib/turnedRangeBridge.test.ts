// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ElevationView } from "@/components/design/ElevationView";
import { doorCountForCabinet, hardwareForCabinet, hardwareSchedule } from "./hardware";
import {
  normalizePlacedWallCabinetSkuDimensions,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import { applyDesignerLayoutRules } from "./designerLayoutRules";
import { buildDesignCabinetCartLines } from "./designCartLines";
import {
  overRangeBridgeFor,
  overRangeCompanionPlacements,
  planOverRangeCompanions,
  turnableBridgeGeometry,
} from "./overRangeCompanion";
import { placeMandatoryOverRangeBridges } from "./overRangeFill";
import {
  rangeBridgeHeightChoices,
  rangeCompanionDetail,
  rangeCompanionPlacement,
  rangeCompanionProposal,
} from "./rangeCompanion";
import { addCabinet, existingCabinetSku, existingCabinetTransform } from "@/components/design/InteractiveRoom3D";

const room: RoomData = { width: 168, depth: 120, ceilingHeight: 96 };

const wallRow = (width: number, height: number, doors: number | null = width >= 24 ? 2 : 1): DesignCabinet => ({
  id: width * 100 + height,
  masterCode: `W${width}${height}`,
  description: `${width}" x ${height}" x 12" Wall Cabinet - ${doors ?? "?"} Door${doors === 1 ? "" : "s"}`,
  category: "Wall Cabinets",
  subCategory: "Wall",
  width: String(width),
  height: String(height),
  depth: "12",
  placement: "wall",
  numberOfDoors: doors,
  numberOfDrawers: 0,
} as DesignCabinet);
/** A line with no 36"-wide bridge, but W12-W24 x 36 uppers and 30"-wide bridges. */
const line36 = (skipWidths: number[] = []) => [
  ...[12, 15, 18, 21, 24, 30, 36].filter((width) => !skipWidths.includes(width)).map((width) => wallRow(width, 36)),
  ...[12, 15, 18, 21, 24].map((height) => wallRow(30, height, 2)),
];
const mw36 = {
  id: 9036, masterCode: "MW-36", description: "Over-Range Microwave 36\"", category: "Appliance", subCategory: "Microwave",
  width: "36", height: "16", depth: "16", placement: "appliance", numberOfDoors: 0, numberOfDrawers: 0,
} as DesignCabinet;

function item(partial: Partial<PlacedCabinet> & Pick<PlacedCabinet, "uid" | "masterCode">): PlacedCabinet {
  return { cabinetId: 1, description: "", placement: "wall", x: 0, y: 0, width: 30, depth: 12, height: 30, rotation: 0, ...partial };
}
const range36 = item({ uid: "range", masterCode: "RANGE-36", description: "36 inch Range", placement: "appliance", x: 48, width: 36, depth: 26, height: 36 });
const neighbors = (height: number) => [
  item({ uid: "left", masterCode: `W15${height}`, description: `15x${height} Wall Cabinet`, x: 33, width: 15, height, mountBottom: 54 }),
  item({ uid: "right", masterCode: `W15${height}`, description: `15x${height} Wall Cabinet`, x: 84, width: 15, height, mountBottom: 54 }),
];
const proposalFor = (neighborHeight: number, wallCatalog = line36(), bridgeHeightIn?: number) =>
  rangeCompanionProposal(range36, room, wallCatalog, [mw36], neighborHeight, {
    placed: [range36, ...neighbors(neighborHeight)], lineName: "Natura Maple", bridgeHeightIn,
  });

describe("a single-door wall cabinet turned horizontal as the range bridge (Tom, Nov 9)", () => {
  it("offers W1236/W1536/W1836/W2136 turned at 12/15/18/21 and never a two-door W2436", () => {
    const choices = rangeBridgeHeightChoices({ rangeWidthIn: 36, wallCatalog: line36(), ceilingIn: 96, lineName: "Natura Maple" });
    expect(choices.map((choice) => [choice.heightIn, choice.label, choice.topIn, choice.turned])).toEqual([
      [12, "W1236 turned horizontal", 84, true],
      [15, "W1536 turned horizontal", 87, true],
      [18, "W1836 turned horizontal", 90, true],
      [21, "W2136 turned horizontal", 93, true],
      [23, null, 95, false],
      [24, null, 96, false],
    ]);
    // The turned view is as wide as the range; the 30" bridges are never used.
    for (const choice of choices.slice(0, 4)) {
      expect([Number(choice.bridge!.width), Number(choice.bridge!.height), choice.bridge!.turnedSideways]).toEqual([36, choice.heightIn, true]);
    }
    expect(choices.find((choice) => choice.heightIn === 24)!.disabledReason).toBe("W3624 is not in the Natura Maple catalog, and a two-door W2436 cannot be turned horizontal.");
    // 23 is never turned: a turned bridge only exists at 12/15/18/21.
    expect(choices.find((choice) => choice.heightIn === 23)!.bridge).toBeNull();
  });

  it("never turns W2436 or any SKU the catalog lists with two doors; uses width when the door count is missing", () => {
    expect(turnableBridgeGeometry(wallRow(24, 36, 2), 36)).toBeNull();
    // Even a row mislabelled as single-door is never turned at 24".
    expect(turnableBridgeGeometry(wallRow(24, 36, 1), 36)).toBeNull();
    expect(turnableBridgeGeometry(wallRow(24, 36, null), 36)).toBeNull();
    // The catalog's door count wins: an 18" listed with two doors is not turned.
    expect(turnableBridgeGeometry(wallRow(18, 36, 2), 36)).toBeNull();
    expect(turnableBridgeGeometry(wallRow(18, 36, null), 36)).toMatchObject({ turnedHeightIn: 18 });
    // Only a cabinet exactly as tall as the range is wide; never narrower than the range.
    expect(turnableBridgeGeometry(wallRow(18, 30), 36)).toBeNull();
    const twoDoor18 = line36([18]).concat(wallRow(18, 36, 2));
    const choices = rangeBridgeHeightChoices({ rangeWidthIn: 36, wallCatalog: twoDoor18, ceilingIn: 96 });
    expect(choices.find((choice) => choice.heightIn === 18)!.bridge).toBeNull();
    expect(choices.some((choice) => choice.bridge?.masterCode === "W2436")).toBe(false);
  });

  it.each([
    [30, 12, "W1236"],
    [36, 18, "W1836"],
    // 42" pairs to 24, which is never turned: the shared fallback keeps 12/18 and takes 18.
    [42, 18, "W1836"],
  ])("preselects for %i-inch neighbours the %i-inch turned %s, in the pop-up and Auto Design alike", (neighborHeight, height, sku) => {
    const proposal = proposalFor(neighborHeight)!;
    expect([proposal.bridgeHeightIn, proposal.bridge?.masterCode, proposal.bridge?.turnedSideways]).toEqual([height, sku, true]);
    expect(overRangeBridgeFor({ rangeWidthIn: 36, wallCabinetHeightIn: neighborHeight, wallCatalog: line36(), ceilingIn: 96 })?.masterCode).toBe(sku);
    const build = planOverRangeCompanions({
      answer: "microwave-bridge", placed: [range36], room, appliancePalette: [mw36], wallCatalog: line36(), wallCabinetHeightIn: neighborHeight,
    });
    expect(build.ok).toBe(true);
    if (!build.ok) return;
    let n = 0;
    const bridge = overRangeCompanionPlacements(build.plan, { makeUid: () => `u${++n}`, styleId: 7 }).find((cabinet) => cabinet.placement === "wall")!;
    expect(bridge).toMatchObject({ masterCode: sku, cabinetId: Number(sku.slice(1, 3)) * 100 + 36, width: 36, height, depth: 12, mountBottom: 72, turnedSideways: true });
  });

  it("keeps a missing turned SKU disabled with a reason, and refuses when nothing at the range width exists", () => {
    const choices = rangeBridgeHeightChoices({ rangeWidthIn: 36, wallCatalog: line36([15]), ceilingIn: 96, lineName: "Natura Maple" });
    expect(choices.find((choice) => choice.heightIn === 15)!.disabledReason).toBe("Neither W3615 nor a single-door W1536 to turn horizontal is in the Natura Maple catalog.");
    expect(choices.find((choice) => choice.heightIn === 18)!.label).toBe("W1836 turned horizontal");
    // Neither a 36" bridge nor a single-door 12-21" x 36" upper: refuse, never a 30" bridge.
    const none = proposalFor(36, line36([12, 15, 18, 21]))!;
    expect(none.bridge).toBeNull();
    expect(none.bridgeUnavailableReason).toBe("The Natura Maple line sells no 36″-wide bridge (W3612–W3624) and no single-door W1236–W2136 to turn horizontal for this 36″ range, so no cabinet can be added over the microwave.");
    expect(overRangeBridgeFor({ rangeWidthIn: 36, wallCabinetHeightIn: 36, wallCatalog: line36([12, 15, 18, 21]) })).toBeNull();
    const build = planOverRangeCompanions({
      answer: "microwave-bridge", placed: [range36], room, appliancePalette: [mw36], wallCatalog: line36([12, 15, 18, 21]), wallCabinetHeightIn: 36,
    });
    expect(build.ok).toBe(false);
    if (build.ok) return;
    expect(build.findings.find((finding) => finding.code === "no-matching-bridge")?.detail).toBe(
      "The selected door line sells no 36″-wide bridge (W3612–W3624) and no single-door W1236–W2136 to turn horizontal for this 36″ range, so no cabinet can be added over the microwave.",
    );
    const seated = { ...range36, wallId: "top", wallOffset: 48 };
    const fill = placeMandatoryOverRangeBridges({
      placed: [seated], room, wallCatalog: line36([12, 15, 18, 21]), wallCabinetHeightIn: 36, styleId: 7, makeUid: () => "fill",
    });
    expect(fill.placed.filter((cabinet) => cabinet.placement === "wall")).toEqual([]);
    expect(fill.findings.map((finding) => finding.detail).join(" ")).toContain("sells no 36″-wide bridge (W3612–W3624) and no single-door W1236–W2136 to turn horizontal for this 36″ range, so no cabinet can be added over the range.");
    // With the turnable uppers, the mandatory bridge is the turned W1836 at 36 wide.
    const turnedFill = placeMandatoryOverRangeBridges({
      placed: [seated], room, wallCatalog: line36(), wallCabinetHeightIn: 36, styleId: 7, makeUid: () => "fill",
    });
    expect(turnedFill.placed.find((cabinet) => cabinet.placement === "wall")).toMatchObject({ masterCode: "W1836", width: 36, height: 18, turnedSideways: true });
  });

  it("does not turn a cabinet when the line sells a real bridge at the range width", () => {
    const withBridge = [...line36(), wallRow(36, 18, 2)];
    const choices = rangeBridgeHeightChoices({ rangeWidthIn: 36, wallCatalog: withBridge, ceilingIn: 96 });
    expect(choices.some((choice) => choice.turned)).toBe(false);
    expect(choices.find((choice) => choice.heightIn === 18)!.label).toBe("W3618");
  });

  it("places, keeps and bills the real W1836 turned 36 wide x 18 tall x 12 deep", () => {
    const proposal = proposalFor(36)!;
    expect(rangeCompanionDetail(proposal)).toBe("The 16″ MW-36 runs from 56″ to 72″. The selected real W1836 turned horizontal begins at 72″ with no gap or trim and ends at 90″.");
    const bridge = rangeCompanionPlacement(proposal.bridge!, proposal.bridgeSpot, proposal.bridgeMountBottom, "bridge", 7);
    expect(bridge).toMatchObject({ cabinetId: 1836, masterCode: "W1836", width: 36, height: 18, depth: 12, mountBottom: 72, turnedSideways: true, overRangeMicrowaveBridge: true });
    // The SKU repair would otherwise reset W1836 to 18 x 36.
    expect(normalizePlacedWallCabinetSkuDimensions(bridge)).toMatchObject({ width: 36, height: 18 });
    const microwave = rangeCompanionPlacement(proposal.microwave, proposal.microwaveSpot, proposal.microwaveMountBottom, "mw", null);
    const laidOut = applyDesignerLayoutRules({
      placed: [range36, ...neighbors(36), microwave, bridge], room, openings: [], fillers: [], makeUid: () => "uid", styleId: 7, allowAutoFillers: false,
    }).placed.find((cabinet) => cabinet.uid === "bridge")!;
    expect(laidOut).toMatchObject({ masterCode: "W1836", width: 36, height: 18, mountBottom: 72, turnedSideways: true });
    const lines = buildDesignCabinetCartLines({
      placed: [bridge, microwave], styleId: 7, distributorId: 4, tier: "homeowner",
      styleNameById: new Map([[7, "Natura Maple"]]), unitPriceFor: () => 210,
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ masterCode: "W1836", qty: 1, unitPrice: 210 });
  });

  it("draws the upright W1836 turned 90 degrees in 3D: 36 wide x 18 tall x 12 deep from 72 to 90", () => {
    const proposal = proposalFor(36)!;
    const bridge = rangeCompanionPlacement(proposal.bridge!, proposal.bridgeSpot, proposal.bridgeMountBottom, "bridge", 7);
    const sku = existingCabinetSku(bridge, room, [range36, bridge]);
    expect([sku.width, sku.height, sku.turnedSideways]).toEqual([18, 36, true]);
    const build = (cabinet: PlacedCabinet) => {
      const root = new THREE.Group();
      addCabinet(root, existingCabinetSku(cabinet, room, [cabinet]), null, {}, room.width, room.depth, "#c8b89a", "#eeeeee", undefined, existingCabinetTransform(cabinet, room, [cabinet]));
      root.updateMatrixWorld(true);
      const group = root.children.find((child) => child.userData?.placedUid === cabinet.uid)!;
      return { group, box: new THREE.Box3().setFromObject(group) };
    };
    const turned = build(bridge);
    expect(turned.group.rotation.z).toBeCloseTo(Math.PI / 2, 6);
    const size = turned.box.getSize(new THREE.Vector3()).multiplyScalar(12);
    // Run axis 36" (allowing the door overlay), 18" tall, about 12" deep.
    expect(size.x).toBeGreaterThan(35.9);
    expect(size.x).toBeLessThan(37);
    expect(size.y).toBeGreaterThan(17.9);
    expect(size.y).toBeLessThan(19);
    expect(size.z).toBeGreaterThan(11.5);
    expect(size.z).toBeLessThan(14);
    expect(turned.box.min.y * 12).toBeCloseTo(72, 0);
    expect(turned.box.max.y * 12).toBeCloseTo(90, 0);
    // The same SKU hung upright is 18 wide x 36 tall: the turn swaps them.
    const upright = build({ ...bridge, uid: "upright", width: 18, height: 36, turnedSideways: undefined });
    const uprightSize = upright.box.getSize(new THREE.Vector3()).multiplyScalar(12);
    expect(uprightSize.x).toBeCloseTo(size.y, 1);
    expect(uprightSize.y).toBeCloseTo(size.x, 1);
  });
  it("draws and bills a turned bridge as one door when the catalog row has no door count", () => {
    // Door counts left blank: eligibility reads width <= 21 as single-door, and the
    // placed cabinet must carry that one door, not infer two from its 36" width.
    const noCount = line36().map((row) => ({ ...row, numberOfDoors: null }));
    const proposal = proposalFor(36, noCount)!;
    const popup = rangeCompanionPlacement(proposal.bridge!, proposal.bridgeSpot, proposal.bridgeMountBottom, "popup", 7);
    const build = planOverRangeCompanions({
      answer: "microwave-bridge", placed: [range36], room, appliancePalette: [mw36], wallCatalog: noCount, wallCabinetHeightIn: 36,
    });
    if (!build.ok) throw new Error(JSON.stringify(build.findings));
    let n = 0;
    const autoDesign = overRangeCompanionPlacements(build.plan, { makeUid: () => `auto-${++n}`, styleId: 7 }).find((cabinet) => cabinet.placement === "wall")!;
    const mandatory = placeMandatoryOverRangeBridges({
      placed: [{ ...range36, wallId: "top", wallOffset: 48 }], room, wallCatalog: noCount, wallCabinetHeightIn: 36, styleId: 7, makeUid: () => "mandatory",
    }).placed.find((cabinet) => cabinet.placement === "wall")!;
    // A turned cabinet saved before the count was carried still reads as one door.
    const legacy = { ...popup, uid: "legacy", numberOfDoors: undefined };

    for (const bridge of [popup, autoDesign, mandatory, legacy]) {
      expect(bridge, bridge.uid).toMatchObject({ masterCode: "W1836", width: 36, height: 18, turnedSideways: true });
      if (bridge !== legacy) expect(bridge.numberOfDoors, bridge.uid).toBe(1);
      expect(doorCountForCabinet(bridge), bridge.uid).toBe(1);
      expect(hardwareForCabinet(bridge, "bar-pull"), bridge.uid).toMatchObject({ barPulls: 1, total: 1 });
      expect(hardwareSchedule([bridge], "bar-pull"), bridge.uid).toMatchObject({ barPulls: 1, total: 1, cabinetsWithHardware: 1 });

      const root = new THREE.Group();
      addCabinet(root, existingCabinetSku(bridge, room, [bridge]), null, {}, room.width, room.depth, "#c8b89a", "#eeeeee", { doorStyle: "Shaker" } as never, existingCabinetTransform(bridge, room, [bridge]), undefined, undefined, { hardwareStyleId: "bar-pull" } as never);
      const doorPulls: THREE.Object3D[] = [];
      const seams: THREE.Object3D[] = [];
      root.traverse((node) => {
        if (node.userData.cabinetPull === "door") doorPulls.push(node);
        if (node.userData.wallCabinetDoorSeam) seams.push(node);
      });
      expect(doorPulls, bridge.uid).toHaveLength(1);
      expect(seams, bridge.uid).toHaveLength(0);

      const markup = renderElevation(bridge);
      expect(markup.match(/data-cabinet-hardware="door-pull"/g), bridge.uid).toHaveLength(1);
    }
  });

  it("hinges the turned door on the bottom or top in the 2D elevation, as in 3D", () => {
    const proposal = proposalFor(36)!;
    const bridge = rangeCompanionPlacement(proposal.bridge!, proposal.bridgeSpot, proposal.bridgeMountBottom, "bridge", 7);
    // 3D turns the upright door +90 degrees, so its left hinge lands on the bottom
    // edge and its right hinge on the top; the elevation turns the same way.
    const left = renderElevation(bridge);
    expect(left).toContain('data-turned-door-hinge="bottom"');
    expect(left).toMatch(/data-turned-door-hinge="bottom"[^>]*style="[^"]*rotate\(-90deg\)/);
    expect(renderElevation({ ...bridge, swing: "right" })).toContain('data-turned-door-hinge="top"');
    // An upright W1836 keeps its side hinge and is not rotated.
    const upright = renderElevation({ ...bridge, width: 18, height: 36, turnedSideways: undefined });
    expect(upright).not.toContain("data-turned-door-hinge");
    expect(upright.match(/data-cabinet-hardware="door-pull"/g)).toHaveLength(1);
  });
});

function renderElevation(cabinet: PlacedCabinet): string {
  return renderToStaticMarkup(createElement(
    LanguageProvider,
    null,
    createElement(ElevationView, {
      room,
      cabinets: [{ ...cabinet, y: 0 }],
      selectedUid: null,
      onSelect: () => undefined,
      wall: "back",
      finish: { face: "#e8dfcf", edge: "#796f61", label: "#302c27" },
      panelKind: "shaker",
      hardwareStyleId: "bar-pull",
    } as never),
  ));
}
