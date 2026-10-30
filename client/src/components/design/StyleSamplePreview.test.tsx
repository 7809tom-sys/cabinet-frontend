// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StyleSamplePreview } from "./StyleSamplePreview";
import type { SampleStyleImages } from "@/lib/sampleImageQa";

afterEach(cleanup);

const cava: SampleFinish = { face: "#c4a574", edge: "#8c7048", label: "#2a2118" };

type SampleFinish = { face: string; edge: string; label: string };

const syncron: SampleStyleImages = {
  doorSampleImageUrl: "/brochure/syncron-slim-cava-scn.jpg",
  drawerSampleImageUrl: "/brochure/syncron-slim-cava-scn.jpg",
  thumbnailImageUrl: "/brochure/syncron-slim-cava-scn.jpg",
};

function renderPreview(style: SampleStyleImages, options?: { showImageCheck?: boolean; knownSize?: { door?: { width: number; height: number } | "error"; drawer?: { width: number; height: number } | "error" } }) {
  return render(
    <StyleSamplePreview
      style={style}
      styleName="Syncron Slim Cava SCN"
      finish={cava}
      showImageCheck={options?.showImageCheck}
      knownSize={options?.knownSize}
    />,
  );
}

describe("style sample preview", () => {
  it("fits the door and the drawer front to fixed shapes on a neutral field", () => {
    renderPreview({
      doorSampleImageUrl: "/doors/cava.png",
      drawerSampleImageUrl: "/drawers/cava-front.png",
    }, {
      knownSize: {
        door: { width: 800, height: 1200 },
        drawer: { width: 1600, height: 400 },
      },
    });

    expect(screen.getByText("Door")).toBeTruthy();
    expect(screen.getByText("Drawer")).toBeTruthy();
    const door = screen.getByTestId("door-sample-tile");
    const drawer = screen.getByTestId("drawer-sample-tile");
    expect(door.getAttribute("data-aspect")).toBe("2 / 3");
    expect(drawer.getAttribute("data-aspect")).toBe("4 / 1");
    expect(door.className).toContain("bg-neutral-100");
    expect(drawer.className).toContain("bg-neutral-100");
    expect(door.style.aspectRatio).toBe("2 / 3");
    expect(drawer.style.aspectRatio).toBe("4 / 1");

    const doorPhoto = screen.getByRole("img", { name: "Syncron Slim Cava SCN door sample" });
    const drawerPhoto = screen.getByRole("img", { name: "Syncron Slim Cava SCN drawer sample" });
    expect(doorPhoto.className).toContain("object-contain");
    expect(drawerPhoto.className).toContain("object-contain");
    expect(screen.queryByTestId("drawer-front-diagram")).toBeNull();
  });

  it("draws a tinted drawer front instead of repeating the door picture", () => {
    renderPreview(syncron, { showImageCheck: false });

    const diagram = screen.getByTestId("drawer-front-diagram");
    expect(diagram.getAttribute("data-face")).toBe(cava.face);
    expect(diagram.getAttribute("data-edge")).toBe(cava.edge);
    expect(screen.getByTestId("drawer-front-pull").getAttribute("fill")).toBe(cava.label);
    expect(screen.getByRole("img", { name: "Syncron Slim Cava SCN drawer front" })).toBe(diagram);
    expect(screen.queryByRole("img", { name: "Syncron Slim Cava SCN drawer sample" })).toBeNull();
    expect(screen.getByRole("img", { name: "Syncron Slim Cava SCN door sample" }).getAttribute("src")).toBe(syncron.doorSampleImageUrl);
    expect(screen.queryByTestId("sample-image-admin-flag-drawer")).toBeNull();
    expect(screen.queryByText(/Image check/)).toBeNull();
  });

  it("shows the image check to admins and keeps it off the customer view", () => {
    const { unmount } = renderPreview(syncron, { showImageCheck: true });
    const flag = screen.getByTestId("sample-image-admin-flag-drawer");
    expect(flag.textContent).toContain("Duplicate picture");
    expect(flag.textContent).toContain("Same file as the door and the thumbnail");
    expect(screen.getByTestId("sample-image-admin-flag-door").textContent).toContain("Duplicate picture");
    unmount();

    renderPreview({
      doorSampleImageUrl: "/doors/cava.png",
      drawerSampleImageUrl: "/drawers/cava-wide.jpg",
    }, {
      showImageCheck: true,
      knownSize: {
        door: { width: 1600, height: 900 },
        drawer: { width: 120, height: 120 },
      },
    });

    expect(screen.getByTestId("drawer-front-diagram")).toBeTruthy();
    expect(screen.getByTestId("sample-image-admin-flag-door").textContent).toContain("Crop doesn't match");
    expect(screen.getByTestId("sample-image-admin-flag-drawer").textContent).toContain("Low resolution");
    expect(screen.queryByRole("img", { name: "Syncron Slim Cava SCN drawer sample" })).toBeNull();
  });

  it("draws a drawer front when the style has no drawer picture", () => {
    renderPreview({ doorSampleImageUrl: "/doors/cava.png", drawerSampleImageUrl: null });
    expect(screen.getByTestId("drawer-front-diagram")).toBeTruthy();
    expect(document.querySelector("[data-drawer-source]")?.getAttribute("data-drawer-source")).toBe("drawing");
  });
});
