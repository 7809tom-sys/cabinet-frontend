// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { auditWalzcraftDoor } from "@shared/walzcraftDoorAudit";
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
  it("lists the ranked profile matches from the audit sheet, top four", () => {
    const expected = auditWalzcraftDoor(style).profiles;
    expect(expected.length).toBeGreaterThan(1);

    render(<DoorEditorWalzAudit style={style} sampleUrl="/uploads/stone-gray.jpg" />);
    const list = screen.getByTestId("walz-audit-profiles");
    expect(list).toBeTruthy();

    const buttons = within(list).getAllByRole("button");
    expect(buttons).toHaveLength(Math.min(4, expected.length));

    expected.slice(0, 4).forEach((profile) => {
      const button = screen.getByTestId(`walz-audit-profile-${profile.rank}`);
      expect(button.textContent).toContain(profile.name);
      expect(button.textContent).toContain(`${profile.pct}% profile match`);
    });
  });

  it("marks the picked profile and keeps the choice visible", () => {
    const profiles = auditWalzcraftDoor(style).profiles;
    render(<DoorEditorWalzAudit style={style} sampleUrl="/uploads/stone-gray.jpg" />);

    // The top match starts picked.
    expect(screen.getByTestId(`walz-audit-profile-${profiles[0]!.rank}`).getAttribute("aria-pressed")).toBe("true");

    const second = profiles[1];
    if (!second) return;
    fireEvent.click(screen.getByTestId(`walz-audit-profile-${second.rank}`));
    expect(screen.getByTestId(`walz-audit-profile-${second.rank}`).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId(`walz-audit-profile-${profiles[0]!.rank}`).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByTestId("wizard-profile-picked").textContent).toContain(second.name);
    expect(screen.getByTestId("wizard-profile-picked").textContent).toContain(`${second.pct}% profile match`);
  });

  it("keeps the upload option beside the profile list, so a custom profile is still possible", () => {
    render(<DoorEditorWalzAudit style={style} sampleUrl="/uploads/stone-gray.jpg" />);
    const block = screen.getByTestId("wizard-profile-image");
    // Both ways in live in the same block.
    expect(within(block).getByTestId("walz-audit-profiles")).toBeTruthy();
    expect(within(block).getByTestId("wizard-folder-button").textContent).toBe("Choose folder");
    expect(within(block).getByTestId("wizard-files-button").textContent).toBe("Choose files");
  });

  it("reports the picked profile in the saved line without changing the saved color", () => {
    const profiles = auditWalzcraftDoor(style).profiles;
    render(<DoorEditorWalzAudit style={style} sampleUrl="/uploads/stone-gray.jpg" />);

    // Pick an explicit color first, then the second profile.
    fireEvent.change(screen.getByTestId("wizard-paint-code"), { target: { value: "SW 7005" } });
    fireEvent.click(screen.getByTestId("wizard-paint-code-apply"));
    const second = profiles[1];
    if (second) fireEvent.click(screen.getByTestId(`walz-audit-profile-${second.rank}`));

    fireEvent.click(screen.getByTestId("wizard-apply"));
    const savedLine = screen.getByTestId("wizard-applied").textContent ?? "";
    // The color save is untouched: still the exact SW chip that was chosen.
    expect(savedLine).toContain("#edece6");
    expect(savedLine).toContain("SW 7005 Pure White");
    if (second) expect(savedLine).toContain(`${second.pct}% profile match`);
  });

  it("says so when the door has no sheet row to rank", () => {
    render(<DoorEditorWalzAudit style={{ id: 1, ourName: "Not a real door", distributorId: 999999 }} />);
    const list = screen.getByTestId("walz-audit-profiles");
    expect(list.textContent).toMatch(/No WalzCraft door matches this distributor and name yet|no ranked profiles/);
    expect(within(list).queryAllByRole("button")).toHaveLength(0);
  });
});
