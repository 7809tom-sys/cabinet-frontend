import { describe, expect, it } from "vitest";
import { buildCountertopFabricationSheet } from "./countertopFabricationSheet";
import { buildCountertopLineArtSvg, buildLineArtModel, lineArtText, quoteFabricationInput, quoteFabricationSheet } from "./countertopLineArt";
import type { PlacedCabinet, RoomData, SinkFixture } from "@/lib/design";

const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };
const base = (o: Partial<PlacedCabinet>): PlacedCabinet => ({
  uid: "b", cabinetId: 1, masterCode: "B-36", description: '36" Base', category: "Base", placement: "base",
  x: 0, y: 0, width: 36, depth: 24, height: 34.5, rotation: 0, ...o,
});
const placed: PlacedCabinet[] = [
  base({ uid: "b1", x: 0, wallId: "top", wallOffset: 0 }),
  base({ uid: "b2", x: 36, wallId: "top", wallOffset: 36 }),
  base({ uid: "sb", masterCode: "SB36", description: '36" Sink Base Cabinet', x: 72, wallId: "top", wallOffset: 72 }),
  base({ uid: "b3", x: 108, wallId: "top", wallOffset: 108 }),
];
const sinks: SinkFixture[] = [{ uid: "s1", type: "single", x: 73.5, y: 1.5, width: 33, depth: 20, faucet: true, wallSide: "top", cabinetUid: "sb", sourceWidth: 33, sourceDepth: 20 }];
const now = new Date("2026-11-25T12:00:00Z");

describe("countertop line drawing", () => {
  it("adds plan outlines in room inches to every run", () => {
    const sheet = buildCountertopFabricationSheet({ room, placed, sinks, now });
    expect(sheet.runs.length).toBeGreaterThan(0);
    for (const run of sheet.runs) {
      expect(run.planOutline).toHaveLength(run.outline.length);
      for (const p of run.planOutline) {
        expect(p.x).toBeGreaterThanOrEqual(-0.01);
        expect(p.x).toBeLessThanOrEqual(144.01);
      }
    }
    expect(sheet.runs.flatMap((r) => r.cutouts).some((c) => c.planCenter)).toBe(true);
  });

  it("draws a black-line SVG with edge lengths and the sink cutout", () => {
    const sheet = buildCountertopFabricationSheet({ room, placed, sinks, now });
    const svg = buildCountertopLineArtSvg(sheet, { title: "Countertop quote #7" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('stroke="#000"');
    expect(svg).not.toMatch(/stroke="#(?!000)/);
    expect(svg).toContain("144&quot;"); // back edge length
    expect(svg).toContain("Sink cutout");
    expect(svg).toContain("Countertop quote #7");
    expect(svg).toContain("Verify every dimension on site");
  });

  it("rebuilds the design from a saved quote, including persisted sinks", () => {
    const quote = {
      id: 7,
      roomData: JSON.stringify({ ...room, persistedEntities: { sinks, island: null, ponyWalls: [], openings: [], furniture: [] } }),
      placedCabinets: placed,
      contactName: "Pat",
      contactEmail: "pat@example.com",
      createdAt: now.toISOString(),
    };
    const input = quoteFabricationInput(quote)!;
    expect(input.sinks).toHaveLength(1);
    expect(input.job?.projectName).toBe("Countertop quote #7");
    const sheet = quoteFabricationSheet(quote)!;
    expect(sheet.totals.cutoutCount).toBe(1);
    expect(sheet.job.customerName).toBe("Pat");
  });

  it("returns null for a quote with no room", () => {
    expect(quoteFabricationInput({ id: 1, roomData: null })).toBeNull();
    expect(quoteFabricationInput({ id: 1, roomData: "{bad" })).toBeNull();
  });

  it("keeps supplier names off the drawing", () => {
    expect(lineArtText("Pelican Calacatta Quartz")).toBe("Calacatta Quartz");
    const sheet = buildCountertopFabricationSheet({ room, placed, sinks, now });
    const model = buildLineArtModel(sheet, { title: "USCD job" });
    expect(model.labels.some((l) => /uscd|pelican/i.test(l.text))).toBe(false);
  });

  it("still draws the room and a note for an empty design", () => {
    const sheet = buildCountertopFabricationSheet({ room, placed: [], now });
    const svg = buildCountertopLineArtSvg(sheet);
    expect(svg).toContain("nothing to fabricate");
  });
});
