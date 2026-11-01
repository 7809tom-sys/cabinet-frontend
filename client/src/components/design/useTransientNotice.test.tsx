// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTransientNotice } from "./useTransientNotice";

function Notice({ signature, durationMs = 8000 }: { signature: string; durationMs?: number }) {
  const notice = useTransientNotice(signature, durationMs);
  if (!notice.visible) return <p data-testid="notice-hidden">hidden</p>;
  return (
    <div role="status" data-testid="notice">
      <p>{signature}</p>
      <button type="button" onClick={notice.dismiss}>Close</button>
    </div>
  );
}

describe("transient designer notices", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("hides a warning on its own after about eight seconds and does not bring it back on the next render", () => {
    vi.useFakeTimers();
    const view = render(<Notice signature="Window on Wall 2: sill raised 4.5 in." />);
    expect(screen.getByTestId("notice")).toBeTruthy();
    act(() => { vi.advanceTimersByTime(7999); });
    expect(screen.getByTestId("notice")).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.getByTestId("notice-hidden")).toBeTruthy();
    view.rerender(<Notice signature="Window on Wall 2: sill raised 4.5 in." />);
    expect(screen.getByTestId("notice-hidden")).toBeTruthy();
  });

  it("can be closed before the timer, and a later different notice still appears", () => {
    vi.useFakeTimers();
    const view = render(<Notice signature="first notice" />);
    act(() => { view.getByRole("button", { name: "Close" }).click(); });
    expect(view.getByTestId("notice-hidden")).toBeTruthy();
    view.rerender(<Notice signature="first notice" />);
    expect(view.getByTestId("notice-hidden")).toBeTruthy();
    view.rerender(<Notice signature="second notice" />);
    expect(view.getByText("second notice")).toBeTruthy();
  });
});
