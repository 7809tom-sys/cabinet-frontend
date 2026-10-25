import { describe, expect, it } from "vitest";
import { canShowCompactWorkspaceMoveControl } from "./compactWorkspaceMove";

describe("canShowCompactWorkspaceMoveControl", () => {
  it("shows the compact Move entry only for an unlocked selected cabinet outside measurement mode", () => {
    expect(canShowCompactWorkspaceMoveControl({
      isCompactWorkspace: true,
      hasSelectedCabinet: true,
      cabinetsLocked: false,
      measureMode: false,
    })).toBe(true);
  });

  it("keeps the Move entry absent when there is no movable selected cabinet", () => {
    expect(canShowCompactWorkspaceMoveControl({
      isCompactWorkspace: true,
      hasSelectedCabinet: false,
      cabinetsLocked: false,
      measureMode: false,
    })).toBe(false);
    expect(canShowCompactWorkspaceMoveControl({
      isCompactWorkspace: true,
      hasSelectedCabinet: true,
      cabinetsLocked: true,
      measureMode: false,
    })).toBe(false);
    expect(canShowCompactWorkspaceMoveControl({
      isCompactWorkspace: true,
      hasSelectedCabinet: true,
      cabinetsLocked: false,
      measureMode: true,
    })).toBe(false);
  });
});
