// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { OutreachTip } from "./OutreachTip";
import { OUTREACH_TIPS, OUTREACH_TIP_IDS } from "./outreachTips";

afterEach(cleanup);

describe("Outreach tips", () => {
  it("stays closed until the lightbulb is clicked, then shows the tip", () => {
    render(<OutreachTip id="followUp" />);
    expect(screen.queryByText(OUTREACH_TIPS.followUp.body)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: `Tip: ${OUTREACH_TIPS.followUp.title}` }));
    expect(screen.getByText(OUTREACH_TIPS.followUp.body)).toBeTruthy();
    expect(screen.getByText(OUTREACH_TIPS.followUp.title)).toBeTruthy();
  });

  it("closes with the × button and with Escape", () => {
    render(<OutreachTip id="mode" />);
    const trigger = screen.getByRole("button", { name: `Tip: ${OUTREACH_TIPS.mode.title}` });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Close tip" }));
    expect(screen.queryByText(OUTREACH_TIPS.mode.body)).toBeNull();
    fireEvent.click(trigger);
    expect(screen.getByText(OUTREACH_TIPS.mode.body)).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(screen.queryByText(OUTREACH_TIPS.mode.body)).toBeNull();
  });

  it("does not block the action next to it while open", () => {
    const onApprove = vi.fn();
    render(<div><OutreachTip id="approveQueue" /><button type="button" onClick={onApprove}>Approve</button></div>);
    fireEvent.click(screen.getByRole("button", { name: `Tip: ${OUTREACH_TIPS.approveQueue.title}` }));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it("keeps every tip short, honest and free of hidden supplier names", () => {
    for (const id of OUTREACH_TIP_IDS) {
      const { title, body } = OUTREACH_TIPS[id];
      expect(title.length).toBeGreaterThan(0);
      const sentences = body.split(/(?<=[.!?])\s+(?=[A-Z"])/).filter(Boolean);
      expect(sentences.length, id).toBeLessThanOrEqual(2);
      expect(`${title} ${body}`).not.toMatch(/Pelican|US Cabinet Depot|USCD|Hardware Resources|Line DL/i);
      expect(body).not.toMatch(/\d+\s?%/);
    }
  });

});
