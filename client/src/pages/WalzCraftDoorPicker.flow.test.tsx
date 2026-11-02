// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import WalzCraftDoorPicker from "./WalzCraftDoorPicker";

afterEach(cleanup);
const cont = () => screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;

describe("WalzCraft door picker click-through", () => {
  it("enables Continue right after a family click and walks every step with a building banner", () => {
    render(<WalzCraftDoorPicker />);
    expect(screen.getByTestId("building-title").textContent).toBe("Building: choose a door");
    expect(cont().disabled).toBe(true);
    fireEvent.click(screen.getByTestId("color-family-alabaster"));
    // Root-cause regression: the family click must select a shade so Continue works.
    expect(cont().disabled).toBe(false);
    expect(screen.getAllByText(/WalzCraft color \(estimated match\)/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/· 70% match/)).toBeNull();
    fireEvent.click(screen.getByTestId("shade-next"));
    fireEvent.click(screen.getByTestId("shade-prev"));
    fireEvent.click(cont());
    expect(screen.getByTestId("step-type")).toBeTruthy();
    fireEvent.click(screen.getByTestId("door-type-five-piece"));
    fireEvent.click(cont());
    expect(screen.getByTestId("step-profile")).toBeTruthy();
    fireEvent.click(screen.getByTestId("profile-toggle-S592"));
    expect(screen.getAllByText(/Seen at: (Faircrest|DL Cabinetry)/).length).toBeGreaterThan(0);
    // several distributor doors map to Barrington: user picks one
    const sel = screen.getByTestId("building-door-select") as HTMLSelectElement;
    fireEvent.change(sel, { target: { value: "faircrest-asp" } });
    expect(screen.getByTestId("building-title").textContent).toBe("Building: Aspen White");
    expect(screen.getByTestId("building-banner").textContent).toContain("from Faircrest");
    expect(screen.getByTestId("building-banner").textContent).not.toMatch(/S592/);
    fireEvent.click(cont());
    expect(screen.getByTestId("step-drawers")).toBeTruthy();
    fireEvent.click(screen.getByTestId("drawer-toggle-wall-match"));
    fireEvent.click(screen.getByTestId("drawer-toggle-base-match"));
    fireEvent.click(cont());
    expect(screen.getByTestId("step-glaze")).toBeTruthy();
    fireEvent.click(cont());
    expect(screen.getByTestId("building-title").className).toContain("text-3xl");
    expect(screen.getByTestId("building-title").textContent).toBe("Building: Aspen White");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByTestId("step-glaze")).toBeTruthy();
    fireEvent.click(screen.getByTestId("step-pill-color"));
    expect(screen.getByTestId("step-color")).toBeTruthy();
  });
});
