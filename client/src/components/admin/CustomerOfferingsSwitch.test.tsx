// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ visible: true, setVisible: vi.fn() }));

vi.mock("@/lib/useCustomerOfferings", () => ({
  useCustomerOfferings: () => ({
    visible: state.visible,
    loading: false,
    saving: false,
    setVisible: state.setVisible,
  }),
}));

import { CustomerOfferingsSwitch } from "./CustomerOfferingsSwitch";

afterEach(() => {
  cleanup();
  state.visible = true;
  state.setVisible.mockClear();
});

describe("customer offerings switch", () => {
  it("shows yes and turns the group off", () => {
    render(<CustomerOfferingsSwitch />);
    expect(screen.getByText("Yes")).toBeTruthy();
    fireEvent.click(screen.getByRole("switch", { name: "Show the customer offerings group" }));
    expect(state.setVisible).toHaveBeenCalledWith(false);
  });

  it("shows no when the group is hidden from customers", () => {
    state.visible = false;
    render(<CustomerOfferingsSwitch />);
    expect(screen.getByText("No")).toBeTruthy();
    expect(screen.getByTestId("customer-offerings-switch")).toBeTruthy();
  });
});
