// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import {
  ApplySpecsToOtherStyles,
  type ApplySpecsHandle,
} from "./ApplySpecsToOtherStyles";

const styles = [
  {
    id: 1,
    distributorId: 9,
    ourName: "Skyline White Shaker",
    styleCode: "SW",
    color: "White",
    doorStyle: "Shaker",
    supplierBrandName: "Skyline",
  },
  {
    id: 2,
    distributorId: 9,
    ourName: "Skyline Gray Shaker",
    styleCode: "SG",
    color: "Gray",
    doorStyle: "Shaker",
    isActive: true,
  },
  {
    id: 3,
    distributorId: 9,
    ourName: "Skyline Navy Shaker",
    styleCode: "SN",
    color: "Navy",
    doorStyle: "Shaker",
    isActive: false,
  },
  {
    id: 4,
    distributorId: 4,
    ourName: "Other Line Slab",
    styleCode: "OLS",
    supplierBrandName: "Other",
  },
];

function Harness({ onConfirmed }: { onConfirmed: (value: string) => void }) {
  const ref = useRef<ApplySpecsHandle>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          void ref.current
            ?.confirm()
            .then((value) => onConfirmed(JSON.stringify(value)));
        }}
      >
        Open confirm
      </button>
      <ApplySpecsToOtherStyles ref={ref} current={styles[0]} styles={styles} />
    </>
  );
}

describe("ApplySpecsToOtherStyles", () => {
  afterEach(() => cleanup());

  it("starts with no other styles checked and offers select all and clear", () => {
    render(<ApplySpecsToOtherStyles current={styles[0]} styles={styles} />);
    expect(
      screen.getByRole("heading", {
        name: "Apply these specs to other styles",
      }),
    ).toBeTruthy();
    expect(screen.getByText(/Other door styles from Skyline/)).toBeTruthy();
    expect(screen.queryByText("Skyline White Shaker")).toBeNull();
    expect(screen.queryByText("Other Line Slab")).toBeNull();
    const gray = screen.getByRole("checkbox", { name: /Skyline Gray Shaker/ });
    const navy = screen.getByRole("checkbox", { name: /Skyline Navy Shaker/ });
    expect((gray as HTMLInputElement).checked).toBe(false);
    expect((navy as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText(/Hidden/)).toBeTruthy();
    expect(
      (screen.getByTestId("apply-spec-group-frame") as HTMLInputElement)
        .checked,
    ).toBe(true);

    fireEvent.click(screen.getByTestId("apply-specs-select-all"));
    expect((gray as HTMLInputElement).checked).toBe(true);
    expect((navy as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText("2 other styles selected.")).toBeTruthy();

    fireEvent.click(screen.getByTestId("apply-specs-clear"));
    expect((gray as HTMLInputElement).checked).toBe(false);
    expect((navy as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText("0 other styles selected.")).toBeTruthy();
  });

  it("confirms how many checked styles will change", async () => {
    let confirmed = "";
    render(
      <Harness
        onConfirmed={(value) => {
          confirmed = value;
        }}
      />,
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Skyline Gray Shaker/ }),
    );
    fireEvent.click(screen.getByTestId("apply-spec-group-finish"));
    fireEvent.click(screen.getByRole("button", { name: "Open confirm" }));
    const confirmation = await screen.findByTestId("apply-specs-confirmation");
    expect(confirmation.textContent).toContain("1 style will change");
    expect(confirmation.textContent).toContain("Skyline Gray Shaker");
    expect(confirmation.textContent).not.toContain("Finish and sheen");
    fireEvent.click(screen.getByRole("button", { name: "Save and apply" }));
    await waitFor(() =>
      expect(screen.queryByTestId("apply-specs-confirmation")).toBeNull(),
    );
    expect(confirmed).toContain('"styleIds":[2]');
    expect(confirmed).not.toContain('"finish"');
    expect(confirmed).toContain('"frame"');
  });
});
