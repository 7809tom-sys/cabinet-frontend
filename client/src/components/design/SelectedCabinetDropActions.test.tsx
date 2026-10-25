// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SelectedCabinetDropActions } from "./SelectedCabinetDropActions";

afterEach(cleanup);

function renderActions(touch = false) {
  const onDropToCountertop = vi.fn();
  const onDropToFloor = vi.fn();
  const view = render(
    <SelectedCabinetDropActions
      touch={touch}
      countertopLabel="Drop to countertop"
      countertopTitle="Place on countertop"
      floorLabel="Drop to floor"
      floorTitle="Place on floor"
      onDropToCountertop={onDropToCountertop}
      onDropToFloor={onDropToFloor}
    />,
  );
  return { view, onDropToCountertop, onDropToFloor };
}

describe("SelectedCabinetDropActions", () => {
  it.each([false, true])("renders countertop immediately before floor in the %s touch mode", (touch) => {
    const { view } = renderActions(touch);
    const buttons = view.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]?.textContent).toContain("Drop to countertop");
    expect(buttons[1]?.textContent).toContain("Drop to floor");
    expect(view.getByTestId(touch ? "selected-cabinet-drop-actions-touch" : "selected-cabinet-drop-actions")).toBeTruthy();
  });

  it.each([false, true])("dispatches the correct independent action in the %s touch mode", (touch) => {
    const { view, onDropToCountertop, onDropToFloor } = renderActions(touch);
    fireEvent.click(view.getByRole("button", { name: "Drop to countertop" }));
    expect(onDropToCountertop).toHaveBeenCalledTimes(1);
    expect(onDropToFloor).not.toHaveBeenCalled();
    fireEvent.click(view.getByRole("button", { name: "Drop to floor" }));
    expect(onDropToFloor).toHaveBeenCalledTimes(1);
  });
});
