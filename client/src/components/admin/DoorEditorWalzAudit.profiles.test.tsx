// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { auditWalzcraftDoor } from "@shared/walzcraftDoorAudit";
import { walzCraftCatalogProfiles } from "@shared/walzcraftProfileImage";
import { DoorEditorWalzAudit } from "./DoorEditorWalzAudit";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const style = {
  id: 360001,
  distributorId: 180001,
  ourName: "White Shaker",
  aliasName: "White Shaker",
  doorStyle: "Shaker 5-pc flat recessed panel",
  color: "White",
  supplierBrandName: "Faircrest",
  distributorName: "Faircrest",
};

describe("door editor wizard: WalzCraft profile choices", () => {
  it("always shows four suggested profile slots", () => {
    render(<DoorEditorWalzAudit style={style} sampleUrl="/uploads/stone-gray.jpg" />);
    const list = screen.getByTestId("walz-audit-profiles");
    expect(list).toBeTruthy();
    // Four slots, always, whatever the sheet ranked.
    expect(within(list).getAllByRole("button")).toHaveLength(4);
  });

  it("lists the ranked profile matches from the audit sheet first", () => {
    const expected = auditWalzcraftDoor(style).profiles;
    render(<DoorEditorWalzAudit style={style} sampleUrl="/uploads/stone-gray.jpg" />);

    expected.slice(0, 4).forEach((profile) => {
      const button = screen.getByTestId(`walz-audit-profile-${profile.rank}`);
      expect(button.getAttribute("data-profile-source")).toBe("match");
      expect(button.textContent).toContain(profile.name);
      expect(button.textContent).toContain(`${profile.pct}% profile match`);
    });
  });

  it("fills spare slots from real WalzCraft catalog defaults, labelled as such", () => {
    render(<DoorEditorWalzAudit style={style} sampleUrl="/uploads/stone-gray.jpg" />);
    const fills = [1, 2, 3, 4]
      .map((rank) => screen.getByTestId(`walz-audit-profile-${rank}`))
      .filter((button) => button.getAttribute("data-profile-source") === "library-default");
    for (const button of fills) {
      // A real catalog name, and no invented match percentage.
      expect(button.textContent).toContain("Library default");
      expect(button.textContent).not.toContain("% profile match");
    }
    // Every filled slot names a profile that is really in the catalog data.
    const catalogNames = walzCraftCatalogProfiles().map((entry) => entry.name);
    for (const button of fills) {
      const label = (button.textContent ?? "").split(" · ")[0] ?? "";
      expect(catalogNames).toContain(label);
    }
  });

  it("shows four slots even when the door has no sheet row at all", () => {
    render(<DoorEditorWalzAudit style={{ id: 1, ourName: "Not a real door", distributorId: 999999 }} />);
    const list = screen.getByTestId("walz-audit-profiles");
    const buttons = within(list).getAllByRole("button");
    expect(buttons).toHaveLength(4);
    // With no sheet row, every slot is a catalog default rather than a claimed match.
    expect(buttons.every((button) => button.getAttribute("data-profile-source") === "library-default")).toBe(true);
  });

  it("marks the picked profile and keeps the choice visible", () => {
    render(<DoorEditorWalzAudit style={style} sampleUrl="/uploads/stone-gray.jpg" />);
    const first = screen.getByTestId("walz-audit-profile-1");
    const second = screen.getByTestId("walz-audit-profile-2");
    expect(first.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(second);
    expect(second.getAttribute("aria-pressed")).toBe("true");
    expect(first.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByTestId("wizard-profile-picked").textContent).toContain((second.textContent ?? "").split(" · ")[0] ?? "");
  });

  it("keeps the upload option beside the profile list, so a custom profile is still possible", () => {
    render(<DoorEditorWalzAudit style={style} sampleUrl="/uploads/stone-gray.jpg" />);
    const block = screen.getByTestId("wizard-profile-image");
    expect(within(block).getByTestId("walz-audit-profiles")).toBeTruthy();
    expect(within(block).getByTestId("wizard-folder-button").textContent).toBe("Choose folder");
    expect(within(block).getByTestId("wizard-files-button").textContent).toBe("Choose files");
  });

  it("reports the picked profile in the saved line without changing the saved color", () => {
    render(<DoorEditorWalzAudit style={style} sampleUrl="/uploads/stone-gray.jpg" />);
    fireEvent.change(screen.getByTestId("wizard-paint-code"), { target: { value: "SW 7005" } });
    fireEvent.click(screen.getByTestId("wizard-paint-code-apply"));
    const second = screen.getByTestId("walz-audit-profile-2");
    fireEvent.click(second);

    fireEvent.click(screen.getByTestId("wizard-apply"));
    const savedLine = screen.getByTestId("wizard-applied").textContent ?? "";
    // The color save is untouched: still the exact SW chip that was chosen.
    expect(savedLine).toContain("#edece6");
    expect(savedLine).toContain("SW 7005 Pure White");
    expect(savedLine).toContain((second.textContent ?? "").split(" · ")[0] ?? "");
  });
});
