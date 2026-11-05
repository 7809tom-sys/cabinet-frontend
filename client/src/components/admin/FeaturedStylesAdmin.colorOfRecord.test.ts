import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveDoorColor } from "@shared/doorColorResolve";

const editorSource = readFileSync(
  resolve(process.cwd(), "client/src/components/admin/FeaturedStylesAdmin.tsx"),
  "utf8",
);

/** The wall cabinet preview block, from its div to its helper line. */
function wallPreviewBlock(): string {
  const start = editorSource.indexOf('data-testid="wall-cabinet-preview"');
  expect(start).toBeGreaterThan(-1);
  return editorSource.slice(Math.max(0, start - 700), start + 900);
}

describe("door style editor: every preview shows the color of record", () => {
  it("paints the wall cabinet preview with the selected render color, not the saved name field", () => {
    const block = wallPreviewBlock();
    // The color of record is what the top of the page shows.
    expect(block).toContain("doorColor.appliedHex");
    // The old bug: the raw saved color field went straight into CSS, so a saved
    // name like "Blue" painted pure #0000FF.
    expect(block).not.toContain("style.color ||");
    expect(block).not.toContain("{ background: style.color");
  });

  it("uses the approved render / render-hex resolution for that color", () => {
    // doorColor comes from resolveDoorColor, which puts the approved door render
    // first and never snaps to the brand palette.
    expect(editorSource).toContain("const doorColor = resolveDoorColor({");
    expect(editorSource).toContain("resolvedHex={doorColor.appliedHex}");
  });

  it("passes the selected color and door setup into the room scene controls", () => {
    const call = editorSource.slice(editorSource.indexOf("<AdminStyleRoomSceneControls\n"));
    const block = call.slice(0, call.indexOf("/>") + 2);
    expect(block).toContain("selectedColorHex={doorColor.appliedHex}");
    expect(block).toContain("doorSetup={{");
    expect(block).toContain("doorStyle,");
    expect(block).toContain("doorSampleImageUrl,");
    expect(block).toContain("drawerSampleImageUrl,");
  });

  it("uses the plain helper wording and an optional source note", () => {
    expect(editorSource).toContain("Wall cabinet preview in the selected color.");
    expect(editorSource).not.toContain("A combined base swatch is not painted onto the wall.");
    expect(editorSource).toContain("Optional: where these specs came from");
  });

  it("resolves a saved color name to a real door hex rather than a CSS named color", () => {
    // The bug's mechanism: CSS reads a bare "Blue" as #0000FF, so a saved name
    // never reaches the preview as-is. The resolver always returns a hex.
    const blue = resolveDoorColor({ id: 1, ourName: "Shaker Blue", color: "Blue" });
    expect(blue.appliedHex).toMatch(/^#[0-9a-f]{6}$/i);
    expect(blue.appliedHex.toLowerCase()).not.toBe("#0000ff");
  });

  it("lets the approved render's color win over the saved name", () => {
    // An accepted door render writes its color back onto renderHex, and that is
    // the highest-precedence source: it beats the saved catalog color.
    const withRender = resolveDoorColor({
      id: 1,
      ourName: "Shaker Blue",
      color: "Blue",
      renderHex: "#33475b",
    });
    expect(withRender.appliedHex.toLowerCase()).toBe("#33475b");
  });
});
