import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildCountertopFabricationSheet } from "./countertopFabricationSheet";
import {
  buildFabricationSheetPdf,
  ensureJsPdf,
  fabricationFeetInches,
  fabricationField,
  fabricationLength,
  fabricationSheetEmailBody,
} from "./countertopFabricationSheetPdf";
import type { PlacedCabinet, RoomData, SinkFixture } from "@/lib/design";

const room: RoomData = { width: 144, depth: 120 };
const FIXED_NOW = new Date("2026-11-05T12:00:00.000Z");

const placed: PlacedCabinet[] = [{
  uid: "sb-36",
  cabinetId: 1,
  masterCode: "SB36",
  description: '36" Sink Base Cabinet',
  placement: "base",
  x: 54,
  y: 96,
  width: 36,
  depth: 24,
  height: 34.5,
  rotation: 0,
  wallId: "bottom",
}];
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

function sampleSheet() {
  return buildCountertopFabricationSheet({
    room,
    placed,
    sinks,
    edgeProfileId: "eased",
    backsplash: { heightIn: 4 },
    selectedSurfaces: [{
      id: 9,
      name: "Calacatta Quartz",
      category: "Surfaces",
      subCategory: "Countertops",
      pelicanCode: "PL-CT-CAL",
      size: '126" x 63"',
      countertopScope: "all",
    }],
    job: {
      designName: "Rivera kitchen",
      projectName: "123 Oak St",
      customerName: "J. Rivera",
      customerEmail: "rivera@example.com",
    },
    now: FIXED_NOW,
  });
}

describe("fabrication sheet formatting", () => {
  it("prints an em dash for a value the design does not hold", () => {
    expect(fabricationLength(null)).toBe("\u2014");
    expect(fabricationLength(33)).toBe('33"');
    expect(fabricationLength(25.5)).toBe('25.5"');
    expect(fabricationField("")).toBe("\u2014");
    expect(fabricationField("  ")).toBe("\u2014");
    expect(fabricationField("Kitchen")).toBe("Kitchen");
  });

  it("formats feet and inches for the header sizes", () => {
    expect(fabricationFeetInches(144)).toBe("12'");
    expect(fabricationFeetInches(120)).toBe("10'");
    expect(fabricationFeetInches(138)).toBe("11'-6\"");
    expect(fabricationFeetInches(null)).toBe("\u2014");
  });
});

describe("fabrication sheet PDF", () => {
  it("builds a real PDF from a design", async () => {
    const JsPdf = await ensureJsPdf();
    const doc = buildFabricationSheetPdf(sampleSheet(), "CabinetDealz", JsPdf);
    const bytes = new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(bytes.byteLength).toBeGreaterThan(5000);
    // A real PDF file starts with the %PDF signature.
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("%PDF");
  });

  it("adds pages as runs are added rather than squeezing them onto one sheet", async () => {
    const JsPdf = await ensureJsPdf();
    // Five separate walls: enough runs to overflow one page of drawings.
    const manyRooms: PlacedCabinet[] = [];
    const sides = ["top", "bottom", "left", "right"] as const;
    sides.forEach((side, index) => {
      const horizontal = side === "top" || side === "bottom";
      manyRooms.push({
        uid: `run-${side}`,
        cabinetId: 1,
        masterCode: "B-48",
        description: '48" Base Cabinet',
        placement: "base",
        x: horizontal ? index * 4 : side === "left" ? 0 : 110,
        y: horizontal ? (side === "top" ? 0 : 96) : 30,
        width: 48,
        depth: 24,
        height: 34.5,
        rotation: horizontal ? 0 : 90,
        wallId: side,
      });
    });
    const sheet = buildCountertopFabricationSheet({ room, placed: manyRooms, edgeProfileId: "eased", now: FIXED_NOW });
    expect(sheet.runs.length).toBe(4);
    const doc = buildFabricationSheetPdf(sheet, "CabinetDealz", JsPdf);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
  });

  it("still produces a document for a design with no countertop", async () => {
    const JsPdf = await ensureJsPdf();
    const empty = buildCountertopFabricationSheet({ room, placed: [], now: FIXED_NOW });
    const doc = buildFabricationSheetPdf(empty, "CabinetDealz", JsPdf);
    const bytes = new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });

  it("writes the run list and the unknown fields into the email body", () => {
    const sheet = sampleSheet();
    const { subject, text } = fabricationSheetEmailBody(sheet, {
      brandName: "Reaves Way Cabinet Shop",
      note: "Templates due Friday.",
    });
    expect(subject).toContain("123 Oak St");
    expect(text).toContain("Front wall");
    expect(text).toContain("Sink: Double-bowl sink");
    expect(text).toContain('33" x 20"');
    expect(text).toContain("Templates due Friday.");
    expect(text).toContain("Sent from Reaves Way Cabinet Shop.");
  });

  it("says so in the email body when a detail is missing instead of omitting the warning", () => {
    const bare = buildCountertopFabricationSheet({ room, placed, sinks, now: FIXED_NOW });
    const { text } = fabricationSheetEmailBody(bare);
    expect(text).toContain("Not stored on the design");
    expect(text).toContain("No countertop product is selected");
  });
});

describe("fabrication sheet PDF page structure", () => {
  it("keeps the not-stored section and the field-blanking rule visible in the source", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "client/src/lib/countertopFabricationSheetPdf.ts"),
      "utf8",
    );
    expect(source).toContain("Not stored on this design");
    expect(source).toContain("const em =");
    expect(source).toContain("fabricationLength");
    // The sheet must never print a price; fabrication documents are specs only.
    expect(source).not.toContain("unitPrice");
    expect(source).not.toContain("totalPrice");
  });
});
