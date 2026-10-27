// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AutoDesignWiggleBadge, AutoDesignWiggleNotice } from "./AutoDesignWiggleNotice";
import type { FourAnchorWiggleMove } from "@/lib/designerLayoutRules";

afterEach(cleanup);

const rangeMove: FourAnchorWiggleMove = {
  uid: "range-1",
  kind: "stove",
  applianceType: "stove",
  label: "Range",
  wallId: "bottom",
  wallLabel: "bottom wall",
  direction: "right",
  deltaAlongIn: 2,
  inchesMoved: 2,
  distanceFromOriginalIn: 2,
  fromStart: 34,
  toStart: 36,
  originalPositionIn: 34,
  newPositionIn: 36,
  reason: { uid: "ls-36", masterCode: "LSB36", label: '36" lazy Susan', widthIn: 36 },
};

describe("Auto-Design wiggle notice", () => {
  it("shows nothing when Auto-Design did not shift an appliance", () => {
    const { container } = render(<AutoDesignWiggleNotice moves={[]} />);
    expect(container.textContent).toBe("");
    expect(screen.queryByTestId("auto-design-wiggle-notice")).toBeNull();
  });

  it("lists every wiggle-room adjustment until the layout no longer has one", () => {
    render(<AutoDesignWiggleNotice moves={[rangeMove]} />);
    const notice = screen.getByTestId("auto-design-wiggle-notice");
    expect(notice.textContent).toContain("Auto-Design wiggle room");
    expect(notice.textContent).toContain('Wiggle room applied: Range moved 2" right to fit the 36" lazy Susan');
    expect(notice.textContent).toContain('bottom wall: 34" → 36"');
    expect(screen.getByTestId("auto-design-wiggle-notice-range-1")).toBeTruthy();
  });

  it("labels the moved appliance with the inches and direction", () => {
    render(<AutoDesignWiggleBadge move={rangeMove} />);
    const badge = screen.getByTestId("auto-design-wiggle-badge");
    expect(badge.textContent).toBe('Moved 2" →');
    expect(badge.getAttribute("data-appliance-uid")).toBe("range-1");
    expect(badge.getAttribute("title")).toContain("36\" lazy Susan");
  });
});
