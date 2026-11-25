// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CustomerActivityLine } from "./CustomerActivityLine";

const HREF = "/affiliate?section=customers&customer=user%3A4&scope=house";

let assign: ReturnType<typeof vi.fn>;
let open: ReturnType<typeof vi.fn>;
const originalLocation = window.location;

beforeEach(() => {
  assign = vi.fn();
  open = vi.fn();
  Object.defineProperty(window, "location", { configurable: true, value: { ...originalLocation, assign } });
  window.open = open as unknown as typeof window.open;
});

afterEach(() => {
  cleanup();
  Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
});

/** Mirrors the board's DealCard: a draggable button that opens the deal on click. */
function Card({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" draggable onClick={onOpen} data-testid="card">
      <span>Ada Lovelace</span>
      <CustomerActivityLine text="1 design, 2 quotes" href={HREF} nested />
    </button>
  );
}

describe("Open customer page inside a board card", () => {
  it("is a focusable link with the destination exposed", () => {
    render(<Card onOpen={vi.fn()} />);
    const link = screen.getByRole("link", { name: "Open customer page" });
    expect(link.tagName).toBe("SPAN");
    expect(link.getAttribute("tabindex")).toBe("0");
    expect(link.getAttribute("title")).toBe(HREF);
    expect(link.className).toContain("cursor-pointer");
  });

  it("opens the customer page on click without opening the deal", () => {
    const onOpen = vi.fn();
    render(<Card onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("link", { name: "Open customer page" }));
    expect(assign).toHaveBeenCalledWith(HREF);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("opens a new tab on Ctrl-click, Cmd-click and middle click", () => {
    const onOpen = vi.fn();
    render(<Card onOpen={onOpen} />);
    const link = screen.getByRole("link", { name: "Open customer page" });
    fireEvent.click(link, { ctrlKey: true });
    fireEvent.click(link, { metaKey: true });
    fireEvent(link, new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 1 }));
    expect(open).toHaveBeenCalledTimes(3);
    expect(open).toHaveBeenCalledWith(HREF, "_blank", "noopener,noreferrer");
    expect(assign).not.toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("works from the keyboard with Enter and Space and keeps the key off the card", () => {
    const onOpen = vi.fn();
    render(<Card onOpen={onOpen} />);
    const link = screen.getByRole("link", { name: "Open customer page" });
    expect(fireEvent.keyDown(link, { key: "Enter" })).toBe(false);
    expect(fireEvent.keyDown(link, { key: " " })).toBe(false);
    expect(assign).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(link, { key: "Tab" });
    expect(assign).toHaveBeenCalledTimes(2);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("stops the card from dragging while the link is pressed, then restores it", async () => {
    render(<Card onOpen={vi.fn()} />);
    const card = screen.getByTestId("card");
    const link = screen.getByRole("link", { name: "Open customer page" });
    expect(card.draggable).toBe(true);
    fireEvent.mouseDown(link);
    expect(card.draggable).toBe(false);
    fireEvent.mouseUp(window);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(card.draggable).toBe(true);
  });

  it("still lets the rest of the card open the deal", () => {
    const onOpen = vi.fn();
    render(<Card onOpen={onOpen} />);
    fireEvent.click(screen.getByText("Ada Lovelace"));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalled();
  });
});

describe("Open customer page in the deal drawer", () => {
  it("is a real anchor to the customer page", () => {
    render(<CustomerActivityLine text="1 design" href={HREF} />);
    const link = screen.getByRole("link", { name: "Open customer page" });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe(HREF);
  });
});

describe("without a customer page", () => {
  it("shows the summary but no dead link", () => {
    render(<CustomerActivityLine text="1 design" href="" nested />);
    expect(screen.getByText("1 design")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
