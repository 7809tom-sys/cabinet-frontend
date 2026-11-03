// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AutoDesignTallDialog } from "./AutoDesignTallDialog";
import type { AutoDesignTallProduct } from "@/lib/autoDesignTallCabinets";

afterEach(cleanup);

const uoc: AutoDesignTallProduct = {
  id: 1, masterCode: "UOC3390", catalogCode: "UOC3390(O339024)",
  description: '33"x 90" Oven Pantry Cabinet', subCategory: "Oven Tower",
  kind: "oven-pantry", widthIn: 33, heightIn: 90, depthIn: 24,
};
const tod: AutoDesignTallProduct = {
  id: 2, masterCode: "TOD3084", catalogCode: "TOD3084",
  description: '30" W × 84" H × 24" D Tall Double Oven Cabinet with One Drawer', subCategory: "Oven Cabinet",
  kind: "oven-pantry", widthIn: 30, heightIn: 84, depthIn: 24,
};
const pantry: AutoDesignTallProduct = {
  id: 3, masterCode: "TP2490", catalogCode: "TP2490",
  description: '24" × 90" Pantry Cabinet', subCategory: "Pantry",
  kind: "pantry", widthIn: 24, heightIn: 90, depthIn: 24,
};

function renderDialog(overrides: Partial<Parameters<typeof AutoDesignTallDialog>[0]> = {}) {
  const onAdd = vi.fn();
  const onRemove = vi.fn();
  const onDone = vi.fn();
  const onCancel = vi.fn();
  render(
    <AutoDesignTallDialog
      open
      products={[uoc, tod, pantry]}
      picked={[]}
      onAdd={onAdd}
      onRemove={onRemove}
      onDone={onDone}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { onAdd, onRemove, onDone, onCancel };
}

describe("AutoDesignTallDialog", () => {
  it("is a pop-up that lists the real tall oven/pantry boxes", () => {
    renderDialog();
    expect(screen.getByTestId("auto-design-tall-dialog")).toBeTruthy();
    expect(screen.getByTestId("auto-design-tall-option-1").textContent).toMatch(/UOC3390/);
    expect(screen.getByText(/33″ W × 90″ H × 24″ D/)).toBeTruthy();
  });

  it("says accessories are not boxes, so trays and valances are absent", () => {
    renderDialog();
    expect(screen.getByText(/Roll-out trays, valances and trim are add-on accessories/i)).toBeTruthy();
  });

  it("adds a pick so the build can auto-place it", () => {
    const { onAdd } = renderDialog();
    fireEvent.click(screen.getByTestId("auto-design-tall-add-1"));
    expect(onAdd).toHaveBeenCalledWith(uoc);
  });

  it("groups by kind and filters the list", () => {
    renderDialog();
    expect(screen.getByTestId("auto-design-tall-group-oven-pantry")).toBeTruthy();
    expect(screen.getByTestId("auto-design-tall-group-pantry")).toBeTruthy();
    fireEvent.click(screen.getByTestId("auto-design-tall-kind-pantry"));
    expect(screen.queryByTestId("auto-design-tall-option-1")).toBeNull();
    expect(screen.getByTestId("auto-design-tall-option-3")).toBeTruthy();
  });

  it("shows a picked box and lets it be removed", () => {
    const { onRemove } = renderDialog({ picked: [uoc, tod] });
    expect(screen.getByTestId("auto-design-tall-picked").textContent).toMatch(/UOC3390, TOD3084/);
    fireEvent.click(screen.getByTestId("auto-design-tall-remove-1"));
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it("reports a line with no tall boxes instead of offering substitutes", () => {
    renderDialog({ products: [] });
    expect(screen.getByTestId("auto-design-tall-empty")).toBeTruthy();
  });
});
