import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const designSource = readFileSync(new URL("../lib/design.ts", import.meta.url), "utf8");

describe("required sink-base placement", () => {
  it("does not hard-stop a sink base when the centered window span is occupied", () => {
    expect(source).toContain("const sinkWindowFallbackSpot = hasActiveWallWindow && !sinkWindowSpot");
    expect(source).toContain("if (!nextSpot && isSinkBasePlacement)");
    expect(source).toContain("sinkWindowFallbackSpot ?? wallPlacementAt(0, width, depth, activeWall, room)");
    expect(source).toContain("Clearance is advisory for sink bases");
    expect(source).not.toContain("was not added because the centered ${formatInches(width)} sink-base span below this window is blocked");
  });

  it("keeps ordinary cabinet collision rejection while making sink-base collision advisory", () => {
    expect(source).toContain("if (cabinetPlacementCollisionDetail(finalCab, normalizedPrevious, room) && !isSinkBasePlacement)");
    expect(source).toContain("const sinkBaseCollision = isSinkBasePlacement");
    expect(source).toContain("The sink base remains in the plan for user review.");
  });

  it("seeds an editable sink with faucet enabled when a sink base commits", () => {
    expect(source).toContain("const defaultSink = makeDefaultSinkForCabinet(finalCab, room, defaultSinkType);");
    expect(source).toContain("setSelectedSinkUid(defaultSink.uid);");
    expect(designSource).toContain("return { ...makeSinkForCabinet(type, cabinet, room), faucet: true };");
  });

  it("preserves sink bases during restoration cleanup instead of silently dropping them", () => {
    expect(designSource).toContain("if (isSinkBaseCabinet(candidate))");
    expect(designSource).toContain("resolution.placed.push(candidate);");
  });
});
