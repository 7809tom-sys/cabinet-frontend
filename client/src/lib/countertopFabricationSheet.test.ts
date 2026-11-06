import { describe, expect, it } from "vitest";
import {
  buildCountertopFabricationSheet,
  fabricationSheetFileName,
  fabricationSheetHasCutouts,
  fabricationSheetSummaryLines,
} from "./countertopFabricationSheet";
import type { IslandZone, PlacedCabinet, RoomData, SinkFixture } from "@/lib/design";

const FIXED_NOW = new Date("2026-11-05T12:00:00.000Z");

/** 12' x 10' kitchen: one full back-wall run and one full front-wall run with a sink base. */
const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };

const base = (overrides: Partial<PlacedCabinet>): PlacedCabinet => ({
  uid: "base",
  cabinetId: 1,
  masterCode: "B-24",
  description: '24" Base Cabinet',
  category: "Base",
  placement: "base",
  x: 0,
  y: 0,
  width: 24,
  depth: 24,
  height: 34.5,
  rotation: 0,
  ...overrides,
});

const placed: PlacedCabinet[] = [
  // Back wall (top), 0"..144": two 72" spans of contiguous bases.
  base({ uid: "back-1", masterCode: "B-36", x: 0, y: 0, width: 36, wallId: "top", wallOffset: 0 }),
  base({ uid: "back-2", masterCode: "B-36", x: 36, y: 0, width: 36, wallId: "top", wallOffset: 36 }),
  base({ uid: "back-3", masterCode: "B-36", x: 72, y: 0, width: 36, wallId: "top", wallOffset: 72 }),
  base({ uid: "back-4", masterCode: "B-36", x: 108, y: 0, width: 36, wallId: "top", wallOffset: 108 }),
  // Front wall (bottom), 0"..144" with a sink base centred on the run.
  base({ uid: "front-1", masterCode: "B-54", x: 0, y: 96, width: 54, wallId: "bottom", wallOffset: 0 }),
  base({ uid: "sb-36", masterCode: "SB36", description: '36" Sink Base Cabinet', x: 54, y: 96, width: 36, wallId: "bottom", wallOffset: 54 }),
  base({ uid: "front-2", masterCode: "B-54", x: 90, y: 96, width: 54, wallId: "bottom", wallOffset: 90 }),
];

const sinks: SinkFixture[] = [{
  uid: "sink-1",
  type: "double",
  x: 55.5,
  y: 97.5,
  width: 33,
  depth: 20,
  faucet: true,
  wallSide: "bottom",
  cabinetUid: "sb-36",
  sourceWidth: 33,
  sourceDepth: 20,
}];

const baseInput = { room, placed, sinks, now: FIXED_NOW };

describe("countertop fabrication sheet", () => {
  it("measures every run from the design's own slabs", () => {
    const sheet = buildCountertopFabricationSheet(baseInput);
    expect(sheet.empty).toBe(false);
    expect(sheet.totals.linearFeet).toBe(24);
    for (const run of sheet.runs) {
      expect(run.lengthIn).toBeGreaterThan(0);
      expect(run.depthIn).toBeGreaterThan(0);
      expect(run.outline.length).toBeGreaterThanOrEqual(4);
      expect(run.finishedEdgeLengthIn).toBeGreaterThan(0);
    }
    // Two full-width walls, each its own slab: 144" back + 144" front.
    expect(sheet.runs.map((run) => run.kind)).toEqual(["wall", "wall"]);
    expect(sheet.runs.map((run) => run.label)).toEqual(["Back wall", "Front wall"]);
    expect(sheet.runs.map((run) => run.lengthIn)).toEqual([144, 144]);
  });

  it("reads depth and edge exposure from the wall each slab sits on", () => {
    const sheet = buildCountertopFabricationSheet(baseInput);
    for (const run of sheet.runs) {
      // 24" cabinet plus the 1.5" finished overhang.
      expect(run.depthIn).toBe(25.5);
      // Front edge finished; the wall side and both run ends stop at a room wall.
      expect(run.edgeSummary).toEqual({ front: true, back: false, left: false, right: false });
      expect(run.finishedEdgeLengthIn).toBe(144);
    }
  });

  it("places the sink opening on its own run with measured sizes and offsets", () => {
    const sheet = buildCountertopFabricationSheet(baseInput);
    const front = sheet.runs.find((run) => run.label === "Front wall")!;
    expect(front.cutouts).toHaveLength(1);
    expect(sheet.runs.find((run) => run.label === "Back wall")!.cutouts).toHaveLength(0);
    const cutout = front.cutouts[0]!;
    expect(cutout.kind).toBe("sink");
    expect(cutout.sizeSource).toBe("product-outside-dims");
    // 33" wide x 20" deep, reported as placed: long side along the run.
    expect(cutout.alongIn).toBe(33);
    expect(cutout.acrossIn).toBe(20);
    // The sink base spans 54"..90" on the 144" run, so its centre is 72" in.
    expect(cutout.centerFromStartIn).toBe(72);
    expect(cutout.centerFromFrontIn).toBeGreaterThan(0);
    expect(cutout.centerFromFrontIn).toBeLessThan(25.5);
    expect(fabricationSheetHasCutouts(sheet)).toBe(true);
  });

  it("measures an island from the island's own stored reveal", () => {
    const islandPlaced = [base({ uid: "island-base", x: 48, y: 48, width: 24, depth: 24, islandFace: "front" })];
    const island: IslandZone = { x: 48, y: 48, width: 24, depth: 24, activeFace: "front" };
    const sheet = buildCountertopFabricationSheet({ room, placed: islandPlaced, island, now: FIXED_NOW });
    const islandRun = sheet.runs.find((run) => run.kind === "island");
    expect(islandRun).toBeDefined();
    expect(islandRun!.label).toBe("Island");
    // 24" cabinet plus the standard 1.5" reveal on every side.
    expect(islandRun!.lengthIn).toBe(27);
    expect(islandRun!.depthIn).toBe(27);
    expect(islandRun!.edgeSummary).toEqual({ front: true, back: true, left: true, right: true });
    expect(islandRun!.finishedEdgeLengthIn).toBe(108);
  });

  it("honours a custom island overhang the design stores", () => {
    const islandPlaced = [base({ uid: "island-base", x: 48, y: 48, width: 24, depth: 24, islandFace: "front" })];
    const island: IslandZone = { x: 48, y: 48, width: 24, depth: 24, activeFace: "front", countertopOverhang: 3 };
    const sheet = buildCountertopFabricationSheet({ room, placed: islandPlaced, island, now: FIXED_NOW });
    const islandRun = sheet.runs.find((run) => run.kind === "island")!;
    expect(islandRun.lengthIn).toBe(30);
    expect(islandRun.depthIn).toBe(30);
  });

  it("labels and frames a peninsula from its own run record", () => {
    const peninsulaRoom: RoomData = {
      ...room,
      peninsulaRuns: [{
        id: "pen-1",
        parentWall: "bottom",
        startOffset: 120,
        turn: 90,
        direction: "right",
        length: 60,
        height: 34.5,
        cabinetSide: "right",
        label: "Peninsula · right",
      }],
    };
    // Two 30" bases seated on the peninsula run, placed by the same rule the
    // Designer uses: rotation follows the run, wallOffset is the along-run start.
    const peninsulaCabinets: PlacedCabinet[] = [
      base({ uid: "pen-a", masterCode: "B-30", x: 120, y: 60, width: 30, depth: 24, rotation: 90, wallId: "pen-1", wallOffset: 0, peninsulaSide: "right" }),
      base({ uid: "pen-b", masterCode: "B-30", x: 120, y: 90, width: 30, depth: 24, rotation: 90, wallId: "pen-1", wallOffset: 30, peninsulaSide: "right" }),
    ];
    const sheet = buildCountertopFabricationSheet({ room: peninsulaRoom, placed: peninsulaCabinets, now: FIXED_NOW });
    const peninsula = sheet.runs.find((run) => run.kind === "peninsula");
    expect(peninsula?.label).toBe("Peninsula · right");
    expect(peninsula!.lengthIn).toBe(60);
    expect(peninsula!.depthIn).toBe(25.5);
    expect(peninsula!.finishedEdgeLengthIn).toBeGreaterThan(0);
  });

  it("counts a cooktop opening when the design seats one in a slab", () => {
    // A 30" cooktop over its own 36" base, as the Designer seats one.
    const cookBase = base({ uid: "ct-base", masterCode: "B-36", x: 18, y: 0, width: 36, wallId: "top", wallOffset: 18 });
    const cooktop: PlacedCabinet = {
      ...base({ uid: "ct-base:cooktop", x: 18, y: 0, width: 30, depth: 24, masterCode: "CT30" }),
      placement: "appliance",
      applianceRole: "countertop-opening",
      applianceCatalogName: "30\" Induction Cooktop",
    };
    const sheet = buildCountertopFabricationSheet({
      room,
      placed: [...placed.filter((item) => item.uid !== "back-1" || true), cookBase, cooktop],
      sinks,
      now: FIXED_NOW,
    });
    const cutout = sheet.runs.flatMap((run) => run.cutouts).find((item) => item.kind === "cooktop");
    expect(cutout).toBeDefined();
    expect(cutout!.label).toBe("30\" Induction Cooktop");
    expect(cutout!.alongIn).toBe(30);
    expect(cutout!.sizeSource).toBe("design-footprint");
    // One cooktop plus the sink.
    expect(sheet.totals.cutoutCount).toBe(2);
  });

  it("leaves fields the design does not hold blank and lists every one", () => {
    const sheet = buildCountertopFabricationSheet(baseInput);
    expect(sheet.materials.every((material) => material.name === null)).toBe(true);
    expect(sheet.edgeProfile).toBeNull();
    expect(sheet.backsplash).toBeNull();
    for (const run of sheet.runs) expect(run.topHeightIn).toBeNull();
    const unknowns = sheet.unknowns.join(" | ");
    expect(unknowns).toContain("Slab thickness is not stored");
    expect(unknowns).toContain("Seam layout is not decided");
    expect(unknowns).toContain("No countertop product is selected");
    expect(unknowns).toContain("No backsplash height is set");
    expect(unknowns).toContain("No edge profile is stored");
    expect(unknowns).toContain("Finished countertop height is not stored");
  });

  it("reports a chosen product, edge and backsplash when the design really has them", () => {
    const sheet = buildCountertopFabricationSheet({
      ...baseInput,
      edgeProfileId: "bullnose",
      backsplash: { heightIn: 4 },
      selectedSurfaces: [{
        id: 42,
        name: "Calacatta Quartz",
        category: "Surfaces",
        subCategory: "Countertops",
        pelicanCode: "PL-CT-CAL",
        size: '126" x 63"',
        countertopScope: "all",
      }],
      job: { designName: "Galley kitchen", customerName: "J. Rivera" },
    });
    expect(sheet.materials[0]).toMatchObject({ name: "Calacatta Quartz", code: "PL-CT-CAL", scope: "perimeter" });
    expect(sheet.edgeProfile).toEqual({ id: "bullnose", name: "Full Bullnose" });
    expect(sheet.backsplash).toEqual({ heightIn: 4, fullHeight: false });
    expect(sheet.job.customerName).toBe("J. Rivera");
    const unknowns = sheet.unknowns.join(" | ");
    expect(unknowns).not.toContain("No countertop product is selected");
    expect(unknowns).not.toContain("No backsplash height is set");
    expect(unknowns).not.toContain("No edge profile is stored");
    // Slab thickness and seam layout are still genuinely absent.
    expect(unknowns).toContain("Slab thickness is not stored");
  });

  it("keeps a full-height backsplash distinct from a measured upstand", () => {
    const sheet = buildCountertopFabricationSheet({ ...baseInput, backsplash: { fullHeight: true } });
    expect(sheet.backsplash).toEqual({ heightIn: null, fullHeight: true });
    expect(sheet.unknowns.join(" ")).not.toContain("No backsplash height is set");
  });

  it("never reports an opening size the design does not have", () => {
    const bareSink: SinkFixture = { uid: "s", type: "single", x: 60, y: 100, width: 16, depth: 18, faucet: false, wallSide: "bottom" };
    const single = base({ uid: "sb-1", masterCode: "SB24", x: 54, y: 96, width: 24, wallId: "bottom" });
    const sheet = buildCountertopFabricationSheet({ room, placed: [single], sinks: [bareSink], now: FIXED_NOW });
    const cutout = sheet.runs.flatMap((run) => run.cutouts)[0]!;
    expect(cutout.sizeSource).toBe("design-footprint");
    // The placed footprint, exactly — nothing rescaled or defaulted.
    expect(cutout.alongIn).toBe(16);
    expect(cutout.acrossIn).toBe(18);
  });

  it("lists an opening the design holds but cannot place on a slab", () => {
    // Far from every slab: the design holds the basin but draws no top under it.
    const floating: SinkFixture = { uid: "f", type: "bar", x: 60, y: 40, width: 12, depth: 12, faucet: false };
    const sheet = buildCountertopFabricationSheet({ room, placed, sinks: [...sinks, floating], now: FIXED_NOW });
    expect(sheet.runs.flatMap((run) => run.cutouts)).toHaveLength(1);
    expect(sheet.unmatchedCutouts).toHaveLength(1);
    expect(sheet.unmatchedCutouts[0]!.centerFromStartIn).toBeNull();
    expect(sheet.unmatchedCutouts[0]!.notes.join(" ")).toContain("no cutout position can be given");
  });

  it("returns an empty sheet instead of a fabricated run when nothing bears a top", () => {
    const sheet = buildCountertopFabricationSheet({ room, placed: [], now: FIXED_NOW });
    expect(sheet.empty).toBe(true);
    expect(sheet.runs).toEqual([]);
    expect(sheet.totals).toMatchObject({ runCount: 0, cutoutCount: 0, squareFeet: 0 });
    expect(sheet.unknowns[0]).toContain("no countertop-bearing run");
  });

  it("ignores tall and wall cabinets, which never take a top", () => {
    const sheet = buildCountertopFabricationSheet({
      room,
      placed: [
        base({ uid: "tall", placement: "tall", height: 84, x: 0, y: 0 }),
        base({ uid: "wall", placement: "wall", height: 30, depth: 12, x: 20, y: 0 }),
      ],
      now: FIXED_NOW,
    });
    expect(sheet.empty).toBe(true);
  });

  it("builds a stable file name and a readable email summary", () => {
    const sheet = buildCountertopFabricationSheet({
      ...baseInput,
      job: { projectName: "123 Oak St — Whole Home" },
    });
    expect(fabricationSheetFileName(sheet)).toBe("cabinetdealz-countertop-fabrication-123-oak-st-whole-home.pdf");
    expect(fabricationSheetFileName(sheet, "Reaves Way Cabinet Shop")).toBe(
      "reaves-way-cabinet-shop-countertop-fabrication-123-oak-st-whole-home.pdf",
    );
    const summary = fabricationSheetSummaryLines(sheet);
    expect(summary.length).toBeGreaterThan(0);
    expect(summary.some((line) => line.includes("Sink:"))).toBe(true);
  });

  it("falls back to the design name, then a generic name, for the file", () => {
    const named = buildCountertopFabricationSheet({ ...baseInput, job: { designName: "Rivera Kitchen" } });
    expect(fabricationSheetFileName(named)).toContain("rivera-kitchen");
    const bare = buildCountertopFabricationSheet(baseInput);
    expect(fabricationSheetFileName(bare)).toBe("cabinetdealz-countertop-fabrication-design.pdf");
  });
});
