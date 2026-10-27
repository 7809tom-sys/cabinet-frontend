import { buildRequiredBlindCornerFiller, requiredBlindCornerFillerGroupId, requiresConfiguredBlindCornerFiller } from "./blindCornerRequiredFiller";
import { catalogFillerForGap, fittedCatalogFillerDescription, type CatalogFillerCandidate } from "./catalogFiller";
import { repairMissingAngledWallFillers } from "./angledWallFiller";
import { CROWN_MITER_CUT_ALLOWANCE_IN } from "./crownTakeoff";
import {
  COLLISION_EPSILON_IN,
  CROWN_MITER_ALLOWANCE_IN,
  STD,
  appendCollisionFreePlacements,
  cabinetPlacementCollisionDetail,
  cabinetWall,
  dim,
  freeSegmentsOnWall,
  isFillerItem,
  isRangeOrOven,
  isRefrigerator,
  isRefrigeratorEndPanel,
  isSinkBaseCabinet,
  matchInstalledFillerToCabinet,
  normalizeGlassStackersToParentFronts,
  normalizeInstalledFillersToAdjacentCabinets,
  normalizeOverSinkWallMounts,
  normalizeSinkFixturesToBases,
  normalizeStandardWallMounts,
  normalizeWd18CountertopMounts,
  refrigeratorEndPanelConflictDetail,
  wallLength,
  wallPlacementAt,
  wallPlacementAtUnbounded,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type SinkFixture,
  type WallOpening,
  type WallSide,
} from "./design";
import { planAutoDesignBaseSegment } from "./autoDesignSeamFillers";
import {
  SMALL_GAP_FILLER_MAX_IN,
  findPreferredSmallGapFillerOpportunity,
  type SmallGapFillerOpportunity,
} from "./smallGapFiller";

/**
 * The most a user-placed auto-design appliance may slide along its own wall
 * while the run is fitted. The cap is measured from the original placement,
 * not from a later corner nudge.
 */
export const AUTO_DESIGN_WIGGLE_ROOM_IN = 3;
const WIGGLE_STEP_IN = 1 / 8;
const UNDERSIZED_CABINET_IN = 12;

export type DesignerRulePhase = "wiggle" | "shared-pipeline" | "auto-design-stage" | "invariant";

export type DesignerLayoutRule = {
  id: string;
  /** Short name used in the designer rule list. */
  name: string;
  phase: DesignerRulePhase;
  summary: string;
};

/**
 * The rules a auto-design kitchen actually accounts for. There was no separate
 * 21-rule registry; `surroundingRules` on the build plan is only a four-word
 * label. This list is the executable set: wiggle and the shared pipeline run
 * from here, stage rules already run inside the auto-design build, and the
 * invariant rules are checked rather than reimplemented.
 */
export const DESIGNER_LAYOUT_RULES: readonly DesignerLayoutRule[] = [
  {
    id: "wiggle-room",
    name: "wiggle room",
    phase: "wiggle",
    summary: "During Auto-Design, slide a user-placed appliance at most 3 inches along its own wall when that yields a better cabinet fit.",
  },
  {
    id: "straight-base-largest-first",
    name: "straight base largest-first",
    phase: "auto-design-stage",
    summary: "Remaining base runs use the shared auto-fill engine, largest-first, on the straight base catalog.",
  },
  {
    id: "range-neighbor-minimum",
    name: "range neighbor minimum",
    phase: "auto-design-stage",
    summary: "A range keeps a real cabinet at least 15 inches wide on each side.",
  },
  {
    id: "small-gap-filler",
    name: "standard small-gap filler",
    phase: "shared-pipeline",
    summary: "A measured cabinet seam of 6 inches or less receives the standard catalog filler instead of being left open.",
  },
  {
    id: "filler-adjoining-finish",
    name: "filler adjoining finish",
    phase: "shared-pipeline",
    summary: "A filler takes the color and supplier finish of the cabinet it fills against.",
  },
  {
    id: "lower-seam-filler",
    name: "lower seam filler",
    phase: "auto-design-stage",
    summary: "Openings the standard filler does not close, up to 12 inches, still receive catalog seam filler.",
  },
  {
    id: "nine-inch-tray-base",
    name: "nine-inch tray base",
    phase: "shared-pipeline",
    summary: "A 9-inch base cabinet has no drawers; it is a tray base.",
  },
  {
    id: "blind-corner-required-filler",
    name: "blind-corner required filler",
    phase: "shared-pipeline",
    summary: "A blind corner that requires its filler gets that catalog filler when it is missing.",
  },
  {
    id: "angled-wall-filler",
    name: "angled-wall filler",
    phase: "shared-pipeline",
    summary: "A cabinet at an angled wall keeps its required transition filler.",
  },
  {
    id: "over-sink-wall-mount",
    name: "over-sink wall mount",
    phase: "shared-pipeline",
    summary: "Wall cabinets over a sink or window use the over-sink mount, and drop back when the opening is gone.",
  },
  {
    id: "wd18-countertop-mount",
    name: "WD18 countertop mount",
    phase: "shared-pipeline",
    summary: "A WD18 drawer sits on the countertop rather than the ordinary wall line.",
  },
  {
    id: "standard-wall-mount",
    name: "standard wall mount",
    phase: "shared-pipeline",
    summary: "Ordinary wall cabinets keep the standard mount height unless a specific exception applies.",
  },
  {
    id: "glass-stacker-front",
    name: "glass stacker front",
    phase: "shared-pipeline",
    summary: "A glass stacker stays on the front of the wall cabinet that supports it.",
  },
  {
    id: "nothing-above-sink",
    name: "nothing above the sink",
    phase: "auto-design-stage",
    summary: "Upper cabinets are not placed over the sink.",
  },
  {
    id: "sink-window-clearance",
    name: "sink window clearance",
    phase: "auto-design-stage",
    summary: "A measured sink window is as wide as the sink, and wall cabinets stop 3 inches short of it.",
  },
  {
    id: "corner-upper-twelve",
    name: "12-inch corner upper",
    phase: "auto-design-stage",
    summary: "The corner upper used by auto-design is the 12-inch corner wall cabinet.",
  },
  {
    id: "refrigerator-bay",
    name: "refrigerator bay",
    phase: "auto-design-stage",
    summary: "The refrigerator keeps its panels and the cabinet above. That bay is not shifted to force a fit.",
  },
  {
    id: "corner-appliance-nudge",
    name: "corner appliance nudge",
    phase: "auto-design-stage",
    summary: "A range or refrigerator may slide up to 3 inches away from a corner so the corner cabinet can sit on the vertex.",
  },
  {
    id: "sink-fixture-on-base",
    name: "sink fixture on base",
    phase: "shared-pipeline",
    summary: "The sink fixture stays on its sink base, and a deck faucet sits on the counter behind the basin.",
  },
  {
    id: "trim-single-supplier",
    name: "trim single supplier",
    phase: "shared-pipeline",
    summary: "Moulding, light rail, shoe, crown, toe-kick, and batten on one project come from one supplier.",
  },
  {
    id: "crown-miter-allowance",
    name: "crown miter allowance",
    phase: "invariant",
    summary: "Crown takeoff keeps the 4-inch cut allowance at each miter.",
  },
  {
    id: "faucet-on-counter",
    name: "faucet on the counter",
    phase: "invariant",
    summary: "A default sink is created with its faucet on, and a non-apron sink keeps that faucet on the rear deck.",
  },
];

export function designerLayoutRuleIds(): string[] {
  return DESIGNER_LAYOUT_RULES.map((rule) => rule.id);
}

export type AutoDesignAnchorOrigin = {
  uid: string;
  /** Anchor kind from the measured build: sink, stove, dishwasher, or refrigerator. */
  kind: string;
  wallId: string;
  /** Along-wall start at the moment the user placement was seated. */
  originalStart: number;
};

export type AutoDesignWiggleMove = {
  uid: string;
  kind: string;
  label: string;
  wallId: string;
  /** Signed along-wall change from the position at the start of wiggle. */
  deltaAlongIn: number;
  /** Absolute distance from the user's original placement. Never above 3 inches. */
  distanceFromOriginalIn: number;
  fromStart: number;
  toStart: number;
};

export type TrimRunKind = "moulding" | "light-rail" | "shoe" | "crown" | "toe-kick" | "batten";

export type TrimRunPiece = {
  id: string;
  kind: TrimRunKind;
  supplierId: string;
  wallId: string;
};

type WiggleGroup = {
  kind: string;
  main: PlacedCabinet;
  uids: Set<string>;
  wallId: WallSide;
};

const near = (left: number, right: number) => Math.abs(left - right) <= COLLISION_EPSILON_IN;

function alongStart(item: PlacedCabinet, side: WallSide, room: RoomData): number {
  return item.wallId === side && Number.isFinite(Number(item.wallOffset))
    ? Number(item.wallOffset)
    : wallRunOffset(item, side, room);
}

function shiftGroup(placed: PlacedCabinet[], group: WiggleGroup, delta: number, room: RoomData): PlacedCabinet[] {
  if (near(delta, 0)) return placed;
  return placed.map((item) => {
    if (!group.uids.has(item.uid)) return item;
    const side = (item.wallId ?? group.wallId) as WallSide;
    const spot = wallPlacementAtUnbounded(
      alongStart(item, side, room) + delta,
      wallRunSpan(item, side, room),
      Math.max(0, Number(item.depth) || 0),
      side,
      room,
      item.peninsulaSide,
    );
    return {
      ...item,
      ...spot,
      wallId: spot.wallId ?? item.wallId,
      wallOffset: spot.wallOffset ?? item.wallOffset,
      mountBottom: item.mountBottom,
    };
  });
}

function groupStillValid(placed: PlacedCabinet[], group: WiggleGroup, openings: readonly WallOpening[], room: RoomData): boolean {
  const members = placed.filter((item) => group.uids.has(item.uid));
  const rest = placed.filter((item) => !group.uids.has(item.uid));
  const restNoPanels = rest.filter((item) => !isRefrigeratorEndPanel(item));
  for (const member of members) {
    const side = (member.wallId ?? group.wallId) as WallSide;
    if (side !== group.wallId && member.uid === group.main.uid) return false;
    const start = alongStart(member, side, room);
    const end = start + wallRunSpan(member, side, room);
    if (start < -COLLISION_EPSILON_IN || end > wallLength(side, room) + COLLISION_EPSILON_IN) return false;
    if (isRefrigeratorEndPanel(member)) {
      if (refrigeratorEndPanelConflictDetail(member, restNoPanels, group.main.uid, room)) return false;
    } else if (cabinetPlacementCollisionDetail(member, rest, room)) return false;
  }
  const main = members.find((item) => item.uid === group.main.uid);
  if (!main) return false;
  if ((main.wallId ?? group.wallId) !== group.wallId) return false;
  if (main.mountBottom !== group.main.mountBottom) return false;
  const side = group.wallId;
  const width = wallRunSpan(main, side, room);
  const start = alongStart(main, side, room);
  return freeSegmentsOnWall(side, room, rest, [...openings], width, 0, "base", false, main, Math.max(0, Number(main.depth) || 0))
    .some((segment) => start >= segment.start - COLLISION_EPSILON_IN
      && start + width <= segment.start + segment.length + COLLISION_EPSILON_IN);
}

function rangeEdgeAt(
  placed: readonly PlacedCabinet[],
  room: RoomData,
  wallId: string,
  at: number,
  edge: "start" | "end",
): boolean {
  return placed.some((other) => {
    if (other.placement !== "appliance" || !isRangeOrOven(other.masterCode, other.description)) return false;
    if (cabinetWall(other, room) !== wallId) return false;
    const start = wallRunOffset(other, wallId, room);
    const point = edge === "start" ? start : start + wallRunSpan(other, wallId, room);
    return near(point, at);
  });
}

function segmentPenalty(
  length: number,
  catalog: DesignCabinet[],
  rangeAtStart: boolean,
  rangeAtEnd: boolean,
  cache: Map<string, number>,
): number {
  const key = `${Math.round(length * 1000)}|${rangeAtStart ? 1 : 0}|${rangeAtEnd ? 1 : 0}`;
  const cached = cache.get(key);
  if (cached != null) return cached;
  const fill = planAutoDesignBaseSegment({ length, catalog, rangeAtStart, rangeAtEnd });
  const filler = fill.items.filter((item) => item.isFiller).reduce((sum, item) => sum + item.width, 0);
  const used = fill.items.reduce((sum, item) => sum + item.width, 0);
  const uncovered = Math.max(0, Math.round((length - used) * 1000) / 1000);
  const undersized = fill.items.filter((item) => !item.isFiller && item.width < UNDERSIZED_CABINET_IN - COLLISION_EPSILON_IN).length;
  // A remainder the standard filler can still cut counts as filler. A hole wider
  // than that is a real miss and dominates the score.
  const smallRemainder = uncovered <= SMALL_GAP_FILLER_MAX_IN ? uncovered : 0;
  const largeHole = uncovered > SMALL_GAP_FILLER_MAX_IN ? uncovered : 0;
  const penalty = largeHole * 1000 + undersized * 100 + (fill.note ? 50 : 0) + filler + smallRemainder;
  cache.set(key, penalty);
  return penalty;
}

function layoutPenalty(
  placed: readonly PlacedCabinet[],
  room: RoomData,
  openings: readonly WallOpening[],
  catalog: DesignCabinet[],
  cache: Map<string, number>,
): number {
  const walls = new Set<string>();
  for (const item of placed) {
    if (item.islandFace) continue;
    walls.add(cabinetWall(item, room));
  }
  let penalty = 0;
  for (const wallId of Array.from(walls)) {
    const segments = freeSegmentsOnWall(wallId as WallSide, room, [...placed], [...openings], 0.125, 0, "base", false, undefined, STD.BASE_DEPTH);
    for (const segment of segments) {
      const end = segment.start + segment.length;
      penalty += segmentPenalty(
        segment.length,
        catalog,
        rangeEdgeAt(placed, room, wallId, segment.start, "end"),
        rangeEdgeAt(placed, room, wallId, end, "start"),
        cache,
      );
    }
  }
  return penalty;
}

function sinkLockedByModeledWindow(
  item: PlacedCabinet,
  openings: readonly WallOpening[],
  room: RoomData,
): boolean {
  if (!isSinkBaseCabinet(item)) return false;
  const wall = cabinetWall(item, room);
  const start = wallRunOffset(item, wall, room);
  const end = start + wallRunSpan(item, wall, room);
  return openings.some((opening) => opening.kind === "window"
    && opening.side === wall
    && opening.offset < end - COLLISION_EPSILON_IN
    && opening.offset + opening.width > start + COLLISION_EPSILON_IN);
}

function applianceLabel(kind: string): string {
  if (kind === "sink") return "sink";
  if (kind === "dishwasher") return "dishwasher";
  if (kind === "refrigerator") return "refrigerator";
  return "range";
}

function wiggleGroup(item: PlacedCabinet, origin: AutoDesignAnchorOrigin, placed: readonly PlacedCabinet[], room: RoomData): WiggleGroup | null {
  const wallId = cabinetWall(item, room);
  if (wallId !== origin.wallId) return null;
  const uids = new Set<string>([item.uid]);
  if (origin.kind === "refrigerator" || isRefrigerator(item)) {
    for (const member of placed) {
      if (member.refrigeratorAssemblyId === item.uid) uids.add(member.uid);
    }
  }
  return { kind: origin.kind, main: item, uids, wallId: wallId as WallSide };
}

/**
 * Slides each user-placed auto-design appliance along its own wall by the
 * smallest distance that produces the best cabinet fit, and never more than
 * 3 inches from the original placement. A shift that collides, leaves the
 * wall, or pulls a sink off a modeled window is rejected. Equal fits keep the
 * smaller move, and a tie breaks toward the wall start.
 */
export function applyAutoDesignWiggleRoom(input: {
  placed: PlacedCabinet[];
  room: RoomData;
  openings: readonly WallOpening[];
  catalog: DesignCabinet[];
  origins: readonly AutoDesignAnchorOrigin[];
  lockedUids?: readonly string[];
}): { placed: PlacedCabinet[]; moves: AutoDesignWiggleMove[] } {
  let placed = [...input.placed];
  const cache = new Map<string, number>();
  const locked = new Set(input.lockedUids ?? []);
  const moves = new Map<string, AutoDesignWiggleMove>();
  const origins = [...input.origins].sort((left, right) => left.wallId.localeCompare(right.wallId) || left.originalStart - right.originalStart);
  const entryStarts = new Map<string, number>();
  for (const origin of origins) {
    const item = placed.find((candidate) => candidate.uid === origin.uid);
    if (!item || cabinetWall(item, input.room) !== origin.wallId) continue;
    entryStarts.set(origin.uid, alongStart(item, origin.wallId as WallSide, input.room));
  }

  for (let pass = 0; pass < 2; pass += 1) {
    for (const origin of origins) {
      const item = placed.find((candidate) => candidate.uid === origin.uid);
      if (!item) continue;
      if (locked.has(item.uid) || sinkLockedByModeledWindow(item, input.openings, input.room)) continue;
      const group = wiggleGroup(item, origin, placed, input.room);
      if (!group) continue;
      const initialStart = alongStart(item, group.wallId, input.room);
      const entryStart = entryStarts.get(origin.uid) ?? initialStart;
      const currentScore = layoutPenalty(placed, input.room, input.openings, input.catalog, cache);
      let bestScore = Number.POSITIVE_INFINITY;
      let bestDeltaFromOriginal = 0;
      let found = false;
      for (let step = 0; step <= Math.round(AUTO_DESIGN_WIGGLE_ROOM_IN / WIGGLE_STEP_IN); step += 1) {
        const magnitudes = step === 0 ? [0] : [step * WIGGLE_STEP_IN, -step * WIGGLE_STEP_IN];
        for (const deltaFromOriginal of magnitudes) {
          if (Math.abs(deltaFromOriginal) > AUTO_DESIGN_WIGGLE_ROOM_IN + COLLISION_EPSILON_IN) continue;
          const target = Math.round((origin.originalStart + deltaFromOriginal) * 8) / 8;
          if (Math.abs(target - origin.originalStart) > AUTO_DESIGN_WIGGLE_ROOM_IN + COLLISION_EPSILON_IN) continue;
          const shifted = shiftGroup(placed, group, target - initialStart, input.room);
          if (!groupStillValid(shifted, group, input.openings, input.room)) continue;
          const score = layoutPenalty(shifted, input.room, input.openings, input.catalog, cache);
          const abs = Math.abs(deltaFromOriginal);
          const bestAbs = Math.abs(bestDeltaFromOriginal);
          const better = !found
            || score < bestScore - 1e-6
            || (Math.abs(score - bestScore) <= 1e-6 && (abs < bestAbs - 1e-9 || (Math.abs(abs - bestAbs) <= 1e-9 && deltaFromOriginal < bestDeltaFromOriginal)));
          if (!better) continue;
          found = true;
          bestScore = score;
          bestDeltaFromOriginal = deltaFromOriginal;
        }
      }
      if (!found || !(bestScore < currentScore - 1e-6)) continue;
      const target = Math.round((origin.originalStart + bestDeltaFromOriginal) * 8) / 8;
      if (near(target, initialStart)) continue;
      placed = shiftGroup(placed, group, target - initialStart, input.room);
      const moved = placed.find((candidate) => candidate.uid === origin.uid);
      const toStart = moved ? alongStart(moved, group.wallId, input.room) : target;
      if (near(toStart, entryStart)) {
        moves.delete(origin.uid);
        continue;
      }
      moves.set(origin.uid, {
        uid: origin.uid,
        kind: origin.kind,
        label: applianceLabel(origin.kind),
        wallId: group.wallId,
        deltaAlongIn: toStart - entryStart,
        distanceFromOriginalIn: Math.abs(toStart - origin.originalStart),
        fromStart: entryStart,
        toStart,
      });
    }
  }

  return { placed, moves: Array.from(moves.values()) };
}

function isNineInchBase(item: PlacedCabinet): boolean {
  if (item.placement !== "base" || isFillerItem(item)) return false;
  const code = (item.masterCode ?? "").trim().toLowerCase();
  if (/^b[-_]?9$/.test(code)) return true;
  return Math.abs(Number(item.width) - 9) <= 0.05;
}

function applyNineInchTrayBases(placed: PlacedCabinet[]): PlacedCabinet[] {
  let changed = false;
  const next = placed.map((item) => {
    if (!isNineInchBase(item) || (item.numberOfDrawers ?? 0) === 0) return item;
    changed = true;
    return { ...item, numberOfDrawers: 0 };
  });
  return changed ? next : placed;
}

function gapPieces(opportunity: SmallGapFillerOpportunity): Array<{ start: number; width: number; side: "left" | "right"; ownerUid: string }> {
  const before = opportunity.cabinetStart - opportunity.openingStart;
  const after = opportunity.openingStart + opportunity.openingLength - (opportunity.cabinetStart + opportunity.cabinetSpan);
  const pieces: Array<{ start: number; width: number; side: "left" | "right"; ownerUid: string }> = [];
  if (before > COLLISION_EPSILON_IN && before <= SMALL_GAP_FILLER_MAX_IN + COLLISION_EPSILON_IN) {
    const ownerUid = opportunity.boundedCabinetUids?.[0] ?? opportunity.cabinetUid;
    pieces.push({ start: opportunity.cabinetStart - before, width: before, side: "left", ownerUid });
  }
  if (after > COLLISION_EPSILON_IN && after <= SMALL_GAP_FILLER_MAX_IN + COLLISION_EPSILON_IN) {
    const ownerUid = opportunity.boundedCabinetUids?.[1] ?? opportunity.cabinetUid;
    pieces.push({ start: opportunity.cabinetStart + opportunity.cabinetSpan, width: after, side: "right", ownerUid });
  }
  return pieces;
}

/**
 * Places the standard small-gap filler in the measured seam without sliding
 * cabinets or appliances that are already seated. A board that would collide
 * is left for the wider seam helper.
 */
export function applyStandardSmallGapFillers(input: {
  placed: PlacedCabinet[];
  room: RoomData;
  openings: readonly WallOpening[];
  fillers: readonly CatalogFillerCandidate[];
  makeUid: () => string;
  styleId: number | null;
}): PlacedCabinet[] {
  let working = [...input.placed];
  for (let guard = 0; guard < 24; guard += 1) {
    let added = false;
    for (const cabinet of working) {
      if (isFillerItem(cabinet) || !["base", "wall", "tall"].includes(cabinet.placement)) continue;
      const opportunity = findPreferredSmallGapFillerOpportunity(input.room, working, input.openings, cabinet.uid);
      if (!opportunity || opportunity.remaining <= COLLISION_EPSILON_IN) continue;
      const drafts: PlacedCabinet[] = [];
      const groupId = `filler-group-${input.makeUid()}`;
      const pieces = gapPieces(opportunity);
      pieces.forEach((piece, index) => {
        const owner = working.find((item) => item.uid === piece.ownerUid) ?? cabinet;
        const layer = owner.placement === "wall" ? "wall" : owner.placement === "tall" ? "tall" : "base";
        const fillerDef = catalogFillerForGap(input.fillers, piece.width, layer);
        if (!fillerDef) return;
        const spot = wallPlacementAt(piece.start, piece.width, Math.max(0, Number(owner.depth) || dim(fillerDef.depth, layer === "wall" ? STD.WALL_DEPTH : STD.BASE_DEPTH)), opportunity.wall, input.room);
        const draft: PlacedCabinet = {
          uid: input.makeUid(),
          cabinetId: fillerDef.id,
          masterCode: fillerDef.masterCode,
          description: `${fittedCatalogFillerDescription(fillerDef, piece.width)} — install on ${piece.side}`,
          category: fillerDef.category ?? "Filler",
          subCategory: fillerDef.subCategory ?? "Filler",
          placement: layer,
          x: spot.x,
          y: spot.y,
          rotation: spot.rotation,
          ...(spot.wallId ? { wallId: spot.wallId, wallOffset: spot.wallOffset, peninsulaSide: spot.peninsulaSide } : {}),
          width: piece.width,
          nominalWidth: dim(fillerDef.width, piece.width),
          depth: dim(fillerDef.depth, layer === "wall" ? STD.WALL_DEPTH : STD.BASE_DEPTH),
          height: Number(owner.height) || (layer === "wall" ? STD.WALL_HEIGHT : STD.BASE_HEIGHT),
          numberOfDoors: 0,
          numberOfDrawers: 0,
          catalogImageUrl: fillerDef.catalogImageUrl ?? null,
          styleId: owner.styleId ?? input.styleId,
          fillerPieceGroupId: groupId,
          fillerBillingRole: index === 0 ? "primary" : "secondary",
          fillerTotalWidth: opportunity.remaining,
          fillerPlacementMode: pieces.length > 1 ? "split" : piece.side,
          fillerForCabinetUid: owner.uid,
        };
        drafts.push(matchInstalledFillerToCabinet(draft, owner, input.room));
      });
      if (!drafts.length) continue;
      const accepted = appendCollisionFreePlacements(working, drafts, input.room);
      if (accepted.rejected.length > 0 || !drafts.every((draft) => accepted.placed.some((item) => item.uid === draft.uid))) continue;
      working = accepted.placed;
      added = true;
      break;
    }
    if (!added) break;
  }
  return working;
}

function applyMissingBlindCornerFillers(input: {
  placed: PlacedCabinet[];
  room: RoomData;
  fillers: readonly CatalogFillerCandidate[];
  makeUid: () => string;
  styleId: number | null;
}): PlacedCabinet[] {
  let working = [...input.placed];
  for (const cabinet of input.placed) {
    if (!requiresConfiguredBlindCornerFiller(cabinet)) continue;
    const groupId = requiredBlindCornerFillerGroupId(cabinet);
    if (working.some((item) => item.fillerPieceGroupId === groupId || item.fillerForCabinetUid === cabinet.uid && isFillerItem(item))) continue;
    const required = buildRequiredBlindCornerFiller(cabinet, input.room, input.fillers, input.makeUid, cabinet.styleId ?? input.styleId);
    if (!required.ok) continue;
    const accepted = appendCollisionFreePlacements(working, [required.filler], input.room);
    if (!accepted.placed.some((item) => item.uid === required.filler.uid)) continue;
    working = accepted.placed;
  }
  return working;
}

/**
 * One supplier for every trim family on the project. The majority supplier
 * wins; a tie keeps the first supplier in the list.
 */
export function enforceTrimSupplierContinuity(pieces: readonly TrimRunPiece[]): TrimRunPiece[] {
  if (pieces.length === 0) return [...pieces];
  const counts = new Map<string, number>();
  for (const piece of pieces) counts.set(piece.supplierId, (counts.get(piece.supplierId) ?? 0) + 1);
  let winner = pieces[0]!.supplierId;
  let winnerCount = -1;
  for (const piece of pieces) {
    const count = counts.get(piece.supplierId) ?? 0;
    if (count > winnerCount) {
      winner = piece.supplierId;
      winnerCount = count;
    }
  }
  return pieces.map((piece) => piece.supplierId === winner ? piece : { ...piece, supplierId: winner });
}

export function crownMiterCutAllowanceIn(): number {
  return CROWN_MITER_CUT_ALLOWANCE_IN;
}

export type DesignerLayoutRuleResult = {
  placed: PlacedCabinet[];
  sinks: SinkFixture[];
  trimPieces: TrimRunPiece[];
  appliedRuleIds: string[];
};

/**
 * Shared automatic rules the normal Designer applies after a placement, run
 * here as a pure pass so auto-design does not depend on a drag or a prompt.
 * Wiggle room is intentionally separate: it has to run before the runs are tiled.
 */
export function applyDesignerLayoutRules(input: {
  placed: PlacedCabinet[];
  room: RoomData;
  openings: readonly WallOpening[];
  fillers: readonly CatalogFillerCandidate[];
  makeUid: () => string;
  styleId: number | null;
  sinks?: readonly SinkFixture[];
  trimPieces?: readonly TrimRunPiece[];
}): DesignerLayoutRuleResult {
  let placed = normalizeGlassStackersToParentFronts(
    normalizeStandardWallMounts(
      normalizeWd18CountertopMounts(
        normalizeOverSinkWallMounts([...input.placed], [...input.openings], input.room),
      ),
      [...input.openings],
      input.room,
    ),
    input.room,
  );
  placed = applyMissingBlindCornerFillers({
    placed, room: input.room, fillers: input.fillers, makeUid: input.makeUid, styleId: input.styleId,
  });
  const angled = repairMissingAngledWallFillers(placed, input.room, input.fillers, input.makeUid, input.styleId);
  placed = angled.placed;
  placed = applyStandardSmallGapFillers({
    placed, room: input.room, openings: input.openings, fillers: input.fillers, makeUid: input.makeUid, styleId: input.styleId,
  });
  placed = normalizeInstalledFillersToAdjacentCabinets(placed, input.room);
  placed = applyNineInchTrayBases(placed);
  const sinks = normalizeSinkFixturesToBases([...(input.sinks ?? [])], placed, input.room);
  const trimPieces = enforceTrimSupplierContinuity(input.trimPieces ?? []);
  return {
    placed,
    sinks,
    trimPieces,
    appliedRuleIds: DESIGNER_LAYOUT_RULES.filter((rule) => rule.phase === "shared-pipeline").map((rule) => rule.id),
  };
}

export const CROWN_MITER_ALLOWANCE_RULE_IN = CROWN_MITER_ALLOWANCE_IN;
