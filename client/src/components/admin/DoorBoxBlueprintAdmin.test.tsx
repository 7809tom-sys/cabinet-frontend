import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DoorBoxBlueprintView } from "./DoorBoxBlueprintAdmin";

describe("Door Box Blueprint admin screen", () => {
  it("states the DL shaker firm rule and shows the dimensioned DL shaker box", () => {
    const html = renderToStaticMarkup(<DoorBoxBlueprintView widthIn={15} heightIn={30} railIn={3} show3D={false} />);
    expect(html).toContain("FIRM RULE (Tom): every shaker door uses the DL shaker style.");
    expect(html).toContain('data-testid="door-box-dl-shaker-svg"');
    for (const piece of ["top-rail", "bottom-rail", "left-stile", "right-stile", "center-panel"]) {
      expect(html).toContain(`data-piece="${piece}"`);
    }
    expect(html).toContain("15&quot; W");
    expect(html).toContain("30&quot; H");
    expect(html).toContain("standardShakerDlFacePlan");
  });

  it("shows the canonical slab reference and names its source", () => {
    const html = renderToStaticMarkup(<DoorBoxBlueprintView widthIn={15} heightIn={30} railIn={3} show3D={false} />);
    expect(html).toContain("canonical slab reference");
    expect(html).toContain('data-testid="door-box-slab-svg"');
    expect(html).toContain('data-piece="slab"');
    expect(html).toContain("shared/doorLibraryProfiles.ts → libraryEntriesForStyle");
    expect(html).toContain("0.045 ft door slab front");
  });

  it("flags a small front as a plain slab", () => {
    const html = renderToStaticMarkup(<DoorBoxBlueprintView widthIn={15} heightIn={6} railIn={3} show3D={false} />);
    expect(html).toContain("renders it as a plain slab");
  });

  it("shows the DL raised panel section with its drawing, sources, and TBDs", () => {
    const html = renderToStaticMarkup(<DoorBoxBlueprintView widthIn={15} heightIn={30} railIn={3} show3D={false} />);
    expect(html).toContain('data-testid="door-box-raised-panel"');
    expect(html).toContain('data-testid="door-box-raised-panel-svg"');
    for (const piece of ["groove", "bevel", "raised-panel"]) expect(html).toContain(`data-piece="${piece}"`);
    expect(html).toContain("raisedPanelFrameGeometry");
    expect(html).toContain("Glacier White");
    expect(html).toContain('data-testid="door-box-raised-panel-tbd"');
    expect(html).toContain("TBD - confirm with Tom");
  });

  it("shows the DL slim shaker section on its 1 inch frame", () => {
    const html = renderToStaticMarkup(<DoorBoxBlueprintView widthIn={15} heightIn={30} railIn={3} show3D={false} />);
    expect(html).toContain('data-testid="door-box-slim-shaker"');
    expect(html).toContain('data-testid="door-box-slim-shaker-svg"');
    expect(html).toContain("stile 1&quot;");
    expect(html).toContain("13&quot; × 28&quot;");
    expect(html).toContain("SLIM_SHAKER_FRAME_INCHES");
    expect(html).toContain('data-testid="door-box-slim-shaker-tbd"');
  });

  it("keeps the original DL shaker and slab sections first and unchanged", () => {
    const html = renderToStaticMarkup(<DoorBoxBlueprintView widthIn={15} heightIn={30} railIn={3} show3D={false} />);
    const order = ["door-box-dl-shaker", "door-box-slab", "door-box-raised-panel", "door-box-slim-shaker"].map((id) => html.indexOf(`data-testid="${id}"`));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).not.toContain('data-testid="door-box-dl-shaker-tbd"');
    expect(html).not.toContain('data-testid="door-box-slab-tbd"');
  });
});
