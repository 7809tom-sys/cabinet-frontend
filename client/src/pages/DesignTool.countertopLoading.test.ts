import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const designer = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const plan = readFileSync(new URL("../components/design/PlanCanvas.tsx", import.meta.url), "utf8");
const threeD = readFileSync(new URL("../components/design/InteractiveRoom3D.tsx", import.meta.url), "utf8");

describe("Designer countertop geometry loading indicator", () => {
  it("announces only pending countertop geometry, without blocking pointer interactions", () => {
    expect(designer).toContain("useDeferredValue(countertopGeometry)");
    expect(designer).toContain("deferredCountertopGeometry !== countertopGeometry");
    expect(designer).toContain('data-testid="countertop-geometry-loading" role="status" aria-live="polite"');
    expect(designer).toContain("pointer-events-none absolute bottom-");
    expect(designer).toContain("motion-reduce:animate-none");
  });

  it("keeps cabinet interactions current but feeds both Floor Plan countertop layers one deferred snapshot", () => {
    expect(designer.match(/countertopGeometry=\{\{ room: deferredCountertopGeometry\.room/g)).toHaveLength(2);
    expect(designer.match(/cabinets=\{placed\}/g)?.length).toBeGreaterThanOrEqual(2);
    expect(plan).toContain("countertopSurfaces(snapshotCabinets, snapshotRoom, geometryIsland)");
    expect(plan).toContain("[countertopMaterialId, snapshotRoom, snapshotCabinets, snapshotIsland]");
  });

  it("holds the 3D badge until the rebuilt scene paints, without rebuilding on status-callback changes", () => {
    expect(designer).toContain("onGeometryRendered={() => setPaintedCountertopGeometry(deferredCountertopGeometry)}");
    expect(threeD).toContain("requestAnimationFrame(() => onGeometryRenderedRef.current?.())");
    expect(threeD).toContain("cancelAnimationFrame(readyFrame)");
    expect(threeD).toContain("onGeometryRenderedRef.current = onGeometryRendered");
  });
});
