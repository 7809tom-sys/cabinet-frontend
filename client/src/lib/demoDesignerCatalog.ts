// Small on purpose: App.tsx imports this for the /distributor-preview/design
// route, so it must not pull in the demo catalog data.
import type { DesignCatalogFilter } from "./designCatalogFilter";
/**
 * Real door styles the designer renders for each demo line. All three are on
 * one supply line, the one whose cabinet codes the demo catalog is derived
 * from (ids from shared/fixtures/doorStyleSideCatalog.json).
 */
export const DEMO_LINE_DOOR_STYLES: Record<"white-shaker" | "gray-shaker" | "raised-panel", { doorStyleId: number; distributorId: number; styleCode: string; styleName: string; doorStyle: string }> = {
  "white-shaker": { doorStyleId: 390001, distributorId: 180001, styleCode: "SW", styleName: "Shaker White", doorStyle: "Shaker" },
  "gray-shaker": { doorStyleId: 360001, distributorId: 180001, styleCode: "GR", styleName: "Shaker Gray", doorStyle: "Shaker" },
  "raised-panel": { doorStyleId: 390011, distributorId: 180001, styleCode: "AW", styleName: "Aspen White", doorStyle: "Raised Panel" },
};

/**
 * DesignTool `catalogFilter` for /distributor-preview/design: only the three
 * demo lines' door styles (by id, or by supply line + style code if ids ever
 * differ). Sinks and faucets come from their own catalog and stay available.
 */
export const demoDesignerCatalogFilter: DesignCatalogFilter = (style) =>
  Object.values(DEMO_LINE_DOOR_STYLES).some(
    (line) => style.id === line.doorStyleId || (style.distributorId === line.distributorId && style.styleCode === line.styleCode),
  );
