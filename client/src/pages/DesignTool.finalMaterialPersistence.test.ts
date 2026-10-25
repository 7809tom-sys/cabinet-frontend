import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");

describe("Designer final material persistence", () => {
  it("normalizes the local draft, Kitchen Package snapshot, and saved-design handoff", () => {
    expect(source).toContain("selectedSurfaces: normalizeInstalledMaterialSelections(selectedSurfaces)");
    expect((source.match(/selectedSurfaces: normalizeInstalledMaterialSelections\(selectedSurfaces\)/g) ?? [])).toHaveLength(2);
    expect(source).toContain("selectedSurfaces={normalizeInstalledMaterialSelections(selectedSurfaces)}");
  });

  it("writes a draft after a direct surface selection changes", () => {
    expect(source).toContain("flooringPattern, selectedSurfaces, cabinetsLocked");
  });

  it("loads an older designId link instead of falling through to a local draft with generic materials", () => {
    expect(source).toContain('const v = params.get("load") ?? params.get("designId");');
    expect(source).toContain("trpc.surfaces.designerByIds.useQuery");
    expect(source).toContain("refreshVerifiedSurfaceSelections(current, verifiedSelectedSurfaceRecords)");
  });
});
