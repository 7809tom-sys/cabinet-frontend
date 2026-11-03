/**
 * Source-level checks for the Auto-Design fixture pop-ups. They prove the wiring
 * the behaviour tests cannot reach: the sink and tall choosers are pop-ups opened
 * from the auto-designer, and the picks are carried into the measured build.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("auto-designer fixture pop-ups", () => {
  it("renders the sink and tall choosers as dialogs, not inline palette rows", () => {
    expect(source).toContain("<AutoDesignSinkDialog");
    expect(source).toContain("<AutoDesignTallDialog");
    expect(source).toContain("<AutoDesignFaucetDialog");
  });

  it("opens the sink pop-up from the auto-designer setup beside the faucet step", () => {
    expect(source).toContain('onOpenSinkPicker={() => openAutoDesignSinkPicker("replace")}');
    expect(source).toContain("onOpenTallPicker={() => setAutoDesignTallOpen(true)}");
  });

  it("carries the picked tall cabinet into the measured build, and NOT a sink", () => {
    expect(source).toContain("tallCabinets: autoDesignTallPicks.map");
    // A sink is never auto-placed by the build: it is asked about after the
    // layout is built, then the faucet step follows.
    expect(source).toContain("sinkProducts: null");
    expect(source).not.toContain("sinkProducts: autoDesignSinkPicks.map");
    expect(source).toContain("promptAutoDesignSinkAfterBuild(");
  });

  it("reads sinks from the same Pelican catalog the faucet picker uses", () => {
    expect(source).toContain('subCategory: "Sinks"');
    expect(source).toContain('trpc.surfaces.recommended.useQuery(');
    expect(source).toContain('role: "sink"');
  });

  it("auto-places a picked sink instead of asking for a manual drop", () => {
    expect(source).toContain("planAutoDesignSinkPlacement({");
    expect(source).toContain('"swap-base"');
  });

  it("opens the range pop-up and seats that exact range code", () => {
    expect(source).toContain("<AutoDesignRangeDialog");
    expect(source).toContain("onOpenRangePicker={() => setAutoDesignRangeOpen(true)}");
    expect(source).toContain("stoveMasterCode: autoDesignRangePick?.masterCode ?? undefined");
  });
});
