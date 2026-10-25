import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MAX_CABINET_DEPTH_MOVE_IN,
  MIN_CABINET_DEPTH_MOVE_IN,
  normalizedCabinetDepthMoveDistance,
  parsedCabinetDepthMoveDistance,
} from "./CabinetAttributesDialog";

const dialogSource = readFileSync(new URL("./CabinetAttributesDialog.tsx", import.meta.url), "utf8");
const hostSource = readFileSync(new URL("../../pages/DesignTool.tsx", import.meta.url), "utf8");

describe("Cabinet Attributes exact depth movement", () => {
  it("parses decimal, simple fraction, mixed fraction, glyph, and optional inch suffix values", () => {
    expect(parsedCabinetDepthMoveDistance("30")).toBe(30);
    expect(parsedCabinetDepthMoveDistance('30"')).toBe(30);
    expect(parsedCabinetDepthMoveDistance("1/2")).toBe(0.5);
    expect(parsedCabinetDepthMoveDistance("30 3/8")).toBe(30.375);
    expect(parsedCabinetDepthMoveDistance("30¾")).toBe(30.75);
    expect(parsedCabinetDepthMoveDistance("bad")).toBeNull();
  });

  it("normalizes to one-eighth inch and supports at least 30 inches with bounded extremes", () => {
    expect(normalizedCabinetDepthMoveDistance("30.14")).toBe(30.125);
    expect(normalizedCabinetDepthMoveDistance("30.19")).toBe(30.25);
    expect(normalizedCabinetDepthMoveDistance("0")).toBe(MIN_CABINET_DEPTH_MOVE_IN);
    expect(normalizedCabinetDepthMoveDistance("999")).toBe(MAX_CABINET_DEPTH_MOVE_IN);
  });

  it("renders one exact distance field beside both controls and sends the selected distance to the authoritative host callback", () => {
    expect(dialogSource).toContain('aria-label="Depth move distance in inches"');
	    expect(dialogSource).toContain('onMoveInOut?.(uid, direction, distanceIn)');
	    expect(dialogSource).toContain("<CabinetDepthMoveControls");
	    expect(dialogSource).toContain('onClick={() => onMove("out", distance)}');
	    expect(dialogSource).toContain('onClick={() => onMove("in", distance)}');
    expect(hostSource).toContain("onMoveInOut={(uid, direction, distanceIn) => moveCabinetFrom3D(uid, direction, distanceIn)}");
  });
});
