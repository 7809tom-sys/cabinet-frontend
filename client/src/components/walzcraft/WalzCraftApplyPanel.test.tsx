// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { GlazingControl, WalzCraftApplyPanel } from "./WalzCraftApplyPanel";
import type { ProfileFormValues } from "@shared/walzcraftProfileFill";

afterEach(cleanup);
const blank: ProfileFormValues = { railWidth: "", stileWidth: "", panelConstruction: "flat", bevelWidth: "", bevelDepth: "", insideEdgeProfile: "", drawerFrontType: "slab", finishSheen: "satin", profileNotes: "", sourceSpecification: "", glazed: "", glazeColor: "", glazeColorOther: "" };
function Harness() {
  const [v, setV] = useState(blank);
  return <><WalzCraftApplyPanel style={{ ourName: "Shaker White", distributorName: "Shaker White" }} values={v} onApply={setV} /><output data-testid="edge">{v.insideEdgeProfile}</output></>;
}

describe("WalzCraftApplyPanel", () => {
  it("previews old → new, fills on confirm, and undoes", () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("walzcraft-approve-fill"));
    expect(screen.getByTestId("fill-row-insideEdgeProfile").textContent).toContain("(empty)");
    expect(screen.getByTestId("walzcraft-fill-missing").textContent).toContain("Rail width: not in WalzCraft data");
    expect(screen.getByTestId("edge").textContent).toBe("");
    fireEvent.click(screen.getByTestId("walzcraft-confirm-fill"));
    expect(screen.getByTestId("edge").textContent).toBe('SR100 2 3/4"');
    fireEvent.click(screen.getByTestId("walzcraft-undo-fill"));
    expect(screen.getByTestId("edge").textContent).toBe("");
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
