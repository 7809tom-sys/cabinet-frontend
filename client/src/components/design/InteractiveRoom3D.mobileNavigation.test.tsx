// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileThreeDViewerNavigation } from "./InteractiveRoom3D";

describe("MobileThreeDViewerNavigation", () => {
  it("uses a half-inch launcher and keeps the full control popup closed until requested", () => {
    const onZoom = vi.fn();
    const onReset = vi.fn();
    const onShare = vi.fn();
    const onPan = vi.fn();

    render(<MobileThreeDViewerNavigation onZoom={onZoom} onReset={onReset} onShare={onShare} onPan={onPan} />);

    const launcher = screen.getByRole("button", { name: "Open 3D view controls" });
    expect(launcher.className).toContain("h-[0.5in]");
    expect(launcher.className).toContain("w-[0.5in]");
    expect(launcher.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("dialog", { name: "3D view controls" })).toBeNull();

    fireEvent.click(launcher);
    expect(launcher.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("dialog", { name: "3D view controls" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Zoom in for a closer cabinet view" }));
    fireEvent.click(screen.getByRole("button", { name: "Pan view right" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset 3D room view" }));
    fireEvent.click(screen.getByRole("button", { name: "Share the current 3D zoom and pan perspective" }));
    expect(onZoom).toHaveBeenCalledWith("in");
    expect(onPan).toHaveBeenCalledWith("right");
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Close 3D view controls" }));
    expect(screen.queryByRole("dialog", { name: "3D view controls" })).toBeNull();
    expect(launcher.getAttribute("aria-expanded")).toBe("false");
  });
});
