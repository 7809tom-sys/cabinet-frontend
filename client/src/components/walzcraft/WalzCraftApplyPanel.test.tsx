// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { GlazingControl, WalzCraftApplyPanel } from "./WalzCraftApplyPanel";
import type { ProfileFormValues } from "@shared/walzcraftProfileFill";

afterEach(cleanup);
const blank: ProfileFormValues = { railWidth: "", stileWidth: "", panelConstruction: "flat", bevelWidth: "", bevelDepth: "", insideEdgeProfile: "", drawerFrontType: "slab", finishSheen: "satin", profileNotes: "", sourceSpecification: "", glazed: "", glazeColor: "", glazeColorOther: "" };
function Harness({ start = blank }: { start?: ProfileFormValues }) {
  const [v, setV] = useState(start);
  return <><WalzCraftApplyPanel style={{ ourName: "Shaker White", distributorName: "Shaker White" }} values={v} onApply={setV} /><output data-testid="edge">{v.insideEdgeProfile}</output><output data-testid="widths">{v.railWidth}|{v.stileWidth}</output></>;
}

describe("WalzCraftApplyPanel", () => {
  it("previews old → new, fills on confirm, and undoes", () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("walzcraft-approve-fill"));
    expect(screen.getByTestId("fill-row-insideEdgeProfile").textContent).toContain("(empty)");
    expect(screen.getByTestId("fill-row-railWidth").textContent).toContain("2.75");
    expect(screen.getByTestId("walzcraft-fill-missing-block").textContent).toMatch(/Left blank \(\d+\)/);
    expect(screen.getByTestId("walzcraft-fill-missing").textContent).toContain("Bevel depth — left blank: WalzCraft does not dimension bevel depth");
    expect(screen.getByTestId("edge").textContent).toBe("");
    fireEvent.click(screen.getByTestId("walzcraft-confirm-fill"));
    expect(screen.getByTestId("edge").textContent).toBe('SR100 2 3/4"');
    fireEvent.click(screen.getByTestId("walzcraft-undo-fill"));
    expect(screen.getByTestId("edge").textContent).toBe("");
  });
  it("SR100 door: Approve overwrites an existing 3\" rail/stile width with 2.75 and Undo restores it", () => {
    render(<Harness start={{ ...blank, railWidth: "3", stileWidth: "3" }} />);
    fireEvent.click(screen.getByTestId("walzcraft-approve-fill"));
    expect(screen.getByTestId("fill-row-railWidth").textContent).toMatch(/Rail width3\s*2\.75/);
    expect(screen.getByTestId("fill-row-stileWidth").textContent).toMatch(/Stile width3\s*2\.75/);
    fireEvent.click(screen.getByTestId("walzcraft-confirm-fill"));
    expect(screen.getByTestId("widths").textContent).toBe("2.75|2.75");
    fireEvent.click(screen.getByTestId("walzcraft-undo-fill"));
    expect(screen.getByTestId("widths").textContent).toBe("3|3");
  });
  it("glazing color dropdown is exactly Gold/Black/Other and Other reveals a name field", () => {
    function G() { const [g, setG] = useState({ glazed: "yes" as const, glazeColor: "" as const, glazeColorOther: "" }); return <GlazingControl {...g} onChange={setG as never} />; }
    render(<G />);
    const sel = screen.getByTestId("glaze-color-select") as HTMLSelectElement;
    expect(Array.from(sel.options).filter((o) => o.value).map((o) => o.text)).toEqual(["Gold", "Black", "Other"]);
    expect(screen.queryByTestId("glaze-color-other")).toBeNull();
    fireEvent.change(sel, { target: { value: "other" } });
    expect(screen.getByTestId("glaze-color-other")).toBeTruthy();
  });
});
