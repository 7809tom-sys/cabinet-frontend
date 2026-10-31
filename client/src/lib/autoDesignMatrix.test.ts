import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hasAefPrintedGeometry } from "@shared/aefFramelessGeometry";
import type { DesignSceneTags } from "@shared/designSceneTags";
import catalogFixture from "./__fixtures__/autoDesignMatrixCatalog.json";
import { AUTO_DESIGN_GALLEY_WALLS, autoDesignCornerSlots } from "./autoDesignCornerStage";
import { wallLabelToEngineWallId, type AutoDesignInputs, type AutoDesignLayoutType } from "./autoDesignAutoBuild";
import { mergeAutoDesignRefrigeratorCaps, runAutoDesignLayout, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import { reviewRangeFridgeSeparation } from "./kitchenAdjacency";
import { autoDesignHoodMountBottom } from "./autoDesignRangeHood";
import { kitchenRuleNumber, resetKitchenRuleParameters } from "./kitchenRuleParameters";
import {
  cabinetPlacementCollisionDetail,
  cabinetWall,
  freeSegmentsOnWall,
  wallPlacementAt,
  isCornerCabinet,
  isRefrigerator,
  isSinkBaseCabinet,
  placedFootprint,
  wallRunFrame,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "./design";

type StylePack = {
  name: string;
  base: DesignCabinet[];
  wall: DesignCabinet[];
  accessory: DesignCabinet[];
  surround: { deepAbove?: DesignCabinet[]; endPanels?: DesignCabinet[] };
};

const catalog = catalogFixture as unknown as Record<string, StylePack>;
const FRAMELESS = new Set(["540005", "540007", "540029"]);

type CaseSpec = {
  id: string;
  seed: string;
  styleId: string;
  layout: AutoDesignLayoutType;
  room: { width: number; depth: number };
  sinkCenter: number;
  rangeWall: "Wall 1" | "Wall 2" | "Wall 3";
  rangeCenter: number;
  fridgeWall: "Wall 1" | "Wall 2" | "Wall 3";
  fridgeCenter: number;
  dishwasherSide: "left" | "right";
  stoveCode?: string;
  skipDishwasher?: boolean;
};

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function appliance(code: string, width: number, depth: number, height: number): DesignCabinet {
  return {
    id: 0, masterCode: code, description: code, category: "Appliance", subCategory: "Appliance",
    width: String(width), depth: String(depth), height: String(height), placement: "appliance",
  } as DesignCabinet;
}

const palette = [
  appliance("RANGE-30", 30, 25, 36),
  appliance("RANGE-42", 42, 25, 36),
  appliance("DW-24", 24, 24, 34.5),
  appliance("FRIDGE-36", 36, 30, 70),
  appliance("HOOD-30", 30, 18, 18),
  appliance("HOOD-36", 36, 18, 18),
  appliance("HOOD-42", 42, 18, 18),
];

function roomOf(size: { width: number; depth: number }): RoomData {
  return { width: size.width, depth: size.depth, ceilingHeight: 96 };
}

function wallLength(label: "Wall 1" | "Wall 2" | "Wall 3", room: RoomData): number {
  const wall = wallLabelToEngineWallId(label, room, "left", "right");
  return wall?.frame.length ?? (label === "Wall 2" ? room.depth : room.width);
}

function inputFor(spec: CaseSpec): AutoDesignInputs {
  return {
    layoutType: spec.layout,
    originCorner: "left",
    runDirection: "right",
    wallCabinetHeightIn: 30,
    sink: { wallLabel: "Wall 3", centerOffsetIn: spec.sinkCenter },
    sinkBaseWidthIn: 36,
    sinkBaseKind: "regular",
    stove: { wallLabel: spec.rangeWall, centerOffsetIn: spec.rangeCenter },
    dishwasher: null,
    skipDishwasher: spec.skipDishwasher,
    dishwasherSide: spec.dishwasherSide,
    refrigerator: { wallLabel: spec.fridgeWall, centerOffsetIn: spec.fridgeCenter },
    refrigeratorWidthIn: 36,
    refrigeratorPanels: "both",
    refrigeratorEnclosure: "cabinet-above",
    kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
  };
}

const standard: CaseSpec[] = (["galley", "l-shape", "u-shape", "single-wall"] as const).flatMap((layout) =>
  (["540005", "540007", "330014"] as const).map((styleId) => {
    const galley = layout === "galley";
    const single = layout === "single-wall";
    return {
      id: `${layout}-${styleId}`,
      seed: `standard-${layout}-${styleId}`,
      styleId,
      layout,
      room: { width: 144, depth: 120 },
      sinkCenter: 72,
      rangeWall: galley ? "Wall 1" : single ? "Wall 3" : "Wall 2",
      rangeCenter: single ? 129 : galley ? 96 : 60,
      fridgeWall: layout === "l-shape" || layout === "u-shape" ? "Wall 1" : single ? "Wall 3" : "Wall 1",
      fridgeCenter: layout === "l-shape" ? 72 : layout === "u-shape" ? 108 : single ? 22 : 36,
      dishwasherSide: "right" as const,
    };
  }),
);

const variedStyles = ["540029", "330020", "510004", "330002", "540005", "330014", "540007", "540029"];
const variedRooms = [
  { width: 120, depth: 96 }, { width: 120, depth: 144 }, { width: 168, depth: 132 }, { width: 192, depth: 120 },
  { width: 144, depth: 120 }, { width: 120, depth: 96 }, { width: 168, depth: 120 }, { width: 144, depth: 96 },
];
const variedLayouts: AutoDesignLayoutType[] = ["galley", "l-shape", "u-shape", "single-wall", "galley", "l-shape", "u-shape", "single-wall"];
const fridgeBias = ["corner", "mid", "end", "corner", "mid", "end", "corner", "mid"] as const;

function variedCases(): CaseSpec[] {
  return variedStyles.map((styleId, index) => {
    const rng = mulberry32(81100 + index);
    const layout = variedLayouts[index]!;
    const room = roomOf(variedRooms[index]!);
    const allowed: Array<"Wall 1" | "Wall 2" | "Wall 3"> = layout === "galley"
      ? ["Wall 1", "Wall 3"]
      : layout === "single-wall" ? ["Wall 3"] : ["Wall 1", "Wall 2", "Wall 3"];
    const occupied: Record<string, Array<[number, number]>> = {};
    const take = (wall: "Wall 1" | "Wall 2" | "Wall 3", width: number, bias: "corner" | "mid" | "end") => {
      const length = wallLength(wall, room);
      const min = width / 2 + 2;
      const max = Math.max(min, length - width / 2 - 2);
      const preferred = bias === "mid" ? (min + max) / 2 : bias === "corner" ? max : min + rng() * (max - min);
      const candidates = [preferred, max, min, (min + max) / 2];
      for (let center = min; center <= max; center += 3) candidates.push(center);
      const blocks = occupied[wall] ?? [];
      for (const center of candidates) {
        const start = center - width / 2;
        const end = center + width / 2;
        if (start < -0.1 || end > length + 0.1) continue;
        const pad = width >= 30 ? 15 : 0;
        if (blocks.some(([blockStart, blockEnd]) => end + pad > blockStart + 0.5 && start - pad < blockEnd - 0.5)) continue;
        blocks.push([start, end]);
        occupied[wall] = blocks;
        return Math.round(center * 8) / 8;
      }
      return null;
    };
    const place = (walls: Array<"Wall 1" | "Wall 2" | "Wall 3">, width: number, bias: "corner" | "mid" | "end") => {
      for (const wall of walls) {
        const center = take(wall, width, bias);
        if (center != null) return { wall, center };
      }
      const fallback = walls[0]!;
      return { wall: fallback, center: Math.round(wallLength(fallback, room) / 2) };
    };
    const sinkCenter = take("Wall 3", 36, "mid") ?? Math.round(wallLength("Wall 3", room) / 2);
    const dishwasherSide = rng() < 0.5 ? "left" : "right";
    const dwCenter = sinkCenter + (dishwasherSide === "right" ? 30 : -30);
    const dwWall = wallLength("Wall 3", room);
    if (dwCenter - 12 > 1 && dwCenter + 12 < dwWall - 1) occupied["Wall 3"] = [...(occupied["Wall 3"] ?? []), [dwCenter - 12, dwCenter + 12]];
    const useWideRange = index === 3;
    const rangeSpot = place(allowed, useWideRange ? 42 : 30, "mid");
    const fridgeWalls = layout === "l-shape" || layout === "u-shape" ? ["Wall 1" as const, ...allowed] : allowed;
    const fridgeSpot = place(fridgeWalls, 36, fridgeBias[index]!);
    return {
      id: `varied-${index}-${layout}-${styleId}`,
      seed: `811${String(index).padStart(2, "0")}`,
      styleId,
      layout,
      room: variedRooms[index]!,
      sinkCenter,
      rangeWall: rangeSpot.wall,
      rangeCenter: rangeSpot.center,
      fridgeWall: fridgeSpot.wall,
      fridgeCenter: fridgeSpot.center,
      dishwasherSide,
      stoveCode: useWideRange ? "RANGE-42" : undefined,
    };
  }).map((spec, index) => {
    if (index === 0) return { ...spec, rangeWall: "Wall 1" as const, rangeCenter: 100, fridgeWall: "Wall 1" as const, fridgeCenter: 22 };
    if (index === 6) return { ...spec, room: { width: 144, depth: 120 }, sinkCenter: 72, rangeWall: "Wall 2" as const, rangeCenter: 60, fridgeWall: "Wall 1" as const, fridgeCenter: 108, dishwasherSide: "right" as const };
    if (index === 7) return { ...spec, sinkCenter: 72, rangeWall: "Wall 3" as const, rangeCenter: 129, fridgeWall: "Wall 3" as const, fridgeCenter: 22, dishwasherSide: "right" as const };
    return spec;
  });
}

function layoutWalls(spec: CaseSpec, room: RoomData): WallSide[] {
  if (spec.layout === "galley") {
    return AUTO_DESIGN_GALLEY_WALLS.flatMap((label) => {
      const wall = wallLabelToEngineWallId(label, room, "left", "right");
      return wall ? [wall.engineWallId as WallSide] : [];
    });
  }
  if (spec.layout === "single-wall") {
    const wall = wallLabelToEngineWallId("Wall 3", room, "left", "right");
    return wall ? [wall.engineWallId as WallSide] : [];
  }
  const walls = new Set<WallSide>();
  for (const item of [] as PlacedCabinet[]) walls.add(cabinetWall(item, room) as WallSide);
  return [];
}

function audit(spec: CaseSpec, run: AutoDesignLayoutSuccess, room: RoomData): string[] {
  const issues: string[] = [];
  const placed = run.placed;
  const frameless = FRAMELESS.has(spec.styleId) || placed.some((item) => hasAefPrintedGeometry(item));
  const slots = autoDesignCornerSlots(spec.layout, {
    wallIds: ["top", "right", "bottom", "left"], room, originCorner: "left", runDirection: "right",
  });
  if ((spec.layout === "galley" || spec.layout === "single-wall") && (slots.length > 0 || run.cornerSlots.length > 0)) {
    issues.push(`corner slots ${run.cornerSlots.map((slot) => slot.label).join(", ") || slots.map((slot) => slot.id).join(",")}`);
  }
  if ((spec.layout === "galley" || spec.layout === "single-wall") && placed.some((item) => isCornerCabinet(item.masterCode, item.description) || /blind/i.test(`${item.cornerType ?? ""} ${item.masterCode}`))) {
    issues.push("corner cabinet on a straight layout");
  }
  const fridge = placed.find((item) => isRefrigerator(item));
  if (!fridge) issues.push("refrigerator missing");
  else {
    const panels = placed.filter((item) => item.refrigeratorAssemblyRole === "left-panel" || item.refrigeratorAssemblyRole === "right-panel");
    const bridge = placed.find((item) => item.refrigeratorAssemblyRole === "bridge");
    if (panels.length < 2) issues.push(`fridge panels ${panels.length}`);
    if (!bridge || bridge.depth < 20) issues.push(`fridge cap depth ${bridge?.depth ?? "missing"}`);
  }
  for (const item of placed.filter((entry) => entry.placement === "wall")) {
    const overFridge = item.refrigeratorAssemblyRole === "bridge";
    if (item.depth >= 20 && !overFridge && !isCornerCabinet(item.masterCode, item.description) && !item.cornerType) {
      issues.push(`${item.masterCode} is ${item.depth}" deep outside the refrigerator`);
    }
    if (frameless && !overFridge && Math.abs(item.depth - 13.5) > 0.25 && item.depth < 20) issues.push(`${item.masterCode} depth ${item.depth} is not 13.5`);
  }
  const sinkBases = placed.filter((item) => item.placement === "base" && isSinkBaseCabinet(item));
  if (sinkBases.length !== 1 || run.sinks.length !== 1) issues.push(`sinks bases=${sinkBases.length} fixtures=${run.sinks.length}`);
  const hood = placed.find((item) => /^HOOD-/i.test(item.masterCode));
  const range = placed.find((item) => item.placement === "appliance" && /RANGE/i.test(item.masterCode));
  if (range && !hood) issues.push("no hood over the range");
  if (hood && hood.mountBottom !== autoDesignHoodMountBottom(hood.width)) issues.push(`hood ${hood.masterCode} bottom ${hood.mountBottom}`);
  if (hood && Math.abs(hood.depth - 18) > 0.05) issues.push(`hood depth ${hood.depth}`);
  if (reviewRangeFridgeSeparation(placed, room).length) issues.push("range and refrigerator are closer than a 15 inch cabinet");
  for (const item of placed) {
    const fillerWidth = item.fillerTotalWidth ?? (/filler|scribe|^OF\d/i.test(`${item.masterCode} ${item.description ?? ""}`) ? item.width : 0);
    if (fillerWidth > 3.05) issues.push(`${item.masterCode} filler ${fillerWidth}" over 3 inch max`);
    if (/^WER/i.test(item.masterCode) && item.depth >= 20 && spec.layout !== "u-shape" && spec.layout !== "l-shape") {
      issues.push(`${item.masterCode} deep easy-reach in a straight run`);
    }
  }
  for (const move of run.wiggleMoves) {
    if (move.kind === "refrigerator" && move.inchesMoved > kitchenRuleNumber("jog_max_in") + 0.05) {
      issues.push(`fridge jog ${move.inchesMoved}`);
    }
  }
  const walls = spec.layout === "galley" || spec.layout === "single-wall"
    ? layoutWalls(spec, room)
    : Array.from(new Set(placed.filter((item) => item.placement === "base" || item.placement === "appliance").map((item) => cabinetWall(item, room) as WallSide)));
  for (const wall of walls) {
    const frame = wallRunFrame(wall, room);
    if (!frame) continue;
    const coveredByCabinet = (along: number) => {
      const point = {
        x: frame.start.x + frame.tangent.x * along,
        y: frame.start.y + frame.tangent.y * along,
      };
      return placed.some((item) => {
        const foot = placedFootprint(item);
        return point.x >= item.x - 0.75 && point.x <= item.x + foot.w + 0.75
          && point.y >= item.y - 0.75 && point.y <= item.y + foot.d + 0.75;
      });
    };
    const probeBlocked = (along: number, length: number, layer: "base" | "wall", depth: number) => {
      const spot = wallPlacementAt(along, Math.min(length, 9), depth, wall, room);
      if (!spot) return true;
      const probe = {
        uid: "probe", cabinetId: 0, masterCode: "PROBE", description: "probe", placement: layer,
        ...spot, width: Math.min(length, 9), depth, height: layer === "wall" ? 30 : 34.5, mountBottom: layer === "wall" ? 54 : 0,
      } as PlacedCabinet;
      return cabinetPlacementCollisionDetail(probe, placed, room) != null;
    };
    const baseGaps = freeSegmentsOnWall(wall, room, placed, run.sinkWindow ? [run.sinkWindow] : [], 3.05, 0, "base", false);
    for (const gap of baseGaps) {
      if (gap.length > 3.05 && !coveredByCabinet(gap.start + gap.length / 2) && !probeBlocked(gap.start, gap.length, "base", 24)) {
        issues.push(`base gap ${gap.length.toFixed(2)}" on ${wall}`);
      }
    }
    const upperGaps = freeSegmentsOnWall(wall, room, placed, run.sinkWindow ? [run.sinkWindow] : [], 3.05, 3, "wall", true);
    for (const gap of upperGaps) {
      if (gap.length > 3.05 && !coveredByCabinet(gap.start + gap.length / 2) && !probeBlocked(gap.start, gap.length, "wall", 13.5)) {
        issues.push(`upper gap ${gap.length.toFixed(2)}" on ${wall}`);
      }
    }
    const occupied = placed.some((item) => (item.placement === "base" || item.placement === "appliance") && cabinetWall(item, room) === wall);
    if (!occupied) issues.push(`no base run on ${wall}`);
  }
  return issues;
}

function payload(spec: CaseSpec, run: AutoDesignLayoutSuccess, room: RoomData) {
  const tags: DesignSceneTags = {
    layoutShape: spec.layout,
    doorStyleId: Number(spec.styleId),
    doorStyleName: catalog[spec.styleId]!.name,
    seed: spec.seed,
    roomWidthIn: room.width,
    roomDepthIn: room.depth,
  };
  return {
    name: `Auto-Design ${spec.layout} ${tags.doorStyleName} seed ${spec.seed}`,
    styleId: tags.doorStyleId,
    styleName: tags.doorStyleName,
    roomType: "kitchen",
    sceneTags: tags,
    room: {
      ...room,
      persistedEntities: { openings: run.sinkWindow ? [run.sinkWindow] : [], sinks: run.sinks, potFillers: [], island: null, furniture: [], ponyWalls: [] },
    },
    placed: run.placed,
  };
}

function runCase(spec: CaseSpec) {
  resetKitchenRuleParameters();
  const pack = catalog[spec.styleId];
  if (!pack) throw new Error(`missing catalog ${spec.styleId}`);
  const room = roomOf(spec.room);
  let uid = 0;
  const result = runAutoDesignLayout({
    input: inputFor(spec),
    room,
    openings: [],
    baseCatalog: pack.base,
    wallCatalog: pack.wall,
    fillers: pack.accessory,
    appliancePalette: palette.map((item) => spec.stoveCode && item.masterCode === "RANGE-30" ? item : item),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround.endPanels ?? [],
    styleId: Number(spec.styleId),
    makeUid: () => `m-${++uid}`,
    stoveMasterCode: spec.stoveCode,
  });
  return { result, room };
}

describe("Auto-Design live repros", () => {
  it("refuses a 36 inch sink centered at 72 on a 70.25 inch Wall 3 and does not leave a partial kitchen", () => {
    resetKitchenRuleParameters();
    const room: RoomData = {
      width: 156,
      depth: 156,
      ceilingHeight: 96,
      vertices: [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 156, y: 0 },
        { id: "c", x: 156, y: 156 },
        { id: "d", x: 85.75, y: 156 },
        { id: "e", x: 0, y: 156 },
      ],
      customWalls: [
        { id: "w1", startVertexId: "a", endVertexId: "b" },
        { id: "w2", startVertexId: "b", endVertexId: "c" },
        { id: "w3", startVertexId: "c", endVertexId: "d" },
        { id: "w4", startVertexId: "d", endVertexId: "e" },
        { id: "w5", startVertexId: "e", endVertexId: "a" },
      ],
    };
    const pack = catalog["540005"]!;
    let uid = 0;
    const result = runAutoDesignLayout({
      input: inputFor({
        id: "l-short-wall",
        seed: "live-l-156",
        styleId: "540005",
        layout: "l-shape",
        room: { width: 156, depth: 156 },
        sinkCenter: 72,
        rangeWall: "Wall 1",
        rangeCenter: 40,
        fridgeWall: "Wall 1",
        fridgeCenter: 120,
        dishwasherSide: "right",
      }),
      room,
      openings: [],
      baseCatalog: pack.base,
      wallCatalog: pack.wall,
      fillers: pack.accessory,
      appliancePalette: palette,
      refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround.deepAbove ?? []),
      refrigeratorEndPanels: pack.surround.endPanels ?? [],
      styleId: 540005,
      makeUid: () => `short-${++uid}`,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/does not fit|cannot be placed/);
  });
});

describe("Auto-Design matrix", () => {
  const rows: { section: string; spec: CaseSpec; issues: string[]; corners: string; run: AutoDesignLayoutSuccess | null }[] = [];

  for (const spec of [...standard.map((item) => ({ section: "standard", spec: item })), ...variedCases().map((item) => ({ section: "varied", spec: item }))]) {
    it(`${spec.section} ${spec.spec.id} seed ${spec.spec.seed}`, () => {
      const { result, room } = runCase(spec.spec);
      const issues = result.ok ? audit(spec.spec, result, room) : [result.message];
      rows.push({
        section: spec.section,
        spec: spec.spec,
        issues,
        corners: result.ok ? result.seatedCorners.map((corner) => `${corner.family}:${corner.masterCode}`).join(", ") || "none" : "build-failed",
        run: result.ok ? result : null,
      });
      expect(issues, issues.join(" | ")).toEqual([]);
    });
  }

  it("writes perfect-run design payloads", () => {
    const dir = resolve(process.cwd(), "test-artifacts/auto-design-perfect-runs");
    mkdirSync(dir, { recursive: true });
    const perfect = rows.filter((row) => row.issues.length === 0 && row.run);
    const index = perfect.map((row) => ({
      id: row.spec.id,
      section: row.section,
      seed: row.spec.seed,
      layout: row.spec.layout,
      styleId: Number(row.spec.styleId),
      styleName: catalog[row.spec.styleId]!.name,
      room: row.spec.room,
      corners: row.corners,
      file: `${row.spec.id}.json`,
    }));
    writeFileSync(resolve(dir, "index.json"), JSON.stringify(index, null, 2));
    for (const row of perfect) {
      const room = roomOf(row.spec.room);
      writeFileSync(resolve(dir, `${row.spec.id}.json`), JSON.stringify(payload(row.spec, row.run!, room)));
    }
    expect(perfect.length).toBe(standard.length + variedStyles.length);
  });
});
