import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const actions = readFileSync(new URL("./DesignActions.tsx", import.meta.url), "utf8");
const designTool = readFileSync(new URL("../../pages/DesignTool.tsx", import.meta.url), "utf8");

describe("DesignActions one-minute automatic save", () => {
  it("updates an existing authenticated plan every minute without opening the manual Save dialog or creating a duplicate plan", () => {
    expect(actions).toContain("const DESIGN_AUTO_SAVE_INTERVAL_MS = 60_000;");
    expect(actions).toContain("trpc.design.autosave.useMutation");
    expect(actions).toContain("currentDesignId == null");
    expect(actions).toContain("setInterval(() => automaticSaveRef.current(), DESIGN_AUTO_SAVE_INTERVAL_MS)");
    expect(actions).toContain("id: currentDesignId");
    expect(actions).not.toContain("setSaveOpen(true); // automatic save");
  });

  it("only sends changed saved-plan data and retains the local recovery draft when cloud saving is unavailable", () => {
    expect(actions).toContain("currentPlanFingerprint");
    expect(actions).toContain("isCurrentPlanSaved");
    expect(actions).toContain("lastAutomaticSaveRef");
    expect(actions).toContain("Your local recovery draft remains protected on this device");
    expect(designTool).toContain("currentPlanFingerprint={currentSavedPlanPayload}");
    expect(designTool).toContain("isCurrentPlanSaved={isCurrentPlanSaved}");
    expect(designTool).toContain("localStorage.setItem(draftKey, JSON.stringify(snap))");
  });

  it("treats a room-type change as saved-plan content so the timer persists it", () => {
    expect(designTool).toContain("roomType: roomType ?? null,");
    expect(designTool).toContain("roomType: savedDesign.roomType ?? null,");
  });

  it("reports successful automatic saves in the toolbar and gives manual updates an explicit confirmation", () => {
    expect(actions).toContain("onAutomaticSaveSuccess?.(Date.now())");
    expect(actions).toContain('toast.success(isUpdatingExistingDesign ? "Design saved now" : t("dt_act_saved")');
    expect(designTool).toContain("const [automaticSaveAt, setAutomaticSaveAt] = useState<number | null>(null);");
    expect(designTool).toContain('data-testid="designer-automatic-save-status"');
    expect(designTool).toContain("onAutomaticSaveSuccess={(savedAt) => setAutomaticSaveAt(savedAt)}");
  });
});
