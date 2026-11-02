/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DoorEditorWalzAudit } from "./DoorEditorWalzAudit";
import { readApprovals } from "@shared/walzcraftDistributorMatches";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("door editor WalzCraft audit", () => {
  it("shows profile, color, and feature probabilities, then lets an admin approve", () => {
    render(<DoorEditorWalzAudit style={{ id: 330002, ourName: "Classic Cream", supplierBrandName: "Faircrest", doorStyle: "Shaker", color: "#F2E8D0", renderHex: "#eae5d6" }} />);
    expect(screen.getByTestId("door-editor-walzcraft-audit")).toBeTruthy();
    expect(screen.getByText(/S899 Tradewind/)).toBeTruthy();
    expect(screen.getByText(/35% profile match/)).toBeTruthy();
    fireEvent.click(screen.getByTestId("walz-audit-next"));
    const probs = screen.getByTestId("walz-audit-probabilities");
    expect(probs.textContent).toMatch(/Color:/);
    expect(probs.textContent).toMatch(/Frame width:/);
    expect(probs.textContent).toMatch(/%/);
    fireEvent.click(screen.getByTestId("walz-audit-next"));
    fireEvent.click(screen.getByTestId("walz-audit-approve-button"));
    expect(readApprovals()["faircrest-cc"]).toBe("approved");
    expect(screen.getByTestId("walz-audit-approve-button").textContent).toBe("Approved");
  });
});
