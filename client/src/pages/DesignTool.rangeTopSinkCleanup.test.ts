import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fixtureBelongsToCabinet, makeDefaultSinkForCabinet, type PlacedCabinet, DEFAULT_ROOM } from "@/lib/design";

describe("range-top mode owns the sink-base fixture lifecycle", () => {
  const source = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");
  const rangeTopStart = source.indexOf("const applyRangeTop =");
  const rangeTopEnd = source.indexOf("const filteredFaucets =", rangeTopStart);
  const applyRangeTopSource = source.slice(rangeTopStart, rangeTopEnd);
  const applySinkStart = source.indexOf("const applySink =");
  const applySinkEnd = source.indexOf("const filteredFaucets =", applySinkStart);
  const applySinkSource = source.slice(applySinkStart, applySinkEnd);

  const sinkBase = {
    uid: "sb36-under-window",
    cabinetId: 36,
    masterCode: "SB36",
    placement: "base",
    x: 42,
    y: 0,
    width: 36,
    depth: 24,
    height: 34.5,
    rotation: 0,
    sinkTopType: "sink",
  } as PlacedCabinet;

  it("fails on the pre-fix implementation because every range-top mode must clear the owned sink/faucet", () => {
    const defaultSink = makeDefaultSinkForCabinet(sinkBase, DEFAULT_ROOM, "double");
    expect(defaultSink.faucet).toBe(true);
    expect(fixtureBelongsToCabinet(defaultSink, sinkBase)).toBe(true);

    for (const mode of ["gas", "electric", "smooth-top"] as const) {
      expect(applyRangeTopSource, `${mode} range-top path`).toMatch(/setSinks\(\s*\(prev/);
      expect(applyRangeTopSource, `${mode} range-top path`).toMatch(/fixtureBelongsToCabinet/);
    }
  });

  it("requires sink re-selection to clear the cooktop mode before attaching a sink", () => {
    expect(applySinkSource).toMatch(/sinkTopType:\s*"sink"/);
    expect(applySinkSource).toMatch(/sinkTopProductId/);
    expect(applySinkSource).toMatch(/fixtureBelongsToCabinet/);
  });

  it("keeps the transition contract explicit for save/reload, move, undo, and redo", () => {
    expect(source).toMatch(/sinkTopType:\s*type/);
    expect(source).toMatch(/setCabAttr\(sinkBaseDialog\.cabinetUid/);
    expect(source).toMatch(/setSinks\(\(prevSinks\)/);
    expect(source).toMatch(/setSelectedSinkUid/);
  });
});
