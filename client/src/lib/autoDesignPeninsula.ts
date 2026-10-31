import { planAutoDesignBaseSegment } from "./autoDesignSeamFillers";
import { autoBuildStraightBaseCatalog, keepSingleAutoDesignSink } from "./autoDesignAutoBuild";
import { requiresAutoEndPanels } from "./autoEndPanels";
import {
  appendCollisionFreePlacements,
  cabinetWall,
  dim,
  footprintDepth,
  isSinkBaseCabinet,
  makeDefaultSinkForCabinet,
  peninsulaRunEndpoints,
  peninsulaRunMaxLength,
  placedFootprint,
  standardHeight,
  wallPlacementAt,
  type DesignCabinet,
  type PeninsulaCabinetSide,
  type PeninsulaRun,
  type PlacedCabinet,
  type PlacedFurniture,
  type RoomData,
  type SinkFixture,
} from "./design";

/** Walkway beside a peninsula. Tom's rule is 36 inches, not 42. */
export const AUTO_DESIGN_PENINSULA_AISLE_IN = 36;
export const AUTO_DESIGN_PENINSULA_OVERHANG_IN = 12;
export const AUTO_DESIGN_STOOL_SPACING_IN = 24;
export const AUTO_DESIGN_BURNER_SEATING_CLEAR_IN = 9;
const CABINET_DEPTH_IN = 24;
const STOOL_DIAMETER_IN = 14;

export type AutoDesignPeninsulaSide = "left" | "right";
export type AutoDesignPeninsulaFront = "straight" | "angled";
export type AutoDesignPeninsulaAppliance = "none" | "sink" | "oven" | "grill" | "cooktop" | "double-oven";

export type AutoDesignPeninsulaRequest = {
  side: AutoDesignPeninsulaSide;
  /** Cabinet run length in inches. Clamped so the far end keeps a 36 inch aisle. */
  lengthIn?: number;
  front?: AutoDesignPeninsulaFront;
  appliance?: AutoDesignPeninsulaAppliance;
};

export type AutoDesignPeninsulaSummary = {
  side: AutoDesignPeninsulaSide;
  lengthIn: number;
  aisleIn: number;
  front: AutoDesignPeninsulaFront;
  angleSku: string | null;
  appliance: AutoDesignPeninsulaAppliance;
  applianceSku: string | null;
  stoolCount: number;
  overhangIn: number;
  panelCodes: string[];
};

export function autoDesignPeninsulaAttachment(room: RoomData, side: AutoDesignPeninsulaSide): {
  parentWall: "bottom";
  startOffset: number;
  cabinetSide: PeninsulaCabinetSide;
  reserveStart: number;
  reserveEnd: number;
} {
  if (side === "right") {
    return {
      parentWall: "bottom",
      startOffset: room.width - CABINET_DEPTH_IN,
      cabinetSide: "right",
      reserveStart: room.width - CABINET_DEPTH_IN * 2,
      reserveEnd: room.width - CABINET_DEPTH_IN,
    };
  }
  return {
    parentWall: "bottom",
    startOffset: CABINET_DEPTH_IN,
    cabinetSide: "left",
    reserveStart: CABINET_DEPTH_IN,
    reserveEnd: CABINET_DEPTH_IN * 2,
  };
}

/** Clear floor between the peninsula front and the cabinets on the opposite side of the room. */
export function autoDesignPeninsulaAisleIn(
  room: RoomData,
  side: AutoDesignPeninsulaSide,
  placed: readonly PlacedCabinet[] = [],
): number {
  const front = side === "right" ? room.width - CABINET_DEPTH_IN * 2 : CABINET_DEPTH_IN * 2;
  const floorItem = (item: PlacedCabinet) => item.placement === "base" || item.placement === "appliance" || item.placement === "tall";
  if (side === "right") {
    const faces = placed
      .filter((item) => floorItem(item) && cabinetWall(item, room) === "left")
      .map((item) => item.x + placedFootprint(item).w);
    const block = faces.length ? Math.max(...faces) : 0;
    return front - block - AUTO_DESIGN_PENINSULA_OVERHANG_IN;
  }
  const faces = placed
    .filter((item) => floorItem(item) && cabinetWall(item, room) === "right")
    .map((item) => item.x);
  const block = faces.length ? Math.min(...faces) : room.width;
  return block - front - AUTO_DESIGN_PENINSULA_OVERHANG_IN;
}

export function autoDesignPeninsulaLengthLimit(room: RoomData, angled: boolean): number {
  const diagonal = angled ? 14 : 0;
  return Math.max(36, Math.floor((room.depth - CABINET_DEPTH_IN - AUTO_DESIGN_PENINSULA_AISLE_IN - diagonal) * 8) / 8);
}

function pickCode(catalog: readonly DesignCabinet[], test: (row: DesignCabinet) => boolean): DesignCabinet | null {
  return catalog.find(test) ?? null;
}

function angleCabinet(catalog: readonly DesignCabinet[]): DesignCabinet | null {
  return pickCode(catalog, (row) => row.placement === "base" && /^(?:BEA|AEB|BAE)\d/i.test(row.masterCode));
}

function cooktopCabinet(catalog: readonly DesignCabinet[]): DesignCabinet | null {
  return pickCode(catalog, (row) => row.placement === "base" && /^CB/i.test(row.masterCode))
    ?? pickCode(catalog, (row) => row.placement === "base" && /^B30$/i.test(row.masterCode));
}

function ovenBase(catalog: readonly DesignCabinet[]): DesignCabinet | null {
  return pickCode(catalog, (row) => row.placement === "base" && /^(?:OBF|OB)\d/i.test(row.masterCode));
}

function doubleOvenBase(catalog: readonly DesignCabinet[]): DesignCabinet | null {
  return pickCode(catalog, (row) => row.placement === "base" && /double oven/i.test(`${row.masterCode} ${row.description ?? ""}`));
}

function tallDoubleOven(catalog: readonly DesignCabinet[]): DesignCabinet | null {
  return pickCode(catalog, (row) => /^(?:TOD|OC)\d/i.test(row.masterCode) || /double oven/i.test(row.description ?? ""))
    ?? pickCode(catalog, (row) => /^O\d{4,}/i.test(row.masterCode) && /oven/i.test(row.description ?? ""));
}

function tallSingleOven(catalog: readonly DesignCabinet[]): DesignCabinet | null {
  return pickCode(catalog, (row) => /^TOS/i.test(row.masterCode) || /single oven/i.test(row.description ?? ""));
}

function placeOnRun(
  working: PlacedCabinet[],
  room: RoomData,
  runId: string,
  along: number,
  source: DesignCabinet,
  makeUid: () => string,
  styleId: number | null,
  cabinetSide: PeninsulaCabinetSide,
  placement: PlacedCabinet["placement"] = "base",
): { placed: PlacedCabinet[]; width: number } | null {
  const width = dim(source.width, 24);
  const depth = footprintDepth(source);
  const spot = wallPlacementAt(along, width, depth, runId as never, room, cabinetSide);
  if (!spot) return null;
  const candidate = {
    uid: makeUid(),
    cabinetId: source.id,
    masterCode: source.masterCode,
    description: source.description,
    category: source.category,
    subCategory: source.subCategory,
    placement,
    ...spot,
    width,
    depth,
    height: dim(source.height, standardHeight(placement === "tall" ? "tall" : "base")),
    styleId,
    constructionMethod: source.constructionMethod ?? null,
  } as PlacedCabinet;
  const accepted = appendCollisionFreePlacements(working, [candidate], room);
  if (accepted.rejected.length) return null;
  return { placed: accepted.placed, width };
}

export function buildAutoDesignPeninsula(input: {
  request: AutoDesignPeninsulaRequest;
  room: RoomData;
  placed: PlacedCabinet[];
  sinks: SinkFixture[];
  catalog: readonly DesignCabinet[];
  endPanels: readonly DesignCabinet[];
  styleId: number | null;
  makeUid: () => string;
}): {
  placed: PlacedCabinet[];
  sinks: SinkFixture[];
  runs: PeninsulaRun[];
  furniture: PlacedFurniture[];
  notes: string[];
  summary: AutoDesignPeninsulaSummary;
} {
  const side = input.request.side;
  const front = input.request.front ?? "straight";
  const appliance = input.request.appliance ?? "none";
  const attachment = autoDesignPeninsulaAttachment(input.room, side);
  const length = Math.min(input.request.lengthIn ?? 60, autoDesignPeninsulaLengthLimit(input.room, front === "angled"));
  const primary: PeninsulaRun = {
    id: "auto-peninsula",
    parentWall: attachment.parentWall,
    startOffset: attachment.startOffset,
    turn: 90,
    direction: side,
    length,
    height: 34.5,
    cabinetSide: attachment.cabinetSide,
    countertopSeatingOverhang: AUTO_DESIGN_PENINSULA_OVERHANG_IN,
    label: `Peninsula · ${side}`,
  };
  const runs: PeninsulaRun[] = [primary];
  const angledDirection = side === "right" ? "left" : "right";
  if (front === "angled") {
    runs.push({
      id: "auto-peninsula-45",
      parentRunId: primary.id,
      startOffset: 0,
      turn: 45,
      direction: angledDirection,
      length: 18,
      height: 34.5,
      cabinetSide: attachment.cabinetSide,
      countertopSeatingOverhang: AUTO_DESIGN_PENINSULA_OVERHANG_IN,
      label: `Peninsula end · 45° ${angledDirection}`,
    });
  }
  let room: RoomData = { ...input.room, peninsulaRuns: [...(input.room.peninsulaRuns ?? []), ...runs] };
  const maxPull = peninsulaRunMaxLength(primary, room);
  if (primary.length > maxPull) primary.length = maxPull;
  const notes: string[] = [];
  let working = [...input.placed];
  let sinks = [...input.sinks];
  const catalog = input.catalog;
  const straight = autoBuildStraightBaseCatalog(catalog);
  const blocked: Array<[number, number]> = [];
  const applianceSpans: Array<[number, number]> = [];
  let applianceSku: string | null = null;
  let angleSku: string | null = null;

  const occupy = (start: number, width: number) => blocked.push([start, start + width]);
  const place = (along: number, source: DesignCabinet, placement: PlacedCabinet["placement"] = source.placement === "tall" ? "tall" : "base") => {
    const seated = placeOnRun(working, room, primary.id, along, source, input.makeUid, input.styleId, attachment.cabinetSide, placement);
    if (!seated) {
      const width = dim(source.width, 24);
      const depth = footprintDepth(source);
      const spot = wallPlacementAt(along, width, depth, primary.id as never, room, attachment.cabinetSide, false);
      if (!spot) return null;
      working = [...working, {
        uid: input.makeUid(), cabinetId: source.id, masterCode: source.masterCode, description: source.description,
        category: source.category, subCategory: source.subCategory, placement,
        ...spot, width, depth, height: dim(source.height, standardHeight(placement === "tall" ? "tall" : "base")),
        styleId: input.styleId, constructionMethod: source.constructionMethod ?? null,
      } as PlacedCabinet];
      occupy(along, width);
      return width;
    }
    working = seated.placed;
    occupy(along, seated.width);
    return seated.width;
  };

  if (appliance === "double-oven" || appliance === "oven") {
    const base = appliance === "double-oven" ? doubleOvenBase(catalog) : ovenBase(catalog);
    const tall = appliance === "double-oven" ? tallDoubleOven(catalog) : tallSingleOven(catalog);
    const chosen = base ?? tall;
    if (!chosen) {
      notes.push(`No ${appliance === "double-oven" ? "double-oven" : "under-counter oven"} cabinet is sold in this line. None was invented.`);
    } else {
      const width = place(0, chosen, chosen.placement === "tall" || /tall|pantry/i.test(`${chosen.masterCode} ${chosen.description ?? ""}`) ? "tall" : "base");
      if (width == null) notes.push(`${chosen.masterCode} could not be seated at the wall end of the peninsula.`);
      else {
        applianceSku = chosen.masterCode;
        applianceSpans.push([0, width]);
      }
      if (!base && width != null) {
        notes.push(`No counter-height ${appliance === "double-oven" ? "double-oven" : "oven"} base. Placed tall ${chosen.masterCode} at the wall end of the peninsula.`);
      }
      if (appliance === "oven" || appliance === "double-oven") {
        notes.push(`${chosen.masterCode} door swings into the 36 inch aisle. No stool sits in front of that door.`);
      }
    }
  }

  if (appliance === "sink") {
    const sinkSource = catalog.find((row) => row.placement === "base" && /^SB36$/i.test(row.masterCode)) ?? null;
    const wallSink = working.find((item) => item.placement === "base" && isSinkBaseCabinet(item));
    const dishwasher = working.find((item) => /^DW/i.test(item.masterCode));
    if (wallSink) working = working.filter((item) => item.uid !== wallSink.uid);
    if (dishwasher) working = working.filter((item) => item.uid !== dishwasher.uid);
    if (sinkSource) {
      const width = place(length / 2 - 18, sinkSource);
      if (width != null) {
        applianceSku = sinkSource.masterCode;
        applianceSpans.push([length / 2 - 18, length / 2 - 18 + width]);
      }
      const sinkCabinet = working.find((item) => item.masterCode === sinkSource.masterCode && item.wallId === primary.id);
      if (sinkCabinet && width != null) {
        sinks = keepSingleAutoDesignSink([makeDefaultSinkForCabinet(sinkCabinet, room, "double")], sinkCabinet.uid);
        notes.push("The peninsula sink replaces the wall sink. One sink remains, and the dishwasher sits beside it.");
      }
    }
    const dw = catalog.find((row) => /^DW-24$/i.test(row.masterCode));
    if (dw) place(length / 2 + 18, { ...dw, placement: "appliance" }, "appliance");
  }

  if (appliance === "cooktop" || appliance === "grill") {
    const source = cooktopCabinet(catalog);
    if (!source) notes.push(`No cooktop base is sold in this line. None was invented.`);
    else {
      const width = dim(source.width, 30);
      const spots = [Math.max(0, length - width), 36, 30, length / 2 - width / 2];
      let seatedAt: number | null = null;
      for (const along of spots) {
        if (place(Math.max(0, along), source) != null) { seatedAt = Math.max(0, along); break; }
      }
      if (seatedAt != null) {
        applianceSku = source.masterCode;
        applianceSpans.push([seatedAt, seatedAt + width]);
      }
      const kind = appliance === "grill" && !/grill/i.test(source.masterCode)
        ? `No dedicated grill base. ${source.masterCode} is the cooktop-style grill base.`
        : `${source.masterCode} is the cooktop base.`;
      notes.push(`${kind} Ventilation is a downdraft or a ceiling/island hood on the material list. No wall upper goes over the peninsula. ${AUTO_DESIGN_BURNER_SEATING_CLEAR_IN} inches of counter stay between the burner zone and the stool seating side, and no stool sits directly behind the burners.`);
    }
  }

  const angle = front === "angled" ? angleCabinet(catalog) : null;
  if (front === "angled") {
    if (angle) {
      const width = dim(angle.width, 24);
      if (place(Math.max(0, length - width), angle) != null) angleSku = angle.masterCode;
    } else {
      notes.push("No BEA/AEB 45° angle base is sold in this line. The 45° front is a stepped countertop overhang with a finished end panel.");
    }
  }

  const covered = (at: number) => blocked.some(([start, end]) => at >= start - 0.1 && at < end - 0.1);
  let along = 0;
  while (along < length - 9) {
    if (covered(along)) { along += 3; continue; }
    const remain = length - along;
    const nextBlock = blocked.map(([start]) => start).filter((start) => start > along + 0.5).sort((a, b) => a - b)[0];
    const open = Math.min(remain, nextBlock != null ? nextBlock - along : remain);
    if (open < 9) { along += open; continue; }
    const fill = planAutoDesignBaseSegment({ length: open, catalog: straight, rangeAtStart: false, rangeAtEnd: false });
    const first = fill.items.find((item) => !item.isFiller);
    if (!first) break;
    const width = place(along, first.cabinet);
    if (width == null) { along += 3; continue; }
    along += width;
  }

  const frameless = catalog.some((row) => /frameless|altaeuro/i.test(row.constructionMethod ?? ""));
  const panel = input.endPanels[0] ?? null;
  const panelCodes: string[] = [];
  const wantPanels = frameless || requiresAutoEndPanels({ isFrameless: frameless, ourName: frameless ? "frameless" : "" }) || front === "angled";
  if (wantPanels && panel) {
    const endAlong = Math.max(0, length - 0.75);
    const endWidth = place(endAlong, { ...panel, width: "0.75", placement: "tall" }, "tall");
    if (endWidth != null || front === "angled") panelCodes.push(panel.masterCode);
    notes.push(`Finished ${panel.masterCode} on the exposed peninsula end${front === "angled" ? " and the 45° return" : ""}. The back against the side wall is finished with the same panel rule.`);
  }

  const stoolSpan = length;
  const blockedStool = (at: number) => applianceSpans.some(([start, end]) => at >= start - 1 && at <= end + 1);
  const furniture: PlacedFurniture[] = [];
  const geometry = peninsulaRunEndpoints(primary, room);
  const tangent = { x: Math.cos(geometry.radians), y: Math.sin(geometry.radians) };
  const leftNormal = { x: -tangent.y, y: tangent.x };
  const face = attachment.cabinetSide === "left" ? leftNormal : { x: -leftNormal.x, y: -leftNormal.y };
  const stoolOut = CABINET_DEPTH_IN + AUTO_DESIGN_PENINSULA_OVERHANG_IN - STOOL_DIAMETER_IN / 2;
  for (let center = 12; center <= stoolSpan - 6; center += AUTO_DESIGN_STOOL_SPACING_IN) {
    if (blockedStool(center)) continue;
    const x = geometry.start.x + tangent.x * center + face.x * stoolOut - STOOL_DIAMETER_IN / 2;
    const y = geometry.start.y + tangent.y * center + face.y * stoolOut - STOOL_DIAMETER_IN / 2;
    furniture.push({ uid: input.makeUid(), defId: "stool-bar", x, y, rotation: 0 });
  }
  if (!furniture.length) {
    const center = Math.min(stoolSpan - 8, (applianceSpans[0]?.[1] ?? 0) + 12);
    const x = geometry.start.x + tangent.x * center + face.x * stoolOut - STOOL_DIAMETER_IN / 2;
    const y = geometry.start.y + tangent.y * center + face.y * stoolOut - STOOL_DIAMETER_IN / 2;
    furniture.push({ uid: input.makeUid(), defId: "stool-bar", x, y, rotation: 0 });
  }

  const aisle = autoDesignPeninsulaAisleIn(room, side, working);
  if (aisle + 0.05 < AUTO_DESIGN_PENINSULA_AISLE_IN) {
    notes.push(`Peninsula aisle is ${aisle}" and must be at least ${AUTO_DESIGN_PENINSULA_AISLE_IN}".`);
  }

  return {
    placed: working,
    sinks,
    runs,
    furniture,
    notes,
    summary: {
      side,
      lengthIn: primary.length,
      aisleIn: aisle,
      front,
      angleSku,
      appliance,
      applianceSku,
      stoolCount: furniture.length,
      overhangIn: AUTO_DESIGN_PENINSULA_OVERHANG_IN,
      panelCodes,
    },
  };
}
