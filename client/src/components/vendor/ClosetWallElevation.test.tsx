// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ClosetWallElevation } from "./ClosetWallElevation";
import { addStudioBasketPlacement, addStudioBay, addStudioCornerShelf, autoBuildStudio, createStudioDesign, snapStudioPart, studioTakeoff, switchStudioWall, type StudioDesign } from "@/lib/vendorClosetStudio";

afterEach(cleanup);

function mixedDesign(): StudioDesign {
  let design: StudioDesign = { ...createStudioDesign(), roomHeightIn: 100 };
  const neighbor = addStudioBay(design, 24);
  if (!neighbor.ok) throw new Error(neighbor.reason);
  design = neighbor.design;
  for (const [kind, at, id] of [["rod", 64, "elev-rod"], ["drawer", 20, "elev-drawer"], ["shoe", 30, "elev-shoe"]] as const) {
    const staged = snapStudioPart(design, 1, kind, at, id);
    if (!staged.ok) throw new Error(staged.reason);
    design = staged.design;
  }
  return design;
}

describe("ClosetWallElevation", () => {
  it("draws the wall's towers and every placed part, with tower widths, used span, upright and room height in inches", () => {
    const design = mixedDesign();
    render(<ClosetWallElevation design={design} wall="back" />);
    const svg = screen.getByTestId("closet-wall-elevation");
    expect(svg.getAttribute("data-wall")).toBe("back");
    expect(svg.getAttribute("aria-label")).toMatch(/Back wall elevation: 2 towers.*of 120″ used, 100″ room height/);
    const text = svg.textContent ?? "";
    expect(text).toContain("24″");
    expect(text).toContain("50.25″ of towers · 120″ wall");
    expect(text).toContain("38″"); // the starter shelf in tower 1
    expect(text).toContain("64″"); // rod
    expect(text).toContain("20″"); // drawer
    expect(text).toContain("94″ upright");
    expect(text).toContain("100″ room height");
    expect(text).toMatch(/\d+(\.\d+)?″ of towers · 120″ wall/);
    expect(svg.querySelectorAll("[data-testid^='elevation-tower-']")).toHaveLength(2);
    expect(svg.querySelectorAll("[data-item='rod']")).toHaveLength(1);
    expect(svg.querySelectorAll("[data-item='drawer']")).toHaveLength(1);
    expect(svg.querySelectorAll("[data-item='shoe']")).toHaveLength(1);
    expect(svg.querySelectorAll("[data-item='shelf']")).toHaveLength(1);
  });

  it("shows a field-cut tower's installed and stock widths, baskets, corner shelves, and an empty wall", () => {
    let design = mixedDesign();
    const basket = addStudioBasketPlacement(design, 0, "432901", 50, "elev-basket");
    expect(basket.ok).toBe(true);
    if (basket.ok) design = basket.design;
    const corner = addStudioCornerShelf(design, "back-right", "fixed", 40, "elev-corner");
    if (corner.ok) design = corner.design;
    render(<ClosetWallElevation design={design} wall="back" />);
    const svg = screen.getByTestId("closet-wall-elevation");
    expect(svg.querySelectorAll("[data-item='basket']").length).toBe(1);
    expect(svg.textContent).toContain("50″");
    if (corner.ok) {
      expect(svg.querySelectorAll("[data-item='corner-shelf']").length).toBe(1);
      expect(svg.textContent).toContain("corner 40″");
    }
    cleanup();

    render(<ClosetWallElevation design={switchStudioWall(design, "left")} wall="left" />);
    expect(screen.getByText("No towers on this wall")).toBeTruthy();
    expect(screen.getByTestId("closet-wall-elevation").getAttribute("aria-label")).toMatch(/Left wall elevation: 0 towers/);
  });

  it("labels a cut tower with both measurements", () => {
    const base = createStudioDesign();
    const cutDesign: StudioDesign = { ...base, bays: [{ ...base.bays[0], widthIn: 22.5, stockWidthIn: 24 }], wallLayouts: { ...base.wallLayouts, back: { wallId: "back", bays: [{ ...base.bays[0], widthIn: 22.5, stockWidthIn: 24 }] } } };
    render(<ClosetWallElevation design={cutDesign} wall="back" />);
    expect(screen.getByTestId("closet-wall-elevation").textContent).toContain("22.5″ (cut from 24″)");
  });

  it("draws hanging clothes, folded stacks and shoes for the elevation, and nothing when decor is off", () => {
    // A real auto-build has a high rod (long enough for a shirt), shelves and a shoe board.
    const design = autoBuildStudio({ mode: "closet", mount: "floor", finish: "Glacier White", wallWidthIn: 120, roomDepthIn: 24, roomHeightIn: 96 }).design;
    render(<ClosetWallElevation design={design} wall="back" decor />);
    const groups = Array.from(screen.getByTestId("closet-wall-elevation").querySelectorAll("[data-testid='elevation-decor']"));
    const total = (name: string) => groups.reduce((sum, group) => sum + Number(group.getAttribute(name) ?? 0), 0);
    expect(groups.length).toBeGreaterThan(0);
    expect(total("data-decor-hangers")).toBeGreaterThan(0);
    expect(total("data-decor-folded")).toBeGreaterThan(0);
    expect(total("data-decor-shoes")).toBeGreaterThan(0);
    expect(screen.getByTestId("closet-wall-elevation").querySelectorAll("[data-decor='hanger']").length).toBeGreaterThan(0);
    expect(screen.getByTestId("closet-wall-elevation").querySelectorAll("[data-decor='folded']").length).toBeGreaterThan(0);
    expect(screen.getByTestId("closet-wall-elevation").querySelectorAll("[data-decor='shoe']").length).toBeGreaterThan(0);
    cleanup();

    render(<ClosetWallElevation design={design} wall="back" />);
    expect(screen.getByTestId("closet-wall-elevation").querySelector("[data-testid='elevation-decor']")).toBeNull();
  });

  it("does not hang a garment on a rod without the drop for it", () => {
    // mixedDesign's rod sits at 64 in under a fixed top shelf at 93.25 in: only 29.25 in of drop.
    render(<ClosetWallElevation design={mixedDesign()} wall="back" decor />);
    const decor = screen.getByTestId("closet-wall-elevation").querySelector("[data-testid='elevation-decor']");
    expect(decor!.getAttribute("data-decor-hangers")).toBe("0");
  });

  it("keeps decor out of the parts list: the elevation's decor changes nothing a takeoff sees", () => {
    const design = mixedDesign();
    const withDecor = studioTakeoff(design);
    render(<ClosetWallElevation design={design} wall="back" decor />);
    expect(studioTakeoff(design)).toEqual(withDecor);
  });
});
