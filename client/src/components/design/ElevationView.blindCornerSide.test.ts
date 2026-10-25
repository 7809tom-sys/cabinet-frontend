import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ElevationView } from "./ElevationView";

/**
 * A blind corner base is seated at its blind-pull distance from the room corner
 * (up to 6 in, 3-6 in by the catalog rule), never exactly at offset 0. The
 * elevation used to treat only an offset of 2 in or less as "corner on the left",
 * so the 6-in seat drew the hidden blind panel on the exposed side and put the
 * door against the corner. The physical rule is shared with the saved door swing.
 */
const ROOM = { width: 144, depth: 120, ceilingHeight: 96 };
function render(wall: "back" | "right", cabinet: Record<string, unknown>) {
  return renderToStaticMarkup(
    createElement(
      LanguageProvider,
      null,
      createElement(ElevationView, {
        room: ROOM,
        cabinets: [{
          uid: "bbc", cabinetId: 9390015, category: "Base", subCategory: "Blind Corner Base", placement: "base",
          masterCode: "BBC36", description: '36" Blind Corner Base Cabinet', width: 36, height: 34.5, depth: 24,
          cornerType: "blind-corner", blindPull: 6, numberOfDoors: 1, numberOfDrawers: 1, ...cabinet,
        }] as never,
        selectedUid: null,
        onSelect: () => undefined,
        wall,
        countertopMaterialId: "white-quartz",
        hardwareStyleId: "bar-pull",
      } as never),
    ),
  );
}
/** The hatched hidden-panel box's inline style, as rendered. */
function blindPanelStyle(markup: string): string {
  const match = markup.match(/<div class="absolute top-0 bottom-0" style="([^"]*)"><div class="absolute inset-\[2px\][^"]*" style="background:repeating-linear-gradient\(135deg/);
  if (!match) throw new Error("blind panel not rendered");
  return match[1]!;
}

describe("blind corner base elevation: the blind panel sits in the room corner", () => {
  it("right wall, seated 6 in from the top-right corner: blind panel on the LEFT (corner end), door on the right", () => {
    const style = blindPanelStyle(render("right", { x: 120, y: 6, rotation: 90, wallId: "right", wallOffset: 6, swing: "right" }));
    expect(style).toMatch(/left:\s*0/);
    expect(style).not.toMatch(/right:\s*0/);
  });

  it("right wall, seated exactly at the corner (offset 0): unchanged, blind panel on the left", () => {
    const style = blindPanelStyle(render("right", { x: 120, y: 0, rotation: 90, wallId: "right", wallOffset: 0, swing: "right" }));
    expect(style).toMatch(/left:\s*0/);
  });

  it("back wall, seated 6 in from the far corner: blind panel on the RIGHT end, door on the left", () => {
    // 144-wide wall: a 36-in box ending 6 in short of the right corner occupies 102-138.
    const style = blindPanelStyle(render("back", { x: 102, y: 0, rotation: 0, wallId: "top", wallOffset: 102, swing: "left" }));
    expect(style).toMatch(/right:\s*0/);
    expect(style).not.toMatch(/left:\s*0/);
  });

  it("a blind corner in the middle of a wall keeps the legacy near-start test (no corner to hide in)", () => {
    const style = blindPanelStyle(render("back", { x: 60, y: 0, rotation: 0, wallId: "top", wallOffset: 60, swing: "left" }));
    expect(style).toMatch(/right:\s*0/);
  });
});

describe("blind corner base elevation: the door pull sits on the visible door, at its exposed edge", () => {
  const wrapperOf = (markup: string) => {
    const match = markup.match(/<div[^>]*data-blind-door-hardware="(left|right)"[^>]*style="([^"]*)"[^>]*>/);
    return match ? { corner: match[1]!, style: match[2]! } : null;
  };
  const pullsIn = (markup: string) => {
    const start = markup.indexOf("data-blind-door-hardware");
    return start < 0 ? [] : (markup.slice(start).match(/<div[^>]*data-cabinet-hardware="door-pull"[^>]*>/g) ?? []);
  };

  it("corner on the left (right wall, seated at 6 in): the pull overlay covers only the right 60%, pull on the door edge nearest the blind panel", () => {
    const markup = render("right", { x: 120, y: 6, rotation: 90, wallId: "right", wallOffset: 6, swing: "right" });
    const wrapper = wrapperOf(markup);
    expect(wrapper?.corner).toBe("left");
    expect(wrapper?.style).toMatch(/right:\s*0/);
    expect(wrapper?.style).toMatch(/width:\s*60%/);
    const pulls = pullsIn(markup);
    expect(pulls).toHaveLength(1);
    // Door hinges on the exposed (right) side, so the pull is on its left edge: the 3D addPull(hingeSide) rule.
    expect(pulls[0]).toContain('data-hardware-position="left"');
  });

  it("corner on the right (back wall, seated 6 in short of the corner): overlay covers the left 60%, pull on the edge nearest the blind panel", () => {
    const markup = render("back", { x: 102, y: 0, rotation: 0, wallId: "top", wallOffset: 102, swing: "left" });
    const wrapper = wrapperOf(markup);
    expect(wrapper?.corner).toBe("right");
    expect(wrapper?.style).toMatch(/left:\s*0/);
    expect(wrapper?.style).toMatch(/width:\s*60%/);
    expect(pullsIn(markup)[0]).toContain('data-hardware-position="right"');
  });

  it("an ordinary base cabinet gets no blind-door wrapper", () => {
    const markup = renderToStaticMarkup(
      createElement(LanguageProvider, null, createElement(ElevationView, {
        room: ROOM,
        cabinets: [{ uid: "b", cabinetId: 1, category: "Base", placement: "base", masterCode: "B24", description: '24" Base', x: 0, y: 0, width: 24, height: 34.5, depth: 24, rotation: 0 }] as never,
        selectedUid: null, onSelect: () => undefined, wall: "back", countertopMaterialId: "white-quartz", hardwareStyleId: "bar-pull",
      } as never)),
    );
    expect(markup).not.toContain("data-blind-door-hardware");
  });
});
