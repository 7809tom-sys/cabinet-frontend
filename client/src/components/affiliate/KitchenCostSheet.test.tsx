// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KitchenCostSheet, type KitchenCostRow } from "./KitchenCostSheet";
import { KITCHEN_COST_SHEET_DESCRIPTIONS } from "@shared/kitchenCostSheet";

afterEach(cleanup);

const rows = (): KitchenCostRow[] => KITCHEN_COST_SHEET_DESCRIPTIONS.map((description) => ({ description,
  materialQuantity: 0, materialUnitCost: 0, laborQuantity: 0, laborUnitCost: 0 }));

describe("compact Kitchen Cost Sheet", () => {
  it("keeps all 30 descriptions, both quantity/price fields, and both totals", () => {
    render(createElement(KitchenCostSheet, { rows: rows(), onChange: vi.fn() }));
    expect(screen.getAllByTestId("kitchen-cost-row")).toHaveLength(30);
    expect(screen.getAllByRole("spinbutton")).toHaveLength(120);
    expect(screen.getAllByRole("status")).toHaveLength(60);
    expect(screen.getByRole("spinbutton", { name: "Sheet Rock, Mud and Tape labor price per unit" })).toBeTruthy();
  });

  it("edits the correct Material/Labor field and calculates totals without changing prices", () => {
    const data = rows();
    data[0] = { ...data[0], materialQuantity: 2, materialUnitCost: 25.5, laborQuantity: 3, laborUnitCost: 90 };
    const onChange = vi.fn();
    render(createElement(KitchenCostSheet, { rows: data, onChange }));
    expect(screen.getByLabelText("Demo material total").textContent).toBe("$51.00");
    expect(screen.getByLabelText("Demo labor total").textContent).toBe("$270.00");
    fireEvent.change(screen.getByRole("spinbutton", { name: "Demo labor quantity" }), { target: { value: "4" } });
    expect(onChange).toHaveBeenLastCalledWith(0, { laborQuantity: 4 });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Demo material price per unit" }), { target: { value: "35.75" } });
    expect(onChange).toHaveBeenLastCalledWith(0, { materialUnitCost: 35.75 });
  });

  it("steps quantities by one, rejects fractional entry, and retains cents for prices", () => {
    const onChange = vi.fn();
    render(createElement(KitchenCostSheet, { rows: rows(), onChange }));
    const quantity = screen.getByRole("spinbutton", { name: "Demo material quantity" });
    expect(quantity.getAttribute("step")).toBe("1");
    expect(quantity.getAttribute("inputmode")).toBe("numeric");
    expect(screen.getByRole("spinbutton", { name: "Demo material price per unit" }).getAttribute("step")).toBe("0.01");
    fireEvent.change(quantity, { target: { value: "2.5" } });
    expect(onChange).toHaveBeenLastCalledWith(0, { materialQuantity: 2 });
  });
});
