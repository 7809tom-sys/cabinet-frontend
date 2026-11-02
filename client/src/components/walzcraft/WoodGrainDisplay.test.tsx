// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { WALZCRAFT_DISTRIBUTOR_DOORS } from "@shared/walzcraftDistributorMatches";
import { colorTypeFor, woodGrainBadge, grainDirectionLabel } from "@shared/walzcraftColorPatterns";
import { ColorSwatchPicker } from "./ColorSwatchPicker";
import { WoodGrainColorDisplay, DoorSkinField } from "./ColorFinishExtras";
import { doorSkinError } from "@shared/doorSkin";

const woodDoors = WALZCRAFT_DISTRIBUTOR_DOORS.filter((d) => colorTypeFor(d).colorType === "woodGrain");
beforeEach(() => { cleanup(); localStorage.clear(); });

describe("wood grain color label", () => {
  it("has wood grain doors in the data", () => expect(woodDoors.length).toBeGreaterThan(0));
  it("never shows a hex code as the main color label for woodGrain styles", () => {
    for (const d of woodDoors) {
      cleanup();
      render(<ColorSwatchPicker door={d} />);
      const label = screen.getByTestId(`color-type-${d.id}`).textContent ?? "";
      expect(label).toMatch(/^Wood grain · /);
      expect(screen.getByTestId(`swatch-preview-${d.id}`).textContent).not.toMatch(/#[0-9a-f]{6}/i);
    }
    render(<WoodGrainColorDisplay label="Wood grain · Hickory · Vertical" swatchUrl="/x.jpg" horizontal={false} />);
    expect(screen.getByTestId("wood-grain-label").textContent).not.toMatch(/#[0-9a-f]{3,6}/i);
  });
  it("direction comes from the style field or source text, else 'grain direction missing'", () => {
    expect(grainDirectionLabel("horizontal")).toBe("Horizontal");
    expect(grainDirectionLabel("vertical-stiles-horizontal-rails")).toBe("Vertical");
    expect(grainDirectionLabel("none")).toBe("grain direction missing");
    expect(grainDirectionLabel(null, "horizontal")).toBe("Horizontal");
    expect(woodGrainBadge({ colorType: "woodGrain", woodSpecies: "Hickory", grainDirection: null })).toBe("Wood grain · Hickory · grain direction missing");
  });
});

describe("Skin needed?", () => {
  it("unchecked shows helper; checked requires a size", () => {
    let v = { skinNeeded: false, skinThicknessIn: null as 0.25 | 0.75 | null };
    const { rerender } = render(<DoorSkinField value={v} onChange={(n) => { v = n; }} woodGrain />);
    expect(screen.getByTestId("skin-none-helper").textContent).toBe("Exposed sides match the door color (no skin).");
    expect(screen.getByTestId("skin-woodgrain-note")).toBeTruthy();
    fireEvent.click(screen.getByTestId("skin-needed"));
    expect(v).toEqual({ skinNeeded: true, skinThicknessIn: null });
    expect(doorSkinError(v)).toMatch(/size/);
    rerender(<DoorSkinField value={v} onChange={(n) => { v = n; }} woodGrain />);
    fireEvent.click(screen.getByLabelText("3/4 in"));
    expect(v).toEqual({ skinNeeded: true, skinThicknessIn: 0.75 });
    expect(doorSkinError(v)).toBeNull();
  });
});
