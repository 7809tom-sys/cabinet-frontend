// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WALZCRAFT_DISTRIBUTOR_DOORS } from "@shared/walzcraftDistributorMatches";
import { colorTypeFor } from "@shared/walzcraftColorPatterns";
import { WALZCRAFT_SHADE_COLORS } from "@shared/walzcraftDoorTemplates";
import { ColorSwatchPicker } from "./ColorSwatchPicker";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

/** One paint door and one stain/wood-grain door from the real catalog. */
const paintDoor = WALZCRAFT_DISTRIBUTOR_DOORS.find((door) => colorTypeFor(door).colorType === "paint");
const stainDoor = WALZCRAFT_DISTRIBUTOR_DOORS.find((door) => colorTypeFor(door).colorType !== "paint");

describe("ColorSwatchPicker keeps stain and paint separate", () => {
  it("offers no preloaded gallery of door swatches", () => {
    for (const door of [paintDoor, stainDoor]) {
      if (!door) continue;
      cleanup();
      render(<ColorSwatchPicker door={door} />);
      // No "Browse more" shade list.
      expect(document.body.textContent ?? "").not.toContain("Browse more");
      // Only the sheet's own matched candidates are offered; no preloaded shade is listed.
      const swatchButtons = Array.from(document.querySelectorAll("[data-testid^='swatch-']"))
        .filter((element) => element.tagName === "BUTTON" && element.getAttribute("data-testid") !== `swatch-picker-${door.id}`);
      expect(swatchButtons.length).toBeLessThanOrEqual(4);
      const preloaded = swatchButtons.filter((button) =>
        WALZCRAFT_SHADE_COLORS.some((shade) => shade.name.length > 4 && (button.textContent ?? "").trim() === shade.name),
      );
      expect(preloaded).toEqual([]);
    }
  });

  it("says whether the door is stain or paint and points at the matching wheel", () => {
    if (stainDoor) {
      const stainType = colorTypeFor(stainDoor).colorType;
      render(<ColorSwatchPicker door={stainDoor} />);
      expect(screen.getByTestId(`swatch-wheels-${stainDoor.id}`).textContent).toContain("stain wheel");
      if (stainType !== "woodGrain") expect(screen.getByTestId(`swatch-preview-${stainDoor.id}`).textContent).toContain("Stain");
    }
    if (paintDoor) {
      cleanup();
      render(<ColorSwatchPicker door={paintDoor} />);
      expect(screen.getByTestId(`swatch-wheels-${paintDoor.id}`).textContent).toContain("paint wheel");
      expect(screen.getByTestId(`swatch-wheels-${paintDoor.id}`).textContent).toContain("opaque solid");
      expect(screen.getByTestId(`color-finish-${paintDoor.id}`).textContent).toContain("Paint");
    }
  });
});
