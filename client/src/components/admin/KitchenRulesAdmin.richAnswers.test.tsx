// @vitest-environment jsdom
/**
 * Rich types his answer on each "Questions for Rich" card, and Tom always sees
 * a labeled Edit button on every rule row, even when the server cannot save.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  settingsError: null as null | { message: string },
  listError: null as null | { message: string },
  listRows: [] as Array<Record<string, unknown>>,
  updates: [] as Array<Record<string, unknown>>,
  saves: [] as Array<Record<string, unknown>>,
  failWith: null as null | string,
}));

vi.mock("@/lib/trpc", () => {
  const mutation = (onRun: (input: unknown) => void) => () => ({
    mutateAsync: async (input: unknown) => {
      if (state.failWith) throw new Error(state.failWith);
      onRun(input);
      return { ok: true };
    },
    isPending: false,
  });
  const query = (get: () => { data: unknown; error: null | { message: string } }) => () => {
    const { data, error } = get();
    return { data: error ? undefined : data, isLoading: false, isError: error != null, error, refetch: async () => undefined };
  };
  const kitchenRules = {
    settings: { useQuery: query(() => ({ data: [], error: state.settingsError })) },
    parameters: { useQuery: query(() => ({ data: { values: {} }, error: null })) },
    saveSetting: { useMutation: mutation((input) => state.saves.push(input as Record<string, unknown>)) },
    resetSetting: { useMutation: mutation(() => undefined) },
    createRule: { useMutation: mutation(() => undefined) },
    deleteRule: { useMutation: mutation(() => undefined) },
    restoreRule: { useMutation: mutation(() => undefined) },
    list: { useQuery: query(() => ({ data: state.listRows, error: state.listError })) },
    update: { useMutation: mutation((input) => state.updates.push(input as Record<string, unknown>)) },
  };
  return { trpc: { kitchenRules } };
});

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), message: vi.fn(), info: vi.fn() }),
}));

import KitchenRulesAdmin from "./KitchenRulesAdmin";
import { RICH_ANSWER_PROMPT } from "@/lib/kitchenRulesRichQuestions";


function storedRich(overrides: Record<string, unknown> = {}) {
  return {
    id: 4211,
    ruleCode: "rich-q-gap-in-run",
    category: "Questions for Rich",
    title: "A gap bigger than 3 inches in a run",
    ruleDescription: "NKBA: Silent on filler widths. Auto-Design today: stored text. Question for Rich: What do you put?",
    parameters: {},
    enforcementKind: "reference",
    sourceText: "NKBA planning guidelines, owner rules, question for Rich",
    implementationStatus: "reference",
    enabledFlag: true,
    notesText: RICH_ANSWER_PROMPT,
    readsParameters: false,
    updatedByName: null,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  state.settingsError = null;
  state.listError = null;
  state.listRows = [];
  state.updates = [];
  state.saves = [];
  state.failWith = null;
  window.localStorage.clear();
});

function openRich() {
  fireEvent.click(screen.getByTestId("kitchen-rules-rich-filter"));
}

describe("Questions for Rich: answers", () => {
  it("every question card has an Answer button", () => {
    render(<KitchenRulesAdmin />);
    openRich();
    const cards = screen.getAllByTestId(/^rich-question:rich-q-[a-z0-9-]+$/).filter((node) => node.tagName === "DIV");
    expect(cards.length).toBeGreaterThanOrEqual(18);
    for (const card of cards) {
      expect(within(card).getByRole("button", { name: /Answer/ })).toBeTruthy();
    }
  });

  it("saves the typed answer into that question's Notes and changes nothing else", async () => {
    state.listRows = [storedRich()];
    render(<KitchenRulesAdmin />);
    openRich();
    fireEvent.click(screen.getByTestId("rich-question:rich-q-gap-in-run-answer"));
    const editor = screen.getByTestId("rich-answer-editor");
    fireEvent.change(within(editor).getByTestId("rich-answer-text"), { target: { value: "  9 in spice base, widest filler 3 in.  " } });
    fireEvent.click(within(editor).getByTestId("rich-answer-save"));
    await waitFor(() => expect(state.updates).toHaveLength(1));
    expect(state.updates[0]).toEqual({
      id: 4211,
      title: "A gap bigger than 3 inches in a run",
      category: "Questions for Rich",
      ruleDescription: storedRich().ruleDescription,
      parameters: {},
      enforcementKind: "reference",
      sourceText: "NKBA planning guidelines, owner rules, question for Rich",
      enabledFlag: true,
      notesText: "9 in spice base, widest filler 3 in.",
    });
    // An answer is never a Designer setting.
    expect(state.saves).toHaveLength(0);
  });

  it("shows a saved answer on the card instead of the not-answered placeholder", () => {
    state.listRows = [storedRich({ notesText: "Wider filler up to 3 in, then a 9 in base." })];
    render(<KitchenRulesAdmin />);
    openRich();
    const card = screen.getByTestId("rich-question:rich-q-gap-in-run");
    expect(within(card).getByTestId("rich-question:rich-q-gap-in-run-saved").textContent).toContain("Wider filler up to 3 in");
    expect(card.textContent).not.toContain("(not answered yet)");
    expect(within(card).getByRole("button", { name: /Edit answer/ })).toBeTruthy();
  });

  it("Save is on when the API answers, with no 'not switched on' message and no keep-local button", () => {
    state.listRows = [storedRich()];
    render(<KitchenRulesAdmin />);
    openRich();
    expect(screen.queryByText(/not switched on/i)).toBeNull();
    fireEvent.click(screen.getByTestId("rich-question:rich-q-gap-in-run-answer"));
    const editor = screen.getByTestId("rich-answer-editor");
    fireEvent.change(within(editor).getByTestId("rich-answer-text"), { target: { value: "Spice base." } });
    expect((within(editor).getByTestId("rich-answer-save") as HTMLButtonElement).disabled).toBe(false);
    expect(within(editor).queryByTestId("rich-answer-keep-local")).toBeNull();
    expect(within(editor).queryByTestId("rich-answer-save-blocked")).toBeNull();
  });

  it("a failed save shows the server's real error and only then offers to keep the answer on this computer", async () => {
    state.listRows = [storedRich()];
    state.failWith = "You do not have required permission (10002)";
    render(<KitchenRulesAdmin />);
    openRich();
    fireEvent.click(screen.getByTestId("rich-question:rich-q-gap-in-run-answer"));
    const editor = screen.getByTestId("rich-answer-editor");
    fireEvent.change(within(editor).getByTestId("rich-answer-text"), { target: { value: "30 in on gas." } });
    fireEvent.click(within(editor).getByTestId("rich-answer-save"));
    await waitFor(() => expect(screen.getByTestId("rich-answer-save-error").textContent).toContain("You do not have required permission (10002)"));
    fireEvent.click(screen.getByTestId("rich-answer-keep-local"));
    const saved = screen.getByTestId("rich-question:rich-q-gap-in-run-saved");
    expect(saved.textContent).toContain("30 in on gas.");
    expect(saved.textContent).toContain("kept on this computer only");
  });

  it("asks for the 0233/0238 SQL when the API works but the question has no row", () => {
    state.listRows = [];
    render(<KitchenRulesAdmin />);
    openRich();
    fireEvent.click(screen.getByTestId("rich-question:rich-q-corners-answer"));
    expect(screen.getByTestId("rich-answer-save-blocked").textContent).toContain("0238_kitchen_rules_questions_for_rich.tidb.sql");
  });
});

describe("Edit button on the rules list", () => {
  it("every rule row has a labeled Edit button, in a column pinned to the right", () => {
    render(<KitchenRulesAdmin />);
    const button = screen.getByTestId("setting:jog_max_in-edit");
    expect(button.textContent).toContain("Edit");
    expect(button.closest("td")?.className).toContain("sticky");
    expect(screen.getByTestId("kitchen-rules-edit-hint")).toBeTruthy();
  });

  it("Save, Reset and Delete are enabled, and a failed save shows the real error in the dialog", async () => {
    render(<KitchenRulesAdmin />);
    expect(screen.queryByText(/not switched on|no Kitchen Rules save API/i)).toBeNull();
    fireEvent.click(screen.getByTestId("setting:jog_max_in-edit"));
    expect((screen.getByTestId("kitchen-rule-save") as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByTestId("kitchen-rule-reset") as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByTestId("kitchen-rule-delete") as HTMLButtonElement).disabled).toBe(false);
    state.failWith = "That is outside the range this rule allows";
    fireEvent.click(screen.getByTestId("kitchen-rule-save"));
    await waitFor(() => expect(screen.getByTestId("kitchen-rule-save-error").textContent).toContain("That is outside the range this rule allows"));
    expect(state.saves).toHaveLength(0);
  });

  it("a load error shows the server's message, not a missing-API message", () => {
    state.settingsError = { message: "You do not have required permission (10002)" };
    render(<KitchenRulesAdmin />);
    expect(screen.getByTestId("kitchen-rules-load-error").textContent).toContain("You do not have required permission (10002)");
    expect(screen.queryByTestId("kitchen-rules-table-missing")).toBeNull();
  });
});
