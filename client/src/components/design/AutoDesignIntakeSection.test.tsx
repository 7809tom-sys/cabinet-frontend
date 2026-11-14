// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AutoDesignIntakeSection } from "./AutoDesignIntakeSection";
import {
  emptyAutoDesignIntake,
  type AutoDesignIntake,
} from "@/lib/autoDesignFifteenRules";

afterEach(cleanup);

function Harness(props: { onChange: (next: AutoDesignIntake) => void }) {
  const [intake, setIntake] = useState<AutoDesignIntake>(emptyAutoDesignIntake());
  return (
    <AutoDesignIntakeSection
      intake={intake}
      onChange={(next) => {
        setIntake(next);
        props.onChange(next);
      }}
    />
  );
}

describe("AutoDesignIntakeSection", () => {
  it("renders the three steps in order", () => {
    const onChange = vi.fn();
    const { container } = render(<Harness onChange={onChange} />);
    const text = container.textContent ?? "";
    const step1 = text.indexOf("Step 1");
    const step2 = text.indexOf("Step 2");
    const step3 = text.indexOf("Step 3");
    expect(step1).toBeGreaterThanOrEqual(0);
    expect(step2).toBeGreaterThan(step1);
    expect(step3).toBeGreaterThan(step2);
  });

  it("shows the construction sentence until old construction is picked", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    expect(screen.getByText("Pick one before the layout math starts.")).toBeTruthy();

    fireEvent.click(screen.getByTestId("intake-construction-old"));

    expect(screen.queryByText("Pick one before the layout math starts.")).toBeNull();
    expect(
      screen.getByText("The layout respects the existing walls and openings."),
    ).toBeTruthy();
  });

  it("sets canMove.rangeHookup false and aria-pressed true when No is clicked", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    const noButton = screen.getByTestId("intake-move-rangeHookup-no");
    expect(noButton.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(noButton);

    expect(noButton.getAttribute("aria-pressed")).toBe("true");
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0] as AutoDesignIntake;
    expect(last.canMove.rangeHookup).toBe(false);
  });

  it("contains no free-text inputs or textareas", () => {
    const onChange = vi.fn();
    const { container } = render(<Harness onChange={onChange} />);
    expect(container.querySelector('input[type="text"]')).toBeNull();
    expect(container.querySelector("textarea")).toBeNull();
  });
});
