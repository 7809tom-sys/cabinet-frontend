// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";
import { BathroomSetupChecklist, type BathroomChecklistStep } from "./BathroomSetupChecklist";

/**
 * The checklist must never sit over the drawing surface uninvited.
 *
 * It used to be an always-open panel pinned to the right edge, which covered the
 * canvas's floating button column in both Plan and 3D. It is now one button in that
 * column, closed by default, whose popover opens to the left.
 */
const steps: BathroomChecklistStep[] = [
  { id: "vanity", label: "Place a vanity sink base", detail: "Choose a bathroom vanity cabinet.", complete: false },
  { id: "basin", label: "Choose a Pelican vanity basin", detail: "Install it through the base.", complete: false },
  { id: "toilet", label: "Place a toilet or bidet", detail: "Drop it anywhere on the plan.", complete: false },
  { id: "tub", label: "Place a tub", detail: "Use a measured envelope.", complete: false },
  { id: "door", label: "Add a shower door or wall, if needed (optional)", detail: "Verify the technical sheet.", complete: false, optional: true },
];

function renderChecklist(overrides: Partial<{ completed: number; required: number }> = {}) {
  const onBrowseFixtures = vi.fn();
  render(
    <BathroomSetupChecklist
      steps={steps}
      completed={overrides.completed ?? 0}
      required={overrides.required ?? 5}
      onBrowseFixtures={onBrowseFixtures}
      idPrefix="t"
    />,
  );
  return { onBrowseFixtures };
}

afterEach(cleanup);

describe("bathroom setup checklist", () => {
  it("renders as a button in the floating column, with an icon-label and tooltip", () => {
    renderChecklist();
    const toggle = screen.getByTestId("bathroom-checklist-toggle");
    expect(toggle).toBeTruthy();
    // Same accessible name the column uses for every other control.
    expect(toggle.getAttribute("aria-label")).toBe("Bathroom setup checklist");
    // The tooltip text is present for hover.
    expect(screen.getAllByText(/Bathroom setup checklist/).length).toBeGreaterThan(0);
  });

  it("starts CLOSED and never renders the panel on mount", () => {
    renderChecklist();
    expect(screen.queryByTestId("bathroom-fixture-checklist")).toBeNull();
    expect(screen.getByTestId("bathroom-checklist-toggle").getAttribute("aria-expanded")).toBe("false");
  });

  it("shows a progress badge like 0/5", () => {
    renderChecklist();
    expect(screen.getByTestId("bathroom-checklist-badge").textContent).toBe("0/5");
  });

  it("hides the badge once every core choice is done", () => {
    renderChecklist({ completed: 5, required: 5 });
    expect(screen.queryByTestId("bathroom-checklist-badge")).toBeNull();
  });

  it("opens on click and keeps every checklist item and the Browse fixtures action", async () => {
    const { onBrowseFixtures } = renderChecklist();
    fireEvent.click(screen.getByTestId("bathroom-checklist-toggle"));
    expect(screen.getByTestId("bathroom-fixture-checklist")).toBeTruthy();
    // All six rows survive the move into the popover.
    for (const step of steps) expect(screen.getByText(new RegExp(step.label.slice(0, 18)))).toBeTruthy();
    expect(screen.getByText(/0 of 5 core choices selected/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Browse fixtures" }));
    expect(onBrowseFixtures).toHaveBeenCalledTimes(1);
  });

  it("closes when the button is clicked again", async () => {
    renderChecklist();
    const toggle = screen.getByTestId("bathroom-checklist-toggle");
    fireEvent.click(toggle);
    expect(screen.getByTestId("bathroom-fixture-checklist")).toBeTruthy();
    fireEvent.click(toggle);
    expect(screen.queryByTestId("bathroom-fixture-checklist")).toBeNull();
  });

  it("closes on the X", async () => {
    renderChecklist();
    fireEvent.click(screen.getByTestId("bathroom-checklist-toggle"));
    fireEvent.click(screen.getByTestId("bathroom-checklist-close"));
    expect(screen.queryByTestId("bathroom-fixture-checklist")).toBeNull();
  });

  it("closes on Escape", async () => {
    renderChecklist();
    fireEvent.click(screen.getByTestId("bathroom-checklist-toggle"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("bathroom-fixture-checklist")).toBeNull();
  });

  it("closes on a click outside", async () => {
    renderChecklist();
    fireEvent.click(screen.getByTestId("bathroom-checklist-toggle"));
    expect(screen.getByTestId("bathroom-fixture-checklist")).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByTestId("bathroom-fixture-checklist")).toBeNull();
  });

  it("does NOT close when the click is inside the panel", async () => {
    renderChecklist();
    fireEvent.click(screen.getByTestId("bathroom-checklist-toggle"));
    const panel = screen.getByTestId("bathroom-fixture-checklist");
    fireEvent.pointerDown(panel);
    expect(screen.getByTestId("bathroom-fixture-checklist")).toBeTruthy();
  });

  it("opens to the left of the column so the buttons stay uncovered", async () => {
    renderChecklist();
    fireEvent.click(screen.getByTestId("bathroom-checklist-toggle"));
    const panel = screen.getByTestId("bathroom-fixture-checklist");
    // `right-full` anchors the panel's right edge to the button's left edge.
    expect(panel.className).toContain("right-full");
    expect(panel.className).not.toContain("left-0");
  });
});
