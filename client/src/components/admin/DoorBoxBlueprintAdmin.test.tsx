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
});
