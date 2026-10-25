// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import VendorClosetStudio from "./VendorClosetStudio";

vi.mock("@/components/vendor/VendorClosetScene", () => ({
  VendorClosetScene: () => <div data-testid="mock-vendor-scene">3D scene</div>,
}));

describe("Closet Studio tablet workspace", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    window.history.replaceState(null, "", "/closet");
  });

  it("keeps a wall's layout separate and exposes filled or empty status through the upper-right bird's-eye overview", () => {
    window.localStorage.clear();
    render(<VendorClosetStudio />);
    fireEvent.click(screen.getByRole("button", { name: "Start with one tower" }));

    const overview = screen.getByTestId("vendor-room-overview");
    const back = within(overview).getByRole("button", { name: /Back wall: filled, 25\.5 of 120 inches used/i });
    const left = within(overview).getByRole("button", { name: /Left wall: empty, 0 of 96 inches used/i });
    expect(back.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(left);

    expect(within(overview).getByRole("button", { name: /Left wall: empty, 0 of 96 inches used/i }).getAttribute("aria-pressed")).toBe("true");
    const dock = screen.getByTestId("vendor-tablet-options-dock");
    expect(within(dock).getByText(/This wall is empty.*other walls remain unchanged/i)).toBeTruthy();
    fireEvent.click(within(dock).getByRole("button", { name: "Add first tower" }));
    expect(within(dock).getByRole("button", { name: "Select Tower 1" })).toBeTruthy();
    expect(within(dock).getByText(/25\.5 of 96 in on left wall/i)).toBeTruthy();

    fireEvent.click(back);
    expect(within(dock).getByText(/25\.5 of 120 in on back wall/i)).toBeTruthy();
    expect(within(overview).getByRole("button", { name: /Left wall: filled, 25\.5 of 96 inches used/i })).toBeTruthy();
    const scene = readFileSync(`${process.cwd()}/client/src/components/vendor/VendorClosetScene.tsx`, "utf8");
    expect(scene).toContain("studioCornerShelvesForWall(design)");
    expect(scene).toContain("if (design.bays.length) box");
  });

  it("keeps Room reversible while the tablet Material List stays a compact right-dock disclosure with tower and part controls", () => {
    window.history.replaceState(null, "", "/closet?demo=mixed");
    render(<VendorClosetStudio />);

    const room = screen.getByRole("button", { name: "Room and wall settings" });
    const dock = screen.getByTestId("vendor-tablet-options-dock");
    const reference = within(dock).getByRole("button", { name: "Material reference details" });
    expect(room.getAttribute("aria-expanded")).toBe("false");
    expect(reference.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByTestId("mock-vendor-scene")).toBeTruthy();
    expect(within(dock).getByRole("button", { name: "Select Tower 2" })).toBeTruthy();
    expect(within(dock).getByRole("combobox", { name: "More parts for selected tower" })).toBeTruthy();

    fireEvent.click(room);
    expect(room.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByRole("button", { name: "Close room settings" })).toHaveLength(2);
    fireEvent.click(reference);
    expect(reference.getAttribute("aria-expanded")).toBe("true");
    expect(within(dock).getByTestId("vendor-tablet-material-list")).toBeTruthy();
    fireEvent.click(reference);
    expect(reference.getAttribute("aria-expanded")).toBe("false");
    expect(within(dock).getByRole("button", { name: "Select Tower 2" })).toBeTruthy();
  });

  it("keeps the three-column layout for wide desktops but uses on-demand panels at tablet CSS widths", () => {
    window.history.replaceState(null, "", "/closet?demo=mixed");
    render(<VendorClosetStudio />);
    expect(screen.getByTestId("vendor-controls").className).toContain("min-[1800px]:static");
    const referencePanel = screen.getByTestId("vendor-reference-panel");
    expect(referencePanel.parentElement?.parentElement?.className).toContain("min-[1800px]:block");
    expect(screen.getByTestId("vendor-part-tray").className).toContain("overflow-hidden");
    const more = within(screen.getByTestId("vendor-tablet-options-dock")).getByRole("combobox", { name: "More parts for selected tower" });
    expect(more.className).toContain("h-full");
    expect(more.className).toContain("inset-0");
    const scene = readFileSync(`${process.cwd()}/client/src/components/vendor/VendorClosetScene.tsx`, "utf8");
    expect(scene).toContain('className="h-full min-h-0 w-full touch-none"');
    expect(screen.getByTestId("mock-vendor-scene")).toBeTruthy();
  });

  it("moves every tablet design option into the right dock and keeps the dated material list as a compact dropdown", () => {
    window.history.replaceState(null, "", "/closet?demo=mixed");
    render(<VendorClosetStudio />);

    const dock = screen.getByTestId("vendor-tablet-options-dock");
    const material = within(dock).getByTestId("vendor-tablet-material-disclosure");
    const toggle = within(material).getByRole("button", { name: "Material reference details" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByTestId("vendor-tower-controls").className).toContain("hidden");
    expect(screen.getByTestId("vendor-tower-controls").className).toContain("min-[1800px]:block");
    expect(screen.getByTestId("vendor-part-tray").className).toContain("hidden");
    expect(screen.getByTestId("vendor-part-tray").className).toContain("min-[1800px]:block");
    expect(within(dock).getByRole("button", { name: "Select Tower 2" })).toBeTruthy();
    expect(within(dock).getByRole("combobox", { name: "More parts for selected tower" })).toBeTruthy();

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(within(material).getByTestId("vendor-tablet-material-list").textContent).toMatch(/March 1, 2022 customer List/i);
    expect(within(material).getByTestId("vendor-reference-total")).toBeTruthy();
  });

  it("uses the Kitchen-style phone action strip to open focused Room, Tower, Parts, and List sheets instead of bottom editing controls", () => {
    window.history.replaceState(null, "", "/closet?demo=mixed");
    render(<VendorClosetStudio />);

    const strip = screen.getByTestId("vendor-phone-action-strip");
    expect(within(strip).getByRole("button", { name: "Room settings" })).toBeTruthy();
    const tower = within(strip).getByRole("button", { name: "Tower controls" });
    const parts = within(strip).getByRole("button", { name: "Add closet parts" });
    const list = within(strip).getByRole("button", { name: "Material reference" });
    expect(screen.getByTestId("vendor-tower-controls").className).toContain("hidden");
    expect(screen.getByTestId("vendor-tower-controls").className).toContain("min-[1800px]:block");

    fireEvent.click(tower);
    expect(screen.getByTestId("vendor-tablet-options-dock").className).toContain("fixed inset-x-0 bottom-0");
    expect(within(screen.getByTestId("vendor-tablet-options-dock")).getByRole("button", { name: "Select Tower 2" })).toBeTruthy();
    fireEvent.click(parts);
    expect(within(screen.getByTestId("vendor-tablet-options-dock")).getByRole("combobox", { name: "More parts for selected tower" })).toBeTruthy();
    fireEvent.click(within(screen.getByTestId("vendor-tablet-options-dock")).getByRole("button", { name: /Adjustable shelf/ }));
    expect(screen.getByTestId("vendor-tablet-options-dock").className).toContain("hidden");
    const source = readFileSync(`${process.cwd()}/client/src/pages/VendorClosetStudio.tsx`, "utf8");
    expect(source).toContain('partToPlace && hasBay ? "top-24 sm:top-28" : "bottom-3 sm:bottom-5"');
    fireEvent.click(list);
    expect(within(screen.getByTestId("vendor-tablet-options-dock")).getByTestId("vendor-tablet-material-list")).toBeTruthy();
  });

  it("lets a tablet user plan a sourced straight shelf cut in the right dock without exposing unverified accessory cuts", () => {
    window.history.replaceState(null, "", "/closet?demo=mixed");
    render(<VendorClosetStudio />);

    const dock = screen.getByTestId("vendor-tablet-options-dock");
    fireEvent.click(within(dock).getByRole("button", { name: "Select Tower 1" }));
    const cut = within(dock).getByTestId("vendor-cut-to-fit");
    expect(within(cut).getByRole("combobox", { name: "Cut-to-fit stock shelf width" })).toBeTruthy();
    const measured = within(cut).getByRole("spinbutton", { name: "Installed clear shelf width in inches" });
    fireEvent.change(measured, { target: { value: "22.5" } });
    fireEvent.click(within(cut).getByRole("button", { name: "Apply measured width" }));
    expect(within(dock).getByText("Cut planned")).toBeTruthy();
    const updatedCut = within(dock).getByTestId("vendor-cut-to-fit");
    expect(updatedCut.textContent).toMatch(/planning difference.*1\.5/i);
    expect(within(updatedCut).getByRole("button", { name: "Full stock" })).toBeTruthy();
    const scene = readFileSync(`${process.cwd()}/client/src/components/vendor/VendorClosetScene.tsx`, "utf8");
    expect(scene).toContain("if (!studioBayCut(bay))");
  });

  it("keeps the 45-degree shoe pitch caveat accessible through the tablet and phone Parts controls, with renderer metadata scoped to shoes", () => {
    window.history.replaceState(null, "", "/closet?demo=mixed");
    render(<VendorClosetStudio />);

    const dock = screen.getByTestId("vendor-tablet-options-dock");
    expect(within(dock).getByTestId("vendor-shoe-pitch-caveat").textContent).toMatch(/45° illustrative shoe pitch.*supplier fit and attachment/i);
    fireEvent.click(within(screen.getByTestId("vendor-phone-action-strip")).getByRole("button", { name: "Add closet parts" }));
    expect(within(dock).getByTestId("vendor-shoe-pitch-caveat").textContent).toMatch(/45° illustrative shoe pitch/i);

    const scene = readFileSync(`${process.cwd()}/client/src/components/vendor/VendorClosetScene.tsx`, "utf8");
    expect(scene).toContain("STUDIO_ILLUSTRATIVE_SHOE_PITCH_DEG");
    expect(scene).toContain("shoeGroup.rotation.x = shoePitchRad");
    expect(scene).toContain("sourcedShelfThicknessIn: 0.75");
    const shoeBranch = scene.split('else if (item.kind === "shoe")')[1]?.split('else if (item.kind === "drawer")')[0];
    expect(shoeBranch).toContain("illustrativePitchDeg");
  });

  it("keeps the 29.5-inch pie shelf planner discoverable and supports both standalone and atomic two-wall corner plans", () => {
    window.history.replaceState(null, "", "/closet");
    render(<VendorClosetStudio />);
    fireEvent.click(screen.getByRole("button", { name: "Start with one tower" }));

    fireEvent.click(within(screen.getByTestId("vendor-room-overview")).getByRole("button", { name: /Right wall: empty/i }));

    const dock = screen.getByTestId("vendor-tablet-options-dock");
    const corner = within(dock).getByTestId("vendor-corner-planning-controls");
    expect(within(corner).getByTestId("vendor-corner-planning-caveat").textContent).toMatch(/29\.5.*2026-spec planning envelope.*not a curved profile.*connector.*H-joint/i);
    const frontRight = within(corner).getByRole("button", { name: "Highlight Front-right 90-degree corner" });
    fireEvent.click(frontRight);
    expect(frontRight.getAttribute("aria-pressed")).toBe("true");
    fireEvent.change(within(corner).getByRole("combobox", { name: "Corner shelf room corner" }), { target: { value: "front-right" } });
    fireEvent.change(within(corner).getByRole("combobox", { name: "Corner shelf type" }), { target: { value: "adjustable" } });
    fireEvent.change(within(corner).getByRole("spinbutton", { name: "Corner shelf planning elevation in inches" }), { target: { value: "36" } });
    fireEvent.click(within(corner).getByRole("button", { name: "Shelf only" }));
    expect(within(corner).getByText(/Adjustable corner.*SKU 432557.*Front-right.*36 in/i)).toBeTruthy();
    expect(within(corner).getByTestId("vendor-corner-plan-elevation").textContent).toMatch(/illustrative pie shelf.*conservative 29\.5.*Elevation: 36.*0\.75.*Tower alignment has not been planned/i);
    expect(within(corner).getByText(/No incident tower to align yet.*verify assembly fit/i)).toBeTruthy();
    fireEvent.click(within(corner).getByRole("button", { name: "Undo corner" }));
    expect(within(corner).queryByText(/Adjustable corner.*SKU 432557/i)).toBeNull();

    fireEvent.change(within(corner).getByRole("combobox", { name: "Corner shelf room corner" }), { target: { value: "back-right" } });
    fireEvent.change(within(corner).getByRole("combobox", { name: "Corner shelf type" }), { target: { value: "fixed" } });
    fireEvent.click(within(corner).getByRole("button", { name: "Build visual corner" }));
    expect(within(corner).getByText(/Fixed corner.*SKU 432556.*Back-right.*36 in/i)).toBeTruthy();
    expect(within(corner).getByTestId("vendor-corner-plan-elevation").textContent).toMatch(/Both incident tower previews align.*not a physical connection/i);
    expect(within(screen.getByTestId("vendor-room-overview")).getByRole("button", { name: /Back wall: filled/i })).toBeTruthy();
    expect(within(screen.getByTestId("vendor-room-overview")).getByRole("button", { name: /Right wall: filled/i })).toBeTruthy();

    fireEvent.click(within(screen.getByTestId("vendor-phone-action-strip")).getByRole("button", { name: "Add closet parts" }));
    expect(within(dock).getByRole("button", { name: "Plan 29.5-inch curved corner shelf" })).toBeTruthy();

    const scene = readFileSync(`${process.cwd()}/client/src/components/vendor/VendorClosetScene.tsx`, "utf8");
    expect(scene).toContain("cornerShelfPlanningEnvelope: true");
    expect(scene).toContain("illustrativePieShelf: true");
    expect(scene).toContain("renderCompanionTower");
    expect(scene).toContain("profileIllustrative: true");
    expect(scene).toContain("installationFitToVerify: true");
    expect(scene).toContain("conservative 29.5-in collision envelope");
    expect(scene).not.toContain("cornerShelfCollisionEnvelope");
    expect(scene).not.toContain("cornerShelfSelectionMarker");
    expect(scene).not.toContain("cornerOutlineMat");
    expect(scene).not.toContain("cornerEnvelopeMat");
    expect(scene).toContain("}), boardMat);");
    expect(scene).toContain("finish: design.finish");
  });

  it("keeps an always-visible Corner shelf action targeted at the actual planner rather than requiring dock scrolling", () => {
    window.history.replaceState(null, "", "/closet");
    render(<VendorClosetStudio />);
    fireEvent.click(screen.getByRole("button", { name: "Start with one tower" }));

    const entry = screen.getByRole("button", { name: "Add 29.5-inch corner shelf" });
    expect(entry.textContent).toMatch(/corner/i);
    fireEvent.click(entry);

    const planners = screen.getAllByTestId("vendor-corner-planning-controls");
    expect(planners.map((planner) => planner.id)).toEqual(["vendor-corner-shelf-planner-wide", "vendor-corner-shelf-planner-dock"]);
    const planner = planners[1];
    expect(within(planner).getByRole("button", { name: "Build visual corner" })).toBeTruthy();
  });

  it("keeps a persistent available-finish dropdown visible while a Studio design is open", () => {
    window.history.replaceState(null, "", "/closet");
    render(<VendorClosetStudio />);
    fireEvent.click(screen.getByRole("button", { name: "Start with one tower" }));

    const finish = screen.getByRole("combobox", { name: "Available MasterTrac finish" });
    expect(within(finish).getByRole("option", { name: "Glacier White" })).toBeTruthy();
    expect(within(finish).getByRole("option", { name: "Slate Rift" })).toBeTruthy();
    expect(within(finish).getByRole("option", { name: "Spiced Mahogany" })).toBeTruthy();
    fireEvent.change(finish, { target: { value: "Slate Rift" } });
    expect((finish as HTMLSelectElement).value).toBe("Slate Rift");
    expect(screen.getByText(/One tower at a time · Slate Rift/i)).toBeTruthy();
  });

  it("places sourced baskets as editable visual-planning envelopes in Parts without substituting 2026 SKUs or claiming rail fit", () => {
    window.history.replaceState(null, "", "/closet?demo=mixed");
    render(<VendorClosetStudio />);

    const dock = screen.getByTestId("vendor-tablet-options-dock");
    const basket = within(dock).getByTestId("vendor-basket-planning-controls");
    expect(within(basket).getByTestId("vendor-basket-planning-caveat").textContent).toMatch(/visual planning only.*supplier rail and clearance verification.*14\.5.*outer basket.*rail.*mounting offsets.*travel.*446807.*446815.*not substituted/i);
    const source = within(basket).getByRole("combobox", { name: "Basket visual-planning source SKU" });
    fireEvent.change(source, { target: { value: "432902" } });
    fireEvent.change(within(basket).getByRole("spinbutton", { name: "Basket visual-planning bottom elevation in inches" }), { target: { value: "42" } });
    fireEvent.click(within(basket).getByRole("button", { name: "Place visual basket" }));
    expect(within(basket).getByText(/17″ H × 24″ W basket.*SKU 432902.*Tower 2.*42 in/i)).toBeTruthy();
    expect(within(basket).getByTestId("vendor-basket-plan-elevation").textContent).toMatch(/24.*14\.5.*Elevation: 42.*17.*visual planning only.*supplier rail/i);
    fireEvent.change(within(basket).getByRole("combobox", { name: "Edit selected basket visual-planning SKU" }), { target: { value: "432901" } });
    expect(within(basket).getByText(/11″ H × 24″ W basket.*SKU 432901.*42 in/i)).toBeTruthy();
    fireEvent.click(within(basket).getByRole("button", { name: "Undo basket" }));
    expect(within(basket).getByText(/17″ H × 24″ W basket.*SKU 432902.*42 in/i)).toBeTruthy();

    const scene = readFileSync(`${process.cwd()}/client/src/components/vendor/VendorClosetScene.tsx`, "utf8");
    expect(scene).toContain("basketVisualPlanningEnvelope: true");
    expect(scene).toContain("decorativeWireLook: true");
    expect(scene).toContain("supplierRailAndClearanceToVerify: true");
  });

  it("makes every public MasterTrac source record searchable while keeping hampers reference-only and basket planning explicitly restricted", () => {
    window.history.replaceState(null, "", "/closet?demo=mixed");
    render(<VendorClosetStudio />);

    const dock = screen.getByTestId("vendor-tablet-options-dock");
    fireEvent.click(within(dock).getByRole("button", { name: "Material reference details" }));
    const catalog = within(dock).getByTestId("vendor-source-catalog");
    expect(catalog.textContent).toMatch(/454 public March 1, 2022 List records/i);
    expect(catalog.textContent).toMatch(/not a checkout quote or installation guide.*corner SKUs and baskets 432897.*restricted.*visual-planning.*never fit-verified/i);

    const search = within(catalog).getByRole("textbox", { name: "Search MasterTrac source catalog" });
    fireEvent.change(search, { target: { value: "432602" } });
    expect(within(catalog).getByTestId("vendor-source-part-432602").textContent).toMatch(/24" Hamper Shaker Door.*Reference only/i);
    expect(within(catalog).queryByRole("button", { name: /hamper/i })).toBeNull();

    fireEvent.change(search, { target: { value: "432556" } });
    expect(within(catalog).getByTestId("vendor-source-part-432556").textContent).toMatch(/Fixed Corner Shelf.*Visual planning only.*not a profile, fit, or installation confirmation/i);
    expect(catalog.textContent).toMatch(/29\.5.*29¼.*no curve.profile, support, connector, or installation geometry.*historical baskets 432897.*14\.5.*rails.*mounting offsets.*alternate 2026 basket SKUs.*not substituted/i);
  });
});
