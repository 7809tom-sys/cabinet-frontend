/** @vitest-environment jsdom */
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThreeDCabinetMoveButton, type ThreeDCabinetMoveDirection } from "./InteractiveRoom3D";

afterEach(cleanup);

function renderMoveButton(direction: ThreeDCabinetMoveDirection, onMove = vi.fn()) {
  const parentPointerDown = vi.fn();
  const parentClick = vi.fn();
  const view = render(
    <div onPointerDown={parentPointerDown} onClick={parentClick}>
      <ThreeDCabinetMoveButton
        testId={`move-${direction}`}
        direction={direction}
        title={`Move ${direction}`}
        className="test-button"
        onMove={onMove}
      >
        {direction}
      </ThreeDCabinetMoveButton>
    </div>,
  );
  return { button: view.getByTestId(`move-${direction}`), onMove, parentPointerDown, parentClick };
}

describe("ThreeDCabinetMoveButton execution path", () => {
  it.each(["up", "down", "left", "right"] as const)("dispatches %s immediately on the primary pointer without leaking to a camera parent", (direction) => {
    const { button, onMove, parentPointerDown } = renderMoveButton(direction);
    fireEvent.pointerDown(button, { button: 0, isPrimary: true, pointerId: 7 });
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith(direction);
    expect(parentPointerDown).not.toHaveBeenCalled();
  });

  it("ignores the compatibility click after pointer dispatch so one press moves exactly once", () => {
    const { button, onMove, parentClick } = renderMoveButton("right");
    fireEvent.pointerDown(button, { button: 0, isPrimary: true, pointerId: 9 });
    fireEvent.click(button, { detail: 1 });
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(parentClick).not.toHaveBeenCalled();
  });

  it("retains keyboard activation through a detail-zero click", () => {
    const { button, onMove, parentClick } = renderMoveButton("up");
    fireEvent.click(button, { detail: 0 });
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith("up");
    expect(parentClick).not.toHaveBeenCalled();
  });
});
