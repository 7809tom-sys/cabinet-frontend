// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import VendorClosetStudio from "./VendorClosetStudio";

// The page reads the storefront hidden-catalog query; there is no tRPC provider in these unit tests.
vi.mock("@/lib/trpc", () => ({
  trpc: { storefront: { hiddenCatalogKeys: { useQuery: () => ({ data: undefined }) } } },
}));

vi.mock("@/components/vendor/VendorClosetScene", () => ({
  VendorClosetScene: () => <div data-testid="mock-vendor-scene">3D scene</div>,
}));

const openParts = () => fireEvent.click(screen.getByTestId("vendor-toolbar-edit"));
const dock = () => screen.getByTestId("vendor-tablet-options-dock");

describe("Closet Studio tablet workspace", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    window.history.replaceState(null, "", "/closet");
  });

  it("keeps a wall's layout separate and exposes filled or empty status through the compact room map", () => {
    window.localStorage.clear();
    render(<VendorClosetStudio />);
    fireEvent.click(screen.getByTestId("guided-start-blank"));

    const overview = screen.getByTestId("vendor-room-overview");
    const back = within(overview).getByRole("button", { name: /Back wall: filled, 25\.5 of \d+ inches used/i });
    const left = within(overview).getByRole("button", { name: /Left wall: empty, 0 of \d+ inches used/i });
    expect(back.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(left);

    expect(within(overview).getByRole("button", { name: /Left wall: empty, 0 of \d+ inches used/i }).getAttribute("aria-pressed")).toBe("true");
    openParts();
    expect(within(dock()).getByText(/This wall is empty.*other walls remain unchanged/i)).toBeTruthy();
    fireEvent.click(within(dock()).getByRole("button", { name: "Add first tower" }));
    expect(within(dock()).getByRole("button", { name: "Select Tower 1" })).toBeTruthy();
    expect(within(dock()).getByText(/25\.5 of \d+ in on left wall/i)).toBeTruthy();

    fireEvent.click(back);
    expect(within(dock()).getByText(/25\.5 of \d+ in on back wall/i)).toBeTruthy();
    expect(within(overview).getByRole("button", { name: /Left wall: filled, 25\.5 of \d+ inches used/i })).toBeTruthy();
    const scene = readFileSync(`${process.cwd()}/client/src/components/vendor/VendorClosetScene.tsx`, "utf8");
    expect(scene).toContain("studioCornerShelvesForWall(design)");
    expect(scene).toContain("if (design.bays.length) box");
  });

  it("keeps the room map a small collapsible inset over the canvas instead of a large picture", () => {
    window.history.replaceState(null, "", "/closet?demo=mixed");
    render(<VendorClosetStudio />);

    // The room map lives inside the scene panel as a thumbnail, and the closet drawing keeps the space.
    const minimap = screen.getByTestId("vendor-room-minimap");
    expect(minimap.closest("[data-testid='vendor-scene-panel']")).toBeTruthy();
    // Thumbnail-sized inset card, not a large picture.
    expect(minimap.querySelector("div")?.className).toContain("w-[116px]");
    const collapse = within(minimap).getByRole("button", { name: "Collapse room map" });
    expect(collapse.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(collapse);
    const expand = within(minimap).getByRole("button", { name: "Show room map" });
    expect(expand.getAttribute("aria-expanded")).toBe("false");
    expect(expand.textContent).toMatch(/Room/);
    expect(within(minimap).queryByTestId("vendor-room-overview")).toBeNull();

    fireEvent.click(expand);
    expect(within(minimap).getByTestId("vendor-room-overview")).toBeTruthy();
  });

  it("keeps secondary panels closed by default and opens them from the single Edit control", () => {
    window.history.replaceState(null, "", "/closet?demo=mixed");
    render(<VendorClosetStudio />);

    // Nothing covers the canvas on load: the dock, room panel and material list are closed.
    expect(dock().className).toContain("hidden");
    expect(screen.getByTestId("vendor-blueprint-column").className).toContain("hidden");
    expect(screen.getByTestId("vendor-controls").className).toContain("hidden");
    expect(screen.getByTestId("mock-vendor-scene")).toBeTruthy();

    const edit = screen.getByTestId("vendor-toolbar-edit");
    expect(edit.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(edit);
    expect(edit.getAttribute("aria-pressed")).toBe("true");
    expect(dock().className).toContain("flex");
    expect(within(dock()).getByRole("button", { name: "Select Tower 2" })).toBeTruthy();

    // One explicit close puts the canvas back on its own.
    fireEvent.click(within(dock()).getByRole("button", { name: "Close accessories panel" }));
    expect(dock().className).toContain("hidden");
    expect(edit.getAttribute("aria-pressed")).toBe("false");
  });

  it("keeps Room and the Material List reversible without taking the canvas away", () => {
    window.history.replaceState(null, "", "/closet?demo=mixed");
    render(<VendorClosetStudio />);

    const room = screen.getByRole("button", { name: "Room and wall settings" });
    const blueprint = screen.getByTestId("vendor-blueprint-column");
    expect(room.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(room);
    expect(room.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("vendor-controls").className).toContain("flex");
    fireEvent.click(screen.getAllByRole("button", { name: "Close room settings" })[0]);
    expect(room.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(within(screen.getByTestId("vendor-phone-action-strip")).getByRole("button", { name: "Material reference" }));
    expect(blueprint.className).toContain("flex");
    const reference = within(blueprint).getByRole("button", { name: "Material reference details" });
    fireEvent.click(reference);
    expect(reference.getAttribute("aria-expanded")).toBe("true");
    expect(within(blueprint).getByTestId("vendor-tablet-material-list")).toBeTruthy();
    fireEvent.click(within(blueprint).getByRole("button", { name: "Close material list" }));
    expect(blueprint.className).toContain("hidden");
  });

  it("pins the essential toolbar controls, including Delete plan, and keeps them 44px tall", () => {
    window.history.replaceState(null, "", "/closet?demo=mixed");
    render(<VendorClosetStudio />);

    const toolbar = screen.getByTestId("vendor-studio-toolbar");
    for (const name of ["Back to room choice", "Delete plan", "Zoom to fit the closet", "Edit parts"]) {
      const button = within(toolbar).getByRole("button", { name });
      expect(button.className).toMatch(/h-11|min-h-11/);
    }
    const remove = within(toolbar).getByRole("button", { name: "Delete plan" });
    expect(remove.className).toContain("border-[#c25b48]");
    expect(remove.className).toContain("text-[#9c3524]");
    // Secondary tools are not in the header; they live in the drawers/tabs.
    expect(within(toolbar).queryByRole("button", { name: "Add 29.5-inch corner shelf" })).toBeNull();
  });

  it("keeps the viewer centered with the controls sidebar beside it on wide desktops, and on-demand panels at tablet widths", () => {
    window.history.replaceState(null, "", "/closet?demo=mixed");
    render(<VendorClosetStudio />);
    // Closed by default, so the desktop grid is a single full-width drawing column.
    expect(screen.getByTestId("vendor-workspace").getAttribute("data-dock")).toBe("closed");
    expect(screen.getByTestId("vendor-workspace").className).toContain("min-[1280px]:grid-cols-[minmax(0,1fr)]");
    openParts();
    // Open, the sidebar is one column on the LEFT and the viewer keeps the rest, still centered.
    expect(screen.getByTestId("vendor-workspace").className).toContain("min-[1280px]:grid-cols-[minmax(320px,360px)_minmax(0,1fr)]");
    expect(screen.getByTestId("vendor-workspace").getAttribute("data-dock")).toBe("open");
    expect(dock().className).toContain("min-[1280px]:order-1");
    expect(screen.getByTestId("vendor-scene-panel").closest("main")?.className).toContain("min-[1280px]:order-2");
    // The material summary is a floating card in the viewer's top-right corner, not a third column.
    expect(screen.getByTestId("vendor-blueprint-column").className).toContain("min-[1280px]:right-3");
    // Below the view-tab row, so it never covers the Decor toggle that lives there.
    expect(screen.getByTestId("vendor-blueprint-column").className).toContain("min-[1280px]:top-16");
    expect(screen.getByTestId("vendor-workspace").className).not.toContain("_250px");
    const referencePanel = screen.getByTestId("vendor-reference-panel");
    expect(referencePanel.closest("[data-testid='vendor-blueprint-column']")).toBeTruthy();
    expect(screen.queryByTestId("vendor-part-tray")).toBeNull();
    openParts();
    const shoe = within(dock()).getByTestId("vendor-accessory-shoe");
    expect(shoe.className).toContain("min-h-14");
    expect(shoe.className).toContain("w-full");
    const scene = readFileSync(`${process.cwd()}/client/src/components/vendor/VendorClosetScene.tsx`, "utf8");
    expect(scene).toContain('className="h-full min-h-0 w-full touch-none"');
    expect(screen.getByTestId("mock-vendor-scene")).toBeTruthy();
  });

  it("gives the canvas the space and never overlaps it until a panel is opened", () => {
    window.history.replaceState(null, "", "/closet?demo=mixed");
    render(<VendorClosetStudio />);

    // The canvas column is the flex-1 surface; panels are absolute sheets with the hidden attribute.
    const scenePanel = screen.getByTestId("vendor-scene-panel");
    expect(scenePanel.className).toContain("flex-1");
    expect(scenePanel.className).not.toContain("46vh");
    expect(screen.getByTestId("vendor-workspace").className).toContain("overflow-hidden");
    expect(dock().getAttribute("data-open")).toBe("false");
  });

  it("uses the Kitchen-style phone action strip to reach the Tower, Parts, and List controls", () => {
    window.history.replaceState(null, "", "/closet?demo=mixed");
    render(<VendorClosetStudio />);

    const strip = screen.getByTestId("vendor-phone-action-strip");
    expect(within(strip).getByRole("button", { name: "Room settings" })).toBeTruthy();
    const tower = within(strip).getByRole("button", { name: "Tower controls" });
    const parts = within(strip).getByRole("button", { name: "Add closet parts" });
    const list = within(strip).getByRole("button", { name: "Material reference" });
    expect(screen.queryByTestId("vendor-tower-controls")).toBeNull();

    expect(dock().className).not.toMatch(/\bfixed\b/);
    fireEvent.click(tower);
    expect(within(dock()).getByRole("button", { name: "Select Tower 2" })).toBeTruthy();
    fireEvent.click(parts);
    expect(within(dock()).getByTestId("vendor-accessory-shoe")).toBeTruthy();
    fireEvent.click(within(dock()).getByRole("button", { name: /Adjustable shelf/ }));
    const source = readFileSync(`${process.cwd()}/client/src/pages/VendorClosetStudio.tsx`, "utf8");
    expect(source).toContain("Drag to rotate · tap a tower to edit its parts");
    expect(source).toContain("scrollWithinScroller");
    // Neither the intro jump nor the section jump may use the document-wide scrollIntoView that
    // used to pull the whole page back to the top.
    expect(source).not.toContain("visiblePlanner?.scrollIntoView");
    expect(source).not.toContain("getElementById(id)?.scrollIntoView");
    fireEvent.click(list);
    expect(within(screen.getByTestId("vendor-blueprint-column")).getByTestId("vendor-tablet-material-list")).toBeTruthy();
  });

  it("lets a tablet user plan a sourced straight shelf cut in the dock without exposing unverified accessory cuts", () => {
    window.history.replaceState(null, "", "/closet?demo=mixed");
    render(<VendorClosetStudio />);
    openParts();

    fireEvent.click(within(dock()).getByRole("button", { name: "Select Tower 1" }));
    const cut = within(dock()).getByTestId("vendor-cut-to-fit");
    expect(within(cut).getByRole("combobox", { name: "Cut-to-fit stock shelf width" })).toBeTruthy();
    const measured = within(cut).getByRole("spinbutton", { name: "Installed clear shelf width in inches" });
    fireEvent.change(measured, { target: { value: "22.5" } });
    fireEvent.click(within(cut).getByRole("button", { name: "Apply measured width" }));
    expect(within(dock()).getByText("Cut planned")).toBeTruthy();
    const updatedCut = within(dock()).getByTestId("vendor-cut-to-fit");
    expect(updatedCut.textContent).toMatch(/planning difference.*1\.5/i);
    expect(within(updatedCut).getByRole("button", { name: "Full stock" })).toBeTruthy();
    const scene = readFileSync(`${process.cwd()}/client/src/components/vendor/VendorClosetScene.tsx`, "utf8");
    expect(scene).toContain("if (!studioBayCut(bay))");
  });

  it("keeps the 45-degree shoe pitch caveat accessible through the tablet and phone Parts controls, with renderer metadata scoped to shoes", () => {
    window.history.replaceState(null, "", "/closet?demo=mixed");
    render(<VendorClosetStudio />);

    openParts();
    expect(within(dock()).getByTestId("vendor-shoe-pitch-caveat").textContent).toMatch(/45° illustrative shoe pitch.*supplier fit and attachment/i);
    fireEvent.click(within(screen.getByTestId("vendor-phone-action-strip")).getByRole("button", { name: "Add closet parts" }));
    expect(within(dock()).getByTestId("vendor-shoe-pitch-caveat").textContent).toMatch(/45° illustrative shoe pitch/i);

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
    // Corner envelopes need a room deeper than 29.5 in, so start blank in walk-in dimensions.
    fireEvent.click(screen.getByTestId("guided-type-walk-in"));
    fireEvent.click(screen.getByTestId("guided-start-blank"));

    fireEvent.click(within(screen.getByTestId("vendor-room-overview")).getByRole("button", { name: /Right wall: empty/i }));
    openParts();
    const corner = within(dock()).getByTestId("vendor-corner-planning-controls");
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
    expect(within(dock()).getByRole("button", { name: "Plan 29.5-inch curved corner shelf" })).toBeTruthy();

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

  it("keeps the corner shelf planner reachable from the Parts palette without a scrolling trap", () => {
    window.history.replaceState(null, "", "/closet");
    render(<VendorClosetStudio />);
    fireEvent.click(screen.getByTestId("guided-start-blank"));

    openParts();
    const entry = within(dock()).getByRole("button", { name: "Plan 29.5-inch curved corner shelf" });
    expect(entry.textContent).toMatch(/corner/i);
    fireEvent.click(entry);

    const planners = screen.getAllByTestId("vendor-corner-planning-controls");
    expect(planners.map((planner) => planner.id)).toEqual(["vendor-corner-shelf-planner-dock"]);
    const planner = planners[0];
    expect(within(planner).getByRole("button", { name: "Build visual corner" })).toBeTruthy();
  });

  it("keeps a persistent available-finish dropdown visible while a Studio design is open", () => {
    window.history.replaceState(null, "", "/closet");
    render(<VendorClosetStudio />);
    fireEvent.click(screen.getByTestId("guided-start-blank"));

    const finish = screen.getByRole("combobox", { name: "Available MasterTrac finish" });
    expect(within(finish).getByRole("option", { name: "Glacier White" })).toBeTruthy();
    expect(within(finish).getByRole("option", { name: "Slate Rift" })).toBeTruthy();
    expect(within(finish).getByRole("option", { name: "Spiced Mahogany" })).toBeTruthy();
    fireEvent.change(finish, { target: { value: "Slate Rift" } });
    expect((finish as HTMLSelectElement).value).toBe("Slate Rift");
    expect(screen.getByTestId("vendor-studio-toolbar").textContent).toMatch(/Slate Rift/);
  });

  it("places sourced baskets as editable visual-planning envelopes in Parts without substituting 2026 SKUs or claiming rail fit", () => {
    window.history.replaceState(null, "", "/closet?demo=mixed");
    render(<VendorClosetStudio />);
    openParts();

    const basket = within(dock()).getByTestId("vendor-basket-planning-controls");
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
    expect(scene).toContain("opaqueLiner: true");
    expect(scene).toContain("linerPlaceholder: true");
    expect(scene).toContain("transparent: false");
    expect(scene).not.toContain("decorativeWireLook: true");
    expect(scene).toContain("supplierRailAndClearanceToVerify: true");
  });

  it("makes every public MasterTrac source record searchable while keeping hampers reference-only and basket planning explicitly restricted", () => {
    window.history.replaceState(null, "", "/closet?demo=mixed");
    render(<VendorClosetStudio />);

    fireEvent.click(within(screen.getByTestId("vendor-phone-action-strip")).getByRole("button", { name: "Material reference" }));
    const blueprint = screen.getByTestId("vendor-blueprint-column");
    fireEvent.click(within(blueprint).getByRole("button", { name: "Material reference details" }));
    const catalog = within(blueprint).getByTestId("vendor-source-catalog");
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
