import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
const designToolSource = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");

function sliceBetween(source: string, startMarker: string, endMarker: string) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("Designer white-page guards", () => {
  it("declares flooring state before threeDPresentationForSave reads it", () => {
    const scoped = sliceBetween(
      designToolSource,
      "function ScopedDesignTool(",
      "function MaterialsConflictShortcut(",
    );
    const pattern = scoped.indexOf("const [flooringPattern, setFlooringPattern] = useState");
    const rotation = scoped.indexOf("const [flooringRotation, setFlooringRotation] = useState");
    const memo = scoped.indexOf("const threeDPresentationForSave = useMemo");

    expect(pattern).toBeGreaterThan(-1);
    expect(rotation).toBeGreaterThan(-1);
    expect(memo).toBeGreaterThan(-1);
    expect(pattern).toBeLessThan(memo);
    expect(rotation).toBeLessThan(memo);

    const memoEnd = scoped.indexOf("flooringPattern, flooringRotation]);", memo);
    expect(memoEnd).toBeGreaterThan(memo);
    const memoSource = scoped.slice(memo, memoEnd);
    expect(memoSource).toContain("flooringPattern");
    expect(memoSource).toContain("flooringRotation");
  });

  it("wraps both Designer routes in ErrorBoundary", () => {
    const designerRoute = sliceBetween(
      appSource,
      "function DesignerRoute()",
      "function DistributorPortalRedirect()",
    );
    const designToolInRoute = designerRoute.indexOf("<DesignTool");
    expect(designerRoute.indexOf("<ErrorBoundary>")).toBeGreaterThan(-1);
    expect(designerRoute.indexOf("<ErrorBoundary>")).toBeLessThan(designToolInRoute);
    expect(designerRoute.indexOf("</ErrorBoundary>")).toBeGreaterThan(designToolInRoute);

    const storeRoute = sliceBetween(
      appSource,
      '<Route path="/store/:slug/design">',
      '<Route path="/store/:slug/signin">',
    );
    const storeDesignTool = storeRoute.indexOf("<DesignTool");
    expect(storeRoute.indexOf("<ErrorBoundary>")).toBeGreaterThan(-1);
    expect(storeRoute.indexOf("<ErrorBoundary>")).toBeLessThan(storeDesignTool);
    expect(storeRoute.indexOf("</ErrorBoundary>")).toBeGreaterThan(storeDesignTool);

    const platformDesign = sliceBetween(
      appSource,
      '<Route path="/design">',
      '<Route path="/closet">',
    );
    expect(platformDesign).toContain("<DesignerRoute />");
  });
});
