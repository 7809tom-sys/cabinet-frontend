/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WALZCRAFT_SHADE_COLORS } from "@shared/walzcraftDoorTemplates";
import { SHERWIN_WILLIAMS_PAINT_COLORS } from "@shared/sherwinWilliamsPaint";
import { SHERWIN_WILLIAMS_STAINS } from "@shared/sherwinWilliamsStain";
import { WIZARD_DOOR_FINISH_STORAGE_KEY, readWizardDoorFinish } from "@shared/walzcraftDesignerPickup";
import { DoorEditorWalzAudit } from "./DoorEditorWalzAudit";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

/** Reads one image file the wizard would upload. */
function imageFile(name: string, dir?: string): File {
  const instance = new File(["x"], name, { type: "image/jpeg" });
  Object.defineProperty(instance, "webkitRelativePath", { value: dir ? `${dir}/${name}` : "" });
  return instance;
}

/** Picks a grain from the compact grain picker. */
function selectGrain(code: string) {
  fireEvent.change(screen.getByTestId("wizard-grain-select"), { target: { value: code } });
}

function chooseFiles(testId: string, files: File[]) {
  const input = screen.getByTestId(testId) as HTMLInputElement;
  Object.defineProperty(input, "files", { value: files, configurable: true });
  fireEvent.change(input);
}

const style = { id: 360001, distributorId: 180001, ourName: "Shaker Gray", aliasName: "Stone Gray (Preston)", doorStyle: "Shaker", color: "Gray" };

describe("door editor wizard: Sherwin-Williams stain and paint", () => {
  it("shows a stain wheel and a paint wheel beside the sample door and the canvas door", () => {
    render(<DoorEditorWalzAudit style={style} sampleUrl="/uploads/stone-gray.jpg" />);
    expect(screen.getByTestId("wizard-real-door")).toBeTruthy();
    expect(screen.getByTestId("wizard-working-door")).toBeTruthy();
    expect(screen.getByTestId("wizard-stain-wheel")).toBeTruthy();
    expect(screen.getByTestId("wizard-paint-wheel")).toBeTruthy();
    // Stain is labelled as keeping the grain; paint as opaque.
    expect(screen.getByTestId("wizard-stain-wheel").textContent).toMatch(/keeps the wood grain/);
    expect(screen.getByTestId("wizard-paint-wheel").textContent).toMatch(/opaque solid/);
    expect(screen.getByTestId("wizard-stain-wheel").textContent).toMatch(/light maple → dark smoke/);
    // Paint wheel and the chip-code box.
    expect(screen.getByTestId("wizard-paint-code")).toBeTruthy();
    expect((screen.getByTestId("wizard-paint-code") as HTMLInputElement).placeholder).toBe("SW 7005");
  });

  it("does not preload a grid of door swatches under the wheels", () => {
    render(<DoorEditorWalzAudit style={style} sampleUrl="/uploads/stone-gray.jpg" />);
    const card = screen.getByTestId("door-editor-walzcraft-audit");
    // The only color source is the two wheels and the two code boxes.
    expect(screen.queryByTestId("color-family-gray")).toBeNull();
    expect(card.querySelectorAll("[data-testid^='swatch-']").length).toBe(0);
    // The preloaded WalzCraft shade list is not rendered as swatch buttons anywhere.
    expect(card.querySelectorAll("[data-shade-name]").length).toBe(0);
    const shadeButtons = Array.from(card.querySelectorAll("button")).filter((button) =>
      WALZCRAFT_SHADE_COLORS.some((shade) => shade.name.length > 4 && (button.textContent ?? "").trim() === shade.name),
    );
    expect(shadeButtons).toEqual([]);
  });

  it("offers the grain as one compact choice instead of a swatch wall", () => {
    render(<DoorEditorWalzAudit style={style} sampleUrl="/uploads/stone-gray.jpg" />);
    const picker = screen.getByTestId("wizard-grain-picker");
    // No swatch grid of door images, and no per-grain tile buttons.
    expect(document.querySelectorAll("[data-testid='wizard-grains']").length).toBe(0);
    expect(document.querySelectorAll("[data-testid^='grain-tile-']").length).toBe(0);
    // One select listing the frameless grains, with nothing chosen yet.
    const select = screen.getByTestId("wizard-grain-select") as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(select.querySelectorAll("option").length).toBeGreaterThan(1);
    expect(picker.querySelectorAll("img").length).toBe(0);
  });

  it("slides the stain wheel through published stain colors", () => {
    render(<DoorEditorWalzAudit style={style} sampleUrl="/uploads/stone-gray.jpg" />);
    const slider = screen.getByTestId("wizard-stain-slider") as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "1000" } });
    fireEvent.change(slider, { target: { value: "0" } });
    const light = screen.getByTestId("wizard-stain-picked").textContent ?? "";
    expect(SHERWIN_WILLIAMS_STAINS.some((stain) => light.includes(stain.code))).toBe(true);
    fireEvent.change(slider, { target: { value: "1000" } });
    const dark = screen.getByTestId("wizard-stain-picked").textContent ?? "";
    expect(SHERWIN_WILLIAMS_STAINS.some((stain) => dark.includes(stain.code))).toBe(true);
    expect(dark).not.toBe(light);
    expect((screen.getByTestId("wizard-working-door") as HTMLElement).dataset.finish).toBe("stain");
  });

  it("slides the paint wheel through published paint chips", () => {
    render(<DoorEditorWalzAudit style={style} sampleUrl="/uploads/stone-gray.jpg" />);
    const slider = screen.getByTestId("wizard-paint-slider") as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "1000" } });
    const darkest = screen.getByTestId("wizard-paint-picked").textContent ?? "";
    expect(SHERWIN_WILLIAMS_PAINT_COLORS.some((chip) => darkest.includes(chip.name))).toBe(true);
    expect((screen.getByTestId("wizard-working-door") as HTMLElement).dataset.finish).toBe("paint");
  });

  it("selects the exact chip for a typed SW 7005 and saves it as an opaque solid", () => {
    const onApply = vi.fn();
    const onSaveFinish = vi.fn();
    render(<DoorEditorWalzAudit style={style} sampleUrl="/uploads/stone-gray.jpg" onApply={onApply} onSaveFinish={onSaveFinish} />);
    fireEvent.change(screen.getByTestId("wizard-paint-code"), { target: { value: "SW 7005" } });
    fireEvent.click(screen.getByTestId("wizard-paint-code-apply"));
    expect(screen.getByTestId("wizard-paint-picked").textContent).toBe("SW 7005 Pure White · #edece6");
    fireEvent.click(screen.getByTestId("wizard-apply"));
    expect(onApply).toHaveBeenCalledWith({ renderHex: "#edece6", woodSpecies: null, grainDirection: "none" });
    expect(onSaveFinish).toHaveBeenCalledWith(expect.objectContaining({ finish: "paint", code: "SW7005", hex: "#edece6" }));
  });

  it("says plainly when a typed chip code is not published, and saves nothing", () => {
    const onApply = vi.fn();
    render(<DoorEditorWalzAudit style={style} sampleUrl="/uploads/stone-gray.jpg" onApply={onApply} />);
    fireEvent.change(screen.getByTestId("wizard-paint-code"), { target: { value: "SW 9999" } });
    fireEvent.click(screen.getByTestId("wizard-paint-code-apply"));
    expect(screen.getByTestId("wizard-paint-note").textContent).toMatch(/SW9999 is not in the published Sherwin-Williams chart/);
    expect(screen.queryByTestId("wizard-paint-picked")).toBeNull();
    fireEvent.click(screen.getByTestId("wizard-apply"));
    expect(onApply).not.toHaveBeenCalled();
  });

  it("keeps the grain when a stain is applied, and writes the record the designer reads", () => {
    const onApply = vi.fn();
    render(<DoorEditorWalzAudit style={style} sampleUrl="/uploads/stone-gray.jpg" onApply={onApply} />);
    fireEvent.change(screen.getByTestId("wizard-stain-code"), { target: { value: "MW230" } });
    fireEvent.click(screen.getByTestId("wizard-stain-code-apply"));
    selectGrain("TGW");
    fireEvent.click(screen.getByTestId("wizard-apply"));
    expect(onApply).toHaveBeenCalledWith({ renderHex: "#9a6e51", woodSpecies: "Grey Wood", grainDirection: "horizontal" });
    const record = readWizardDoorFinish(360001);
    expect(record).toMatchObject({ finish: "stain", code: "MW230", hex: "#9a6e51", woodSpecies: "Grey Wood", grainDirection: "horizontal" });
    expect(screen.getByTestId("wizard-applied").textContent).toMatch(/MW230 Early American/);
  });

  it("refuses to apply a stain with no grain instead of guessing one", () => {
    const onApply = vi.fn();
    render(<DoorEditorWalzAudit style={style} sampleUrl="/uploads/stone-gray.jpg" onApply={onApply} />);
    fireEvent.change(screen.getByTestId("wizard-stain-code"), { target: { value: "MW230" } });
    fireEvent.click(screen.getByTestId("wizard-stain-code-apply"));
    fireEvent.click(screen.getByTestId("wizard-apply"));
    expect(onApply).not.toHaveBeenCalled();
  });

  it("clicking a swatch changes the canvas door and leaves the sample door alone", () => {
    render(<DoorEditorWalzAudit style={style} sampleUrl="/uploads/stone-gray.jpg" />);
    const sampleDoor = () => screen.getByTestId("wizard-real-door") as HTMLImageElement;
    const sampleFrame = () => sampleDoor().parentElement as HTMLElement;
    const before = { src: sampleDoor().getAttribute("src"), style: sampleDoor().getAttribute("style"), frameStyle: sampleFrame().getAttribute("style") };
    expect(screen.queryByTestId("wizard-sample-finish")).toBeNull();

    // Tom's report: SW 7669 Summit Gray from the paint wheel.
    fireEvent.change(screen.getByTestId("wizard-paint-code"), { target: { value: "SW 7669" } });
    fireEvent.click(screen.getByTestId("wizard-paint-code-apply"));

    const canvas = screen.getByTestId("wizard-working-door") as HTMLElement;
    expect(canvas.dataset.finish).toBe("paint");
    expect(canvas.dataset.hex).toBe("#959491");
    expect(canvas.style.backgroundColor).toBe("rgb(149, 148, 145)");

    // The sample door is the untouched reference for the side-by-side comparison.
    expect(screen.queryByTestId("wizard-sample-finish")).toBeNull();
    expect(sampleDoor().getAttribute("src")).toBe(before.src);
    expect(sampleDoor().getAttribute("style")).toBe(before.style);
    expect(sampleFrame().getAttribute("style")).toBe(before.frameStyle);
    expect(sampleFrame().querySelectorAll("[data-finish]")).toHaveLength(0);
  });

  it("leaves the sample door alone when a stain is picked from the wheel", () => {
    render(<DoorEditorWalzAudit style={style} sampleUrl="/uploads/stone-gray.jpg" />);
    const srcBefore = (screen.getByTestId("wizard-real-door") as HTMLImageElement).getAttribute("src");
    selectGrain("TGW");
    fireEvent.change(screen.getByTestId("wizard-stain-slider"), { target: { value: "1000" } });
    expect((screen.getByTestId("wizard-working-door") as HTMLElement).dataset.finish).toBe("stain");
    // No tint is laid over the sample door photo; it stays the untouched reference.
    expect(screen.queryByTestId("wizard-sample-finish")).toBeNull();
    const sampleFrame = (screen.getByTestId("wizard-real-door") as HTMLImageElement).parentElement as HTMLElement;
    expect(sampleFrame.querySelectorAll("[data-finish]")).toHaveLength(0);
    expect((screen.getByTestId("wizard-real-door") as HTMLImageElement).getAttribute("src")).toBe(srcBefore);
  });

  it("keeps the grain photo under a stain and drops it for paint", () => {
    render(<DoorEditorWalzAudit style={style} sampleUrl="/uploads/stone-gray.jpg" />);
    selectGrain("TGW");
    fireEvent.change(screen.getByTestId("wizard-stain-code"), { target: { value: "MW230" } });
    fireEvent.click(screen.getByTestId("wizard-stain-code-apply"));
    const stained = screen.getByTestId("wizard-working-door");
    expect(stained.dataset.finish).toBe("stain");
    expect(stained.dataset.grainPhoto).toBe("/walzcraft/doors/altaeuro-tgw.webp");
    expect(stained.style.backgroundImage).toContain("altaeuro-tgw.webp");
    expect(stained.style.backgroundBlendMode).toBe("multiply");
    fireEvent.change(screen.getByTestId("wizard-paint-code"), { target: { value: "SW 7015" } });
    fireEvent.click(screen.getByTestId("wizard-paint-code-apply"));
    const painted = screen.getByTestId("wizard-working-door");
    expect(painted.dataset.finish).toBe("paint");
    expect(painted.style.backgroundImage).toBe("");
  });

  it("still copies the same hex/grain save to the other doors", () => {
    const onReplicate = vi.fn();
    render(
      <DoorEditorWalzAudit
        style={style}
        sampleUrl="/uploads/stone-gray.jpg"
        others={[{ id: 360001, distributorId: 180001, ourName: "Shaker Gray" }, { id: 390001, distributorId: 180001, ourName: "Shaker White" }]}
        onReplicate={onReplicate}
      />,
    );
    fireEvent.change(screen.getByTestId("wizard-paint-code"), { target: { value: "SW 7015" } });
    fireEvent.click(screen.getByTestId("wizard-paint-code-apply"));
    fireEvent.click(screen.getByTestId("wizard-apply"));
    fireEvent.click(screen.getByTestId("wizard-replicate-390001"));
    fireEvent.click(screen.getByTestId("wizard-replicate-apply"));
    expect(onReplicate).toHaveBeenCalledWith([390001], { renderHex: "#ccc9c0", woodSpecies: null, grainDirection: "none" });
  });
});

describe("door editor wizard: door profile image from a local folder", () => {
  it("auto-selects the file whose name carries the typed model number", async () => {
    const uploadImage = vi.fn(async () => "/uploads/s592-barrington.jpg");
    const onProfileImage = vi.fn();
    render(<DoorEditorWalzAudit style={style} sampleUrl="/uploads/stone-gray.jpg" uploadImage={uploadImage} onProfileImage={onProfileImage} />);
    fireEvent.change(screen.getByTestId("wizard-model-number"), { target: { value: "S592" } });
    expect(screen.getByTestId("wizard-model-status").textContent).toBe("S592 · S592 Barrington");
    chooseFiles("wizard-folder-input", [
      imageFile("dover-white.jpg", "Skyline"),
      imageFile("S592-barrington.jpg", "Skyline"),
      imageFile("s660-hale.webp", "Skyline"),
    ]);
    await waitFor(() => expect(uploadImage).toHaveBeenCalledTimes(1));
    expect((uploadImage.mock.calls[0] as unknown as [File])[0].name).toBe("S592-barrington.jpg");
    await waitFor(() => expect(onProfileImage).toHaveBeenCalledWith(expect.objectContaining({ url: "/uploads/s592-barrington.jpg", modelNumber: "S592" })));
    expect(screen.getByTestId("wizard-upload-note").textContent).toMatch(/offered again in the library/);
  });

  it("says the model number is not in the catalog and picks nothing", () => {
    const uploadImage = vi.fn(async () => "/uploads/x.jpg");
    render(<DoorEditorWalzAudit style={style} sampleUrl="/uploads/stone-gray.jpg" uploadImage={uploadImage} />);
    fireEvent.change(screen.getByTestId("wizard-model-number"), { target: { value: "S1234" } });
    expect(screen.getByTestId("wizard-model-status").textContent).toMatch(/S1234 is not in the WalzCraft catalog data/);
    expect(screen.getByTestId("wizard-model-status").textContent).toMatch(/No profile is assumed/);
    chooseFiles("wizard-folder-input", [imageFile("dover-white.jpg", "Skyline")]);
    expect(uploadImage).not.toHaveBeenCalled();
    expect(screen.getByTestId("wizard-upload-note").textContent).toMatch(/S1234 is not in the WalzCraft catalog data/);
    expect(screen.getByTestId("wizard-upload-note").textContent).toMatch(/Nothing was picked/);
  });

  it("says nothing in the selection carries the number, and picks nothing", () => {
    const uploadImage = vi.fn(async () => "/uploads/x.jpg");
    render(<DoorEditorWalzAudit style={style} sampleUrl="/uploads/stone-gray.jpg" uploadImage={uploadImage} />);
    fireEvent.change(screen.getByTestId("wizard-model-number"), { target: { value: "S592" } });
    chooseFiles("wizard-files-input", [imageFile("dover-white.jpg"), imageFile("s660-hale.webp")]);
    expect(uploadImage).not.toHaveBeenCalled();
    expect(screen.getByTestId("wizard-upload-note").textContent).toMatch(/No file in this selection carries model S592/);
    expect(screen.getByTestId("wizard-upload-note").textContent).toMatch(/Nothing was picked/);
  });

  it("becomes the live profile on the door and is offered again in the library", async () => {
    const uploadImage = vi.fn(async () => "/uploads/s592-barrington.jpg");
    render(<DoorEditorWalzAudit style={style} sampleUrl="/uploads/stone-gray.jpg" uploadImage={uploadImage} />);
    fireEvent.change(screen.getByTestId("wizard-model-number"), { target: { value: "S592" } });
    chooseFiles("wizard-files-input", [imageFile("S592-barrington.jpg")]);
    await waitFor(() => expect(screen.getByTestId("wizard-profile-in-use").textContent).toMatch(/S592-barrington.jpg/));
    // The sample door now shows the uploaded profile image.
    await waitFor(() => expect((screen.getByTestId("wizard-real-door") as HTMLImageElement).getAttribute("src")).toBe("/uploads/s592-barrington.jpg"));
    // It is offered again.
    await waitFor(() => expect(screen.getAllByTestId("wizard-profile-library-S592-barrington.jpg").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByTestId("wizard-profile-library-S592-barrington.jpg")[0]!);
    expect(screen.getByTestId("wizard-upload-note").textContent).toMatch(/again as the live profile/);
  });

  it("keeps the door image when the library upload fails, and says so", async () => {
    const uploadImage = vi.fn(async () => null);
    render(<DoorEditorWalzAudit style={style} sampleUrl="/uploads/stone-gray.jpg" uploadImage={uploadImage} />);
    chooseFiles("wizard-files-input", [imageFile("door.jpg")]);
    await waitFor(() => expect(screen.getByTestId("wizard-upload-note").textContent).toMatch(/not offered again/));
    // The door still has a face. With no object URL available it keeps the image it had.
    expect((screen.getByTestId("wizard-real-door") as HTMLImageElement).getAttribute("src")).toBe("/uploads/stone-gray.jpg");
  });

  it("remembers the profile for this door across reloads", () => {
    localStorage.setItem("walzcraftDoorProfileImage.v1", JSON.stringify({
      "style:360001": { modelNumber: "S592", folder: "Skyline", fileName: "S592-barrington.jpg", url: "/uploads/s592.jpg", inCatalog: true, catalogNote: null },
    }));
    render(<DoorEditorWalzAudit style={style} sampleUrl="/uploads/stone-gray.jpg" />);
    expect((screen.getByTestId("wizard-real-door") as HTMLImageElement).getAttribute("src")).toBe("/uploads/s592.jpg");
    expect(screen.getByTestId("wizard-profile-in-use").textContent).toMatch(/S592-barrington.jpg/);
  });

  it("keeps the door's own image for a door with no profile", () => {
    render(<DoorEditorWalzAudit style={style} sampleUrl="/uploads/stone-gray.jpg" />);
    expect((screen.getByTestId("wizard-real-door") as HTMLImageElement).getAttribute("src")).toBe("/uploads/stone-gray.jpg");
    expect(screen.queryByTestId("wizard-upload-note")).toBeNull();
    expect(screen.queryByTestId("wizard-profile-in-use")).toBeNull();
  });

  it("does not touch the designer's localStorage records for other doors", () => {
    render(<DoorEditorWalzAudit style={style} sampleUrl="/uploads/stone-gray.jpg" />);
    expect(localStorage.getItem(WIZARD_DOOR_FINISH_STORAGE_KEY)).toBeNull();
  });
});
