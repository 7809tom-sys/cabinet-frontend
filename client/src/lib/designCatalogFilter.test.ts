import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { filterDesignDistributors, filterDesignDoorStyles } from "./designCatalogFilter";
import { DEMO_LINE_DOOR_STYLES, demoDesignerCatalogFilter } from "./demoDesignerCatalog";

const root = resolve(__dirname, "../../..");
const styles = JSON.parse(readFileSync(resolve(root, "shared/fixtures/doorStyleSideCatalog.json"), "utf8")) as Array<{
  id: number; distributorId: number; styleCode: string; ourName: string; doorStyle: string;
}>;
const distributors = Array.from(new Set(styles.map((s) => s.distributorId))).map((id) => ({ id, name: `Line ${id}` }));

describe("DesignTool optional catalogFilter", () => {
  it("leaves the catalog exactly as it was when the prop is omitted", () => {
    expect(filterDesignDoorStyles(styles, undefined)).toBe(styles);
    expect(filterDesignDistributors(distributors, styles, undefined)).toBe(distributors);
    expect(filterDesignDoorStyles(undefined, undefined)).toBeUndefined();
  });

  it("limits the demo designer to the three demo lines' door styles", () => {
    const kept = filterDesignDoorStyles(styles, demoDesignerCatalogFilter)!;
    expect(kept.map((s) => s.id).sort()).toEqual([360001, 390001, 390011]);
    expect(kept.map((s) => s.ourName).sort()).toEqual(["Aspen White", "Shaker Gray", "Shaker White"]);
    expect(kept.find((s) => s.id === 390011)?.doorStyle).toBe("Raised Panel");
    for (const line of Object.values(DEMO_LINE_DOOR_STYLES)) {
      const row = styles.find((s) => s.id === line.doorStyleId)!;
      expect(row.styleCode).toBe(line.styleCode);
      expect(row.distributorId).toBe(line.distributorId);
    }
    expect(filterDesignDistributors(distributors, kept, demoDesignerCatalogFilter)!.map((d) => d.id)).toEqual([180001]);
    expect(filterDesignDistributors(distributors, undefined, demoDesignerCatalogFilter)).toEqual([]);
  });

  it("is a single optional prop passed only by the demo designer route", () => {
    const tool = readFileSync(resolve(root, "client/src/pages/DesignTool.tsx"), "utf8");
    expect(tool).toContain("export default function DesignTool({ hidePrices = false, ...props }: { affiliateSlug?: string; catalogFilter?: DesignCatalogFilter; hidePrices?: boolean })");
    const callers: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name) && !/\.test\./.test(name) && readFileSync(path, "utf8").includes("catalogFilter={")) callers.push(path.slice(root.length + 1));
      }
    };
    walk(resolve(root, "client/src"));
    expect(callers).toEqual(["client/src/App.tsx"]);
    const app = readFileSync(resolve(root, "client/src/App.tsx"), "utf8");
    expect(app.match(/catalogFilter=\{/g)).toHaveLength(1);
    expect(app).toContain("<DesignTool catalogFilter={demoDesignerCatalogFilter} hidePrices />");
    expect(app.indexOf("<DesignTool catalogFilter")).toBeGreaterThan(app.indexOf('<Route path="/distributor-preview/design">'));
    expect(app.indexOf("<DesignTool catalogFilter")).toBeLessThan(app.indexOf('<Route path="/distributor-preview/designer">'));
  });
});
