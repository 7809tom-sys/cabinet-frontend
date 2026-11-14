// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AutoDesignReviewList } from "./AutoDesignReviewList";
import type { DesignerReviewFinding } from "@/lib/designerReviewFindings";

afterEach(cleanup);

function finding(
  patch: Partial<DesignerReviewFinding> & Pick<DesignerReviewFinding, "code" | "severity" | "title" | "detail">,
): DesignerReviewFinding {
  return {
    ruleId: patch.ruleId ?? "design-questions-honored",
    wallLabel: patch.wallLabel ?? null,
    cabinetUid: patch.cabinetUid ?? null,
    cabinetCode: patch.cabinetCode ?? null,
    ...patch,
  };
}

const FINDINGS: DesignerReviewFinding[] = [
  finding({
    code: "range-neighbor-too-narrow",
    severity: "warning",
    title: "Landing beside the range is short",
    detail: "Only 5 in of counter; 15 in is the minimum.",
    wallLabel: "Wall 1",
  }),
  finding({
    ruleId: "auto-design-rule-12",
    code: "preference-budget-friendly",
    severity: "info",
    title: "Customer pick: Budget friendly",
    detail: "Budget friendly: the build already prefers standard boxes; check the cart for lower-cost swaps.",
  }),
  finding({
    ruleId: "microwave-bridge-in-build",
    code: "over-range-defaulted",
    severity: "info",
    title: "What goes above the range",
    detail: "No answer was given, so the build used a microwave and a bridge cabinet. You can change this after the build.",
  }),
];

describe("AutoDesignReviewList", () => {
  it("shows a non-blocking Auto Design report, expanded, grouped by section", () => {
    render(<AutoDesignReviewList findings={FINDINGS} open onDismiss={() => {}} />);
    expect(screen.getByTestId("auto-design-rules-report")).toBeTruthy();
    expect(screen.getByText("Auto Design report")).toBeTruthy();
    expect(screen.queryByText("Design questions needing review")).toBeNull();
    expect(screen.getByTestId("auto-design-rules-report").getAttribute("role")).toBe("status");
    expect(screen.getByTestId("designer-review-toggle").textContent).toBe("Hide report");
    expect(screen.getByTestId("designer-review-toggle").getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("auto-design-rules-report-unmet").textContent).toContain(
      "Landing beside the range is short (Wall 1) — Only 5 in of counter; 15 in is the minimum.",
    );
    expect(screen.getByTestId("auto-design-rules-report-applied").textContent).toContain(
      "Customer pick: Budget friendly — Budget friendly: the build already prefers standard boxes; check the cart for lower-cost swaps.",
    );
    expect(screen.getByTestId("auto-design-rules-report-changeable").textContent).toContain(
      "What goes above the range — No answer was given, so the build used a microwave and a bridge cabinet. You can change this after the build.",
    );
    expect(screen.getAllByTestId("designer-review-finding")).toHaveLength(3);
  });

  it("is not a modal, can collapse and expand, and a new run opens the report again", () => {
    const onDismiss = vi.fn();
    const { rerender, container } = render(<AutoDesignReviewList findings={FINDINGS} open onDismiss={onDismiss} />);
    expect(container.querySelector("[role=dialog]")).toBeNull();
    fireEvent.click(screen.getByTestId("designer-review-toggle"));
    expect(screen.getByTestId("designer-review-toggle").textContent).toBe("Show report (3)");
    expect(screen.queryAllByTestId("designer-review-finding")).toHaveLength(0);
    fireEvent.click(screen.getByTestId("designer-review-toggle"));
    expect(screen.getAllByTestId("designer-review-finding")).toHaveLength(3);
    fireEvent.click(screen.getByTestId("designer-review-toggle"));
    rerender(<AutoDesignReviewList findings={FINDINGS.slice(0, 1)} open onDismiss={onDismiss} />);
    expect(screen.getByTestId("designer-review-toggle").textContent).toBe("Hide report");
    expect(screen.getAllByTestId("designer-review-finding")).toHaveLength(1);
    fireEvent.click(screen.getByLabelText("Dismiss review list"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    rerender(<AutoDesignReviewList findings={[]} open onDismiss={onDismiss} />);
    expect(container.innerHTML).toBe("");
  });

  it("stays visible after a long time and never auto-dismisses", () => {
    vi.useFakeTimers();
    try {
      const onDismiss = vi.fn();
      render(<AutoDesignReviewList findings={FINDINGS} open onDismiss={onDismiss} />);
      expect(screen.getByTestId("auto-design-rules-report")).toBeTruthy();
      vi.advanceTimersByTime(60_000);
      expect(screen.getByTestId("auto-design-rules-report")).toBeTruthy();
      expect(screen.getAllByTestId("designer-review-finding")).toHaveLength(3);
      vi.advanceTimersByTime(60 * 60 * 1000);
      expect(screen.getByTestId("auto-design-rules-report")).toBeTruthy();
      expect(onDismiss).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("View last report reopens the same findings after dismiss", () => {
    const onDismiss = vi.fn();
    const onReopen = vi.fn();
    const { rerender } = render(
      <AutoDesignReviewList findings={FINDINGS} open onDismiss={onDismiss} onReopen={onReopen} />,
    );
    fireEvent.click(screen.getByLabelText("Dismiss review list"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    rerender(<AutoDesignReviewList findings={FINDINGS} open={false} onDismiss={onDismiss} onReopen={onReopen} />);
    expect(screen.queryByTestId("auto-design-rules-report")).toBeNull();
    const reopen = screen.getByTestId("auto-design-view-last-report");
    expect(reopen.textContent).toBe("View last report");
    fireEvent.click(reopen);
    expect(onReopen).toHaveBeenCalledTimes(1);
    rerender(<AutoDesignReviewList findings={FINDINGS} open onDismiss={onDismiss} onReopen={onReopen} />);
    expect(screen.getByTestId("auto-design-rules-report")).toBeTruthy();
    expect(screen.getAllByTestId("designer-review-finding")).toHaveLength(3);
  });
});
