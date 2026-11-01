import { describe, expect, it } from "vitest";
import catalogFixture from "./__fixtures__/autoDesignRealCatalog.json";
import { buildMandatoryAutoDesignRefrigeratorBay, AUTO_DESIGN_REFRIGERATOR_WALL_END_SHIFT_IN } from "./autoDesignRefrigeratorBay";
import {
  adjacentDishwasherCenterIn,
  anchorAlongStartIn,
  autoBuildStraightBaseCatalog,
  subtractAnchorRunReservations,
  wallLabelToEngineWallId,
} from "./autoDesignAutoBuild";
import { seatAutoDesignCornerFromCatalog } from "./autoDesignCornerPlacement";
import { autoBuildCornerCatalog, autoDesignCornerSlots, autoDesignCornerSlotPoint } from "./autoDesignCornerStage";
import { fillAutoDesignLowerSeams, planAutoDesignBaseSegment } from "./autoDesignSeamFillers";
import { buildAutoDesignWallCabinets } from "./autoDesignWallCabinets";
import { autoDesignSinkWindow } from "./autoDesignSinkWindow";
import { catalogFillerForGap, fittedCatalogFillerDescription, isCatalogFiller } from "./catalogFiller";
import { applyAutoDesignWiggleRoom, type AutoDesignAnchorOrigin } from "./designerLayoutRules";
import {
  appendCollisionFreePlacements,
  appendRefrigeratorEnclosurePlacements,
  cabinetWall,
  dim,
  elevationBox,
  fitExplicitRefrigeratorOptionPlacements,
  footprintDepth,
  freeSegmentsOnWall,
  placedFootprint,
  wallPlacementAt,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "./design";

const STYLE = "330011";
const room: RoomData = { width: 150, depth: 150, ceilingHeight: 96 };
const fixture = catalogFixture as unknown as Record<string, { base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[] }>;
const pool = [...fixture[STYLE]!.base, ...fixture[STYLE]!.wall, ...fixture[STYLE]!.accessory];
const fillers = fixture[STYLE]!.accessory.filter((row) => isCatalogFiller(row));

function placeAnchor(input: {
  kind: "sink" | "stove" | "dishwasher" | "refrigerator";
  wallLabel: "Wall 1" | "Wall 2" | "Wall 3";
  center: number;
  source: DesignCabinet;
  width: number;
  uid: string;
}): PlacedCabinet {
  const wall = wallLabelToEngineWallId(input.wallLabel, room, "left", "right");
  if (!wall) throw new Error(input.wallLabel);
  const along = anchorAlongStartIn({ wallLabel: input.wallLabel, centerOffsetIn: input.center }, input.width, wall);
  const depth = dim(input.source.depth, input.kind === "refrigerator" ? 30 : 24);
  const height = dim(input.source.height, input.kind === "refrigerator" ? 70 : input.kind === "sink" ? 34.5 : 36);
  const spot = wallPlacementAt(along, input.width, depth, wall.engineWallId as WallSide, room);
  return {
    uid: input.uid,
    cabinetId: input.source.id,
    masterCode: input.kind === "refrigerator" ? "FRIDGE-36" : input.source.masterCode,
    description: input.source.description,
    category: input.source.category,
    subCategory: input.source.subCategory,
    placement: input.kind === "sink" ? "base" : "appliance",
    ...spot,
    width: input.width,
    depth,
    height,
    rotation: spot.rotation,
    wallId: spot.wallId,
    wallOffset: spot.wallOffset,
    mountBottom: 0,
    refrigeratorPanelMode: input.kind === "refrigerator" ? "both" : undefined,
    refrigeratorOptionsChosen: input.kind === "refrigerator" ? true : undefined,
  } as PlacedCabinet;
}

function describeItem(item: PlacedCabinet) {
  const wall = cabinetWall(item, room);
  const start = wallRunOffset(item, wall, room);
  const span = wallRunSpan(item, wall, room);
  const box = elevationBox(item, room);
  const foot = placedFootprint(item);
  return {
    uid: item.uid,
    masterCode: item.masterCode,
    role: item.refrigeratorAssemblyRole ?? item.autoPlacedReason ?? null,
    wall,
    along: [Math.round(start * 1000) / 1000, Math.round((start + span) * 1000) / 1000],
    x: [Math.round(item.x * 1000) / 1000, Math.round((item.x + foot.w) * 1000) / 1000],
    y: [Math.round(item.y * 1000) / 1000, Math.round((item.y + foot.d) * 1000) / 1000],
    zBottom: box.bottom,
    height: box.height,
    top: Math.round((box.bottom + box.height) * 1000) / 1000,
    depth: item.depth,
    nominalWidth: item.nominalWidth ?? null,
    note: item.fieldModificationNote ?? null,
  };
}

describe("owner U-shape: 150 inch walls, fridge center 131 on wall 3", () => {
  it("names the 2496 panels and the 2442, and keeps the outer fridge panel inside the wall and clear of other cabinets", () => {
    let uid = 0;
    const makeUid = () => `u-${++uid}`;
    const sinkSource = pool.find((row) => row.masterCode === "SB36")!;
    const straight = autoBuildStraightBaseCatalog(pool);
    const base24 = straight.find((row) => Math.abs(dim(row.width, 0) - 24) < 0.1) ?? straight[0]!;
    const sink = placeAnchor({ kind: "sink", wallLabel: "Wall 1", center: 75, source: sinkSource, width: 36, uid: makeUid() });
    const range = placeAnchor({ kind: "stove", wallLabel: "Wall 2", center: 75, source: { ...base24, id: 0, masterCode: "RANGE-30", description: "30 inch range", width: "30", depth: "25", height: "36", placement: "appliance" }, width: 30, uid: makeUid() });
    const dishwasherCenter = adjacentDishwasherCenterIn(75, 36, 24, "right");
    const dishwasher = placeAnchor({ kind: "dishwasher", wallLabel: "Wall 1", center: dishwasherCenter, source: { ...base24, id: 0, masterCode: "DW-24", description: "Dishwasher", width: "24", depth: "24", height: "34.5", placement: "appliance" }, width: 24, uid: makeUid() });
    const fridge = placeAnchor({ kind: "refrigerator", wallLabel: "Wall 3", center: 131, source: { ...base24, id: 0, masterCode: "FRIDGE-36", description: "Refrigerator", width: "36", depth: "30", height: "70", placement: "appliance" }, width: 36, uid: makeUid() });

    const deepAbove = fixture[STYLE]!.wall.filter((row) => Number(row.width) === 36 && Number(row.depth) >= 20);
    const endPanels = fixture[STYLE]!.accessory.filter((row) => /REPV|refrigerator end panel/i.test(`${row.masterCode} ${row.description}`));
    const bay = buildMandatoryAutoDesignRefrigeratorBay({
      refrigerator: fridge, room, caps: deepAbove, endPanels, styleId: Number(STYLE), makeUid, wallCabinetHeightIn: 42,
    });
    expect(bay.ok, !bay.ok ? bay.message : "").toBe(true);
    if (!bay.ok) return;

    let working = [sink, range, dishwasher, fridge];
    const fitted = fitExplicitRefrigeratorOptionPlacements(working, bay.additions, fridge.uid, room);
    expect(Math.abs(fitted.shiftIn)).toBeLessThanOrEqual(AUTO_DESIGN_REFRIGERATOR_WALL_END_SHIFT_IN + 1e-6);
    const committed = appendRefrigeratorEnclosurePlacements(fitted.existing, fitted.additions, fridge.uid, room);
    expect(committed.rejected.map((item) => item.masterCode)).toEqual([]);
    working = committed.placed;
    const reservation = {
      wall: bay.reservation.wall,
      start: bay.reservation.start + fitted.shiftIn,
      end: bay.reservation.end + fitted.shiftIn,
    };

    const window = autoDesignSinkWindow({ sink: working.find((item) => item.uid === sink.uid)!, room, uid: makeUid() });
    const measured = { wallIds: ["top", "right", "bottom"], room, originCorner: "left" as const, runDirection: "right" as const };
    const slots = autoDesignCornerSlots("u-shape", measured);
    const cornerOptions = autoBuildCornerCatalog(pool);
    const cornerNotes: string[] = [];
    const cornerFailures: string[] = [];
    const upperCorners: { base: PlacedCabinet; point: { x: number; y: number; firstWallId: string } }[] = [];
    for (const slot of slots) {
      const point = autoDesignCornerSlotPoint(slot, room, "left", "right");
      const first = wallLabelToEngineWallId(slot.firstWall, room, "left", "right");
      const second = wallLabelToEngineWallId(slot.secondWall, room, "left", "right");
      expect(point && first && second).toBeTruthy();
      if (!point || !first || !second) return;
      const seated = seatAutoDesignCornerFromCatalog({
        slot, options: cornerOptions, pool, target: point,
        cornerWallIds: [first.engineWallId, second.engineWallId],
        working, room, openings: [window], measuredApplianceUids: [fridge.uid],
        catalogFillers: fillers, makeUid, styleId: Number(STYLE),
      });
      if (!seated.ok) {
        cornerFailures.push(`${slot.label}: ${seated.message}`);
        continue;
      }
      if (seated.fallbackNote) cornerNotes.push(`${slot.label}: ${seated.fallbackNote} (${seated.source.masterCode})`);
      else cornerNotes.push(`${slot.label}: ${seated.source.masterCode}`);
      working = seated.placed;
      upperCorners.push({ base: seated.corner, point });
    }

    const origins: AutoDesignAnchorOrigin[] = [
      { uid: sink.uid, kind: "sink", wallId: sink.wallId!, originalStart: sink.wallOffset! },
      { uid: range.uid, kind: "stove", wallId: range.wallId!, originalStart: range.wallOffset! },
      { uid: dishwasher.uid, kind: "dishwasher", wallId: dishwasher.wallId!, originalStart: dishwasher.wallOffset! },
      { uid: fridge.uid, kind: "refrigerator", wallId: fridge.wallId!, originalStart: fridge.wallOffset! },
    ];
    const wiggle = applyAutoDesignWiggleRoom({ placed: working, room, openings: [window], catalog: straight, origins, lockedUids: [] });
    working = wiggle.placed;

    for (const wallId of ["top", "right", "bottom"] as const) {
      const raw = freeSegmentsOnWall(wallId, room, working, [window], 9, 0, "base", false, undefined, footprintDepth(base24));
      const reserved = reservation.wall === wallId ? [{ start: reservation.start, end: reservation.end }] : [];
      for (const segment of subtractAnchorRunReservations(raw, reserved)) {
        const fill = planAutoDesignBaseSegment({ length: segment.length, catalog: straight, rangeAtStart: false, rangeAtEnd: false });
        let along = segment.start;
        for (const item of fill.items) {
          const catalogFiller = item.isFiller ? catalogFillerForGap(fillers, item.width, "base") : null;
          const source = catalogFiller ?? item.cabinet;
          if (item.isFiller && !catalogFiller) { along += item.width; continue; }
          const spot = wallPlacementAt(along, item.width, footprintDepth(source), wallId, room);
          const candidate = {
            uid: makeUid(), cabinetId: source.id, masterCode: source.masterCode,
            description: item.isFiller ? fittedCatalogFillerDescription(source, item.width) : source.description,
            category: source.category, subCategory: source.subCategory, placement: "base" as const, ...spot,
            width: item.width, nominalWidth: item.isFiller ? dim(source.width, item.width) : undefined,
            depth: footprintDepth(source), height: dim(source.height, 34.5),
          } as PlacedCabinet;
          const accepted = appendCollisionFreePlacements(working, [candidate], room);
          if (accepted.rejected.length === 0) working = accepted.placed;
          along += item.width;
        }
      }
    }
    const seams = fillAutoDesignLowerSeams({ placed: working, room, openings: [window], fillers, makeUid, styleId: Number(STYLE), corners: upperCorners.map((entry) => entry.point) });
    working = seams.placed;
    const uppers = buildAutoDesignWallCabinets({
      placed: working, room, openings: [window], catalog: fixture[STYLE]!.wall,
      wallCabinetHeightIn: 42, styleId: Number(STYLE), makeUid, corners: upperCorners, catalogFillers: fillers, closeSeams: true,
    });
    working = uppers.placed;

    const panels = working.filter((item) => /2496/.test(item.masterCode));
    const twoFour = working.filter((item) => /2442/.test(item.masterCode));
    const fillerItems = working.filter((item) => /filler|scribe/i.test(`${item.masterCode} ${item.description ?? ""}`) || item.fillerPieceGroupId);
    const bridge = working.find((item) => item.refrigeratorAssemblyRole === "bridge");
    const movedFridge = working.find((item) => item.uid === fridge.uid)!;

    const overlaps: string[] = [];
    for (let left = 0; left < working.length; left += 1) {
      for (let right = left + 1; right < working.length; right += 1) {
        const a = working[left]!;
        const b = working[right]!;
        if (a.refrigeratorAssemblyId && a.refrigeratorAssemblyId === b.refrigeratorAssemblyId) continue;
        if (a.uid === b.refrigeratorAssemblyId || b.uid === a.refrigeratorAssemblyId) continue;
        const aBox = describeItem(a);
        const bBox = describeItem(b);
        const ox = Math.min(aBox.x[1], bBox.x[1]) - Math.max(aBox.x[0], bBox.x[0]);
        const oy = Math.min(aBox.y[1], bBox.y[1]) - Math.max(aBox.y[0], bBox.y[0]);
        const oz = Math.min(aBox.top, bBox.top) - Math.max(aBox.zBottom, bBox.zBottom);
        if (ox > 0.05 && oy > 0.05 && oz > 0.05) overlaps.push(`${a.masterCode}@${a.uid} ∩ ${b.masterCode}@${b.uid} by ${ox.toFixed(2)} x ${oy.toFixed(2)} x ${oz.toFixed(2)}`);
      }
    }
    const pastWall = working.flatMap((item) => {
      const info = describeItem(item);
      const past: string[] = [];
      if (info.x[0] < -0.05 || info.x[1] > room.width + 0.05 || info.y[0] < -0.05 || info.y[1] > room.depth + 0.05) {
        past.push(`${item.masterCode}@${item.uid} plan ${info.x.join("–")} / ${info.y.join("–")}`);
      }
      if (info.top > room.ceilingHeight + 0.05) past.push(`${item.masterCode}@${item.uid} top ${info.top}`);
      return past;
    });

    const report = {
      shiftIn: fitted.shiftIn,
      cornerNotes,
      cornerFailures,
      wiggle: wiggle.moves.map((move) => ({ kind: move.kind, inches: move.inchesMoved, direction: move.direction })),
      fridgeAlong: describeItem(movedFridge).along,
      bridge: bridge ? describeItem(bridge) : null,
      panels: panels.map(describeItem),
      twoFour: twoFour.map(describeItem),
      fillers: fillerItems.map((item) => ({
        ...describeItem(item),
        stockWidth: item.nominalWidth ?? null,
        installedWidth: item.width,
      })),
      upperSkipped: uppers.skipped,
      seamNotes: seams.notes,
      overlaps,
      pastWall,
      heightUsed: uppers.heightUsedIn,
    };
    expect(report).toMatchObject({
      panels: [
        expect.objectContaining({ masterCode: "REPV2496", role: "left-panel" }),
        expect.objectContaining({ masterCode: "REPV2496", role: "right-panel" }),
      ],
    });
    expect(report.shiftIn).toBeCloseTo(-0.25, 5);
    // LSB36/LSB33 are lazy Susans. Main used to classify them "diagonal" because the description said so, which
    // produced "LSB36 does not fit ... LSB33 is placed instead"; by code they are lazy Susans, so the same
    // LSB33 is reached by the lazy-Susan size reduction. The cabinets placed are unchanged.
    expect(report.cornerNotes.join(" ")).toMatch(/Lazy Susan reduced to 33\.000" to fit \(LSB33\)/);
    expect(report.cornerNotes.join(" ")).toMatch(/LSB33/);
    expect(report.cornerFailures.join(" ")).toMatch(/Wall 2 and Wall 3/);
    expect(report.cornerFailures.join(" ")).toMatch(/12"/);
    expect(report.twoFour.map((item) => item.masterCode).sort()).toEqual(["DCW2442", "DCW2442", "DCW2442"]);
    const rightPanel = report.panels.find((item) => item.role === "right-panel")!;
    expect(rightPanel.along[1]).toBeCloseTo(150, 2);
    expect(rightPanel.top).toBeCloseTo(96, 2);
    expect(rightPanel.depth).toBe(24);
    for (const filler of report.fillers) {
      expect(filler.masterCode.startsWith("FILL-"), `${filler.masterCode} is a generic filler, not catalog stock`).toBe(false);
      if (filler.installedWidth <= 3.001 && filler.stockWidth != null) expect(filler.stockWidth).toBeCloseTo(3, 2);
    }
    expect(pastWall, pastWall.join("\n")).toEqual([]);
    expect(overlaps, overlaps.join("\n")).toEqual([]);
    for (const panel of panels) {
      expect(panel.height).toBeCloseTo(bridge!.height + (bridge!.mountBottom ?? 0), 2);
      const info = describeItem(panel);
      const wallLength = info.wall === "top" || info.wall === "bottom" ? room.width : room.depth;
      const alongEnd = info.along[1];
      expect(alongEnd).toBeLessThanOrEqual(wallLength + 0.02);
      expect(info.along[0]).toBeGreaterThanOrEqual(-0.02);
    }
  });
});
