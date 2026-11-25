// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  OUTREACH_EXPLAINER_LINES,
  OUTREACH_EXPLAINER_TIPS,
  OUTREACH_EXPLAINER_TITLE,
  OutreachViewButton,
} from "./OutreachExplainer";

afterEach(cleanup);

describe("Outreach explainer", () => {
  it("clicking the Outreach pill still opens Outreach and does not pop the explainer", () => {
    const onSelect = vi.fn();
    render(<OutreachViewButton active={false} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Outreach" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(OUTREACH_EXPLAINER_TITLE, { selector: "p" })).toBeNull();
  });

  it("tapping the info icon shows the title, how-to lines and tips", () => {
    const onSelect = vi.fn();
    render(<OutreachViewButton active={false} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "What is Outreach?" }));
    expect(screen.getByText(OUTREACH_EXPLAINER_TITLE, { selector: "p" })).toBeTruthy();
    for (const line of [...OUTREACH_EXPLAINER_LINES, ...OUTREACH_EXPLAINER_TIPS]) expect(screen.getByText(line)).toBeTruthy();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("opens on mouse hover of the pill but not on a touch pointer", () => {
    render(<OutreachViewButton active onSelect={() => {}} />);
    const pill = screen.getByRole("button", { name: "Outreach" });
    fireEvent.pointerEnter(pill, { pointerType: "touch" });
    expect(screen.queryByText(OUTREACH_EXPLAINER_TITLE, { selector: "p" })).toBeNull();
    fireEvent.pointerEnter(pill, { pointerType: "mouse" });
    expect(screen.getByText(OUTREACH_EXPLAINER_TITLE, { selector: "p" })).toBeTruthy();
  });

  it("keeps copy honest and free of hidden supplier names", () => {
    const copy = [OUTREACH_EXPLAINER_TITLE, ...OUTREACH_EXPLAINER_LINES, ...OUTREACH_EXPLAINER_TIPS].join(" ");
    expect(copy).not.toMatch(/Pelican|US Cabinet Depot|USCD|Hardware Resources|Line DL/i);
    expect(copy).toMatch(/Enrol list/);
  });
});
