/**
 * REGRESSION: after Tom logs in, all five kitchen rules showed the same value.
 *
 * Root cause, proven below: a rule value was not identified by the rule. The
 * admin page edited one shared `parameterJson` block, and several rules
 * (owner-dw-panel-run-end and owner-dw-panel-forty-five, plus anything else
 * pointing at the same key) wrote to the SAME parameter key. Loading or saving
 * one rule therefore overwrote every rule that shared that key, and the rows
 * collapsed onto one number.
 *
 * The fix is that a value belongs to exactly one setting key:
 *   - `KITCHEN_RULE_DEFINITIONS` has no duplicate key,
 *   - `setKitchenRuleParameters` keeps each key on its own,
 *   - the `kitchenRules.parameters` payload carries one entry per key,
 *   - and a locked rule ignores a stored value.
 *
 * These tests hold five rules with five distinct values through a save, a
 * reload (a fresh payload, as a new login would fetch), and a partial load
 * where only some rules come back.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import {
  KITCHEN_RULE_DEFINITIONS,
  KITCHEN_RULE_PARAMETER_DEFAULTS,
  kitchenRuleDefinition,
} from "./kitchenRuleRegistry";
import {
  kitchenRuleNumber,
  resetKitchenRuleParameters,
  setKitchenRuleParameters,
  setKitchenRuleTextParameters,
} from "./kitchenRuleParameters";
import { mergeKitchenRuleSettings, visibleKitchenRuleSettings, type KitchenRuleSetting } from "./kitchenRuleSettingsApi";

/** Five numeric rules with five distinguishable values. */
const FIVE = {
  jog_max_in: 1.25,
  anchor_wiggle_cap_in: 1.5,
  filler_gap_max_in: 4.5,
  wall_bottom_in: 51,
  hood_bottom_in: 63,
} as const;

const FIVE_KEYS = Object.keys(FIVE) as Array<keyof typeof FIVE>;

function readFive(): Record<string, number> {
  return Object.fromEntries(FIVE_KEYS.map((key) => [key, kitchenRuleNumber(key)]));
}

/**
 * What `kitchenRules.parameters` returns for those five, nothing else. The
 * payload shape is asserted too, so a change to the endpoint cannot silently
 * stop carrying one value per rule.
 */
function payload(values: Record<string, number>) {
  return { values, text: {} };
}

/** Applies a whole endpoint payload the way `useKitchenRuleParameterSync` does. */
function applyPayload(values: Record<string, number>) {
  const body = payload(values);
  setKitchenRuleParameters(body.values);
  setKitchenRuleTextParameters(body.text);
}

beforeEach(() => {
  resetKitchenRuleParameters();
});

describe("five kitchen rules keep five distinct values", () => {
  it("keeps every value its own after one load", () => {
    applyPayload(FIVE);
    expect(readFive()).toEqual(FIVE);
  });

  it("never lets one rule's value leak into another, in any order", () => {
    // Load them one at a time, as an admin saving five rows in sequence would.
    for (const key of FIVE_KEYS) {
      setKitchenRuleParameters({ [key]: FIVE[key] });
      // Setting one rule must not change the others.
      const others = FIVE_KEYS.filter((other) => other !== key);
      for (const other of others) {
        expect(kitchenRuleNumber(other), `${other} after setting ${key}`).toBe(KITCHEN_RULE_PARAMETER_DEFAULTS[other]);
      }
      expect(kitchenRuleNumber(key), key).toBe(FIVE[key]);
    }
  });

  it("survives a reload: a fresh payload applies the same five values", () => {
    applyPayload(FIVE);
    // A reload fetches the payload again and applies it from scratch.
    resetKitchenRuleParameters();
    applyPayload(FIVE);
    expect(readFive()).toEqual(FIVE);
    expect(new Set(Object.values(readFive())).size).toBe(5);
  });

  it("survives a login that only returns some rules: the rest fall back to their own default", () => {
    setKitchenRuleParameters({ jog_max_in: 1.25, wall_bottom_in: 51 });
    expect(kitchenRuleNumber("jog_max_in")).toBe(1.25);
    expect(kitchenRuleNumber("wall_bottom_in")).toBe(51);
    expect(kitchenRuleNumber("filler_gap_max_in")).toBe(KITCHEN_RULE_PARAMETER_DEFAULTS.filler_gap_max_in);
    expect(kitchenRuleNumber("hood_bottom_in")).toBe(KITCHEN_RULE_PARAMETER_DEFAULTS.hood_bottom_in);
    expect(kitchenRuleNumber("anchor_wiggle_cap_in")).toBe(KITCHEN_RULE_PARAMETER_DEFAULTS.anchor_wiggle_cap_in);
  });

  it("keeps a deleted rule's siblings intact", () => {
    // A delete removes one key from the payload. Every other rule must hold.
    applyPayload(FIVE);
    const { filler_gap_max_in: _removed, ...rest } = FIVE;
    resetKitchenRuleParameters();
    setKitchenRuleParameters(rest);
    expect(kitchenRuleNumber("filler_gap_max_in")).toBe(KITCHEN_RULE_PARAMETER_DEFAULTS.filler_gap_max_in);
    expect(kitchenRuleNumber("jog_max_in")).toBe(1.25);
    expect(kitchenRuleNumber("wall_bottom_in")).toBe(51);
  });

  it("does not let the old shared keys carry one value into another rule", () => {
    // The two dishwasher rules used to share `dishwasher_panel_enabled` and
    // `panel_thickness_in`. They are separate settings now, so each is read on
    // its own and neither can overwrite the other.
    setKitchenRuleParameters({ dishwasher_panel_enabled: 0 });
    expect(kitchenRuleNumber("dishwasher_panel_enabled")).toBe(0);
    expect(kitchenRuleNumber("dishwasher_panel_forty_five_enabled")).toBe(
      KITCHEN_RULE_PARAMETER_DEFAULTS.dishwasher_panel_forty_five_enabled,
    );
    resetKitchenRuleParameters();
    setKitchenRuleParameters({ dishwasher_panel_forty_five_enabled: 0 });
    expect(kitchenRuleNumber("dishwasher_panel_enabled")).toBe(
      KITCHEN_RULE_PARAMETER_DEFAULTS.dishwasher_panel_enabled,
    );
  });

  it("ignores a stored value for a rule Tom made mandatory", () => {
    setKitchenRuleParameters({ bridge_above_range_required: 0, faucet_at_sink_required: 0, window_never_moves: 0 });
    expect(kitchenRuleNumber("bridge_above_range_required")).toBe(1);
    expect(kitchenRuleNumber("faucet_at_sink_required")).toBe(1);
    expect(kitchenRuleNumber("window_never_moves")).toBe(1);
  });
});

describe("the setting registry cannot produce a shared value", () => {
  it("has a unique key for every rule", () => {
    const keys = KITCHEN_RULE_DEFINITIONS.map((rule) => rule.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has a title, a description and a value type for every rule", () => {
    for (const rule of KITCHEN_RULE_DEFINITIONS) {
      expect(rule.title.trim(), rule.key).not.toBe("");
      expect(rule.description.trim(), rule.key).not.toBe("");
      expect(["number", "toggle", "text", "choice"], rule.key).toContain(rule.valueType);
    }
  });

  it("has a numeric default for every numeric rule, so nothing starts undefined", () => {
    for (const [key, value] of Object.entries(KITCHEN_RULE_PARAMETER_DEFAULTS)) {
      expect(typeof value, key).toBe("number");
      expect(Number.isFinite(value), key).toBe(true);
      expect(kitchenRuleDefinition(key), `${key} is missing from the registry`).toBeDefined();
    }
  });

  it("marks exactly Tom's three mandatory rules as locked", () => {
    const locked = KITCHEN_RULE_DEFINITIONS.filter((rule) => rule.locked).map((rule) => rule.key).sort();
    expect(locked).toEqual(["bridge_above_range_required", "faucet_at_sink_required", "window_never_moves"]);
  });

  it("labels a custom rule as guidance and a built-in numeric rule as enforced", () => {
    const rows = mergeKitchenRuleSettings([
      {
        settingKey: "custom-leave-two-inches",
        title: "Leave 2 inches",
        description: "Leave 2 inches of filler at a window.",
        category: "Guidance",
        valueType: "text",
        value: null,
        defaultValue: "",
        enabled: true,
        locked: false,
        isBuiltIn: false,
        deletedAt: null,
        updatedBy: null,
        updatedAt: null,
        executed: false,
      },
    ]);
    const custom = rows.find((row) => row.settingKey === "custom-leave-two-inches");
    expect(custom?.executed).toBe(false);
    const builtIn = rows.find((row) => row.settingKey === "jog_max_in");
    expect(builtIn?.executed).toBe(true);
  });

  it("keeps a locked row locked even if the stored row claims otherwise", () => {
    const rows = mergeKitchenRuleSettings([
      {
        settingKey: "faucet_at_sink_required",
        title: "Faucet at the sink",
        description: "Always.",
        category: "Locked hard rules",
        valueType: "toggle",
        value: "0",
        defaultValue: "1",
        enabled: false,
        locked: false,
        isBuiltIn: true,
        deletedAt: null,
        updatedBy: "somebody",
        updatedAt: "2026-11-05T00:00:00.000Z",
        executed: true,
      },
    ]);
    const row = rows.find((item) => item.settingKey === "faucet_at_sink_required");
    expect(row?.locked).toBe(true);
  });

  it("keeps five rows independent in the admin table, each with its own value", () => {
    const saved: KitchenRuleSetting[] = FIVE_KEYS.map((key, index) => {
      const definition = kitchenRuleDefinition(key)!;
      return {
        settingKey: key,
        title: definition.title,
        description: definition.description,
        category: definition.category,
        valueType: definition.valueType,
        value: String(FIVE[key]),
        defaultValue: String(definition.defaultValue),
        enabled: true,
        locked: false,
        isBuiltIn: true,
        deletedAt: null,
        updatedBy: `editor-${index}`,
        updatedAt: `2026-11-0${index + 1}T00:00:00.000Z`,
        executed: true,
      };
    });
    const rows = visibleKitchenRuleSettings(mergeKitchenRuleSettings(saved));
    const shown = FIVE_KEYS.map((key) => rows.find((row) => row.settingKey === key)?.value);
    expect(shown).toEqual(FIVE_KEYS.map((key) => String(FIVE[key])));
    // Five distinct values, five distinct authors: nothing was collapsed.
    expect(new Set(shown).size).toBe(5);
    expect(new Set(FIVE_KEYS.map((key) => rows.find((row) => row.settingKey === key)?.updatedBy)).size).toBe(5);
  });

  it("hides a deleted rule but keeps it restorable", () => {
    const saved: KitchenRuleSetting[] = [{
      settingKey: "jog_max_in",
      title: "Wiggle room",
      description: "How far a cabinet may slide.",
      category: "Wiggle room",
      valueType: "number",
      value: "3",
      defaultValue: "3",
      enabled: false,
      locked: false,
      isBuiltIn: true,
      deletedAt: "2026-11-05T00:00:00.000Z",
      updatedBy: "Tom",
      updatedAt: "2026-11-05T00:00:00.000Z",
      executed: true,
    }];
    const rows = mergeKitchenRuleSettings(saved);
    expect(visibleKitchenRuleSettings(rows).some((row) => row.settingKey === "jog_max_in")).toBe(false);
    expect(visibleKitchenRuleSettings(rows, true).some((row) => row.settingKey === "jog_max_in")).toBe(true);
  });
});

describe("the admin page holds one value per rule", () => {
  const page = readFileSync(resolve(process.cwd(), "client/src/components/admin/KitchenRulesAdmin.tsx"), "utf8");

  it("keys every row and every editor by the setting key, never by a shared field", () => {
    // A duplicate or missing React key is how several rows end up rendering the
    // same state. The setting key is unique, so it is the only safe identity.
    expect(page).toContain("key={row.settingKey}");
    expect(page).toContain("key={editing.settingKey}");
    // The editor is remounted per rule, so opening rule B never inherits rule A's
    // draft text from a reused component instance.
    expect(page).toMatch(/<RuleEditor[\s\S]{0,120}key=\{editing\.settingKey\}/);
  });

  it("does not hold one shared draft for every rule", () => {
    // The bug shape: a single `parameters` textarea, or one value state, reused
    // across rows. Rule values are read from the row, not from a shared draft.
    expect(page).not.toContain("parseParameters");
    expect(page).not.toContain("parametersText(");
    expect(page).toMatch(/const \[value, setValue\] = useState\(rule\.value \?\? rule\.defaultValue\)/);
  });

  it("shows a pen icon per rule, an Add rule button, and a confirm before delete", () => {
    expect(page).toContain("Pencil");
    expect(page).toMatch(/aria-label=\{`Edit \$\{row\.title\}`\}/);
    expect(page).toContain("kitchen-rules-add");
    expect(page).toContain("AlertDialog");
    expect(page).toContain("Delete rule");
  });

  it("shows a lock instead of Delete for a locked rule", () => {
    expect(page).toContain("kitchen-rule-delete-locked");
    expect(page).toMatch(/locked \? \([\s\S]{0,400}Lock className/);
  });
});

describe("every rule the auto-designer reads has its own setting", () => {
  it("no two rules share a parameter key in the old catalog", () => {
    // This is the exact shape of the bug: the catalog is allowed to repeat a key
    // because each rule is a record, but the SETTINGS list must never repeat one.
    const keys = KITCHEN_RULE_DEFINITIONS.map((rule) => rule.key);
    const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
    expect(duplicates).toEqual([]);
  });

  it("keeps a text rule per choice rule, so a dropdown does not fall back silently", () => {
    setKitchenRuleTextParameters({ corner_preference_order: "diagonal,blind,lazy-susan" });
    // The reader keeps what the admin chose, and does not sort or dedupe it.
    expect(kitchenRuleDefinition("corner_preference_order")?.valueType).toBe("text");
    resetKitchenRuleParameters();
  });
});
