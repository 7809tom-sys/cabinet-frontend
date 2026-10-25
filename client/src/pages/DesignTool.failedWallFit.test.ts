import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("Design Tool failed wall-fit guidance", () => {
  it("labels the first active-catalog alternative as the closest fitting cabinet", () => {
    expect(source).toContain('data-testid="closest-fit-badge"');
    expect(source).toContain("Closest fit");
    expect(source).toContain("smartGapCandidatePrices.get(option.cabinet.id)");
    expect(source).toContain('unitPrice != null && unitPrice > 0 ? `$${unitPrice.toFixed(2)}` : "Unavailable"');
    expect(source).not.toContain('unitPrice != null && unitPrice > 0 ? `$${unitPrice.toFixed(2)}` : "Price pending"');
  });

  it("makes the suggested cabinet row the single direct replacement action", () => {
    const blockStart = source.indexOf('data-testid="failed-wall-smart-fit"');
    const blockEnd = source.indexOf("{customPlacementMode", blockStart);
    const block = source.slice(blockStart, blockEnd);
    expect(block).toContain('data-testid={`closest-fit-option-${option.cabinet.id}`}');
    expect(block).toContain("Select to replace and place");
    expect(block).toContain("fillGapWithCabAndFiller(failedWallFit.gap, option.cabinet)");
    expect(block).toContain("else fillGap(failedWallFit.gap, option.cabinet)");
    expect(block).toContain("setFailedWallFit(null)");
    expect(block).not.toContain("Add cabinet{filler");
  });

  it("stores the authoritative failed measurement once and exposes an exact comparison tooltip", () => {
    expect(source).toContain("measurement: fit");
    expect(source).toContain('data-testid="failed-fit-dimensions-trigger"');
    expect(source).toContain('data-testid="failed-fit-dimensions-tooltip"');
    expect(source).toContain("Selected cabinet vs. available space");
    expect(source).toContain("failedWallFit.measurement.requiredSpan");
    expect(source).toContain("failedWallFit.measurement.availableSpan");
    expect(source).toContain("failedWallFit.measurement.shortage");
    expect(source).toContain("failedWallFit.measurement.availableStart");
    expect(source).toContain("failedWallFit.measurement.availableEnd");
    expect(source).toContain('failedWallFit.blockers.join(", ")');
  });

  it("identifies an accidentally selected base cabinet and directs the user to the real matching upper without substituting products", () => {
    expect(source).toContain('const matchingUpper = accPlacement === "base"');
    expect(source).toContain('wallCabPoolRef.current');
    expect(source).toContain('${c.masterCode} is a base cabinet. To add the ${formatInches(width)} upper, open the Wall tab and choose ${matchingUpper.masterCode}.');
    expect(source).toContain('The existing layout was not changed.${categoryHint}');
  });
});
