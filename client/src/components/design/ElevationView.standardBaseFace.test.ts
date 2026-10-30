import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DoorFront } from "./ElevationView";

function markup(masterCode: string, drawerLayout: string | null, width: number) {
  return renderToStaticMarkup(createElement(DoorFront, {
    kind: "shaker",
    edge: "#1a2744",
    face: "#d8d4c8",
    cabinetType: "standard-door",
    cabinetWidthIn: width,
    cabinetHeightIn: 34.5,
    doors: 1,
    drawers: 1,
    masterCode,
    drawerLayout,
    numberOfDoors: 1,
    numberOfDrawers: 2,
  }));
}

describe("elevation standard base faces", () => {
  it("draws the same reference row the 3D view uses when drawerLayout is empty", () => {
    expect(markup("B18", null, 18).match(/data-standard-base-door=/g)).toHaveLength(1);
    expect(markup("B18", null, 18).match(/data-standard-base-drawer=/g)).toHaveLength(1);
    expect(markup("B30", null, 30).match(/data-standard-base-door=/g)).toHaveLength(2);
    expect(markup("B30", null, 30).match(/data-standard-base-drawer=/g)).toHaveLength(1);
    expect(markup("B42", null, 42).match(/data-standard-base-door=/g)).toHaveLength(2);
    expect(markup("B42", null, 42).match(/data-standard-base-drawer=/g)).toHaveLength(2);
  });

  it("lets a saved one-column layout override the B42 two-drawer reference", () => {
    const html = markup("B42", JSON.stringify([{ count: 1 }]), 42);
    expect(html.match(/data-standard-base-door=/g)).toHaveLength(2);
    expect(html.match(/data-standard-base-drawer=/g)).toHaveLength(1);
  });
});
