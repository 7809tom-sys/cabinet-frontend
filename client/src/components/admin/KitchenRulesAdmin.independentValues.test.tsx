// @vitest-environment jsdom
/**
 * The admin Kitchen Rules table edits the VALUES the auto-designer reads.
 *
 * Five rules, five distinct values: opening the pen on one rule must show that
 * rule's value, and saving it must send that rule's key. This is the UI half of
 * the bug where every row showed the same number.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const saved = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  saved: [] as Array<Record<string, unknown>>,
  deleted: [] as Array<Record<string, unknown>>,
  restored: [] as Array<Record<string, unknown>>,
  reset: [] as Array<Record<string, unknown>>,
  created: [] as Array<Record<string, unknown>>,
  isError: false,
}));

vi.mock("@/lib/trpc", () => {
  const mutation = (onRun: (input: unknown) => void) => () => ({
    mutateAsync: async (input: unknown) => { onRun(input); return { ok: true }; },
    isPending: false,
  });
  const kitchenRules = {
    settings: { useQuery: () => ({ data: saved.rows, isLoading: false, isError: saved.isError, error: null, refetch: async () => undefined }) },
    parameters: { useQuery: () => ({ data: { values: {}, text: {} }, isLoading: false, isError: false, error: null, refetch: async () => undefined }) },
    saveSetting: { useMutation: mutation((input) => saved.saved.push(input as Record<string, unknown>)) },
    resetSetting: { useMutation: mutation((input) => saved.reset.push(input as Record<string, unknown>)) },
    createRule: { useMutation: mutation((input) => saved.created.push(input as Record<string, unknown>)) },
    deleteRule: { useMutation: mutation((input) => saved.deleted.push(input as Record<string, unknown>)) },
    restoreRule: { useMutation: mutation((input) => saved.restored.push(input as Record<string, unknown>)) },
  };
  return { trpc: { kitchenRules } };
});

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), message: vi.fn(), info: vi.fn() }),
}));

import KitchenRulesAdmin from "./KitchenRulesAdmin";

/** One saved row as the settings endpoint returns it. */
function row(overrides: Record<string, unknown>) {
  return {
    settingKey: "jog_max_in",
    title: "Wiggle room",
    description: "How far a cabinet may slide.",
    category: "Wiggle room",
    valueType: "number",
    value: null,
    defaultValue: "3",
    enabled: true,
    locked: false,
    isBuiltIn: true,
    deletedAt: null,
    updatedBy: null,
    updatedAt: null,
    executed: true,
    ...overrides,
  };
}

/** Five rules, five clearly different values and five different authors. */
const FIVE = [
  row({ settingKey: "jog_max_in", title: "Wiggle room", value: "1.25", defaultValue: "3", updatedBy: "Tom", updatedAt: "2026-11-01T00:00:00.000Z" }),
  row({ settingKey: "anchor_wiggle_cap_in", title: "Anchor wiggle", value: "1.5", defaultValue: "2", updatedBy: "Rich", updatedAt: "2026-11-02T00:00:00.000Z" }),
  row({ settingKey: "filler_gap_max_in", title: "Widest seam", value: "4.5", defaultValue: "6", category: "Fillers", updatedBy: "Tom", updatedAt: "2026-11-03T00:00:00.000Z" }),
  row({ settingKey: "wall_bottom_in", title: "Wall bottom", value: "51", defaultValue: "54", category: "Upper heights", updatedBy: "Rich", updatedAt: "2026-11-04T00:00:00.000Z" }),
  row({ settingKey: "hood_bottom_in", title: "Hood bottom", value: "63", defaultValue: "60", category: "Range and hood", updatedBy: "Tom", updatedAt: "2026-11-05T00:00:00.000Z" }),
  row({
    settingKey: "faucet_at_sink_required",
    title: "Faucet at the sink",
    description: "Hard rule from Tom.",
    category: "Locked hard rules",
    valueType: "toggle",
    value: "0",
    defaultValue: "1",
    locked: true,
    enabled: false,
  }),
];

afterEach(() => {
  cleanup();
  saved.saved = [];
  saved.deleted = [];
  saved.restored = [];
  saved.reset = [];
  saved.created = [];
  saved.isError = false;
  saved.rows = [];
});

function cell(settingKey: string, suffix = "-value") {
  return screen.getByTestId(`setting:${settingKey}${suffix}`);
}

describe("five rules show five different values", () => {
  it("renders each rule's own value, not one shared number", () => {
    saved.rows = FIVE;
    render(<KitchenRulesAdmin />);
    expect(cell("jog_max_in").textContent).toContain("1.25");
    expect(cell("anchor_wiggle_cap_in").textContent).toContain("1.5");
    expect(cell("filler_gap_max_in").textContent).toContain("4.5");
    expect(cell("wall_bottom_in").textContent).toContain("51");
    expect(cell("hood_bottom_in").textContent).toContain("63");
  });

  it("opens the pen on the rule that was clicked, with that rule's value", () => {
    saved.rows = FIVE;
    render(<KitchenRulesAdmin />);
    fireEvent.click(cell("wall_bottom_in", "-edit"));
    const input = screen.getByTestId("kitchen-rule-value") as HTMLInputElement;
    expect(input.value).toBe("51");
    expect(screen.getByTestId("kitchen-rule-title")).toHaveProperty("value", "Wall bottom");
  });

  it("shows a different value when a different pen is clicked", () => {
    saved.rows = FIVE;
    render(<KitchenRulesAdmin />);
    fireEvent.click(cell("hood_bottom_in", "-edit"));
    expect((screen.getByTestId("kitchen-rule-value") as HTMLInputElement).value).toBe("63");
    cleanup();
    render(<KitchenRulesAdmin />);
    fireEvent.click(cell("filler_gap_max_in", "-edit"));
    expect((screen.getByTestId("kitchen-rule-value") as HTMLInputElement).value).toBe("4.5");
  });

  it("saves only the edited rule, keyed by its own setting key", async () => {
    saved.rows = FIVE;
    render(<KitchenRulesAdmin />);
    fireEvent.click(cell("wall_bottom_in", "-edit"));
    fireEvent.change(screen.getByTestId("kitchen-rule-value"), { target: { value: "52" } });
    fireEvent.click(screen.getByTestId("kitchen-rule-save"));
    await waitFor(() => expect(saved.saved).toHaveLength(1));
    expect(saved.saved[0]).toMatchObject({ settingKey: "wall_bottom_in", value: "52" });
    // The other four were never written.
    expect(saved.saved.some((input) => input.settingKey === "hood_bottom_in")).toBe(false);
  });

  it("shows the author and time of the last change per rule", () => {
    saved.rows = FIVE;
    render(<KitchenRulesAdmin />);
    const table = screen.getByRole("table");
    expect(within(table).getByText(/Tom · 2026-11-01T00:00:00\.000Z/)).toBeTruthy();
    expect(within(table).getByText(/Rich · 2026-11-02T00:00:00\.000Z/)).toBeTruthy();
  });
});

describe("add, edit, delete", () => {
  it("has an Add rule button that opens the add dialog", () => {
    saved.rows = FIVE;
    render(<KitchenRulesAdmin />);
    fireEvent.click(screen.getByTestId("kitchen-rules-add"));
    expect(screen.getByTestId("kitchen-rule-new-title")).toBeTruthy();
  });

  it("creates a guidance rule with a key derived from its name", async () => {
    saved.rows = FIVE;
    render(<KitchenRulesAdmin />);
    fireEvent.click(screen.getByTestId("kitchen-rules-add"));
    fireEvent.change(screen.getByTestId("kitchen-rule-new-title"), { target: { value: "Leave 2 inches at a window" } });
    fireEvent.change(screen.getByTestId("kitchen-rule-new-description"), { target: { value: "Never butt a cabinet to the casing." } });
    fireEvent.click(screen.getByTestId("kitchen-rule-create"));
    await waitFor(() => expect(saved.created).toHaveLength(1));
    expect(saved.created[0]).toMatchObject({ settingKey: "custom-leave-2-inches-at-a-window", category: "Guidance" });
  });

  it("confirms before deleting, and does not delete on Cancel", () => {
    saved.rows = FIVE;
    render(<KitchenRulesAdmin />);
    fireEvent.click(cell("jog_max_in", "-edit"));
    fireEvent.click(screen.getByTestId("kitchen-rule-delete"));
    // The dialog asks first.
    expect(screen.getByText("Delete this rule?")).toBeTruthy();
    expect(saved.deleted).toHaveLength(0);
    // Cancel inside the confirm dialog only.
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(saved.deleted).toHaveLength(0);
  });

  it("deletes after the confirm", async () => {
    saved.rows = FIVE;
    render(<KitchenRulesAdmin />);
    fireEvent.click(cell("jog_max_in", "-edit"));
    fireEvent.click(screen.getByTestId("kitchen-rule-delete"));
    fireEvent.click(screen.getByText("Delete rule"));
    await waitFor(() => expect(saved.deleted).toHaveLength(1));
    expect(saved.deleted[0]).toMatchObject({ settingKey: "jog_max_in" });
  });

  it("offers no Delete control on a locked rule, and shows a lock instead", () => {
    saved.rows = FIVE;
    render(<KitchenRulesAdmin />);
    fireEvent.click(cell("faucet_at_sink_required", "-edit"));
    expect(screen.queryByTestId("kitchen-rule-delete")).toBeNull();
    expect(screen.getByTestId("kitchen-rule-delete-locked")).toBeTruthy();
    expect(screen.getByTestId("kitchen-rule-locked-note").textContent).toContain("cannot be switched off or deleted");
    // Its value is not editable either.
    expect((screen.getByTestId("kitchen-rule-toggle") as HTMLInputElement).disabled).toBe(true);
  });

  it("restores a deleted rule from Show deleted", async () => {
    saved.rows = [...FIVE, row({ settingKey: "narrow_cabinet_max_in", title: "Narrow cabinet", deletedAt: "2026-11-05T00:00:00.000Z", enabled: false })];
    render(<KitchenRulesAdmin />);
    // Hidden by default.
    expect(screen.queryByTestId("setting:narrow_cabinet_max_in")).toBeNull();
    fireEvent.click(screen.getByLabelText("Show deleted"));
    fireEvent.click(screen.getByTestId("setting:narrow_cabinet_max_in-restore"));
    await waitFor(() => expect(saved.restored).toHaveLength(1));
    expect(saved.restored[0]).toMatchObject({ settingKey: "narrow_cabinet_max_in" });
  });

  it("resets a rule to its default", async () => {
    saved.rows = FIVE;
    render(<KitchenRulesAdmin />);
    fireEvent.click(cell("wall_bottom_in", "-edit"));
    fireEvent.click(screen.getByTestId("kitchen-rule-reset"));
    await waitFor(() => expect(saved.reset).toHaveLength(1));
    expect(saved.reset[0]).toMatchObject({ settingKey: "wall_bottom_in" });
  });

  it("refuses to save a number outside what the rule allows", () => {
    saved.rows = FIVE;
    render(<KitchenRulesAdmin />);
    fireEvent.click(cell("jog_max_in", "-edit"));
    fireEvent.change(screen.getByTestId("kitchen-rule-value"), { target: { value: "99" } });
    expect(screen.getByText("That is outside the range this rule allows.")).toBeTruthy();
    expect((screen.getByTestId("kitchen-rule-save") as HTMLButtonElement).disabled).toBe(true);
  });

  it("labels a custom rule as guidance in its editor", () => {
    saved.rows = [
      ...FIVE,
      row({
        settingKey: "custom-leave-two-inches",
        title: "Leave 2 inches",
        category: "Guidance",
        valueType: "text",
        value: "Leave 2 inches of filler at a window.",
        defaultValue: "",
        isBuiltIn: false,
        executed: false,
      }),
    ];
    render(<KitchenRulesAdmin />);
    fireEvent.click(cell("custom-leave-two-inches", "-edit"));
    // Both the description line and the Kind cell say so; either is correct.
    expect(screen.getAllByText(/Guidance \(shown in plan review & AI prompt\)/).length).toBeGreaterThan(0);
  });
});

describe("when the settings table is missing", () => {
  it("explains which SQL to run and still shows the code defaults", () => {
    saved.rows = [];
    saved.isError = true;
    render(<KitchenRulesAdmin />);
    expect(screen.getByTestId("kitchen-rules-table-missing").textContent).toContain("0250_kitchen_rule_settings.tidb.sql");
    // The rules are still listed from the code registry, with their defaults.
    expect(cell("jog_max_in").textContent).toContain("3");
    expect((screen.getByTestId("kitchen-rules-add") as HTMLButtonElement).disabled).toBe(true);
  });
});
