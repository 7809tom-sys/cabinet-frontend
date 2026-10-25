import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("Design Tool measured cabinet wall placement", () => {
  it("routes typed cabinet and appliance offsets through the authoritative exact-wall movement path", () => {
    const start = source.indexOf("const setCabinetWallOffset = useCallback");
    const end = source.indexOf("const swingSelected", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const handler = source.slice(start, end);

    expect(handler).toContain("if (cabinetsLocked)");
    expect(handler).toContain("const side = (cabinet.wallId ?? cabinetWall(cabinet, room)) as WallSide;");
    expect(handler).toContain("const spot = wallPlacementAt(offset, cabinet.width, cabinet.depth, side, room, cabinet.peninsulaSide);");
    expect(handler).toContain("moveCabinet(uid, spot.x, spot.y, spot.rotation, true, { wallId: side, wallOffset: offset });");
  });

  it("supplies the selected measured run to the right-click cabinet attributes dialog", () => {
    expect(source).toContain("const cabinetWallPosition = useMemo(() => {");
    expect(source).toContain("wallLabel: label,");
    expect(source).toContain("wallLengthIn: length,");
    expect(source).toContain("wallPosition={cabinetWallPosition}");
    expect(source).toContain("onSetWallOffset={setCabinetWallOffset}");
  });
});
