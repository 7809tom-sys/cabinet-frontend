// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AutoDesignReviewList } from "./AutoDesignReviewList";

afterEach(cleanup);

const LINES = [
  "B21 keeps an unfinished end side — Rule 10 needs 3/4\" stock on every visible side.",
  "W1230 keeps an unfinished end side — Rule 10 needs 3/4\" stock on every visible side.",
  "1 piece left the room bounds — B42.",
];

describe("AutoDesignReviewList", () => {
  it("starts collapsed after an Auto Design run: header and count only, no rule lines", () => {
    render(<AutoDesignReviewList lines={LINES} onDismiss={() => {}} />);
    expect(screen.getByText("Design questions needing review")).toBeTruthy();
    const toggle = screen.getByTestId("designer-review-toggle");
    expect(toggle.textContent).toBe("Show rules (3)");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryAllByTestId("designer-review-finding")).toHaveLength(0);
  });

  it("Show rules expands the same lines; Hide rules collapses them", () => {
    render(<AutoDesignReviewList lines={LINES} onDismiss={() => {}} />);
    fireEvent.click(screen.getByTestId("designer-review-toggle"));
    expect(screen.getAllByTestId("designer-review-finding").map((li) => li.textContent)).toEqual(LINES);
    expect(screen.getByTestId("designer-review-toggle").textContent).toBe("Hide rules");
    fireEvent.click(screen.getByTestId("designer-review-toggle"));
    expect(screen.queryAllByTestId("designer-review-finding")).toHaveLength(0);
  });

  it("a new run collapses again, Dismiss still works, and nothing renders with no findings", () => {
    const onDismiss = vi.fn();
    const { rerender, container } = render(<AutoDesignReviewList lines={LINES} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId("designer-review-toggle"));
    rerender(<AutoDesignReviewList lines={LINES.slice(0, 2)} onDismiss={onDismiss} />);
    expect(screen.getByTestId("designer-review-toggle").textContent).toBe("Show rules (2)");
    expect(screen.queryAllByTestId("designer-review-finding")).toHaveLength(0);
    fireEvent.click(screen.getByLabelText("Dismiss review list"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    rerender(<AutoDesignReviewList lines={[]} onDismiss={onDismiss} />);
    expect(container.innerHTML).toBe("");
  });
});
