import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("DesignTool photoreal custom walls", () => {
  it("groups scene cabinets by arbitrary wall id instead of a cardinal-only Record", () => {
    const start = source.indexOf("const buildPhotorealScene = useCallback");
    const end = source.indexOf("// The room's four walls as spans", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const builder = source.slice(start, end);

    expect(builder).toContain("const wallCabs = new Map<string, PlacedCabinet[]>()");
    expect(builder).toContain("const cabs = wallCabs.get(w) ?? [];");
    expect(builder).toContain("wallCabs.set(w, cabs);");
    expect(builder).toContain("wallCabs.forEach((cabs, side) => {");
    expect(builder).toContain("wallRunOffset(a, side, room) - wallRunOffset(b, side, room)");
    expect(builder).not.toContain("const wallCabs: Record<WallSide, PlacedCabinet[]>");
  });

  it("labels drawn walls from their measured wall record while preserving cardinal labels", () => {
    const start = source.indexOf("const buildPhotorealScene = useCallback");
    const end = source.indexOf("// The room's four walls as spans", start);
    const builder = source.slice(start, end);

    expect(builder).toContain("const customWall = room.customWalls?.find((candidate) => candidate.id === wallId);");
    expect(builder).toContain("customWall?.label?.trim()");
    expect(builder).toContain("const cardinalLabel = wallNames[wallId as WallSide];");
  });
});
