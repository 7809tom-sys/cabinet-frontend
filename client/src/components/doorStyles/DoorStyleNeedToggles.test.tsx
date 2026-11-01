// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SKIN_NEEDED_LOCKED_TOOLTIP } from "@shared/canHaveSkins";
import { DoorStyleNeedToggles } from "./DoorStyleNeedToggles";

afterEach(cleanup);

const hickoryFrameless = {
  id: 1,
  woodSpecies: "Hickory",
  ourName: "Hickory Shaker",
  styleCode: "SSH",
  boxConstruction: "frameless",
};

const maple = {
  id: 2,
  woodSpecies: "Maple",
  ourName: "White Shaker",
  styleCode: "SW",
  boxConstruction: "face frame",
  skinNeeded: true,
};

function box(name: string): HTMLButtonElement {
  return screen.getByRole("checkbox", { name }) as HTMLButtonElement;
}

describe("DoorStyleNeedToggles", () => {
  it("checks Skin needed for hickory frameless and lets both boxes change", () => {
    const onSkin = vi.fn();
    const onEnd = vi.fn();
    render(<DoorStyleNeedToggles style={hickoryFrameless} onSkinNeeded={onSkin} onFinishedEndNeeded={onEnd} />);
    const skin = box("Skin needed: Yes");
    const end = box("Finished end needed: No");
    expect(skin.disabled).toBe(false);
    expect(end.disabled).toBe(false);
    fireEvent.click(skin);
    fireEvent.click(end);
    expect(onSkin).toHaveBeenCalledWith(1, false);
    expect(onEnd).toHaveBeenCalledWith(1, true);
  });

  it("keeps Skin needed No and disabled for every other style, even when forced on", () => {
    const onSkin = vi.fn();
    render(<DoorStyleNeedToggles style={maple} onSkinNeeded={onSkin} onFinishedEndNeeded={vi.fn()} />);
    const skin = box("Skin needed: No");
    expect(skin.disabled).toBe(true);
    expect(skin.closest("span")?.getAttribute("title")).toBe(SKIN_NEEDED_LOCKED_TOOLTIP);
    fireEvent.click(skin);
    expect(onSkin).not.toHaveBeenCalled();
    expect(box("Finished end needed: No").disabled).toBe(false);
  });

  it("treats missing checkbox fields as the defaults", () => {
    render(<DoorStyleNeedToggles style={{ id: 3, ourName: "Oak" }} onSkinNeeded={vi.fn()} onFinishedEndNeeded={vi.fn()} />);
    expect(box("Skin needed: No").disabled).toBe(true);
    expect(box("Finished end needed: No").getAttribute("aria-checked")).toBe("false");
  });
});
