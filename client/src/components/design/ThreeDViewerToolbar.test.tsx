// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { ThreeDViewerNavigationControls, THREE_D_VIEWER_BUTTON_CLASS, THREE_D_VIEWER_COLUMN_CLASS } from "./InteractiveRoom3D";
import {
  SHADOW_STRENGTH_PREFERENCE,
  normalizeShadowStrength,
  readShadowStrengthPreference,
  shadowStrengthDescription,
  shadowStrengthLabel,
  shadowStrengthScale,
  writeShadowStrengthPreference,
} from "@/lib/shadowStrength";

afterEach(cleanup);

const noop = () => {};

/**
 * A controlled host, because the slider is a controlled input: firing a change
 * while the prop still holds the old value would re-render it back. This is how
 * the real stage wires it (parent state -> prop).
 */
function ShadowHost({ onChange }: { onChange?: (percent: number) => void }) {
  const [value, setValue] = useState(100);
  return (
    <ThreeDViewerNavigationControls
      onZoom={noop}
      onReset={noop}
      onShare={noop}
      onPhotoRender={noop}
      onPan={noop}
      shadowStrength={value}
      onShadowStrengthChange={(percent) => {
        setValue(percent);
        onChange?.(percent);
      }}
    />
  );
}

function renderControls(overrides: Partial<Parameters<typeof ThreeDViewerNavigationControls>[0]> = {}) {
  return render(
    <ThreeDViewerNavigationControls
      onZoom={noop}
      onReset={noop}
      onShare={noop}
      onPhotoRender={noop}
      onPan={noop}
      shadowStrength={100}
      onShadowStrengthChange={noop}
      {...overrides}
    />,
  );
}

describe("shadow strength", () => {
  it("clamps anything it is given into 0–100", () => {
    expect(normalizeShadowStrength(0)).toBe(0);
    expect(normalizeShadowStrength(50)).toBe(50);
    expect(normalizeShadowStrength(100)).toBe(100);
    expect(normalizeShadowStrength(-40)).toBe(0);
    expect(normalizeShadowStrength(480)).toBe(100);
    expect(normalizeShadowStrength("62.4")).toBe(62);
    expect(normalizeShadowStrength(null)).toBe(100);
    expect(normalizeShadowStrength("")).toBe(100);
    expect(normalizeShadowStrength("not a number")).toBe(100);
  });

  it("maps a percentage onto the renderer's own strength", () => {
    expect(shadowStrengthScale(0)).toBe(0);
    expect(shadowStrengthScale(50)).toBe(0.5);
    // 100% is exactly the strength the stage had before the control existed.
    expect(shadowStrengthScale(100)).toBe(1);
  });

  it("reads and writes the preference, defaulting to full strength", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    };
    expect(readShadowStrengthPreference(storage)).toBe(100);
    writeShadowStrengthPreference(35, storage);
    expect(store.get(SHADOW_STRENGTH_PREFERENCE)).toBe("35");
    expect(readShadowStrengthPreference(storage)).toBe(35);
    writeShadowStrengthPreference(0, storage);
    expect(readShadowStrengthPreference(storage)).toBe(0);
  });

  it("falls back to full strength when storage is unavailable or corrupt", () => {
    expect(readShadowStrengthPreference({ getItem: () => { throw new Error("denied"); } })).toBe(100);
    expect(readShadowStrengthPreference({ getItem: () => "wat" })).toBe(100);
    expect(() => writeShadowStrengthPreference(50, { setItem: () => { throw new Error("full"); } })).not.toThrow();
  });

  it("names both ends of the range unambiguously", () => {
    expect(shadowStrengthLabel(0)).toBe("Shadows 0%");
    expect(shadowStrengthDescription(0)).toMatch(/no cast shadows/i);
    expect(shadowStrengthDescription(100)).toMatch(/full strength/i);
    expect(shadowStrengthDescription(50)).toContain("50%");
  });
});

describe("right-hand 3D toolbar", () => {
  it("puts zoom, reset, share, shadows and auto-design in the same square style", () => {
    const { container } = renderControls();
    const testIds = [
      "three-d-zoom-in",
      "three-d-zoom-out",
      "three-d-reset-view",
      "three-d-share-view",
      "three-d-shadows-toggle",
      "three-d-photo-render",
    ];
    for (const id of testIds) {
      const button = container.querySelector(`[data-testid="${id}"]`) as HTMLElement;
      expect(button, id).toBeTruthy();
      for (const token of THREE_D_VIEWER_BUTTON_CLASS.split(" ")) {
        expect(button.className, `${id} missing ${token}`).toContain(token);
      }
    }
  });

  it("no longer wraps the buttons in a bordered panel", () => {
    const { container } = renderControls();
    const column = container.querySelector('[data-testid="three-d-viewer-navigation"]') as HTMLElement;
    expect(column.className).not.toContain("border");
    expect(column.className).not.toContain("bg-white/95");
    // The only bordered box left is the pan pad, which keeps PAN in place.
    const bordered = Array.from(column.querySelectorAll("*")).filter((node) =>
      /(^|\s)border(\s|$)/.test((node as HTMLElement).className ?? ""),
    );
    expect(bordered.length).toBeGreaterThan(0);
    const panPad = container.querySelector('[data-testid="three-d-pan-pad"]') as HTMLElement;
    expect(panPad.className).toContain("border");
    expect(THREE_D_VIEWER_COLUMN_CLASS).toContain("right-3");
  });

  it("keeps the pan arrows in the same four positions", () => {
    const { container } = renderControls();
    for (const direction of ["up", "left", "right", "down"]) {
      expect(container.querySelector(`[data-testid="three-d-pan-${direction}"]`), direction).toBeTruthy();
    }
    const pad = container.querySelector('[data-testid="three-d-pan-pad"]') as HTMLElement;
    expect(pad.className).toContain("grid-cols-3");
  });

  it("opens a Shadows slider from a button labelled Shadows", () => {
    const { container } = renderControls();
    const toggle = container.querySelector('[data-testid="three-d-shadows-toggle"]') as HTMLElement;
    expect(toggle.getAttribute("title")).toBe("Shadows");
    expect(container.querySelector('[data-testid="three-d-shadows-slider"]')).toBeNull();
    fireEvent.click(toggle);
    const slider = container.querySelector('[data-testid="three-d-shadows-slider"]') as HTMLInputElement;
    expect(slider).toBeTruthy();
    expect(slider.min).toBe("0");
    expect(slider.max).toBe("100");
    expect(slider.value).toBe("100");
  });

  it("reports a live value as the slider moves, from 0 to 100", () => {
    const onChange = vi.fn();
    const { container } = render(<ShadowHost onChange={onChange} />);
    fireEvent.click(container.querySelector('[data-testid="three-d-shadows-toggle"]')!);
    const slider = container.querySelector('[data-testid="three-d-shadows-slider"]') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "0" } });
    expect(onChange).toHaveBeenLastCalledWith(0);
    expect(screen.getByTestId("three-d-shadows-value").textContent).toBe("0%");
    fireEvent.change(slider, { target: { value: "50" } });
    expect(onChange).toHaveBeenLastCalledWith(50);
    expect(screen.getByTestId("three-d-shadows-value").textContent).toBe("50%");
    fireEvent.change(slider, { target: { value: "100" } });
    expect(onChange).toHaveBeenLastCalledWith(100);
    expect(screen.getByTestId("three-d-shadows-value").textContent).toBe("100%");
  });

  it("shows the current percentage next to the slider", () => {
    const { container } = renderControls({ shadowStrength: 40 });
    fireEvent.click(container.querySelector('[data-testid="three-d-shadows-toggle"]')!);
    expect(screen.getByTestId("three-d-shadows-value").textContent).toBe("40%");
  });

  it("omits the Shadows control where no handler is wired (mobile popup path)", () => {
    const { container } = renderControls({ onShadowStrengthChange: undefined });
    expect(container.querySelector('[data-testid="three-d-shadows-toggle"]')).toBeNull();
  });

  it("still hides pan where the caller asks it to", () => {
    const { container } = renderControls({ hidePan: true });
    expect(container.querySelector('[data-testid="three-d-pan-pad"]')).toBeNull();
    expect(container.querySelector('[data-testid="three-d-zoom-in"]')).toBeTruthy();
  });
});
